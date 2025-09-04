# =========================================================================
# ARCADE MANAGER - FLASK APP (ROOT)
# =========================================================================

# --- 1) Imports ------------------------------------------------------------
import os
import sqlite3
import requests
import pandas as pd
from datetime import datetime, date
import json

import psycopg2
from psycopg2 import sql
from flask import Flask, render_template, request, jsonify, g, redirect, url_for
from werkzeug.utils import secure_filename

# local modules
import tpt_processor
from games_db import ensure_games_table
from games_api import register_game_routes
from issues_api import register_issue_routes
from issue_hub_bp import register_issue_hub_blueprint

# env + AI (Gemini)
from dotenv import load_dotenv
load_dotenv()  # load .env for local dev; Render uses Environment Variables
from datetime import datetime, date as _date
import google.generativeai as genai
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
MODEL_NAME = "gemini-2.5-pro"  # Use gemini-2.5-pro for more powerful reasoning

# --- 2) App setup ----------------------------------------------------------
app = Flask(__name__)


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
            cur.execute(
                "INSERT INTO id_sequences (entity, counter) VALUES ('issue', 0) "
                "ON CONFLICT (entity) DO NOTHING;"
            )
            cur.execute(
                "INSERT INTO id_sequences (entity, counter) VALUES ('game', 0) "
                "ON CONFLICT (entity) DO NOTHING;"
            )
        else:
            cur.execute(
                "INSERT OR IGNORE INTO id_sequences (entity, counter) VALUES ('issue', 0);"
            )
            cur.execute(
                "INSERT OR IGNORE INTO id_sequences (entity, counter) VALUES ('game', 0);"
            )

        db_conn.commit()
    finally:
        cur.close()

# --- NEW: DB helper for PM logs table --------------------------------------
def ensure_pm_logs_table(db_conn):
    is_postgres = hasattr(db_conn, "dsn")
    cur = db_conn.cursor()
    try:
        # Create pm_logs table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pm_logs (
                id SERIAL PRIMARY KEY,
                game_id TEXT NOT NULL,
                pm_date DATE NOT NULL,
                notes TEXT,
                completed_by TEXT,
                date_logged TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Add foreign key constraint (Postgres only, with IF NOT EXISTS)
        if is_postgres:
            try:
                cur.execute(sql.SQL("""
                    ALTER TABLE pm_logs
                    ADD COLUMN IF NOT EXISTS game_id TEXT REFERENCES games(id) ON DELETE CASCADE;
                """))
            except Exception as e:
                print(f"Warning: PM logs migration skipped: {e}")
        
        db_conn.commit()
    except Exception as e:
        print(f"Error creating pm_logs table: {e}")
        db_conn.rollback()
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
    # ensure pm_logs table
    ensure_pm_logs_table(db_conn)

    cur = db_conn.cursor()
    try:
        # legacy issues table
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

# --- helper: upsert a setting for both Postgres/SQLite ---------------------
def upsert_setting(db_conn, key, value):
    is_postgres = hasattr(db_conn, "dsn")
    cur = db_conn.cursor()
    try:
        if is_postgres:
            cur.execute(
                """
                INSERT INTO settings (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
                """,
                (key, value),
            )
        else:
            cur.execute(
                """
                INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value;
                """,
                (key, value),
            )
        db_conn.commit()
    finally:
        cur.close()

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
    # Disabled: feature parked
    return ("TPT calculator is disabled", 410)

@app.route("/issues")
def issues_page():
    # Old Issues page retired → redirect to Issue Hub
    return redirect(url_for("issuehub"), code=302)

@app.route("/ai_assistant")
def ai_assistant():
    return render_template("ai_assistant_page.html")

@app.route("/settings")
def settings_page():
    return render_template("settings_page.html")

@app.route("/issuehub")
def issuehub():
    return render_template("issue_hub.html")

# --- NEW: PM Tracking page route -------------------------------------------
@app.route('/pm')
def pm_tracking_page():
    return render_template('pm_page.html')

# Debug: list all routes so we can confirm /api/pms and /api/pms/add exist
@app.get("/api/_debug/routes")
def _debug_routes():
    try:
        routes = sorted([r.rule for r in app.url_map.iter_rules()])
    except Exception:
        routes = []
    return jsonify({"routes": routes})

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
    # Disabled: feature parked
    return jsonify({"error": "TPT calculator is disabled"}), 410

# --- NEW: TPT calculate endpoint used by the TPT page JS ---

@app.post("/api/tpt/calculate")
def api_tpt_calculate():
    # Disabled: feature parked
    return jsonify({"error": "TPT calculator is disabled"}), 410

# --- TPT: preview columns (Detect Columns button) ---
@app.route('/api/tpt/preview', methods=['POST'])
def api_tpt_preview():
    # Disabled: feature parked
    return jsonify({"error": "TPT preview is disabled"}), 410

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

    try:
        upsert_setting(db_conn, "lowestDesiredTpt", lowest)
        upsert_setting(db_conn, "highestDesiredTpt", highest)
        upsert_setting(db_conn, "targetTpt", target)
        upsert_setting(db_conn, "includeBirthdayBlaster", include_bb)
        return jsonify({"message": "TPT settings saved successfully!"})
    except Exception as e:
        return jsonify({"error": f"Failed to save settings: {e}"}), 500


# already imported earlier in your file for the other route
from issues_db import _debug_active_breakdown  # type: ignore

@app.route("/api/issues/_debug_counts", methods=["GET"])
def api_debug_counts():
    try:
        return jsonify(_debug_active_breakdown())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Open Issues Count API ---
from flask import jsonify
from issues_db import count_all_open_issues

@app.route("/api/issues/count", methods=["GET"])
def api_count_open_issues():
    try:
        total = count_all_open_issues()
        return jsonify({"count": int(total)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- 7) Health Check API ---------------------------------------------------
# --- Health Check API (rich + cached) --------------------------------------
import time

_HEALTH_CACHE = {"ts": 0.0, "payload": None}
_HEALTH_TTL = 60.0  # seconds

def _ok(msg):    return {"status": "ok",    "message": msg}
def _err(msg):   return {"status": "error", "message": msg}
def _skip(msg):  return {"status": "skip",  "message": msg}  # used if not configured

def _check_db():
    try:
        if DATABASE_URL:                  # Postgres on Render
            conn = psycopg2.connect(DATABASE_URL)
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
            cur.close()
            conn.close()
            return _ok("PostgreSQL reachable.")
        else:                             # Local SQLite
            conn = sqlite3.connect("app.db")
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
            cur.close()
            conn.close()
            return _ok("SQLite reachable.")
    except Exception as e:
        return _err(f"DB error: {e}")

def _check_storage():
    path = "data"
    try:
        if os.path.exists(path) and os.access(path, os.W_OK):
            return _ok("Storage is writable.")
        return _err("Storage dir missing or not writable.")
    except Exception as e:
        return _err(f"Storage error: {e}")

def _check_route(url):
    try:
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            return _ok(f"{url} OK")
        return _err(f"{url} status {r.status_code}")
    except requests.RequestException as e:
        return _err(f"{url} error: {e}")

def _check_issue_api():
    base = request.url_root.rstrip("/")
    url = f"{base}/api/issuehub/list?category=gameroom&status=all"
    return _check_route(url)

def _check_games_api():
    base = request.url_root.rstrip("/")
    url = f"{base}/api/games"
    return _check_route(url)

def _check_weather():
    key = os.environ.get("OPENWEATHER_API_KEY")
    if not key:
        return _skip("No OPENWEATHER_API_KEY set.")
    try:
        # Very small call; adjust your coordinates if needed
        url = (
            "https://api.openweathermap.org/data/2.5/weather"
            f"?lat={LATITUDE}&lon={LONGITUDE}&appid={key}&units=imperial"
        )
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            return _ok("OpenWeather reachable.")
        return _err(f"OpenWeather status {r.status_code}")
    except requests.RequestException as e:
        return _err(f"OpenWeather error: {e}")

def _check_ai():
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return _skip("No GEMINI_API_KEY set.")
    try:
        # Light “ping” – don’t rely on response.text (sometimes empty on finish_reason=2)
        model = genai.GenerativeModel(MODEL_NAME)
        resp = model.generate_content("ping", generation_config={"max_output_tokens": 1})
        # If no exception was thrown, we consider it reachable.
        return _ok("Gemini reachable.")
    except Exception as e:
        return _err(f"Gemini error: {e}")

def _compute_health_payload():
    services = {
        "database":   _check_db(),
        "storage":    _check_storage(),
        "issue_api":  _check_issue_api(),
        "games_api":  _check_games_api(),
        "weather":    _check_weather(),
        "ai":         _check_ai(),
    }
    overall = "ok" if all(s["status"] in ("ok", "skip") for s in services.values()) else "error"
    return {"overall": overall, "services": services, "ttl": _HEALTH_TTL}

@app.get("/api/health")
def health_check():
    now = time.monotonic()
    if _HEALTH_CACHE["payload"] and (now - _HEALTH_CACHE["ts"] < _HEALTH_TTL):
        return jsonify(_HEALTH_CACHE["payload"])
    payload = _compute_health_payload()
    _HEALTH_CACHE["payload"] = payload
    _HEALTH_CACHE["ts"] = now
    return jsonify(payload)

@app.get("/api/health/refresh")
def health_refresh():
    # Force a fresh run (handy when debugging or after fixing a service)
    payload = _compute_health_payload()
    _HEALTH_CACHE["payload"] = payload
    _HEALTH_CACHE["ts"] = time.monotonic()
    return jsonify(payload)


# --- 8) AI endpoint --------------------------------------------------------
@app.post("/api/ai/ask")
def ai_ask():
    data = request.get_json(silent=True) or {}
    prompt = (data.get("prompt") or "").strip()
    context = data.get("context") or {}

    if not prompt:
        return jsonify({"error": "Missing prompt"}), 400

    # Demo path if key is missing (keeps UI usable)
    if not os.environ.get("GEMINI_API_KEY"):
        return jsonify({"reply": f"(demo) I got: {prompt}"}), 200

    # ——— build message ———
    system_hint = (
        "You are an assistant for the Ultimate Task Manager application. "
        "Your purpose is to help an arcade operations manager with their daily tasks. "
        "Respond concisely in 1-2 sentences. "
        "Do not echo the user's prompt back. "
        "Your responses should be concise and actionable. "
    )
    ctx_lines = []
    if context.get("url"):  ctx_lines.append(f"URL: {context['url']}")
    if context.get("page"): ctx_lines.append(f"Page: {context['page']}")
    ctx_text = "\n".join(ctx_lines)
    user_msg = f"{ctx_text}\n\nUser: {prompt}" if ctx_text else prompt

    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    def _extract_text(resp) -> str:
        """Return concatenated text parts or '' if none."""
        try:
            for c in (getattr(resp, "candidates", []) or []):
                parts = getattr(getattr(c, "content", None), "parts", []) or []
                texts = [getattr(p, "text", "") for p in parts if getattr(p, "text", "")]
                if texts:
                    return "".join(texts).strip()
        except Exception:
            pass
        return ""

    # Create model (handle older SDKs without system_instruction)
    try:
        model = genai.GenerativeModel(model_name, system_instruction=system_hint)
    except TypeError:
        model = genai.GenerativeModel(model_name)
        user_msg = f"{system_hint}\n\n{user_msg}"

    gen_cfg = {"temperature": 0.3, "top_p": 0.9, "max_output_tokens": 1024}

    try:
        # 1st attempt
        resp = model.generate_content(user_msg, generation_config=gen_cfg)
        text = _extract_text(resp)

        # If empty, inspect finish_reason and retry once
        if not text:
            finish_reason = None
            try:
                finish_reason = getattr(resp.candidates[0], "finish_reason", None)
            except Exception:
                pass

            # If MAX_TOKENS (2), try again with a larger cap
            if finish_reason == 2:
                resp = model.generate_content(
                    user_msg,
                    generation_config={**gen_cfg, "max_output_tokens": 2048},
                )
                text = _extract_text(resp)

            # As a last resort, try a stable backup model
            if not text and model_name != "gemini-1.5-flash":
                try:
                    backup = genai.GenerativeModel("gemini-1.5-flash")
                    resp = backup.generate_content(user_msg, generation_config=gen_cfg)
                    text = _extract_text(resp)
                except Exception:
                    pass

        if not text:
            # Surface a friendly error with the finish_reason for debugging
            fr = None
            try:
                fr = getattr(resp.candidates[0], "finish_reason", None)
            except Exception:
                pass
            return jsonify({"error": f"AI returned no text (finish_reason={fr}). Try again or shorten your prompt."}), 502
        def _strip_reflection(reply: str, user: str) -> str:
            if not reply or not user:
                return reply
            r, u = reply.strip(), user.strip()
            # If the reply starts with the exact prompt, remove it.
            if r.lower().startswith(u.lower()):
                r = r[len(u):].lstrip(" \n:,-")
            return r

        text = _strip_reflection(text, prompt)
        return jsonify({"reply": text}), 200

    except Exception as e:
        app.logger.exception("AI error")
        return jsonify({"error": str(e)}), 500


@app.get("/api/dashboard/metrics")
def dashboard_metrics():
    db = get_db()
    cur = db.cursor()
    # counts from issues table
    cur.execute("SELECT COUNT(*) FROM issues WHERE status='open';")
    open_issues = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM issues WHERE status='in_progress';")
    in_progress = cur.fetchone()[0]

    # stale in_progress: last_updated before today
    cur.execute("""
        SELECT COUNT(*) FROM issues
        WHERE status='in_progress'
          AND date(last_updated) < date('now', 'localtime')
    """)
    stale_in_progress = cur.fetchone()[0]

    # overdue targets (not resolved/archived)
    cur.execute("""
        SELECT COUNT(*) FROM issues
        WHERE target_date IS NOT NULL
          AND DATE(target_date) < DATE('now','localtime')
          AND status NOT IN ('resolved','archived','trash')
    """)
    overdue_targets = cur.fetchone()[0]

    # down games (assumes games table has status column)
    try:
        cur.execute("SELECT COUNT(*) FROM games WHERE lower(status)='down';")
        down_games = cur.fetchone()[0]
    except Exception:
        down_games = 0  # if column doesn't exist yet

    return jsonify({
        "open_issues": open_issues,
        "in_progress": in_progress,
        "stale_in_progress": stale_in_progress,
        "overdue_targets": overdue_targets,
        "down_games": down_games,
    })



# --- NEW: PM Tracking APIs ------------------------------------------------
@app.route('/api/pms', methods=['GET'])
def get_pms():
    db = get_db()
    cur = db.cursor()
    try:
        # CAST makes join safe even if pm_logs.game_id is TEXT
        cur.execute("""
            SELECT
                p.pm_date               AS pm_date,
                COALESCE(p.notes, '')   AS notes,
                COALESCE(p.completed_by,'') AS completed_by,
                COALESCE(g.name, '')    AS game_name
            FROM pm_logs p
            LEFT JOIN games g ON CAST(p.game_id AS INTEGER) = g.id
            ORDER BY p.pm_date DESC, p.id DESC;
        """)
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        data = [dict(zip(cols, r)) for r in rows]
        return jsonify({"items": data})
    except Exception as e:
        app.logger.error("Error fetching PM history: %s", e)
        return jsonify({"error": "Failed to fetch PM history"}), 500
    finally:
        cur.close()

@app.route('/api/pms/add', methods=['POST'])
def add_pm():
    db = get_db()
    data = request.get_json(silent=True) or {}
    game_id = data.get('pmGame')
    pm_date_str = data.get('pmDate')
    notes = data.get('pmNotes') or ''
    completed_by = data.get('pmCompletedBy') or ''

    if not game_id or not pm_date_str:
        return jsonify({"error": "Missing required fields"}), 400

    is_postgres = hasattr(db, "dsn")
    placeholders = "%s, %s, %s, %s" if is_postgres else "?, ?, ?, ?"
    sql_stmt = f"INSERT INTO pm_logs (game_id, pm_date, notes, completed_by) VALUES ({placeholders})"

    try:
        try:
            game_id_int = int(game_id)
        except (TypeError, ValueError):
            game_id_int = game_id  # fallback; CAST in SELECT handles it

        cur = db.cursor()
        cur.execute(sql_stmt, (game_id_int, pm_date_str, notes, completed_by))
        db.commit()
        return jsonify({"success": True, "message": "PM logged successfully!"})
    except Exception as e:
        db.rollback()
        app.logger.error("Error adding PM log: %s", e)
        return jsonify({"error": "Failed to log PM"}), 500
    finally:
        try:
            cur.close()
        except Exception:
            pass

@app.get("/api/pms/last_by_game")
def api_pm_last_by_game():
    db = get_db()
    cur = db.cursor()
    try:
        # 1) All games
        cur.execute("SELECT id, name FROM games ORDER BY name;")
        games = cur.fetchall()
        # Normalize rows → list of dicts
        gcols = [d[0] for d in cur.description]
        games = [dict(zip(gcols, r)) for r in games]

        # 2) Last PM per game (handles TEXT or INT game_id)
        cur.execute("""
            SELECT CAST(game_id AS INTEGER) AS gid, MAX(pm_date) AS last_pm
            FROM pm_logs
            GROUP BY CAST(game_id AS INTEGER)
        """)
        rows = cur.fetchall()
        rcols = [d[0] for d in cur.description]
        last_map = {}
        for r in rows:
            drow = dict(zip(rcols, r))
            last_map[drow["gid"]] = drow["last_pm"]  # date or str YYYY-MM-DD

        today = _date.today()
        items = []
        for g in games:
            gid = g["id"]
            gname = g["name"]
            raw = last_map.get(gid)
            last_dt = None
            if raw:
                # Postgres returns date; SQLite usually returns str 'YYYY-MM-DD'
                if isinstance(raw, _date):
                    last_dt = raw
                elif isinstance(raw, str):
                    try:
                        last_dt = datetime.strptime(raw[:10], "%Y-%m-%d").date()
                    except Exception:
                        last_dt = None

            if last_dt is None:
                status = "due"           # never PM'd → due
                days_since = None
            else:
                days_since = (today - last_dt).days
                if days_since >= 90:
                    status = "due"
                elif days_since >= 75:
                    status = "soon"
                else:
                    status = "ok"

            items.append({
                "game_id": gid,
                "game_name": gname,
                "last_pm_date": (last_dt.isoformat() if last_dt else None),
                "days_since": (int(days_since) if days_since is not None else None),
                "status": status
            })

        # Sort: due → soon → ok, then name
        order = {"due": 0, "soon": 1, "ok": 2}
        items.sort(key=lambda x: (order.get(x["status"], 9), (x["game_name"] or "").lower()))
        return jsonify({"items": items})
    except Exception as e:
        db.rollback()
        app.logger.error("api_pm_last_by_game error: %s", e)
        return jsonify({"error": f"{e}"}), 500
    finally:
        try:
            cur.close()
        except Exception:
            pass

@app.get("/daily-tasks")
def daily_tasks_page():
    return render_template("daily_tasks.html")            


# --- 9) Module Registration ------------------------------------------------
register_issue_hub_blueprint(app, get_db, ensure_id_sequences)  # page blueprint
register_game_routes(app, get_db)                               # APIs
register_issue_routes(app, get_db)

# --- 10) Entrypoint --------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)