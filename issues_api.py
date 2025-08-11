# =========================================================================
# ARCADE MANAGER - ISSUES API
# Routes for Issues (GET/POST/PUT/DELETE), counts, equipment suggestions,
# and permanent sequential IDs like ISS-001.
#
# What this file does:
# - Exposes: /api/issues (GET, POST), /api/issues/<id> (PUT, DELETE)
# - Exposes: /api/urgent_issues_count (GET)
# - Exposes: /api/equipment_locations (GET)
# - Provides: get_next_issue_id() using settings.issue_counter
# - One-time helper: /admin/seed_issue_counter to sync counter to current max
#
# Connected files:
# - app.py (calls register_issue_routes(app, get_db))
# - templates/issues.html (table UI)
# - static/js/modules/tableRenderer.js (renders Issues table)
# =========================================================================

from flask import request, jsonify

def register_issue_routes(app, get_db):
    """
    Call this from app.py:
        from issues_api import register_issue_routes
        register_issue_routes(app, get_db)
    """

    # -------- Helpers --------
    def _is_postgres(db):
        return hasattr(db, 'dsn')

    def _safe_iso(val):
        if val is None:
            return None
        return val.isoformat() if hasattr(val, "isoformat") else str(val)

    def get_next_issue_id():
        """
        Returns next ID like 'ISS-001' using settings.issue_counter.
        Works on SQLite and Postgres.
        """
        db = get_db()
        cur = db.cursor()
        try:
            if _is_postgres(db):
                # Postgres: upsert + atomic increment with RETURNING
                cur.execute("BEGIN;")
                cur.execute(
                    "INSERT INTO settings (key, value) VALUES (%s, %s) "
                    "ON CONFLICT (key) DO NOTHING;",
                    ('issue_counter', '0')
                )
                cur.execute(
                    "UPDATE settings SET value = ((value::int) + 1)::text "
                    "WHERE key = %s RETURNING value;",
                    ('issue_counter',)
                )
                new_val = cur.fetchone()[0]
                db.commit()
            else:
                # SQLite: immediate lock to avoid races
                cur.execute("BEGIN IMMEDIATE;")
                cur.execute(
                    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);",
                    ('issue_counter', '0')
                )
                cur.execute(
                    "UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = ?;",
                    ('issue_counter',)
                )
                cur.execute("SELECT value FROM settings WHERE key = ?;", ('issue_counter',))
                row = cur.fetchone()
                new_val = row[0] if row else '1'
                db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            cur.close()

        try:
            n = int(str(new_val))
        except:
            n = 1
        return f"ISS-{n:03d}"

    # -------- Routes --------

    @app.route('/api/issues', methods=['GET', 'POST'])
    def api_issues():
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
                    # rows may be tuples or rows; use index access like original code
                    data.append({
                        "id": r[0],
                        "priority": r[1],
                        "date_logged": _safe_iso(r[2]),
                        "last_updated": _safe_iso(r[3]),
                        "area": r[4],
                        "equipment_location": r[5],
                        "description": r[6],
                        "notes": r[7],
                        "status": r[8],
                        "target_date": _safe_iso(r[9]),
                        "assigned_to": r[10],
                    })
                return jsonify(data)
            except Exception as e:
                print(f"ERROR: Failed to fetch issues: {e}")
                return jsonify({"error": "Failed to retrieve issues", "details": str(e)}), 500
            finally:
                cur.close()

        # POST
        try:
            data = request.get_json(force=True) or {}

            description = data.get('description')
            priority = data.get('priority')
            status = data.get('status')
            area = data.get('area', '')
            equipment_location = data.get('equipment_location', '')
            notes = data.get('notes', '')
            target_date = data.get('target_date')
            assigned_to = data.get('assigned_to', '')

            if not description or not priority or not status:
                return jsonify({"error": "Missing required fields: description, priority, status"}), 400

            issue_id = get_next_issue_id()

            is_pg = _is_postgres(db)
            ph = '%s' if is_pg else '?'
            sql_insert = (
                f"INSERT INTO issues (id, description, priority, status, area, equipment_location, "
                f"notes, target_date, assigned_to, last_updated) "
                f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, CURRENT_TIMESTAMP);"
            )
            params = (issue_id, description, priority, status, area, equipment_location, notes, target_date, assigned_to)

            cur = db.cursor()
            try:
                cur.execute(sql_insert, params)
                db.commit()
                return jsonify({"message": "Issue added successfully!", "issue_id": issue_id}), 201
            except Exception as e:
                db.rollback()
                print(f"ERROR: Failed to add issue: {e}")
                return jsonify({"error": "Failed to add issue", "details": str(e)}), 500
            finally:
                cur.close()

        except Exception as e:
            print(f"ERROR: POST /api/issues failed: {e}")
            return jsonify({"error": "Server error"}), 500

    @app.route('/api/issues/<issue_id>', methods=['PUT'])
    def api_issue_update(issue_id):
        try:
            db = get_db()
            is_pg = _is_postgres(db)
            ph = '%s' if is_pg else '?'

            data = request.get_json(force=True) or {}
            allowed = ['description', 'area', 'equipment_location',
                       'priority', 'status', 'notes', 'assigned_to', 'target_date']

            set_parts = []
            values = []
            for key in allowed:
                if key in data:
                    set_parts.append(f"{key} = {ph}")
                    values.append(data[key])

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
                print(f"ERROR: update_issue failed: {e}")
                return jsonify({"error": "Failed to update issue", "details": str(e)}), 500
            finally:
                cur.close()

        except Exception as e:
            print(f"ERROR: update_issue outer failure: {e}")
            return jsonify({"error": "Server error"}), 500

    @app.route('/api/issues/<issue_id>', methods=['DELETE'])
    def api_issue_delete(issue_id):
        try:
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
                print(f"ERROR: delete_issue failed: {e}")
                return jsonify({"error": "Failed to delete issue", "details": str(e)}), 500
            finally:
                cur.close()
        except Exception as e:
            print(f"ERROR: delete_issue outer failure: {e}")
            return jsonify({"error": "Server error"}), 500

    @app.route('/api/urgent_issues_count', methods=['GET'])
    def api_urgent_issues_count():
        try:
            db = get_db()
            cur = db.cursor()
            try:
                cur.execute("""
                    SELECT COUNT(*) FROM issues
                    WHERE status = 'Open' AND (priority = 'IMMEDIATE' OR priority = 'High');
                """)
                count = cur.fetchone()[0]
                return jsonify({"count": count})
            finally:
                cur.close()
        except Exception as e:
            print(f"ERROR: urgent_issues_count: {e}")
            return jsonify({"count": 0, "error": "Database error fetching count"}), 500

    @app.route('/api/equipment_locations', methods=['GET'])
    def api_equipment_locations():
        """
        Returns unique equipment_location values (newest first).
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
                items = [r[0] for r in rows if r and r[0]]
                return jsonify({"items": items})
            finally:
                cur.close()
        except Exception as e:
            print(f"ERROR: equipment_locations failed: {e}")
            return jsonify({"items": [], "error": "failed"}), 500

    @app.route('/admin/seed_issue_counter')
    def seed_issue_counter():
        """
        ONE-TIME helper.
        Sets settings.issue_counter to the max numeric part found in existing 'ISS-xxx' IDs.
        Run once locally, then remove/disable.
        """
        try:
            db = get_db()
            cur = db.cursor()
            try:
                cur.execute("SELECT id FROM issues;")
                rows = cur.fetchall()
            finally:
                pass

            max_n = 0
            for row in rows:
                raw = row[0] if isinstance(row, (list, tuple)) else row
                s = str(raw or "")
                if s.startswith("ISS-"):
                    try:
                        n = int(s.split("-", 1)[1])
                        if n > max_n:
                            max_n = n
                    except:
                        continue

            if _is_postgres(db):
                cur.execute(
                    "INSERT INTO settings (key, value) VALUES (%s, %s) "
                    "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;",
                    ('issue_counter', str(max_n))
                )
            else:
                cur.execute(
                    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);",
                    ('issue_counter', str(max_n))
                )
                cur.execute(
                    "UPDATE settings SET value = ? WHERE key = ?;",
                    (str(max_n), 'issue_counter')
                )

            db.commit()
            cur.close()
            return jsonify({"message": "issue_counter seeded", "value": max_n}), 200
        except Exception as e:
            try:
                db.rollback()
            except:
                pass
            return jsonify({"error": "seed failed", "details": str(e)}), 500
