# =========================================================================
# ARCADE MANAGER - ISSUES API
# REST endpoints for Issues (list/create/update/delete, helpers).
#
# Routes:
# - GET  /api/issues
# - POST /api/issues              (creates padded ID via id_sequences)
# - PUT  /api/issues/<id>
# - DELETE /api/issues/<id>
# - POST /api/issues/reset        (clears issuehub_issues + issues)
# - GET  /api/urgent_issues_count
# - GET  /api/equipment_locations
# =========================================================================

from flask import jsonify, request

def register_issue_routes(app, get_db):

    # ---------- helpers ----------
    def is_postgres(db):
        return hasattr(db, "dsn")

    def get_next_padded_id(db, entity: str, width: int = 3, prefix: str = "IS-") -> str:
        """
        Returns a new padded ID like 'IS-001' by incrementing id_sequences(entity).
        Creates the table/row if missing (works on both engines).
        """
        pg = is_postgres(db)
        cur = db.cursor()
        try:
            # Ensure table exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS id_sequences (
                    entity  TEXT PRIMARY KEY,
                    counter INTEGER NOT NULL
                );
            """)
            db.commit()

            # Ensure row exists
            if pg:
                cur.execute(
                    "INSERT INTO id_sequences (entity, counter) VALUES (%s, 0) "
                    "ON CONFLICT (entity) DO NOTHING;",
                    (entity,)
                )
            else:
                cur.execute(
                    "INSERT OR IGNORE INTO id_sequences (entity, counter) VALUES (?, 0);",
                    (entity,)
                )
            db.commit()

            # Bump and fetch
            if pg:
                cur.execute(
                    "UPDATE id_sequences SET counter = counter + 1 WHERE entity = %s RETURNING counter;",
                    (entity,)
                )
                new_counter = cur.fetchone()[0]
            else:
                cur.execute(
                    "UPDATE id_sequences SET counter = counter + 1 WHERE entity = ?;",
                    (entity,)
                )
                cur.execute(
                    "SELECT counter FROM id_sequences WHERE entity = ?;",
                    (entity,)
                )
                new_counter = cur.fetchone()[0]

            db.commit()
            return f"{prefix}{str(new_counter).zfill(width)}"
        finally:
            cur.close()

    def safe_iso(val):
        if val is None:
            return None
        return val.isoformat() if hasattr(val, "isoformat") else str(val)

    # ---------- routes ----------
    
    @app.route('/api/issues', methods=['GET', 'POST'])
    def issues_collection():
            db = get_db()
            cur = db.cursor()

            if request.method == 'GET':
                try:
                    # Optional filters
                    status_param = (request.args.get('status') or '').strip()
                    category_param = (request.args.get('category') or '').strip()
                    q_param = (request.args.get('q') or '').strip()

                    def norm(s: str) -> str:
                        return s.lower().replace('_', ' ').replace('-', ' ').strip()

                    # Map friendly status tokens to stored values
                    status_map = {
                        'open': 'Open',
                        'in progress': 'In Progress',
                        'inprogress': 'In Progress',
                        'resolved': 'Closed',   # treat resolved as closed
                        'closed': 'Closed',
                        'archived': 'Archived',
                        'awaiting parts': 'Awaiting Parts',
                        'awaitingparts': 'Awaiting Parts',
                        'awaitingpart': 'Awaiting Parts',
                        'blocked': 'Blocked',
                    }

                    filters, params = [], []
                    pg = is_postgres(db)
                    ph = '%s' if pg else '?'

                    if status_param:
                        target_status = status_map.get(norm(status_param), status_param)
                        filters.append(f"LOWER(status) = LOWER({ph})")
                        params.append(target_status)

                    if category_param:
                        # UI sends category; DB column is area (Gameroom/Facility/Games)
                        filters.append(f"LOWER(area) = LOWER({ph})")
                        params.append(category_param)

                    if q_param:
                        like = f"%{q_param}%"
                        filters.append(
                            f"(LOWER(description) LIKE LOWER({ph}) OR LOWER(notes) LIKE LOWER({ph}) OR LOWER(equipment_location) LIKE LOWER({ph}))"
                        )
                        params.extend([like, like, like])

                    sql = (
                        "SELECT id, priority, date_logged, last_updated, area, equipment_location, "
                        "description, notes, status, target_date, assigned_to "
                        "FROM issues"
                    )
                    if filters:
                        sql += " WHERE " + " AND ".join(filters)
                    sql += " ORDER BY date_logged DESC;"

                    cur.execute(sql, tuple(params))
                    rows = cur.fetchall()
                    out = []
                    for r in rows:
                        out.append({
                            "id": r[0],
                            "priority": r[1],
                            "date_logged": safe_iso(r[2]),
                            "last_updated": safe_iso(r[3]),
                            "area": r[4],
                            "equipment_location": r[5],
                            "description": r[6],
                            "notes": r[7],
                            "status": r[8],
                            "target_date": safe_iso(r[9]),
                            "assigned_to": r[10],
                        })
                    return jsonify(out)
                except Exception as e:
                    print(f"ERROR: GET /api/issues failed: {e}")
                    return jsonify({"error": "Failed to retrieve issues"}), 500
                finally:
                    cur.close()

            # POST (create)
            try:
                # Accept both JSON and form-data
                data_json = request.get_json(silent=True) or {}
                data_form = request.form.to_dict() if request.form else {}
                # Let form override json if both present
                data = {}
                data.update(data_json)
                data.update(data_form)

                def pick(*names, default=''):
                    for n in names:
                        v = data.get(n)
                        if v is not None and str(v).strip() != '':
                            return v
                    return default

                # --- UPDATED LINE ---
                description = pick('description', 'title', 'problem', 'desc')
                # --------------------
                priority = pick('priority', 'priority_level')
                status = pick('status', 'status_text', 'state') or 'Open'
                area = pick('area', 'category', 'tab')
                equipment_location = pick('equipment_location', 'equipment_name', 'location', 'equipment', 'game')
                notes = pick('notes', 'note', 'details')
                target_date = pick('target_date', 'target', 'due_date')
                assigned_to = pick('assigned_to', 'assignee', 'assigned', 'employee')

                missing = []
                if not description: missing.append('description')
                if not priority: missing.append('priority')
                if not status: missing.append('status')
                if not target_date: missing.append('target_date')
                if missing:
                    return jsonify({"error": "Missing required fields", "missing_fields": missing}), 400

                issue_id = get_next_padded_id(db, entity="issue", width=3, prefix="IS-")

                pg = is_postgres(db)
                cur = db.cursor()
                ph = '%s' if pg else '?'
                sql = f"""
                    INSERT INTO issues (id, description, priority, status, area, equipment_location, notes, target_date, assigned_to)
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph});
                """
                cur.execute(sql, (issue_id, description, priority, status, area, equipment_location, notes, target_date, assigned_to))
                db.commit()

                # Mirror to Issue Hub table (best-effort)
                try:
                    cur2 = db.cursor()
                    cur2.execute("""
                        CREATE TABLE IF NOT EXISTS issuehub_issues (
                            id TEXT PRIMARY KEY,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            description TEXT,
                            priority TEXT,
                            status TEXT,
                            category TEXT,
                            equipment_name TEXT,
                            equipment_location TEXT,
                            notes TEXT,
                            target_date TEXT,
                            assigned_to TEXT
                        );
                    """)
                    hub_sql = """
                        INSERT INTO issuehub_issues (
                            id, description, priority, status, category, equipment_name, equipment_location, notes, target_date, assigned_to
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """ if is_postgres(db) else """
                        INSERT INTO issuehub_issues (
                            id, description, priority, status, category, equipment_name, equipment_location, notes, target_date, assigned_to
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """
                    cur2.execute(hub_sql, (
                        issue_id, description, priority, status, area, None, equipment_location, notes, target_date, assigned_to
                    ))
                    db.commit()
                    cur2.close()
                except Exception as e:
                    # Don’t fail the main insert if mirror fails
                    db.rollback()
                    print(f"WARN: mirror to issuehub_issues failed: {e}")

                return jsonify({"message": "Issue added successfully!", "issue_id": issue_id}), 201
            except Exception as e:
                db.rollback()
                print(f"ERROR: POST /api/issues failed: {e}")
                return jsonify({"error": f"Server error: {e}"}), 500
            finally:
                try:
                    cur.close()
                except Exception:
                    pass


    @app.route('/api/issues/<issue_id>', methods=['PUT'])
    def update_issue(issue_id):
        try:
            db = get_db()
            pg = is_postgres(db)
            data = request.get_json(force=True) or {}
            allowed = ['description', 'area', 'equipment_location', 'priority', 'status', 'notes', 'assigned_to', 'target_date']

            set_parts, values = [], []
            ph = '%s' if pg else '?'
            for k in allowed:
                if k in data:
                    set_parts.append(f"{k} = {ph}")
                    values.append(data[k])
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
                print(f"ERROR: PUT /api/issues/{issue_id} failed: {e}")
                return jsonify({"error": "Failed to update issue"}), 500
            finally:
                cur.close()
        except Exception as e:
            print(f"ERROR: PUT outer /api/issues/{issue_id}: {e}")
            return jsonify({"error": "Server error"}), 500

    @app.route('/api/issues/<issue_id>', methods=['DELETE'])
    def delete_issue(issue_id):
        try:
            db = get_db()
            pg = is_postgres(db)
            ph = '%s' if pg else '?'
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
                print(f"ERROR: DELETE /api/issues/{issue_id} failed: {e}")
                return jsonify({"error": "Failed to delete issue"}), 500
            finally:
                cur.close()
        except Exception as e:
            print(f"ERROR: DELETE outer /api/issues/{issue_id}: {e}")
            return jsonify({"error": "Server error"}), 500

    @app.route('/api/issuehub_open_count', methods=['GET'])
    def issuehub_open_count():
        """Return number of Open issues from Issue Hub table; fallback to legacy issues if hub table missing."""
        try:
            db = get_db()
            cur = db.cursor()
            try:
                cur.execute("SELECT COUNT(*) FROM issuehub_issues WHERE status = 'Open';")
                count = cur.fetchone()[0]
                return jsonify({"count": int(count)})
            except Exception:
                # Fallback to legacy issues table
                try:
                    cur = db.cursor()
                    cur.execute("SELECT COUNT(*) FROM issues WHERE status = 'Open';")
                    count = cur.fetchone()[0]
                    return jsonify({"count": int(count), "fallback": True})
                except Exception as e:
                    print(f"ERROR: issuehub_open_count fallback failed: {e}")
                    return jsonify({"count": 0, "error": "Database error"}), 500
            finally:
                try:
                    cur.close()
                except Exception:
                    pass
        except Exception as e:
            print(f"ERROR: /api/issuehub_open_count failed: {e}")
            return jsonify({"count": 0, "error": "Server error"}), 500

    @app.route('/api/urgent_issues_count', methods=['GET'])
    def get_urgent_issues_count():
        try:
            db = get_db()
            cur = db.cursor()
            try:
                cur.execute("""
                    SELECT COUNT(*)
                    FROM issues
                    WHERE status = 'Open' AND (priority = 'IMMEDIATE' OR priority = 'High');
                """)
                count = cur.fetchone()[0]
                return jsonify({"count": count})
            finally:
                cur.close()
        except Exception as e:
            print(f"ERROR: urgent_issues_count failed: {e}")
            return jsonify({"count": 0, "error": "Database error"}), 500

    @app.route('/api/equipment_locations', methods=['GET'])
    def equipment_locations():
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

    # --- POST /api/issues/reset -------------------------------------------
    @app.route('/api/issues/reset', methods=['POST'])
    def reset_issues():
        """
        Clears BOTH new Issue Hub table and legacy issues table.
        Frontend Settings button calls this route.
        """
        db = get_db()
        cur = db.cursor()
        try:
            # Try to clear Issue Hub table
            try:
                cur.execute("DELETE FROM issuehub_issues;")
            except Exception:
                db.rollback()
                cur = db.cursor()  # reset cursor if table missing

            # Try to clear legacy Issues table
            try:
                cur.execute("DELETE FROM issues;")
            except Exception:
                db.rollback()
                cur = db.cursor()

            db.commit()
            return jsonify({"success": True, "message": "All issues cleared."}), 200
        except Exception as e:
            db.rollback()
            return jsonify({"success": False, "message": str(e)}), 500
        finally:
            try:
                cur.close()
            except Exception:
                pass