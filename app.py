# app.py
#
# This is the main Flask application file for your Arcade Manager App.
# It handles web routes (pages), API endpoints, and database interactions.
#
# Sections are organized with clear comments for easy navigation and understanding.

# --- 1. Imports ---
# Standard Python Libraries
import os         # For interacting with environment variables (like DATABASE_URL)
import json       # For working with JSON data (e.g., API responses)
import time       # For generating temporary unique IDs (e.g., for new issues)
import sqlite3    # SQLite database adapter (for local development)

# Third-Party Libraries
import psycopg2   # PostgreSQL database adapter
from psycopg2 import sql # For safely building SQL queries
from flask import Flask, render_template, request, jsonify, g # Flask framework components
import requests   # For making HTTP requests to external APIs (e.g., OpenWeatherMap, if reactivated)
import pandas as pd # For data manipulation (used by tpt_processor)
from werkzeug.utils import secure_filename # For securely handling uploaded filenames

# Your Custom Modules
import tpt_processor # Contains logic for TPT calculations
from games_db import ensure_games_table
from games_api import register_game_routes




# --- 2. Flask App Instance Initialization ---
# This creates your Flask application. It must be defined early.
app = Flask(__name__)


# --- 3. Database Configuration and Connection Management ---
# This section defines how your Flask app connects to the PostgreSQL database.

# DATABASE_URL is an environment variable that holds your database connection string.
# On Render, this is automatically set. For local development, you need to set it (e.g., in .env or terminal).
DATABASE_URL = os.environ.get('DATABASE_URL')


# --- NEW CODE HERE ---
def get_db():
    """
    Establishes a connection to the correct database (PostgreSQL on Render, SQLite locally).
    """
    if 'db' not in g:
        if DATABASE_URL:
            # Production: Connect to PostgreSQL on Render
            g.db = psycopg2.connect(DATABASE_URL)
        else:
            # Local Development: Connect to SQLite
            db_path = 'app.db'
            g.db = sqlite3.connect(db_path)
            # This allows us to use row['column_name'] syntax for SQLite
            g.db.row_factory = sqlite3.Row
    return g.db
# --- END NEW CODE ---
# Register Game Inventory API routes
register_game_routes(app, get_db)

@app.teardown_appcontext
def close_db(e=None):
    """
    Closes the database connection at the end of each request context or app teardown.
    This ensures that database connections are properly managed and released.
    """
    # Pop 'db' from Flask's 'g' object. If it doesn't exist, return None.
    db = g.pop('db', None)
    if db is not None:
        db.close() # Close the database connection if it was open.

# --- NEW CODE HERE ---
# --- NEW CODE HERE ---
def init_db():
    """
    Initializes the database schema for both PostgreSQL and SQLite,
    and handles simple column migrations.
    """
    db = get_db()
    is_postgres = hasattr(db, 'dsn')

    # --- NEW CODE HERE ---
    # sqlite doesn't support "with db.cursor() as cur:", so use manual open/close
    cur = db.cursor()
    ensure_games_table(db)

    try:
        # --- Create 'issues' table with all columns ---
        # This will create the table on a fresh DB, or do nothing if it exists.
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
        db.commit()

        # --- Run ALTER TABLE commands to add missing columns (Postgres only) ---
        if is_postgres:
            try:
                # Add 'area' column if it's missing from an old table
                cur.execute(sql.SQL("""
                    ALTER TABLE issues
                    ADD COLUMN IF NOT EXISTS area TEXT;
                """))
                print("Added 'area' column to 'issues' table.")

                # Add 'last_updated' column if it's missing
                cur.execute(sql.SQL("""
                    ALTER TABLE issues
                    ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                """))
                print("Added 'last_updated' column to 'issues' table.")
                
                # Add 'notes' column if it's missing
                cur.execute(sql.SQL("""
                    ALTER TABLE issues
                    ADD COLUMN IF NOT EXISTS notes TEXT;
                """))
                print("Added 'notes' column to 'issues' table.")
                
                # Add 'target_date' column if it's missing
                cur.execute(sql.SQL("""
                    ALTER TABLE issues
                    ADD COLUMN IF NOT EXISTS target_date DATE;
                """))
                print("Added 'target_date' column to 'issues' table.")

                # Add 'assigned_to' column if it's missing
                cur.execute(sql.SQL("""
                    ALTER TABLE issues
                    ADD COLUMN IF NOT EXISTS assigned_to TEXT;
                """))
                print("Added 'assigned_to' column to 'issues' table.")
                
                db.commit()
            except Exception as e:
                print(f"Warning: Could not add columns to 'issues' table: {e}")
                db.rollback()

        # --- Create other tables ---
        cur.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                priority TEXT NOT NULL,
                completed BOOLEAN NOT NULL DEFAULT FALSE,
                due_date DATE,
                is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
                recurrence_pattern TEXT
            );
        """)
        db.commit()
    finally:
        cur.close()
    # --- END NEW CODE ---

    db.commit()
    print("Database initialized or already exists.")
# --- END NEW CODE ---


# --- 4. Application Context for Database Initialization ---
# This ensures that init_db() is called when the Flask app starts up.
# The 'if os.environ.get("SKIP_DB_INIT")' block allows you to bypass DB connection locally.
with app.app_context():
    if os.environ.get("SKIP_DB_INIT") != "true":
        init_db()
    else:
        print("Skipping database initialization because SKIP_DB_INIT is set.")


# --- 5. Application Configuration ---
# Settings for external APIs, file uploads, etc.
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', 'f733dbbdf2d7274b20ed5a5d52fbad30')
LATITUDE = 26.0636
LONGITUDE = -80.2073

UPLOAD_FOLDER = 'temp_uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# --- 6. Flask Routes (Page Handlers) ---
# These functions render HTML templates for different pages of your web app.
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/test_page')
def test_page():
    """A temporary route to test the base template."""
    return render_template('test_page.html')

@app.route('/inventory')
def game_inventory():
    return render_template('game_inventory.html')

@app.route('/tpt_calculator')
def tpt_calculator_page():
    return render_template('tpt_calculator.html')

@app.route('/issues')
def issues_page():
    return render_template('issues.html')

@app.route('/ai_assistant')
def ai_assistant():
    """Renders the AI Assistant page."""
    return render_template('ai_assistant_page.html')

@app.route('/settings')
def settings_page():
    """Renders the Settings page."""
    return render_template('settings_page.html')

@app.route('/clear_issues_temp')
def clear_issues_temp():
    db = get_db()
    with db.cursor() as cur:
        cur.execute("DELETE FROM issues;")
    db.commit()
    return "All issues have been cleared from the database.", 200


@app.route('/init_db_temp')
def init_db_temp():
    with app.app_context():
        init_db()
    return "Database initialization complete! You can now remove this route.", 200


# --- 7. API Endpoints ---
# These functions handle data requests from the frontend (JavaScript) and interact with the database or external services.

@app.route('/api/data', methods=['GET'])
def get_data():
    """Placeholder API endpoint for general data retrieval."""
    return jsonify({"message": "Data fetched from Flask backend (placeholder)"})


@app.route('/weather', methods=['GET'])
def get_weather():
    """
    Fetches current weather data for a specific location from OpenWeatherMap API.
    """
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={LATITUDE}&lon={LONGITUDE}&appid={OPENWEATHER_API_KEY}&units=imperial"
        response = requests.get(url)
        response.raise_for_status()
        weather_data = response.json()

        icon_code = weather_data['weather'][0]['icon']
        description = weather_data['weather'][0]['description']
        temperature = weather_data['main']['temp']

        return jsonify({
            "icon_code": icon_code,
            "description": description.capitalize(),
            "temperature": round(temperature)
        })

    except requests.exceptions.RequestException as e:
        print(f"DEBUG: Error fetching weather data from OpenWeatherMap: {e}")
        return jsonify({"error": "Failed to fetch weather data", "details": str(e)}), 500
    except KeyError as e:
        print(f"DEBUG: Key error in weather data response: {e} - Data: {weather_data}")
        return jsonify({"error": "Weather data format error", "details": str(e)}), 500


@app.route('/api/calculate_tpt', methods=['POST'])
def calculate_tpt():
    """Handles TPT file uploads and calculations."""
    if 'tpt_file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['tpt_file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        filename = secure_filename(file.filename)
        temp_dir = 'temp_uploads'
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
        temp_file_path = os.path.join(temp_dir, filename)
        file.save(temp_file_path)

        file_ext = filename.rsplit('.', 1)[1].lower()
        file_type = 'csv' if file_ext == 'csv' else 'excel'

        try:
            lowest_tpt = float(request.form.get('lowest_tpt'))
            highest_tpt = float(request.form.get('highest_tpt'))
            include_blaster = request.form.get('include_birthday_blaster') == 'true'

            results = tpt_processor.calculate_tpt_data(
                temp_file_path,
                file_type,
                lowest_tpt,
                highest_tpt,
                include_blaster,
                filename
            )

            os.remove(temp_file_path)

            if "error" in results:
                return jsonify(results), 400
            else:
                results['file_name'] = filename
                return jsonify(results), 200

        except (TypeError, ValueError) as e:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            print(f"Error converting TPT settings: {e}")
            return jsonify({"error": f"Invalid TPT settings provided: {str(e)}. Please check your input values."}), 400
        except Exception as e:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            print(f"Server error during TPT calculation: {e}")
            return jsonify({"error": f"Server error: {str(e)}. Check Flask console."}), 500


@app.route('/api/tpt_settings', methods=['GET', 'POST'])
def handle_tpt_settings():
    db = get_db()
    
    if request.method == 'GET':
        settings = {}
        with db.cursor() as cur:
            cur.execute("SELECT key, value FROM settings")
            rows = cur.fetchall()
            for row in rows:
                settings[row[0]] = row[1]
        
        return jsonify({
            'lowestDesiredTpt': settings.get('lowestDesiredTpt', '2.00'),
            'highestDesiredTpt': settings.get('highestDesiredTpt', '4.00'),
            'targetTpt': settings.get('targetTpt', '3.00'),
            'includeBirthdayBlaster': settings.get('includeBirthdayBlaster', 'true') == 'true'
        })
    
    elif request.method == 'POST':
        data = request.get_json()
        lowest = data.get('lowestDesiredTpt')
        highest = data.get('highestDesiredTpt')
        target = data.get('targetTpt')
        include_bb = str(data.get('includeBirthdayBlaster')).lower()

        with db.cursor() as cur:
            cur.execute(sql.SQL("""
                INSERT INTO settings (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
            """), ('lowestDesiredTpt', lowest))
            cur.execute(sql.SQL("""
                INSERT INTO settings (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
            """), ('highestDesiredTpt', highest))
            cur.execute(sql.SQL("""
                INSERT INTO settings (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
            """), ('targetTpt', target))
            cur.execute(sql.SQL("""
                INSERT INTO settings (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
            """), ('includeBirthdayBlaster', include_bb))
        db.commit()
        
        return jsonify({"message": "TPT settings saved successfully!"})


@app.route('/api/issues', methods=['GET', 'POST'])
def handle_issues():
    """
    Handles GET requests to fetch all issues and POST requests to add new issues.
    """
    db = get_db()
    cur = db.cursor()

    if request.method == 'GET':
        try:
            # Select all columns from the issues table, ordered by date_logged descending (newest first)
            cur.execute("""
                SELECT id, priority, date_logged, last_updated, area, equipment_location, description, notes, status, target_date, assigned_to
                FROM issues
                ORDER BY date_logged DESC;
            """)
            issues_from_db = cur.fetchall() # Fetch all results as tuples

            def safe_iso(val):
                """Return ISO string for datetimes/dates if possible; else string or None."""
                if val is None:
                    return None
                return val.isoformat() if hasattr(val, "isoformat") else str(val)

            # Convert fetched tuples into a list of dictionaries for JSON response
            issue_list = []
            for issue in issues_from_db:
                issue_list.append({
                    "id": issue[0],
                    "priority": issue[1],
                    "date_logged": safe_iso(issue[2]), # Convert datetime to string, handle None
                    "last_updated": safe_iso(issue[3]), # Convert datetime to string, handle None
                    "area": issue[4],
                    "equipment_location": issue[5],
                    "description": issue[6],
                    "notes": issue[7],
                    "status": issue[8],
                    "target_date": safe_iso(issue[9]), # Convert date to string, handle None
                    "assigned_to": issue[10]
                })
            return jsonify(issue_list)
        except Exception as e:
            print(f"ERROR: Failed to fetch issues from DB: {e}")
            return jsonify({"error": "Failed to retrieve issues", "details": str(e)}), 500

    elif request.method == 'POST':
        try:
            data = request.get_json() # Get JSON data sent from the frontend
            
            # Extract data fields from the incoming JSON, with defaults for optional fields
            description = data.get('description')
            priority = data.get('priority')
            status = data.get('status')
            area = data.get('area', '') # Default to empty string if not provided
            equipment_location = data.get('equipment_location', '')
            notes = data.get('notes', '')
            target_date = data.get('target_date') # Can be None if not provided
            assigned_to = data.get('assigned_to', '')

            # Basic validation for required fields
            if not description or not priority or not status:
                return jsonify({"error": "Missing required fields: description, priority, status"}), 400

            # Generate a temporary unique ID for the issue (will be replaced by DB SERIAL in real use)
            issue_id = f"IS-{int(time.time())}" 

            # --- NEW CODE HERE ---
            # Insert new issue into the issues table, setting last_updated automatically
            is_postgres = hasattr(db, 'dsn')

            if is_postgres:
                # Postgres uses %s placeholders and can keep sql.SQL wrapper
                cur.execute(sql.SQL("""
                    INSERT INTO issues (id, description, priority, status, area, equipment_location, notes, target_date, assigned_to, last_updated)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP);
                """), (issue_id, description, priority, status, area, equipment_location, notes, target_date, assigned_to))
            else:
                # SQLite uses ? placeholders; DO NOT use sql.SQL here
                cur.execute("""
                    INSERT INTO issues (id, description, priority, status, area, equipment_location, notes, target_date, assigned_to, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
                """, (issue_id, description, priority, status, area, equipment_location, notes, target_date, assigned_to))
            # --- END NEW CODE ---
            
            db.commit() # Commit the changes to save to database

            return jsonify({"message": "Issue added successfully!", "issue_id": issue_id}), 201 # 201 Created status

        except Exception as e:
            print(f"ERROR: Failed to add issue to DB: {e}")
            return jsonify({"error": "Failed to add issue", "details": str(e)}), 500


@app.route('/api/urgent_issues_count', methods=['GET'])
def get_urgent_issues_count():
    """
    Fetches the count of high-priority, open issues from the database.
    """
    try:
        db = get_db() # Get a database connection
        with db.cursor() as cur:
            # Query to count issues that are 'Open' AND (priority 'IMMEDIATE' OR 'High')
            # Adjust priority values to exactly match your Google Sheet values if different
            cur.execute(sql.SQL("""
                SELECT COUNT(*) FROM issues
                WHERE status = 'Open' AND (priority = 'IMMEDIATE' OR priority = 'High');
            """))
            count = cur.fetchone()[0] # Fetch the count (it's the first element of the tuple)
            return jsonify({"count": count})
    except Exception as e:
        # Log the error for debugging on Render dashboard logs
        print(f"ERROR: Failed to fetch urgent issues count from DB: {e}")
        # Return 0 count in case of DB error so the app doesn't break visually
        return jsonify({"count": 0, "error": "Database error fetching count"}), 500 

@app.route('/api/equipment_locations', methods=['GET'])
def equipment_locations():
    """
    Returns a list of unique equipment_location values (newest first).
    Works for Postgres and SQLite.
    """
    try:
        db = get_db()
        cur = db.cursor()
        try:
            cur.execute("""
                SELECT equipment_location, MAX(date_logged) AS last_used
                FROM issues
                WHERE equipment_location IS NOT NULL AND TRIM(equipment_location) <> ''
                GROUP BY equipment_location
                ORDER BY last_used DESC
                LIMIT 50;
            """)
            rows = cur.fetchall()
        finally:
            cur.close()

        suggestions = [row[0] for row in rows if row and row[0]]
        return jsonify({"items": suggestions})

    except Exception as e:
        print(f"ERROR: equipment_locations failed: {e}")
        return jsonify({"items": [], "error": "failed"}), 500


@app.route('/api/issues/<issue_id>', methods=['PUT'])
def update_issue(issue_id):
    """
    Update fields on an issue and bump last_updated.
    Works on SQLite (local) and Postgres (Render).
    Allowed fields: description, area, equipment_location, priority, status, notes, assigned_to, target_date
    """
    try:
        db = get_db()
        is_postgres = hasattr(db, 'dsn')

        data = request.get_json(force=True) or {}

        allowed = ['description', 'area', 'equipment_location',
                   'priority', 'status', 'notes', 'assigned_to', 'target_date']

        # build dynamic SET clause
        set_parts = []
        values = []
        placeholder = '%s' if is_postgres else '?'

        for key in allowed:
            if key in data:
                set_parts.append(f"{key} = {placeholder}")
                values.append(data[key])

        if not set_parts:
            return jsonify({"error": "No fields to update"}), 400

        # always update last_updated
        set_parts.append("last_updated = CURRENT_TIMESTAMP")

        sql_str = f"UPDATE issues SET {', '.join(set_parts)} WHERE id = {placeholder};"

        cur = db.cursor()
        try:
            cur.execute(sql_str, (*values, issue_id))
            if cur.rowcount == 0:
                db.commit()
                return jsonify({"error": "Issue not found"}), 404
            db.commit()
            return jsonify({"message": "Issue updated", "issue_id": issue_id})
        except Exception as e:
            db.rollback()
            print(f"ERROR: update_issue failed: {e}")
            return jsonify({"error": "Failed to update issue", "details": str(e)}), 500
        finally:
            cur.close()

    except Exception as e:
        print(f"ERROR: update_issue outer failure: {e}")
        return jsonify({"error": "Server error"}), 500

# --- NEW CODE HERE ---
@app.route('/api/issues/<issue_id>', methods=['DELETE'])
def delete_issue(issue_id):
    """
    Delete an issue by id. Works on SQLite (local) and Postgres (Render).
    """
    try:
        db = get_db()
        is_postgres = hasattr(db, 'dsn')
        placeholder = '%s' if is_postgres else '?'

        cur = db.cursor()
        try:
            cur.execute(f"DELETE FROM issues WHERE id = {placeholder};", (issue_id,))
            if cur.rowcount == 0:
                db.commit()
                return jsonify({"error": "Issue not found"}), 404
            db.commit()
            return jsonify({"message": "Issue deleted", "issue_id": issue_id})
        except Exception as e:
            db.rollback()
            print(f"ERROR: delete_issue failed: {e}")
            return jsonify({"error": "Failed to delete issue", "details": str(e)}), 500
        finally:
            cur.close()
    except Exception as e:
        print(f"ERROR: delete_issue outer failure: {e}")
        return jsonify({"error": "Server error"}), 500
# --- END NEW CODE ---


# --- 8. Application Entry Point ---
# This block runs when you execute app.py directly (e.g., python app.py)
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)