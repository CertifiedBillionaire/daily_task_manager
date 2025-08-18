# tpt_processor.py
import pandas as pd
import numpy as np # Used for handling NaN values if needed

# --- NEW: small helpers + light imports (kept in this file for now; easy to move later) ---
from datetime import datetime, timedelta
from pathlib import Path
import os, json, sqlite3
import re

# Column aliases so we can normalize whatever corp names the sheet uses
COLUMN_ALIASES = {
    'TICKETS': 'TICKETS_CLEAN',
    'TICKETS\n': 'TICKETS_CLEAN',
    'TOTAL TICKETS': 'TICKETS_CLEAN',
    'Total Tickets': 'TICKETS_CLEAN',

    'Total Plays': 'PLAYS_CLEAN',
    'Plays': 'PLAYS_CLEAN',
    'Plays\n': 'PLAYS_CLEAN',

    'TPT': 'TPT_INDIVIDUAL_CLEAN',
    'TPP': 'TPT_INDIVIDUAL_CLEAN',
    'TPT\n': 'TPT_INDIVIDUAL_CLEAN',

    'Game': 'GAME_CLEAN',
    'Game\n': 'GAME_CLEAN',
    'Machine Name': 'GAME_CLEAN',

    'Profile': 'PROFILE_CLEAN',
    'Profile\n': 'PROFILE_CLEAN',

    # --- NEW ALIASES ---
    'Total Plays ': 'PLAYS_CLEAN',
    'Tickets Dispensed': 'TICKETS_CLEAN',
    'Tickets': 'TICKETS_CLEAN',
    'Tickets  ': 'TICKETS_CLEAN',
    'Tickets Per Play': 'TPT_INDIVIDUAL_CLEAN',
    'Tix/Play': 'TPT_INDIVIDUAL_CLEAN',
    'Machine Title': 'GAME_CLEAN',
    'Title': 'GAME_CLEAN',
}

# Canonical names we use internally
TICKETS = 'TICKETS_CLEAN'
PLAYS = 'PLAYS_CLEAN'
TPT = 'TPT_INDIVIDUAL_CLEAN'
GAME = 'GAME_CLEAN'
PROFILE = 'PROFILE_CLEAN'

# Birthday Blaster and friends (can be expanded later via settings)
BB_NAMES = ['BIRTHDAY BLASTER P1']

def _read_any(file_path: str, file_type: str, forced_header_row: int | None = None) -> pd.DataFrame:
    """Read CSV/Excel by type."""
    if file_type == 'csv':
        return pd.read_csv(file_path, sep=',')
    elif file_type == 'excel':
        if forced_header_row is not None:
            return pd.read_excel(file_path, header=forced_header_row)
        return _read_excel_autoheader(file_path)
    raise ValueError("Unsupported file type provided. Please upload .csv or .xlsx.")


# --- Helper: Read Excel and auto-detect header row ---
def _read_excel_autoheader(file_path: str) -> pd.DataFrame:
    """Read Excel and auto-detect the header row; if many 'Unnamed' columns result, try a 2-row header and flatten."""
    try:
        preview = pd.read_excel(file_path, header=None, nrows=25)
    except Exception:
        return pd.read_excel(file_path)

    header_row = None

    def row_hits(vals):
        s = "|".join([str(v) for v in vals])
        s_low = s.lower()
        score = 0
        if ("game" in s_low) or ("machine" in s_low) or ("title" in s_low):
            score += 1
        if "play" in s_low:
            score += 1
        if "ticket" in s_low:
            score += 1
        if ("tpt" in s_low) or ("tpp" in s_low) or ("tickets per play" in s_low) or ("tix/play" in s_low):
            score += 1
        return score

    for i in range(min(25, len(preview))):
        vals = preview.iloc[i].tolist()
        if all((str(v).strip() == '') or str(v).lower().startswith('unnamed') for v in vals):
            continue
        if row_hits(vals) >= 2:
            header_row = i
            break

    def _flatten_cols(cols):
        new_cols = []
        for col in cols:
            if isinstance(col, tuple):
                a, b = (str(col[0]).strip(), str(col[1]).strip())
                # prefer b if it's not Unnamed/blank, else a
                name = b if (b and not b.lower().startswith('unnamed')) else a
            else:
                name = str(col).strip()
            new_cols.append(name)
        return new_cols

    # First attempt: single-row header
    try:
        if header_row is not None:
            df = pd.read_excel(file_path, header=header_row)
        else:
            df = pd.read_excel(file_path)
    except Exception:
        df = pd.read_excel(file_path)

    # If we got too many Unnamed columns, try 2-row header and flatten
    unnamed_ratio = sum(1 for c in df.columns if str(c).lower().startswith('unnamed')) / max(1, len(df.columns))
    if unnamed_ratio > 0.3:  # heuristic
        try:
            if header_row is not None:
                df2 = pd.read_excel(file_path, header=[header_row, header_row + 1])
            else:
                df2 = pd.read_excel(file_path, header=[0, 1])
            df2.columns = _flatten_cols(df2.columns)
            df = df2
        except Exception:
            pass

    return df

def _normalize_headers(df: pd.DataFrame, user_map: dict | None = None) -> pd.DataFrame:
    """Strip whitespace/newlines and map to our canonical columns."""
    df = df.copy()
    # Apply user-provided column mapping first (exact name match)
    if user_map:
        rename_map = {}
        # user_map is expected like {'tickets': 'ColNameA', 'plays': 'ColNameB', 'game': 'ColNameC', 'tpt': 'ColNameD'}
        for key, colname in user_map.items():
            if not colname:
                continue
            if colname in df.columns:
                if key == 'tickets':
                    rename_map[colname] = TICKETS
                elif key == 'plays':
                    rename_map[colname] = PLAYS
                elif key == 'tpt':
                    rename_map[colname] = TPT
                elif key == 'game':
                    rename_map[colname] = GAME
                elif key == 'profile':
                    rename_map[colname] = PROFILE
        if rename_map:
            df.rename(columns=rename_map, inplace=True)
    # Drop columns that are entirely NaN and named 'Unnamed:*'
    keep_cols = []
    for c in df.columns:
        name = str(c)
        if name.lower().startswith('unnamed') and df[c].isna().all():
            continue
        keep_cols.append(c)
    if len(keep_cols) != len(df.columns):
        df = df[keep_cols]

    # Clean header strings
    df.columns = (df.columns
                  .map(lambda x: str(x))
                  .str.strip()
                  .str.replace('\n', '', regex=False)
                  .str.replace('\r', '', regex=False)
                  .str.replace('  ', ' ', regex=False))

    # First pass: direct aliases
    df.rename(columns=COLUMN_ALIASES, inplace=True, errors='ignore')

    # Second pass: soft mapping (case/space/punct insensitive contains checks)
    canonical_map = {}
    for col in df.columns:
        if col in (TICKETS, PLAYS, TPT, GAME, PROFILE):
            continue  # already mapped by alias
        norm = re.sub(r'[^a-z0-9]', '', str(col).lower())
        # detect GAME
        if any(k in norm for k in ('game', 'machinename', 'machinetitle', 'title', 'gamename')):
            canonical_map[col] = GAME
            continue
        # detect PLAYS
        if 'play' in norm:
            canonical_map[col] = PLAYS
            continue
        # detect TICKETS (total tickets dispensed; avoid tpt)
        if 'ticket' in norm and 'per' not in norm and 'tpt' not in norm and 'tpp' not in norm:
            canonical_map[col] = TICKETS
            continue
        # detect TPT (tickets per play)
        if 'tpt' in norm or 'tpp' in norm or 'ticketsperplay' in norm or 'tixplay' in norm:
            canonical_map[col] = TPT
            continue
        # detect PROFILE
        if 'profile' in norm:
            canonical_map[col] = PROFILE
            continue
    if canonical_map:
        df.rename(columns=canonical_map, inplace=True)

    # Ensure PROFILE exists for display
    if PROFILE not in df.columns:
        df[PROFILE] = "N/A"
    return df

def _require_columns(df: pd.DataFrame):
    """Require only the columns needed for overall average (Tickets + Plays)."""
    needed = [TICKETS, PLAYS]
    missing = [c for c in needed if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns after normalization: {missing}. Available: {list(df.columns)}")

def _to_numeric_and_dropna(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce numerics and drop rows without essentials (Tickets/Plays). TPT is optional."""
    df = df.copy()
    if TICKETS in df.columns:
        df[TICKETS] = pd.to_numeric(df[TICKETS], errors='coerce')
    if PLAYS in df.columns:
        df[PLAYS] = pd.to_numeric(df[PLAYS], errors='coerce')
    if TPT in df.columns:
        df[TPT] = pd.to_numeric(df[TPT], errors='coerce')
    # Replace inf with NaN then drop rows missing essentials
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    subset = [c for c in (TICKETS, PLAYS) if c in df.columns]
    if subset:
        df.dropna(subset=subset, inplace=True)
    return df

def _overall_tpt(df: pd.DataFrame) -> float:
    """Compute overall TPT as total tickets / total plays, rounded to 2 decimals.
    Safe against missing columns or non-numeric values.
    """
    try:
        if TICKETS not in df.columns or PLAYS not in df.columns:
            return 0.0
        tickets = pd.to_numeric(df[TICKETS], errors='coerce')
        plays = pd.to_numeric(df[PLAYS], errors='coerce')
        total_tickets = float(tickets.sum(skipna=True))
        total_plays = float(plays.sum(skipna=True))
        if total_plays <= 0:
            return 0.0
        return round(total_tickets / total_plays, 2)
    except Exception:
        return 0.0

def _split_bb(df: pd.DataFrame):
    """Return (bb_df, non_bb_df) based on GAME names."""
    bb_df = df[df[GAME].isin(BB_NAMES)]
    non_bb_df = df[~df[GAME].isin(BB_NAMES)]
    return bb_df, non_bb_df

def _out_of_range(df: pd.DataFrame, low: float, high: float):
    """Return below_df, above_df, combined_df with out-of-range games."""
    below_df = df[df[TPT] < low]
    above_df = df[df[TPT] > high]
    combined = pd.concat([below_df, above_df], axis=0)
    return below_df, above_df, combined

def _individual_rows(df: pd.DataFrame):
    """Return list of dicts for table display, sorted by GameName. Computes per-row TPT if needed."""
    rows = []
    # Prepare series safely
    profile_s = df[PROFILE] if PROFILE in df.columns else pd.Series(["N/A"] * len(df))
    game_s = df[GAME] if GAME in df.columns else pd.Series([""] * len(df))
    tickets_s = pd.to_numeric(df[TICKETS], errors='coerce') if TICKETS in df.columns else pd.Series([None] * len(df))
    plays_s = pd.to_numeric(df[PLAYS], errors='coerce') if PLAYS in df.columns else pd.Series([None] * len(df))

    if TPT in df.columns:
        tpt_s = pd.to_numeric(df[TPT], errors='coerce')
    else:
        # compute per-row TPT if both tickets and plays exist
        with pd.option_context('mode.use_inf_as_na', True):
            tpt_s = (tickets_s / plays_s).round(2)

    for prof, game, tpt, tix, pls in zip(profile_s.fillna("N/A"), game_s.fillna(""), tpt_s, tickets_s, plays_s):
        rows.append({
            'Profile': None if pd.isna(prof) else str(prof),
            'GameName': None if pd.isna(game) else str(game),
            'TPTIndividual': None if pd.isna(tpt) else float(tpt),
            'TotalTickets': None if pd.isna(tix) else float(tix),
            'TotalPlays': None if pd.isna(pls) else float(pls),
        })
    return sorted(rows, key=lambda x: x.get('GameName', '') or '')

# --- DB helpers (defined now, wired later) ---
def ensure_tpt_tables(db_path: str = 'app.db'):
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tpt_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                avg_all REAL,
                below_count INTEGER,
                above_count INTEGER,
                json_path TEXT
            );
        """)
        conn.commit()
    finally:
        conn.close()

def save_tpt_report(avg_all: float | None, below_count: int, above_count: int, json_path: str, db_path: str = 'app.db'):
    ensure_tpt_tables(db_path)
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO tpt_reports (created_at, avg_all, below_count, above_count, json_path) VALUES (?, ?, ?, ?, ?)",
            (datetime.utcnow().isoformat(timespec='seconds') + 'Z', avg_all if isinstance(avg_all, (int, float)) else None, int(below_count), int(above_count), json_path)
        )
        conn.commit()
    finally:
        conn.close()

def prune_old_reports(days: int = 90, db_path: str = 'app.db', reports_dir: str = 'data/tpt_reports'):
    """Delete reports older than N days from DB and disk."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    # prune DB rows
    conn = sqlite3.connect(db_path)
    old_paths = []
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, created_at, json_path FROM tpt_reports")
        for rid, created_at, jpath in cur.fetchall():
            try:
                created = datetime.fromisoformat(created_at.replace('Z',''))
            except Exception:
                continue
            if created < cutoff:
                old_paths.append((rid, jpath))
        # delete old rows
        for rid, _ in old_paths:
            cur.execute("DELETE FROM tpt_reports WHERE id=?", (rid,))
        conn.commit()
    finally:
        conn.close()
    # prune files
    for _, jpath in old_paths:
        try:
            if jpath and os.path.isfile(jpath):
                os.remove(jpath)
        except Exception:
            pass

def calculate_tpt_data_OLD(file_path, file_type, lowest_tpt_threshold, highest_tpt_threshold, include_birthday_blaster_flag, original_filename):
    """
    Reads a TPT data file (CSV/Excel), performs calculations, and returns results.
    ASSUMES THE HEADER ROW IS ALWAYS ON THE FIRST ROW OF THE UPLOADED FILE
    (i.e., any leading descriptive rows have been manually removed by the user).

    Args:
        file_path (str): The path to the uploaded file.
        file_type (str): 'csv' or 'excel'.
        lowest_tpt_threshold (float): The lower bound for TPT range.
        highest_tpt_threshold (float): The upper bound for TPT range.
        include_birthday_blaster_flag (bool): True if BB games should be included in total TPT average.
        original_filename (str): The original filename (used for messaging, not skiprows logic).

    Returns:
        dict: A dictionary containing calculated TPT metrics.
              Returns an error dictionary if required columns are missing or processing fails.
    """
    try:
        if file_type == 'csv':
            df = pd.read_csv(file_path, sep=',')
        elif file_type == 'excel':
            df = pd.read_excel(file_path)
        else:
            raise ValueError("Unsupported file type provided. Please upload .csv or .xlsx.")

        # --- IMPORTANT: CLEAN COLUMN NAMES IMMEDIATELY AFTER READING ---
        df.columns = df.columns.str.strip().str.replace('\n', '').str.replace('\r', '')
        df.columns = df.columns.str.replace('  ', ' ')


        # --- COLUMN MAPPING FOR FAIL-SAFES (YOUR CUSTOMIZABLE PART!) ---
        column_mapping = {
            'TICKETS': 'TICKETS_CLEAN',
            'TICKETS\n': 'TICKETS_CLEAN',
            'TOTAL TICKETS': 'TICKETS_CLEAN',

            'Total Plays': 'PLAYS_CLEAN',
            'Plays': 'PLAYS_CLEAN',
            'Plays\n': 'PLAYS_CLEAN',

            'TPT': 'TPT_INDIVIDUAL_CLEAN',
            'TPP': 'TPT_INDIVIDUAL_CLEAN',
            'TPT\n': 'TPT_INDIVIDUAL_CLEAN',

            'Game': 'GAME_CLEAN',
            'Game\n': 'GAME_CLEAN',
            'Machine Name': 'GAME_CLEAN',

            'Profile': 'PROFILE_CLEAN',
            'Profile\n': 'PROFILE_CLEAN',
        }

        df.rename(columns=column_mapping, inplace=True, errors='ignore')

        # --- Internal Clean Column Names (Your code will always use these) ---
        tickets_col = 'TICKETS_CLEAN'
        plays_col = 'PLAYS_CLEAN'
        individual_tpt_col = 'TPT_INDIVIDUAL_CLEAN'
        game_col = 'GAME_CLEAN'

        # --- Define Birthday Blaster Identification (by Game Name) ---
        bb_game_names = ['BIRTHDAY BLASTER P1'] # <<< IMPORTANT: ADJUST THIS LIST with ALL your actual BB game names!

        # --- Data Cleaning and Validation (after cleaning and mapping headers) ---
        required_cols = [tickets_col, plays_col, individual_tpt_col, game_col]
        # Check for 'PROFILE_CLEAN' if it's required for logic, otherwise it's optional for display
        if 'PROFILE_CLEAN' not in df.columns:
            # If Profile column is missing, create it and fill with "N/A" or empty string
            df['PROFILE_CLEAN'] = "N/A"
            print("Warning: 'Profile' column not found in data. Filling with 'N/A'.")


        for col in required_cols:
            if col not in df.columns:
                return {"error": f"Required column '{col}' not found after cleaning and mapping. "
                                 f"Please ensure your Excel/CSV has the correct column headers (case-sensitive) and has been pre-cleaned. "
                                 f"Available columns (after cleaning): {list(df.columns)}"}

        # Convert numerical columns to numeric, coercing errors to NaN
        df[tickets_col] = pd.to_numeric(df[tickets_col], errors='coerce')
        df[plays_col] = pd.to_numeric(df[plays_col], errors='coerce')
        df[individual_tpt_col] = pd.to_numeric(df[individual_tpt_col], errors='coerce')

        # Drop rows where critical numerical data is missing
        df.dropna(subset=[tickets_col, plays_col, individual_tpt_col], inplace=True)

        if df.empty:
            return {"error": "No valid data found after cleaning. Ensure columns have numbers and no empty rows."}

        # --- Perform Calculations ---

        # 1. Total Game Room TPT Average (Tickets / Plays), adjusted based on Birthday Blaster toggle
        df_for_total_average = df.copy() # Start with a copy of the full DataFrame

        if not include_birthday_blaster_flag:
            # If BB is NOT included, filter it out for the total average calculation
            df_for_total_average = df_for_total_average[~df_for_total_average[game_col].isin(bb_game_names)]
            message_suffix = " (excluding Birthday Blaster)"
        else:
            message_suffix = " (including Birthday Blaster)" # This will be the default message

        total_tickets_for_average = df_for_total_average[tickets_col].sum()
        total_plays_for_average = df_for_total_average[plays_col].sum()

        total_game_room_tpt_average = "N/A"
        if total_plays_for_average > 0:
            total_game_room_tpt_average = round(total_tickets_for_average / total_plays_for_average, 2)

        # 2. Games Out of Range (based on individual TPT and dynamic thresholds)
        games_out_of_range_df = df[
            (df[individual_tpt_col] < lowest_tpt_threshold) | # Use dynamic lowest threshold
            (df[individual_tpt_col] > highest_tpt_threshold)  # Use dynamic highest threshold
        ]
        games_out_of_range_count = games_out_of_range_df.shape[0]
        games_out_of_range_names = games_out_of_range_df[game_col].tolist()


        # 3. TPT with/without Birthday Blaster (ALWAYS CALCULATE BOTH FOR DISPLAY)
        tpt_with_blaster_val = "N/A"
        tpt_without_blaster_val = "N/A"

        blaster_df = df[df[game_col].isin(bb_game_names)]
        non_blaster_df = df[~df[game_col].isin(bb_game_names)]

        if not blaster_df.empty and blaster_df[plays_col].sum() > 0:
            tpt_with_blaster_val = round(blaster_df[tickets_col].sum() / blaster_df[plays_col].sum(), 2)

        if not non_blaster_df.empty and non_blaster_df[plays_col].sum() > 0:
            tpt_without_blaster_val = round(non_blaster_df[tickets_col].sum() / non_blaster_df[plays_col].sum(), 2)
            
        # --- NEW: Prepare individual game data for the table display (CORRECT PLACEMENT) ---
        individual_game_data = []
        profile_exists_in_df = 'PROFILE_CLEAN' in df.columns

        for index, row in df.iterrows():
            game_data_row = {
                "Profile": row['PROFILE_CLEAN'] if profile_exists_in_df else "N/A",
                "GameName": row[game_col],
                "TPTIndividual": round(row[individual_tpt_col], 2) if pd.notna(row[individual_tpt_col]) else "N/A",
                "TotalTickets": int(row[tickets_col]) if pd.notna(row[tickets_col]) else 0,
                "TotalPlays": int(row[plays_col]) if pd.notna(row[plays_col]) else 0
            }
            individual_game_data.append(game_data_row)

        # Sort the individual game data, for example, by Game Name
        individual_game_data_sorted = sorted(individual_game_data, key=lambda x: x.get('GameName', ''))

        return {
            "games_out_of_range": games_out_of_range_count,
            "games_out_of_range_names": games_out_of_range_names,
            "total_tpt_average": total_game_room_tpt_average,
            "tpt_with_blaster": tpt_with_blaster_val,
            "tpt_without_blaster": tpt_without_blaster_val,
            "message": f"Calculations complete{message_suffix}.",
            "individual_games": individual_game_data_sorted # NEW: Add the list of individual game data
        }

    except FileNotFoundError:
        return {"error": "Uploaded file not found (internal server issue)."}
    except KeyError as e:
        return {"error": f"Missing expected column in file: {e}. Please ensure file contains data and required columns after cleaning/mapping."}
    except ValueError as e:
        return {"error": f"File content or type error: {e}. Ensure numerical columns have numbers and are correctly formatted."}
    except Exception as e:
        return {"error": f"An unexpected error occurred during TPT calculation: {str(e)}."}

# --- NEW: main entry (thin orchestrator that uses the helpers above) ---
def calculate_tpt_data(
    file_path,
    file_type,
    lowest_tpt_threshold,
    highest_tpt_threshold,
    include_birthday_blaster_flag,
    original_filename,
    user_column_map: dict | None = None,
    forced_header_row: int | None = None
):
    """
    New implementation:
    - normalizes columns
    - computes overall avg (with & without BB)
    - finds below/above threshold
    - returns a compact, predictable dict (keeps old keys for compatibility)
    """
    try:
        df_raw = _read_any(file_path, file_type, forced_header_row=forced_header_row)
        df_norm = _normalize_headers(df_raw, user_map=user_column_map)
        _require_columns(df_norm)
        df = _to_numeric_and_dropna(df_norm)

        # If per-row TPT column is missing but we have Tickets/Plays, synthesize it
        if TPT not in df.columns and (TICKETS in df.columns and PLAYS in df.columns):
            with pd.option_context('mode.use_inf_as_na', True):
                df[TPT] = (df[TICKETS] / df[PLAYS]).replace([np.inf, -np.inf], np.nan)

        has_tpt = TPT in df.columns
        has_game = GAME in df.columns

        if df.empty:
            return {"error": "No valid data after cleaning. Make sure columns have numbers and there are rows."}

        # total average (respects BB toggle)
        if include_birthday_blaster_flag or (GAME not in df.columns):
            total_tpt_avg = _overall_tpt(df)
            message_suffix = " (including Birthday Blaster)" if include_birthday_blaster_flag else ""
        else:
            _, non_bb = _split_bb(df)
            total_tpt_avg = _overall_tpt(non_bb)
            message_suffix = " (excluding Birthday Blaster)"

        # BB-only and non-BB-only averages (always compute for display)
        if has_game:
            bb_df, non_bb_df = _split_bb(df)
            tpt_with_blaster_val = _overall_tpt(bb_df)
            tpt_without_blaster_val = _overall_tpt(non_bb_df)
        else:
            tpt_with_blaster_val = "N/A"
            tpt_without_blaster_val = "N/A"

        # below/above/out-of-range
        has_row_tpt = TPT in df.columns
        if has_row_tpt and has_game:
            below_df, above_df, combined = _out_of_range(df, float(lowest_tpt_threshold), float(highest_tpt_threshold))
            below_names = below_df[GAME].astype(str).tolist() if not below_df.empty else []
            above_names = above_df[GAME].astype(str).tolist() if not above_df.empty else []
            combined_names = combined[GAME].astype(str).tolist() if not combined.empty else []
        else:
            below_df = df.iloc[0:0]
            above_df = df.iloc[0:0]
            combined = df.iloc[0:0]
            below_names = []
            above_names = []
            combined_names = []

        # individual rows for table
        individual_rows = _individual_rows(df) if (TICKETS in df.columns and PLAYS in df.columns) else []

        # Build response (preserve old keys; add more detail)
        result = {
            "games_out_of_range": int(combined.shape[0]),
            "games_out_of_range_names": combined_names,
            "total_tpt_average": total_tpt_avg,
            "tpt_with_blaster": tpt_with_blaster_val,
            "tpt_without_blaster": tpt_without_blaster_val,
            "message": f"Calculations complete{message_suffix}.",
            "individual_games": individual_rows,

            # new keys (won't break old UI)
            "below_range_count": int(below_df.shape[0]),
            "above_range_count": int(above_df.shape[0]),
            "below_range_names": below_names,
            "above_range_names": above_names,
            "range_low": float(lowest_tpt_threshold),
            "range_high": float(highest_tpt_threshold),
            "file_name": original_filename,
            "processed_at": datetime.utcnow().isoformat(timespec='seconds') + 'Z'
        }
        # Add header_row_used for debugging
        result["header_row_used"] = forced_header_row

        # Optional: save a JSON snapshot + record (will be wired from route later)
        try:
            reports_dir = Path("data") / "tpt_reports"
            reports_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.utcnow().strftime("%Y-%m-%dT%H-%M-%S")
            json_path = str(reports_dir / f"tpt_report_{stamp}.json")
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
            # Not calling save_tpt_report/prune_old_reports here automatically to avoid surprises.
            # Routes can call them explicitly after a successful upload.
        except Exception:
            # snapshot is best-effort; ignore failure
            pass

        return result

    except FileNotFoundError:
        return {"error": "Uploaded file not found (internal server issue)."}
    except ValueError as e:
        return {"error": f"File/type/column error: {e}"}
    except Exception as e:
        return {"error": f"Unexpected error in TPT calculation: {str(e)}"}