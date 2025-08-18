# --- NEW CODE HERE ---
"""
games_db.py
Backend helper for the Game Inventory table.
Keeps database schema setup for 'games' separate from app.py.
"""

def ensure_games_table(db):
    """
    Ensures the 'games' table exists in the database.
    Works for both SQLite (local) and Postgres (Render).
    """
    is_postgres = hasattr(db, 'dsn')
    cur = db.cursor()

    try:
        if is_postgres:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS games (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('Up', 'Down')),
                    down_reason TEXT,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
        else:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS games (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('Up', 'Down')),
                    down_reason TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

        db.commit()
        print("✅ 'games' table ready.")
    finally:
        cur.close()
# --- END NEW CODE ---
# --- PM LOGS (Preventative Maintenance) -------------------------

def ensure_pm_logs_table(db):
    """
    Makes the 'pm_logs' table if it doesn't exist.
    Works on SQLite (local) and Postgres (Render).
    """
    is_postgres = hasattr(db, 'dsn')
    cur = db.cursor()
    try:
        if is_postgres:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS pm_logs (
                    id SERIAL PRIMARY KEY,
                    game_id INTEGER,
                    game_name TEXT NOT NULL,
                    pm_date DATE NOT NULL,
                    notes TEXT DEFAULT '',
                    completed_by TEXT DEFAULT '',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            """)
        else:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS pm_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id INTEGER,
                    game_name TEXT NOT NULL,
                    pm_date TEXT NOT NULL,      -- store as 'YYYY-MM-DD'
                    notes TEXT DEFAULT '',
                    completed_by TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
        db.commit()
        print("✅ 'pm_logs' table ready.")
    finally:
        cur.close()


def add_pm_log(db, game_name, pm_date, notes="", completed_by="", game_id=None):
    """
    Insert one PM entry. Returns the new id (best-effort).
    """
    is_postgres = hasattr(db, 'dsn')
    cur = db.cursor()
    try:
        if is_postgres:
            cur.execute(
                "INSERT INTO pm_logs (game_id, game_name, pm_date, notes, completed_by) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (game_id, game_name, pm_date, notes, completed_by)
            )
            new_id = cur.fetchone()[0]
        else:
            cur.execute(
                "INSERT INTO pm_logs (game_id, game_name, pm_date, notes, completed_by) "
                "VALUES (?, ?, ?, ?, ?)",
                (game_id, game_name, pm_date, notes, completed_by)
            )
            new_id = cur.lastrowid

        db.commit()
        return new_id
    finally:
        cur.close()


def list_pm_logs(db, limit=500):
    """
    Get recent PM entries as a list of dicts.
    """
    is_postgres = hasattr(db, 'dsn')
    cur = db.cursor()
    try:
        if is_postgres:
            cur.execute(
                "SELECT id, game_id, game_name, pm_date, notes, completed_by, created_at "
                "FROM pm_logs "
                "ORDER BY pm_date DESC, id DESC "
                "LIMIT %s",
                (limit,)
            )
        else:
            cur.execute(
                "SELECT id, game_id, game_name, pm_date, notes, completed_by, created_at "
                "FROM pm_logs "
                "ORDER BY date(pm_date) DESC, id DESC "
                "LIMIT ?",
                (limit,)
            )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in rows]
    finally:
        cur.close()
# ---------------------------------------------------------------