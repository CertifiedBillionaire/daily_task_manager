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
