# tpt_processor.py
import pandas as pd
import numpy as np # Used for handling NaN values if needed

def calculate_tpt_data(file_path, file_type, lowest_tpt_threshold, highest_tpt_threshold, include_birthday_blaster_flag, original_filename):
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