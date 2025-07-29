# app.py
import psycopg2
from psycopg2 import sql
from flask import Flask, render_template, request, jsonify, g
import requests
import os
import json
import pandas as pd
from werkzeug.utils import secure_filename
import tpt_processor


# Define the Flask app instance FIRST, right after imports.
app = Flask(__name__) # THIS LINE MUST BE HERE!

# --- Database Configuration for PostgreSQL ---
# IMPORTANT: This DATABASE_URL will be provided by your hosting provider (e.g., Render)
# when you set up your PostgreSQL database. For local testing, you'll need to set it
# in your environment or use a local PostgreSQL instance.
# Example format: "postgresql://user:password@host:port/database_name"
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db():
    """
    Establishes a connection to the PostgreSQL database and stores it in Flask's 'g' object.
    """
    if 'db' not in g:
        if not DATABASE_URL:
            # For local development without a DATABASE_URL env var, this will raise an error.
            # This is expected behavior before deploying or setting up local PG.
            raise RuntimeError("DATABASE_URL environment variable is not set. Cannot connect to PostgreSQL.")
        
        g.db = psycopg2.connect(DATABASE_URL)
        # If you want dictionary-like rows instead of tuples, uncomment these lines
        # and add 'import psycopg2.extras' at the top. For now, we'll stick to tuples.
        # import psycopg2.extras
        # g.db.cursor_factory = psycopg2.extras.DictCursor
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    """
    Closes the database connection at the end of the request.
    """
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """
    Initializes the database schema for PostgreSQL.
    This function will be called when the app starts.
    It creates the 'settings' table if it doesn't exist.
    """
    db = get_db()
    with db.cursor() as cur:
        # Use sql.SQL for safe identifier quoting
        cur.execute(sql.SQL("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        """))

        cur.execute(sql.SQL("""
            CREATE TABLE IF NOT EXISTS issues (
                id TEXT PRIMARY KEY,
                priority TEXT NOT NULL,
                status TEXT NOT NULL,
                description TEXT NOT NULL,
                equipment_location TEXT,
                date_logged TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """)) # Make sure the """)); is correct and there's no extra comma after CURRENT_TIMESTAMP

        # NEW: Create 'tasks' table (this should be after issues, assuming you added it previously)
        cur.execute(sql.SQL("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                description TEXT NOT NULL,
                priority TEXT NOT NULL,
                completed BOOLEAN NOT NULL DEFAULT FALSE,
                due_date DATE,
                is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
                recurrence_pattern TEXT
            );
        """)) # Make sure the """)); is correct here too
    db.commit() # Commit changes to create the table
    print("PostgreSQL database initialized or already exists.")


# Call init_db() when the Flask application starts up.
# This ensures your tables are ready each time app.py is run.
# CORRECTED INDENTATION HERE:
with app.app_context():
    # Temporarily skip database initialization during local development for weather debug
    if os.environ.get("SKIP_DB_INIT") != "true":
        init_db()
    else:
        print("Skipping database initialization because SKIP_DB_INIT is set.")


# Configuration for OpenWeatherMap API
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', 'f733dbbdf2d7274b20ed5a5d52fbad30') # Using os.environ.get here
LATITUDE = 26.0636
LONGITUDE = -80.2073

UPLOAD_FOLDER = 'temp_uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# --- Flask Routes (Traffic Controller) ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/inventory')
def game_inventory():
    return render_template('game_inventory.html')

@app.route('/tpt_calculator')
def tpt_calculator_page():
    return render_template('tpt_calculator.html')

# --- API Endpoints ---
@app.route('/api/data', methods=['GET'])
def get_data():
    return jsonify({"message": "Data fetched from Flask backend (placeholder)"})

@app.route('/weather', methods=['GET'])
def get_weather():
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={LATITUDE}&lon={LONGITUDE}&appid={OPENWEATHER_API_KEY}&units=imperial"
        response = requests.get(url)
        response.raise_for_status()
        weather_data = response.json()

        print(f"DEBUG: Weather data received from OpenWeatherMap: {weather_data}") # <--- THIS LINE MUST BE HERE

        icon_code = weather_data['weather'][0]['icon']
        description = weather_data['weather'][0]['description']
        temperature = weather_data['main']['temp']

        return jsonify({
            "icon_code": icon_code,
            "description": description.capitalize(),
            "temperature": round(temperature)
        })

    except requests.exceptions.RequestException as e:
        print(f"DEBUG: Error fetching weather data from OpenWeatherMap: {e}") # <--- THIS LINE MUST BE DEBUG
        return jsonify({"error": "Failed to fetch weather data", "details": str(e)}), 500
    except KeyError as e:
        print(f"DEBUG: Key error in weather data response: {e} - Data: {weather_data}") # <--- THIS LINE MUST BE DEBUG
        return jsonify({"error": "Weather data format error", "details": str(e)}), 500


    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data from OpenWeatherMap: {e}")
        return jsonify({"error": "Failed to fetch weather data", "details": str(e)}), 500
    except KeyError as e:
        print(f"Key error in weather data response: {e} - Data: {weather_data}")
        return jsonify({"error": "Weather data format error", "details": str(e)}), 500

@app.route('/api/calculate_tpt', methods=['POST'])
def calculate_tpt():
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

@app.route('/api/tpt_settings', methods=['GET'])
def get_tpt_settings():
    db = get_db()
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

@app.route('/api/tpt_settings', methods=['POST'])
def save_tpt_settings():
    data = request.get_json()
    lowest = data.get('lowestDesiredTpt')
    highest = data.get('highestDesiredTpt')
    target = data.get('targetTpt')
    include_bb = str(data.get('includeBirthdayBlaster')).lower()

    db = get_db()
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

@app.route('/issues')
def issues_page():
    return render_template('issues.html')

# --- Application Entry Point ---
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)