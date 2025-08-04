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

# Third-Party Libraries
import psycopg2   # PostgreSQL database adapter
from psycopg2 import sql # For safely building SQL queries
from flask import Flask, render_template, request, jsonify, g # Flask framework components
import requests   # For making HTTP requests to external APIs (e.g., OpenWeatherMap, if reactivated)
import pandas as pd # For data manipulation (used by tpt_processor)
from werkzeug.utils import secure_filename # For securely handling uploaded filenames

# Your Custom Modules
import tpt_processor # Contains logic for TPT calculations


# --- 2. Flask App Instance Initialization ---
# This creates your Flask application. It must be defined early.
app = Flask(__name__)


# --- 3. Database Configuration and Connection Management ---
# This section defines how your Flask app connects to the PostgreSQL database.

# DATABASE_URL is an environment variable that holds your database connection string.
# On Render, this is automatically set. For local development, you need to set it (e.g., in .env or terminal).
DATABASE_URL = os.environ.get('DATABASE_URL')


def get_db():
    """
    Establishes a connection to the PostgreSQL database and stores it in Flask's 'g' object.
    'g' is a special Flask object used to store data for the current request context.
    This prevents creating a new connection for every database operation within a request.
    """
    if 'db' not in g:
        # Check if DATABASE_URL is set; this error is expected if running locally without it.
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL environment variable is not set. Cannot connect to PostgreSQL.")
        
        # Connect to the PostgreSQL database using the DATABASE_URL.
        g.db = psycopg2.connect(DATABASE_URL)
        
        # Optional: Uncomment if you want database query results to be dictionary-like (e.g., row['column_name'])
        # instead of tuples (e.g., row[0]). Requires 'import psycopg2.extras' at the top.
        # import psycopg2.extras
        # g.db.cursor_factory = psycopg2.extras.DictCursor
    return g.db


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


def init_db():
    """
    Initializes the database schema for PostgreSQL.
    This function creates all necessary tables ('settings', 'issues', 'tasks') if they don't already exist.
    It also handles adding new columns to existing tables for simple migrations during development.
    """
    db = get_db() # Get a database connection
    with db.cursor() as cur: # Create a cursor to execute SQL commands
        # --- Create 'settings' table ---
        # This table stores general application settings (e.g., TPT thresholds).
        cur.execute(sql.SQL("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        """))

        # --- Create 'issues' table ---
        # This table stores all active and open issues in the arcade.
        cur.execute(sql.SQL("""
            CREATE TABLE IF NOT EXISTS issues (
                id TEXT PRIMARY KEY, /* Unique ID for the issue (e.g., IS-001) */
                priority TEXT NOT NULL, /* e.g., 'IMMEDIATE', 'High', 'Medium', 'Low', 'CLEANING' */
                date_logged TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, /* When the issue was first recorded */
                last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, /* When the issue was last modified */
                area TEXT,                 /* e.g., 'Arcade', 'Restaurant', 'Redemption' */
                equipment_location TEXT,   /* e.g., 'Pac-Man', 'Dining Table 5', 'Ticket Eater #3' */
                description TEXT NOT NULL, /* Detailed problem description */
                notes TEXT,                /* Additional notes or action taken */
                status TEXT NOT NULL,      /* e.g., 'Open', 'In Progress', 'Awaiting Part', 'Resolved' */
                target_date DATE,          /* Target resolution date (optional) */
                assigned_to TEXT           /* Employee assigned to the issue (optional) */
            );
        """))
        
        # --- ALTER TABLE for 'issues' (for adding new columns to existing tables) ---
        # This block is essential for "migrating" your database schema during development.
        # It adds columns if they don't already exist in an existing 'issues' table.
        try:
            # Example: Adding 'last_updated' column if it's missing (this handles old deployments)
            cur.execute(sql.SQL("""
                ALTER TABLE issues
                ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            """))
            db.commit() # Commit after ALTER TABLE is crucial for it to take effect immediately
            print("Added 'last_updated' column to 'issues' table if it didn't exist.")
        except Exception as e:
            print(f"Warning: Could not add 'last_updated' column to 'issues' table (might already exist or other issue): {e}")
            db.rollback() # Rollback the transaction if the ALTER fails (e.g., due to permission issues)

        # --- Create 'tasks' table ---
        # This table stores daily and recurring tasks for the arcade manager.
        cur.execute(sql.SQL("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY, /* Auto-incrementing unique ID for the task */
                description TEXT NOT NULL, /* Description of the task */
                priority TEXT NOT NULL, /* e.g., 'High', 'Cleanliness', 'Parts Needed' */
                completed BOOLEAN NOT NULL DEFAULT FALSE, /* Whether the task is completed */
                due_date DATE, /* When the task is due */
                is_recurring BOOLEAN NOT NULL DEFAULT FALSE, /* True if this is a recurring task */
                recurrence_pattern TEXT /* e.g., 'weekly_monday', 'daily', 'monthly' */
            );
        """))
        
    db.commit() # Commit all changes from this function to the database
    print("PostgreSQL database initialized or already exists.")


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
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', 'f733dbbdf2d7274b20ed5a5d52fbad30') # Default key for testing if env var not set
LATITUDE = 26.0636 # Margate, FL
LONGITUDE = -80.2073 # Margate, FL

UPLOAD_FOLDER = 'temp_uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True) # Ensure the upload folder exists


# --- 6. Flask Routes (Page Handlers) ---
# These functions render HTML templates for different pages of your web app.
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/test_page')
def test_page():
    """A temporary route to test the base template."""          #the test
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


# --- 7. API Endpoints ---
# These functions handle data requests from the frontend (JavaScript) and interact with the database or external services.

@app.route('/api/data', methods=['GET'])
def get_data():
    """Placeholder API endpoint for general data retrieval."""
    return jsonify({"message": "Data fetched from Flask backend (placeholder)"})


@app.route('/weather', methods=['GET']) # Removed from here, but still present in app.js
def get_weather():
    """
    Fetches current weather data for a specific location from OpenWeatherMap API.
    """
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={LATITUDE}&lon={LONGITUDE}&appid={OPENWEATHER_API_KEY}&units=imperial"
        response = requests.get(url)
        response.raise_for_status() # Raises an exception for HTTP errors (4xx or 5xx)
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


@app.route('/api/tpt_settings', methods=['GET', 'POST']) # Added POST previously
def handle_tpt_settings(): # Renamed from get_tpt_settings for clarity
    db = get_db()
    
    if request.method == 'GET':
        settings = {}
        with db.cursor() as cur:
            cur.execute("SELECT key, value FROM settings")
            rows = cur.fetchall()
            for row in rows:
                settings[row[0]] = row[1] # Access by index for non-DictCursor
        
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

            # Convert fetched tuples into a list of dictionaries for JSON response
            issue_list = []
            for issue in issues_from_db:
                issue_list.append({
                    "id": issue[0],
                    "priority": issue[1],
                    "date_logged": issue[2].isoformat() if issue[2] else None, # Convert datetime to string, handle None
                    "last_updated": issue[3].isoformat() if issue[3] else None, # Convert datetime to string, handle None
                    "area": issue[4],
                    "equipment_location": issue[5],
                    "description": issue[6],
                    "notes": issue[7],
                    "status": issue[8],
                    "target_date": issue[9].isoformat() if issue[9] else None, # Convert date to string, handle None
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

            # Insert new issue into the issues table, setting last_updated automatically
            cur.execute(sql.SQL("""
                INSERT INTO issues (id, description, priority, status, area, equipment_location, notes, target_date, assigned_to, last_updated)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP);
            """), (issue_id, description, priority, status, area, equipment_location, notes, target_date, assigned_to))
            
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




# --- 8. Application Entry Point ---
# This block runs when you execute app.py directly (e.g., python app.py)
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)