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
