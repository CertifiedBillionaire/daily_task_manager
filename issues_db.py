# =========================================================================
# ARCADE MANAGER - ISSUES DB UTILITIES
# Ensures the Issues schema exists and generates padded Issue IDs (001, 002…)
#
# What this file does:
# - Creates id_sequences table (name TEXT PK, last_value INTEGER)
# - Seeds a row for "issues" if missing
# - Ensures the issues table exists with all expected columns
# - Provides next_issue_id(db) -> "001" style string
#
# Connected files:
# - app.py (calls ensure_issues_schema(db) during startup; uses next_issue_id on POST)
# =========================================================================

from psycopg2 import sql

def _is_postgres(db):
    """Heuristic: psycopg2 connections have 'dsn' attr."""
    return hasattr(db, 'dsn')

def ensure_issues_schema(db):
    """
    Create/verify:
      - id_sequences(name TEXT PRIMARY KEY, last_value INTEGER NOT NULL DEFAULT 0)
      - issues(...) table with expected columns
      - a seed row in id_sequences for 'issues'
    Works for SQLite and Postgres.
    """
    is_pg = _is_postgres(db)
    ph = '%s' if is_pg else '?'  # placeholder style

    cur = db.cursor()
    try:
        # 1) id_sequences table
        if is_pg:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS id_sequences (
                    name TEXT PRIMARY KEY,
                    last_value INTEGER NOT NULL DEFAULT 0
                );
            """)
            # seed row for 'issues'
            cur.execute("""
                INSERT INTO id_sequences (name, last_value)
                VALUES ('issues', 0)
                ON CONFLICT (name) DO NOTHING;
            """)
        else:
            # SQLite
            cur.execute("""
                CREATE TABLE IF NOT EXISTS id_sequences (
                    name TEXT PRIMARY KEY,
                    last_value INTEGER NOT NULL DEFAULT 0
                );
            """)
            cur.execute(f"INSERT OR IGNORE INTO id_sequences (name, last_value) VALUES ({ph}, 0);", ('issues',))

        # 2) issues table (same shape you already use)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS issues (
                id TEXT PRIMARY KEY,
                priority TEXT NOT NULL,
                date_logged TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                area TEXT,
                equipment_location TEXT,
                description TEXT NOT NULL,
                notes TEXT,
                status TEXT NOT NULL,
                target_date DATE,
                assigned_to TEXT
            );
        """)

        # Optional: gentle column add for PG if ever missing (safe no-op in new DBs)
        if is_pg:
            try:
                cur.execute(sql.SQL("ALTER TABLE issues ADD COLUMN IF NOT EXISTS area TEXT;"))
                cur.execute(sql.SQL("ALTER TABLE issues ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
                cur.execute(sql.SQL("ALTER TABLE issues ADD COLUMN IF NOT EXISTS notes TEXT;"))
                cur.execute(sql.SQL("ALTER TABLE issues ADD COLUMN IF NOT EXISTS target_date DATE;"))
                cur.execute(sql.SQL("ALTER TABLE issues ADD COLUMN IF NOT EXISTS assigned_to TEXT;"))
            except Exception:
                # don't crash if ALTER fails on some engines
                pass

        db.commit()
    finally:
        cur.close()

def next_issue_id(db):
    """
    Increment and return the next issue ID as a zero-padded string: "001", "002", ...
    Uses id_sequences where name='issues'. Works for SQLite and Postgres.
    """
    is_pg = _is_postgres(db)
    ph = '%s' if is_pg else '?'

    cur = db.cursor()
    try:
        # Make sure the row exists (belt & suspenders)
        if is_pg:
            cur.execute("""
                INSERT INTO id_sequences (name, last_value)
                VALUES ('issues', 0)
                ON CONFLICT (name) DO NOTHING;
            """)
            # Atomically bump and return
            cur.execute(f"UPDATE id_sequences SET last_value = last_value + 1 WHERE name = {ph} RETURNING last_value;", ('issues',))
            row = cur.fetchone()
            new_val = int(row[0]) if row else 1
        else:
            # SQLite
            cur.execute(f"INSERT OR IGNORE INTO id_sequences (name, last_value) VALUES ({ph}, 0);", ('issues',))
            cur.execute(f"SELECT last_value FROM id_sequences WHERE name = {ph};", ('issues',))
            row = cur.fetchone()
            current = int(row[0]) if row and row[0] is not None else 0
            new_val = current + 1
            cur.execute(f"UPDATE id_sequences SET last_value = {ph} WHERE name = {ph};", (new_val, 'issues'))

        db.commit()
        return f"{new_val:03d}"
    finally:
        cur.close()


def count_all_open_issues():
    """
    Count 'active' issues across DB + JSON.
    Active = status NOT in {'closed','archived','resolved'} (empty = active).
    Merges by id to avoid double-counts.
    """
    closed_like = {'closed', 'archived', 'resolved'}

    def norm(x): 
        return (x or "").strip().lower()

    def is_active(status):
        s = norm(status)
        return (s == "") or (s not in closed_like)

    # --- collect from DB ---
    db_items = []
    try:
        from extensions import get_db
        db = get_db()
        rows = db.execute("SELECT id, status FROM issues").fetchall()
        for r in rows:
            try:
                rid = r["id"]
                status = r["status"]
            except Exception:
                # fallback tuple indexing
                rid = r[0] if len(r) > 0 else None
                status = r[1] if len(r) > 1 else None
            db_items.append({"id": rid, "status": status})
    except Exception:
        pass

    # --- collect from JSON ---
    json_items = []
    try:
        import json, os
        json_path = os.path.join(os.path.dirname(__file__), "data", "issues.json")
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                for it in (json.load(f) or []):
                    json_items.append({"id": it.get("id"), "status": it.get("status")})
    except Exception:
        pass

    # --- merge by id (DB wins) ---
    merged = {}
    for it in json_items:
        key = it.get("id") if it.get("id") is not None else ("json_" + str(len(merged)))
        merged[key] = it
    for it in db_items:
        key = it.get("id") if it.get("id") is not None else ("db_" + str(len(merged)))
        merged[key] = it

    # --- count active ---
    return sum(1 for it in merged.values() if is_active(it.get("status")))


def _collect_all_issue_records():
    """
    Return a list of {id, status, category, source} from BOTH:
    - SQLite table `issues`
    - data/issues.json
    """
    items = []

    def norm(x): 
        return (x or "").strip()

    # --- DB source ---
    try:
        from extensions import get_db
        db = get_db()
        rows = None
        try:
            # Try with category column
            rows = db.execute("SELECT id, status, category FROM issues").fetchall()
            for r in rows:
                try:
                    rid, status, category = r["id"], r["status"], r["category"]
                except Exception:
                    rid, status, category = r[0], r[1], r[2] if len(r) > 2 else None
                items.append({
                    "id": rid,
                    "status": norm(status),
                    "category": norm(category),
                    "source": "db"
                })
        except Exception:
            # Fallback w/out category
            rows = db.execute("SELECT id, status FROM issues").fetchall()
            for r in rows:
                try:
                    rid, status = r["id"], r["status"]
                except Exception:
                    rid, status = r[0], r[1] if len(r) > 1 else None
                items.append({
                    "id": rid,
                    "status": norm(status),
                    "category": None,
                    "source": "db"
                })
    except Exception:
        pass

    # --- JSON source ---
    try:
        import json, os
        json_path = os.path.join(os.path.dirname(__file__), "data", "issues.json")
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                arr = json.load(f) or []
                for it in arr:
                    items.append({
                        "id": it.get("id"),
                        "status": norm(it.get("status")),
                        "category": norm(it.get("category")),
                        "source": "json"
                    })
    except Exception:
        pass

    return items


def _debug_active_breakdown():
    """
    Build a breakdown of what we're counting.
    Active = status NOT in {'closed','archived','resolved'} (empty = active).
    """
    closed_like = {'closed', 'archived', 'resolved'}
    def lower(x): return (x or "").strip().lower()
    def is_active(status): 
        s = lower(status)
        return (s == "") or (s not in closed_like)

    raw = _collect_all_issue_records()

    # Merge by id when present (DB wins). If no id, keep per-source row.
    merged = {}
    for it in raw:
        key = it["id"] if it.get("id") is not None else f'{it["source"]}:{len(merged)}'
        # DB wins on collision
        if key in merged and it["source"] == "json" and merged[key]["source"] == "db":
            continue
        merged[key] = it

    by_status = {}
    for it in merged.values():
        s = lower(it.get("status"))
        by_status[s] = by_status.get(s, 0) + 1

    active_list = [it for it in merged.values() if is_active(it.get("status"))]

    return {
        "totals": {
            "merged": len(merged),
            "active": len(active_list)
        },
        "by_status": by_status,
        "sample_active": active_list[:20]
    }