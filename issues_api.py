# =========================================================================
# ARCADE MANAGER - ISSUES API ROUTES
# REST endpoints for Issues: list, create (padded IDs), update, delete,
# counts, and location suggestions. Works on Postgres (Render) + SQLite (local).
#
# What this file does:
# - GET  /api/issues                     → list issues (newest first)
# - POST /api/issues                     → create issue with zero-padded id (001, 002…)
# - PUT  /api/issues/<issue_id>          → update selected fields + bump last_updated
# - DELETE /api/issues/<issue_id>        → delete issue by id
# - GET  /api/urgent_issues_count        → count Open + (IMMEDIATE or High)
# - GET  /api/equipment_locations        → recent distinct equipment_location suggestions
#
# Connected files:
# - app.py                 (calls register_issue_routes(app, get_db))
# - issues_db.py           (next_issue_id for padded IDs; optional helpers)
# - templates/issues.html  (frontend)
# - static/js/*            (dashboard/issues UIs)
# =========================================================================

from flask import request, jsonify
from psycopg2 import sql

# Optional helper: zero-padded IDs via id_sequences table
# (We rely on next_issue_id() to lazily ensure the sequence row exists)
try:
    from issues_db import next_issue_id  # returns "001", "002", ...
except Exception:
    next_issue_id = None  # fallback handled in POST

def _is_postgres(db):
    return hasattr(db, "dsn")

def _safe_iso(val):
    """Return ISO string for datetimes/dates if possible; else str/None."""
    if val is None:
        return None
    return val.isoformat() if hasattr(val, "isoformat") else str(val)

def register_issue_routes(app, get_db):
    # ----------------------------- List + Create -----------------------------

    @app.route('/api/issues', methods=['GET', 'POST'])
    def issues_collection():
        db = get_db()
        cur = db.cursor()

        if request.method == 'GET':
            try:
                cur.execute("""
                    SELECT id, priority, date_logged, last_updated, area,
                           equipment_location, description, notes, status,
                           target_date, assigned_to
                    FROM issues
                    ORDER BY date_logged DESC;
                """)
                rows = cur.fetchall()

                data = []
                for r in rows:
                    # r can be tuple (pg) or sqlite Row; index by position
                    data.append({
                        "id":               r[0],
                        "priority":         r[1],
                        "date_logged":      _safe_iso(r[2]),
                        "last_updated":     _safe_iso(r[3]),
                        "area":             r[4],
                        "equipment_location": r[5],
                        "description":      r[6],
                        "notes":            r[7],
                        "status":           r[8],
                        "target_date":      _safe_iso(r[9]),
                        "assigned_to":      r[10],
                    })
                return jsonify(data)
            except Exception as e:
                app.logger.error(f"/api/issues GET failed: {e}")
                return jsonify({"error": "Failed to retrieve issues"}), 500
            finally:
                cur.close()

        # POST (create)
        try:
            body = request.get_json(force=True) or {}
            description = body.get('description', '').strip()
            priority    = body.get('priority', '').strip()
            status      = body.get('status', '').strip()
            area        = body.get('area', '').strip()
            equip_loc   = body.get('equipment_location', '').strip()
            notes       = body.get('notes', '').strip()
            target_date = body.get('target_date')  # may be None/'' (client raw)
            assigned_to = body.get('assigned_to', '').strip()

            if not description or not priority or not status:
                return jsonify({"error": "Missing required fields: description, priority, status"}), 400

            # padded ID if helper is available, else timestamp fallback
            if next_issue_id:
                issue_id = next_issue_id(db)  # "001"
            else:
                import time
                issue_id = f"{int(time.time())}"

            is_pg = _is_postgres(db)
            cur = db.cursor()
            try:
                if is_pg:
                    cur.execute(sql.SQL("""
                        INSERT INTO issues
                          (id, description, priority, status, area, equipment_location,
                           notes, target_date, assigned_to, last_updated)
                        VALUES
                          (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP);
                    """), (issue_id, description, priority, status, area, equip_loc, notes, target_date, assigned_to))
                else:
                    cur.execute("""
                        INSERT INTO issues
                          (id, description, priority, status, area, equipment_location,
                           notes, target_date, assigned_to, last_updated)
                        VALUES
                          (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
                    """, (issue_id, description, priority, status, area, equip_loc, notes, target_date, assigned_to))
                db.commit()
                return jsonify({"message": "Issue added successfully!", "issue_id": issue_id}), 201
            except Exception as e:
                db.rollback()
                app.logger.error(f"/api/issues POST failed: {e}")
                return jsonify({"error": "Failed to add issue"}), 500
            finally:
                cur.close()
        except Exception as e:
            app.logger.error(f"/api/issues POST outer failure: {e}")
            return jsonify({"error": "Server error"}), 500

    # ----------------------------- Update -----------------------------------

    @app.route('/api/issues/<issue_id>', methods=['PUT'])
    def issues_update(issue_id):
        db = get_db()
        is_pg = _is_postgres(db)
        ph = '%s' if is_pg else '?'

        body = request.get_json(force=True) or {}
        allowed = ['description', 'area', 'equipment_location', 'priority',
                   'status', 'notes', 'assigned_to', 'target_date']

        set_parts = []
        values = []
        for k in allowed:
            if k in body:
                set_parts.append(f"{k} = {ph}")
                values.append(body[k])

        if not set_parts:
            return jsonify({"error": "No fields to update"}), 400

        set_parts.append("last_updated = CURRENT_TIMESTAMP")
        sql_str = f"UPDATE issues SET {', '.join(set_parts)} WHERE id = {ph};"

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
            app.logger.error(f"/api/issues PUT failed: {e}")
            return jsonify({"error": "Failed to update issue"}), 500
        finally:
            cur.close()

    # ----------------------------- Delete -----------------------------------

    @app.route('/api/issues/<issue_id>', methods=['DELETE'])
    def issues_delete(issue_id):
        db = get_db()
        is_pg = _is_postgres(db)
        ph = '%s' if is_pg else '?'

        cur = db.cursor()
        try:
            cur.execute(f"DELETE FROM issues WHERE id = {ph};", (issue_id,))
            if cur.rowcount == 0:
                db.commit()
                return jsonify({"error": "Issue not found"}), 404
            db.commit()
            return jsonify({"message": "Issue deleted", "issue_id": issue_id})
        except Exception as e:
            db.rollback()
            app.logger.error(f"/api/issues DELETE failed: {e}")
            return jsonify({"error": "Failed to delete issue"}), 500
        finally:
            cur.close()

    # ----------------------------- Counts -----------------------------------

    @app.route('/api/urgent_issues_count', methods=['GET'])
    def urgent_issues_count():
        """Open AND (IMMEDIATE or High)."""
        db = get_db()
        cur = db.cursor()
        try:
            cur.execute(sql.SQL("""
                SELECT COUNT(*)
                FROM issues
                WHERE status = 'Open' AND (priority = 'IMMEDIATE' OR priority = 'High');
            """))
            count = cur.fetchone()[0]
            return jsonify({"count": int(count)})
        except Exception as e:
            app.logger.error(f"/api/urgent_issues_count failed: {e}")
            return jsonify({"count": 0, "error": "Database error fetching count"}), 500
        finally:
            cur.close()

    # ------------------------ Location suggestions --------------------------

    @app.route('/api/equipment_locations', methods=['GET'])
    def equipment_locations():
        """Distinct equipment_location values (newest first, limit 50)."""
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
            items = [r[0] for r in rows if r and r[0]]
            return jsonify({"items": items})
        except Exception as e:
            app.logger.error(f"/api/equipment_locations failed: {e}")
            return jsonify({"items": [], "error": "failed"}), 500
        finally:
            cur.close()
