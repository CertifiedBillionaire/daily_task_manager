# =========================================================================
# ARCADE MANAGER - FLASK APP (ROOT)
# Main application: page routes, shared services (DB, weather, TPT), and
# bootstrapping. All Games and Issues API endpoints are registered from
# their own modules to keep this file small.
#
# Connected files:
# - games_db.py            (ensure_games_table)
# - games_api.py           (register_game_routes)
# - issues_api.py          (register_issue_routes)
# - issue_hub_bp.py        (register_issue_hub)  <-- new blueprint
# - templates/*.html       (pages)
# - static/js/* (frontend modules)
# =========================================================================

# --- 1) Imports ------------------------------------------------------------
import os
import sqlite3

import psycopg2
from psycopg2 import sql
from flask import Flask, render_template, request, jsonify, g
import requests
from werkzeug.utils import secure_filename

# your modules
import tpt_processor
from games_db import ensure_games_table
from games_api import register_game_routes
from issues_api import register_issue_routes
# --- REFINED IMPORT NAME ---
from issue_hub_bp import register_issue_hub_blueprint

# --- 2) App setup ----------------------------------------------------------
app = Flask(__name__)



# --- Health Check API ---
@app.route('/api/health')
def health_check():
    status = {}

    # 1. Database Check (assuming SQLite and app.db)
    db_path = 'app.db' # Adjust this if your DB path is different
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT 1") # Simple query to check connection
        status['database'] = {'status': 'ok', 'message': 'Database connection successful.'}
    except Exception as e:
        status['database'] = {'status': 'error', 'message': f'Database error: {str(e)}'}
    finally:
        if 'conn' in locals() and conn:
            conn.close()

    # 2. Storage Check (e.g., check if 'data' directory is writable)
    storage_path = 'data' # Adjust to a relevant storage directory
    try:
        if os.path.exists(storage_path) and os.access(storage_path, os.W_OK):
            status['storage'] = {'status': 'ok', 'message': 'Storage directory is writable.'}
        else:
            status['storage'] = {'status': 'error', 'message': 'Storage directory not found or not writable.'}
    except Exception as e:
        status['storage'] = {'status': 'error', 'message': f'Storage error: {str(e)}'}

    # 3. Key Route Check (e.g., check your /api/issuehub/list endpoint)
    # Important: For a real application, use a full URL, e.g., "http://localhost:5000/api/issuehub/list"
    # If running locally, make sure your app is running when this check is performed.
    key_route_url = f"{request.url_root.rstrip('/')}/api/issuehub/list" 
    try:
        response = requests.get(key_route_url, timeout=5) # 5-second timeout
        if response.status_code == 200:
            status['issue_api'] = {'status': 'ok', 'message': 'Issue API route accessible.'}
        else:
            status['issue_api'] = {'status': 'error', 'message': f'Issue API route returned status {response.status_code}.'}
    except requests.exceptions.RequestException as e:
        status['issue_api'] = {'status': 'error', 'message': f'Issue API route error: {str(e)}'}

    overall_status = 'ok'
    for service in status.values():
        if service['status'] == 'error':
            overall_status = 'error'
            break

    return jsonify({'overall': overall_status, 'services': status})

# DB url: set on Render. If missing, we default to local SQLite.
DATABASE_URL = os.environ.get("DATABASE_URL")

# --- 3) DB helpers ---------------------------------------------------------
def get_db():
    """
    Returns a per-request DB connection:
      - Render: PostgreSQL (psycopg2)
      - Local:  SQLite (app.db)
    """
    if "db" not in g:
        if DATABASE_URL:
            g.db = psycopg2.connect(DATABASE_URL)
        else:
            g.db = sqlite3.connect("app.db")
            g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(e=None):
    db_conn = g.pop("db", None)
    if db_conn is not None:
        db_conn.close()

# --- 3a) ID sequences (for padded IDs like 001, 002, …) -------------------
def ensure_id_sequences(db_conn):
    """
    Creates id_sequences(entity TEXT PRIMARY KEY, counter INTEGER NOT NULL)
    and seeds rows for 'issue' and 'game' (counter=0) if missing.
    Works on Postgres and SQLite.
    """
    is_postgres = hasattr(db_conn, "dsn")
    cur = db_conn.cursor()
    try:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS id_sequences (
                entity  TEXT PRIMARY KEY,
                counter INTEGER NOT NULL
            );
            """
        )
        db_conn.commit()

        if is_postgres:
            # Postgres upsert
            cur.execute(
                "INSERT INTO id_sequences (entity, counter) VALUES ('issue', 0) "
                "ON CONFLICT (entity) DO NOTHING;"
            )
            cur.execute(
                "INSERT INTO id_sequences (entity, counter) VALUES ('game', 0) "
                "ON CONFLICT (entity) DO NOTHING;"
            )
        else:
            # SQLite upsert
            cur.execute(
                "INSERT OR IGNORE INTO id_sequences (entity, counter) VALUES ('issue', 0);"
            )
            cur.execute(
                "INSERT OR IGNORE INTO id_sequences (entity, counter) VALUES ('game', 0);"
            )

        db_conn.commit()
    finally:
        cur.close()

def init_db():
    """
    Creates core tables (issues, settings, tasks) and the games table.
    Works for both Postgres and SQLite. Includes light Postgres migrations.
    """
    db_conn = get_db()
    is_postgres = hasattr(db_conn, "dsn")

    # ensure games table (module handles both engines)
    ensure_games_table(db_conn)

    cur = db_conn.cursor()
    try:
        # legacy issues table (kept so old pages still work if you use them)
        cur.execute(
            """
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
            """
        )
        db_conn.commit()

        # id_sequences base rows
        ensure_id_sequences(db_conn)

        # light Postgres migrations (no-ops on SQLite)
        if is_postgres:
            try:
                cur.execute(sql.SQL("ALTER TABLE issues ADD COLUMN IF NOT EXISTS area TEXT;"))
                cur.execute(sql.SQL(
                    "ALTER TABLE issues ADD COLUMN IF NOT EXISTS last_updated "
                    "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"
                ))
                cur.execute(sql.SQL("ALTER TABLE issues ADD COLUMN IF NOT EXISTS notes TEXT;"))
                cur.execute(sql.SQL("ALTER TABLE issues ADD COLUMN IF NOT EXISTS target_date DATE;"))
                cur.execute(sql.SQL("ALTER TABLE issues ADD COLUMN IF NOT EXISTS assigned_to TEXT;"))
                db_conn.commit()
            except Exception as e:
                print(f"Warning: issue migrations skipped: {e}")
                db_conn.rollback()

        # settings
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            """
        )

        # tasks
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                priority TEXT NOT NULL,
                completed BOOLEAN NOT NULL DEFAULT FALSE,
                due_date DATE,
                is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
                recurrence_pattern TEXT
            );
            """
        )
        db_conn.commit()
    finally:
        cur.close()

    print("DB ready ✅")

# run initialization (unless explicitly skipped)
with app.app_context():
    if os.environ.get("SKIP_DB_INIT") != "true":
        init_db()
    else:
        print("SKIP_DB_INIT=true → skipped DB init")

# --- 4) Page routes --------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/test_page")
def test_page():
    return render_template("test_page.html")

@app.route("/inventory")
def game_inventory():
    return render_template("game_inventory.html")

@app.route("/tpt_calculator")
def tpt_calculator_page():
    return render_template("tpt_calculator.html")

@app.route("/issues")
def issues_page():
    return render_template("issues.html")

@app.route("/ai_assistant")
def ai_assistant():
    return render_template("ai_assistant_page.html")

@app.route("/settings")
def settings_page():
    return render_template("settings_page.html")

# --- 5) Utility/maintenance routes ----------------------------------------
@app.route("/clear_issues_temp")
def clear_issues_temp():
    """Dev helper: clears all issues."""
    db_conn = get_db()
    cur = db_conn.cursor()
    try:
        cur.execute("DELETE FROM issues;")
        db_conn.commit()
        return "All issues have been cleared from the database.", 200
    except Exception as e:
        db_conn.rollback()
        return f"Failed to clear issues: {e}", 500
    finally:
        cur.close()

@app.route("/init_db_temp")
def init_db_temp():
    with app.app_context():
        init_db()
    return "Database initialization complete!", 200

# --- 6) Example/utility APIs (weather, TPT, settings) ----------------------
@app.route("/api/data", methods=["GET"])
def get_data():
    return jsonify({"message": "Data fetched from Flask backend (placeholder)"})

OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY", "f733dbbdf2d7274b20ed5a5d52fbad30")
LATITUDE = 26.0636
LONGITUDE = -80.2073

@app.route("/weather", methods=["GET"])
def get_weather():
    try:
        url = (
            "https://api.openweathermap.org/data/2.5/weather"
            f"?lat={LATITUDE}&lon={LONGITUDE}&appid={OPENWEATHER_API_KEY}&units=imperial"
        )
        response = requests.get(url)
        response.raise_for_status()
        weather_data = response.json()

        icon_code = weather_data["weather"][0]["icon"]
        description = weather_data["weather"][0]["description"]
        temperature = weather_data["main"]["temp"]

        return jsonify(
            {
                "icon_code": icon_code,
                "description": description.capitalize(),
                "temperature": round(temperature),
            }
        )
    except requests.exceptions.RequestException as e:
        print(f"Weather error: {e}")
        return jsonify({"error": "Failed to fetch weather data", "details": str(e)}), 500
    except KeyError as e:
        print(f"Weather key error: {e}")
        return jsonify({"error": "Weather data format error", "details": str(e)}), 500

@app.route("/api/calculate_tpt", methods=["POST"])
def calculate_tpt():
    if "tpt_file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["tpt_file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    filename = secure_filename(file.filename)
    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, filename)
    file.save(temp_file_path)

    try:
        file_ext = filename.rsplit(".", 1)[1].lower()
        file_type = "csv" if file_ext == "csv" else "excel"

        lowest_tpt = float(request.form.get("lowest_tpt"))
        highest_tpt = float(request.form.get("highest_tpt"))
        include_blaster = request.form.get("include_birthday_blaster") == "true"

        results = tpt_processor.calculate_tpt_data(
            temp_file_path, file_type, lowest_tpt, highest_tpt, include_blaster, filename
        )

        os.remove(temp_file_path)

        if "error" in results:
            return jsonify(results), 400
        else:
            results["file_name"] = filename
            return jsonify(results), 200

    except (TypeError, ValueError) as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        return jsonify({"error": f"Invalid TPT settings provided: {str(e)}. Please check your input values."}), 400
    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        return jsonify({"error": f"Server error: {str(e)}. Check Flask console."}), 500

@app.route("/api/tpt_settings", methods=["GET", "POST"])
def handle_tpt_settings():
    db_conn = get_db()

    if request.method == "GET":
        settings = {}
        cur = db_conn.cursor()
        try:
            cur.execute("SELECT key, value FROM settings")
            rows = cur.fetchall()
            for row in rows:
                # row can be tuple (pg) or sqlite Row
                k = row[0]
                v = row[1]
                settings[k] = v
        finally:
            cur.close()

        return jsonify(
            {
                "lowestDesiredTpt": settings.get("lowestDesiredTpt", "2.00"),
                "highestDesiredTpt": settings.get("highestDesiredTpt", "4.00"),
                "targetTpt": settings.get("targetTpt", "3.00"),
                "includeBirthdayBlaster": settings.get("includeBirthdayBlaster", "true") == "true",
            }
        )

    # POST
    data = request.get_json()
    lowest = data.get("lowestDesiredTpt")
    highest = data.get("highestDesiredTpt")
    target = data.get("targetTpt")
    include_bb = str(data.get("includeBirthdayBlaster")).lower()

    cur = db_conn.cursor()
    try:
        cur.execute(
            sql.SQL(
                """
                INSERT INTO settings (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
                """
            ),
            ("lowestDesiredTpt", lowest),
        )
        cur.execute(
            sql.SQL(
                """
                INSERT INTO settings (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
                """
            ),
            ("highestDesiredTpt", highest),
        )
        cur.execute(
            sql.SQL(
                """
                INSERT INTO settings (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
                """
            ),
            ("targetTpt", target),
        )
        cur.execute(
            sql.SQL(
                """
                INSERT INTO settings (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
                """
            ),
            ("includeBirthdayBlaster", include_bb),
        )
        db_conn.commit()
        return jsonify({"message": "TPT settings saved successfully!"})
    except Exception as e:
        db_conn.rollback()
        return jsonify({"error": f"Failed to save settings: {e}"}), 500
    finally:
        cur.close()

# --- 7) Module Registration ------------------------------------------------
# Register page blueprints
register_issue_hub_blueprint(app, get_db, ensure_id_sequences) # Pass the functions here

# Register API modules
register_game_routes(app, get_db)
register_issue_routes(app, get_db)
# --- 8) Entrypoint ---------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)