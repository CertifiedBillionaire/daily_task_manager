# issue_hub_bp.py
# Issue Hub lives in its own blueprint.
# It is now correctly passed the database functions from app.py.

from flask import Blueprint, render_template, request, jsonify
from datetime import datetime, timedelta


issue_hub_bp = Blueprint("issue_hub", __name__)

# we'll stash app.py's get_db here so routes can use it
_get_db_fn = None


# -------- helpers -----------------------------------------------------------
def _is_pg(db):
    return hasattr(db, "dsn")  # psycopg2 connections have .dsn


def _get_db():
    # This helper function uses the function passed in from app.py
    return _get_db_fn()


def ensure_issuehub_tables(get_db_fn, ensure_id_sequences):
    """
    Creates base tables if missing, ensures id_sequences rows,
    then safely adds new columns (no-op if they exist).
    """
    db = get_db_fn()

    # --- issuehub_issues base table ---
    cur = db.cursor()
    try:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS issuehub_issues (
                id           TEXT PRIMARY KEY,
                category     TEXT NOT NULL,
                title        TEXT NOT NULL,
                details      TEXT,
                location     TEXT,
                priority     TEXT NOT NULL DEFAULT 'medium',
                status       TEXT NOT NULL DEFAULT 'open',
                resolution   TEXT,
                reporter     TEXT,
                assignee     TEXT,
                created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                resolved_at  TIMESTAMP WITH TIME ZONE
            );
            """
        )
        db.commit()

        # id_sequences row for Issue Hub IDs
        ensure_id_sequences(db)
        if _is_pg(db):
            cur.execute(
                "INSERT INTO id_sequences (entity, counter) VALUES ('ih', 0) "
                "ON CONFLICT (entity) DO NOTHING;"
            )
        else:
            cur.execute(
                "INSERT OR IGNORE INTO id_sequences (entity, counter) VALUES ('ih', 0);"
            )
        db.commit()
    finally:
        cur.close()

    # --- employees table + id_sequences row ---
    cur = db.cursor()
    try:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS employees (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL UNIQUE,
                active     INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        db.commit()

        if _is_pg(db):
            cur.execute(
                "INSERT INTO id_sequences (entity, counter) VALUES ('emp', 0) "
                "ON CONFLICT (entity) DO NOTHING;"
            )
        else:
            cur.execute(
                "INSERT OR IGNORE INTO id_sequences (entity, counter) VALUES ('emp', 0);"
            )
        db.commit()
    finally:
        cur.close()

    # --- add missing columns safely (no-op if already there) ---
    # target_date (for scheduling), deleted_at (for Trash view)
    cur = db.cursor()
    try:
        try:
            cur.execute("ALTER TABLE issuehub_issues ADD COLUMN target_date TIMESTAMP WITH TIME ZONE;")
            db.commit()
        except Exception:
            db.rollback()

        try:
            cur.execute("ALTER TABLE issuehub_issues ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;")
            db.commit()
        except Exception:
            db.rollback()
    finally:
        cur.close()


def next_id(db, prefix="IH", entity="ih", width=3):
    """Make IDs like IH001, IH002… using id_sequences."""
    cur = db.cursor()
    try:
        if _is_pg(db):
            cur.execute("UPDATE id_sequences SET counter = counter + 1 WHERE entity = %s;", (entity,))
            if cur.rowcount == 0:
                cur.execute("INSERT INTO id_sequences (entity, counter) VALUES (%s, 1);", (entity,))
            cur.execute("SELECT counter FROM id_sequences WHERE entity = %s;", (entity,))
        else:
            cur.execute("UPDATE id_sequences SET counter = counter + 1 WHERE entity = ?;", (entity,))
            if cur.rowcount == 0:
                cur.execute("INSERT INTO id_sequences (entity, counter) VALUES (?, 1);", (entity,))
            cur.execute("SELECT counter FROM id_sequences WHERE entity = ?;", (entity,))
        counter = cur.fetchone()[0]
        db.commit()
        return f"{prefix}{str(counter).zfill(width)}"
    finally:
        cur.close()

def auto_archive_resolved(db, days: int = 14) -> int:
    """
    Move items to 'archived' when they have been 'resolved' for > days.
    Uses UTC and works for both Postgres and SQLite by passing a Python datetime threshold.
    Returns number of rows changed.
    """
    now = datetime.utcnow()
    threshold = now - timedelta(days=days)
    ph = "%s" if _is_pg(db) else "?"

    sql = f"""
        UPDATE issuehub_issues
        SET status = 'archived', updated_at = {ph}
        WHERE deleted_at IS NULL
          AND status = 'resolved'
          AND COALESCE(resolved_at, updated_at) < {ph};
    """

    cur = db.cursor()
    try:
        cur.execute(sql, (now, threshold))
        changed = cur.rowcount or 0
        db.commit()
        return changed
    except Exception:
        db.rollback()
        return 0
    finally:
        cur.close()


# -------- page route (keeps endpoint name 'issue_hub') ----------------------
@issue_hub_bp.route("/issue-hub")
def issue_hub_page():
    return render_template("issue_hub.html", page_title="Issue Hub")


# -------- APIs: list + create ----------------------------------------------
@issue_hub_bp.route("/api/issuehub/list", methods=["GET"])
def issuehub_list():
    """
    GET /api/issuehub/list?category=gameroom|facility&status=all|open|in_progress|resolved|archived|trash
    Rules:
    - status=trash => show ONLY deleted (deleted_at IS NOT NULL)
    - status=all (or missing) => show non-deleted AND status IN ('open','in_progress')
    - otherwise => non-deleted AND status = <value>
    """
    db = _get_db()
    # auto-move old resolved → archived (14 days)
    try:
        auto_archive_resolved(db, 14)
    except Exception:
        # don’t block listing if cleanup hiccups
        pass
    cur = db.cursor()
    try:
        category = request.args.get("category")
        status = (request.args.get("status") or "all").strip().lower()

        base = (
            "SELECT id, category, title, details, location, priority, status, resolution, "
            "reporter, assignee, target_date, created_at, updated_at, resolved_at, deleted_at "
            "FROM issuehub_issues"
        )
        where = []
        params = []

        if status == "trash":
            where.append("deleted_at IS NOT NULL")
        else:
            where.append("deleted_at IS NULL")
            if status == "all":
                where.append("status IN ('open','in_progress')")
            else:
                where.append("status = %s" if _is_pg(db) else "status = ?")
                params.append(status)

        if category:
            where.append("category = %s" if _is_pg(db) else "category = ?")
            params.append(category)

        if where:
            base += " WHERE " + " AND ".join(where)
        base += " ORDER BY created_at DESC"

        cur.execute(base, tuple(params))
        rows = cur.fetchall()

        items = []
        for r in rows:
            items.append({
                "id": r[0],
                "category": r[1],
                "title": r[2],
                "details": r[3],
                "notes": r[3],
                "location": r[4],
                "priority": r[5],
                "status": r[6],
                "resolution": r[7],
                "reporter": r[8],
                "assignee": r[9],
                "target_date": (str(r[10]) if r[10] else None),
                "created_at": str(r[11]),
                "updated_at": str(r[12]),
                "resolved_at": (str(r[13]) if r[13] else None),
                "deleted_at": (str(r[14]) if r[14] else None),
            })
        return jsonify({"items": items})
    finally:
        cur.close()

@issue_hub_bp.route("/api/issuehub/by_game", methods=["GET"])
def issuehub_by_game():
    """
    GET /api/issuehub/by_game?location=<game name>&status=all|open|in_progress|resolved|archived|trash
    - Only shows category='gameroom'
    - status default = all (open + in_progress)
    - trash shows only deleted items
    """
    db = _get_db()

    # tiny safety: auto-archive old resolved first
    try:
        auto_archive_resolved(db, 14)
    except Exception:
        pass

    cur = db.cursor()
    try:
        location = (request.args.get("location") or "").strip()
        status = (request.args.get("status") or "all").strip().lower()
        if not location:
            return jsonify({"items": []})  # no game picked yet

        base = (
            "SELECT id, category, title, details, location, priority, status, resolution, "
            "reporter, assignee, target_date, created_at, updated_at, resolved_at, deleted_at "
            "FROM issuehub_issues"
        )
        where = []
        params = []

        # only gameroom items
        where.append("category = %s" if _is_pg(db) else "category = ?")
        params.append("gameroom")

        # match exact location (you type it from the games list)
        where.append("LOWER(TRIM(COALESCE(location,''))) = " + ("%s" if _is_pg(db) else "?"))
        params.append(location.lower().strip())

        # trash vs normal
        if status == "trash":
            where.append("deleted_at IS NOT NULL")
        else:
            where.append("deleted_at IS NULL")
            if status == "all":
                where.append("status IN ('open','in_progress')")
            else:
                where.append("status = " + ("%s" if _is_pg(db) else "?"))
                params.append(status)

        if where:
            base += " WHERE " + " AND ".join(where)
        base += " ORDER BY created_at DESC"

        cur.execute(base, tuple(params))
        rows = cur.fetchall()

        items = []
        for r in rows:
            items.append({
                "id": r[0],
                "category": r[1],
                "title": r[2],
                "details": r[3],
                "notes": r[3],  # alias for frontend
                "location": r[4],
                "priority": r[5],
                "status": r[6],
                "resolution": r[7],
                "reporter": r[8],
                "assignee": r[9],
                "target_date": (str(r[10]) if r[10] else None),
                "created_at": str(r[11]),
                "updated_at": str(r[12]),
                "resolved_at": (str(r[13]) if r[13] else None),
                "deleted_at": (str(r[14]) if r[14] else None),
            })
        return jsonify({"items": items})
    finally:
        cur.close()



@issue_hub_bp.route("/api/issuehub/create", methods=["POST"])
def issuehub_create():
    """
    POST JSON:
    {
      "category": "gameroom" | "facility",
      "title": "text",
      "details": "text?" OR "notes": "text?",
      "location": "text?",
      "priority": "low|medium|high" (default medium),
      "reporter": "text?",
      "assignee": "text?",
      "status": "open" | "in_progress" (optional; defaults to open),
      "target_date": "YYYY-MM-DD" or ISO datetime (optional),
      "allow_duplicate": true|false  <-- if true, skip dupe check
    }
    """
    import re, unicodedata, difflib
    from datetime import datetime

    def _key(s: str) -> str:
        if not s:
            return ""
        s = unicodedata.normalize("NFKD", s)
        s = s.encode("ascii", "ignore").decode("ascii")
        s = s.lower().strip()
        s = re.sub(r'\b(?:no\.?|num(?:ber)?)\s*([0-9]+)\b', r'\1', s)
        s = re.sub(r'#\s*([0-9]+)\b', r'\1', s)
        s = re.sub(r'[^a-z0-9]+', ' ', s)
        s = re.sub(r'\s+', '', s)
        return s

    def _similar(a: str, b: str) -> bool:
        if not a or not b:
            return False
        if a == b:
            return True
        if (len(a) >= 4 and len(b) >= 4) and (a in b or b in a):
            return True
        import difflib as _dl
        return _dl.SequenceMatcher(None, a, b).ratio() >= 0.92

    db = _get_db()
    data = request.get_json(silent=True) or {}

    # ---- validate + normalize ----
    category = (data.get("category") or "").strip().lower()
    title    = (data.get("title") or "").strip()
    if category not in ("gameroom", "facility"):
        return jsonify({"error": "category must be 'gameroom' or 'facility'"}), 400
    if not title:
        return jsonify({"error": "title is required"}), 400

    raw_details = data.get("notes", data.get("details", ""))
    details  = (raw_details or "").strip() or None
    location = (data.get("location") or "").strip() or None

    priority = (data.get("priority") or "medium").strip().lower()
    if priority not in ("low", "medium", "high"):
        priority = "medium"

    reporter = (data.get("reporter") or "").strip() or None
    assignee = (data.get("assignee") or "").strip() or None

    status = (data.get("status") or "open").strip().lower()
    if status not in ("open", "in_progress"):
        status = "open"

    raw_td = (data.get("target_date") or "").strip()
    target_date = raw_td or None  # DB parses; blank -> NULL

    allow_duplicate = bool(data.get("allow_duplicate", False))

    # ---- improved duplicate stopper (unless overridden) ----
    if not allow_duplicate:
        t_key = _key(title)
        l_key = _key(location or "")

        ph = "%s" if _is_pg(db) else "?"
        cur = db.cursor()
        try:
            cur.execute(
                f"""
                SELECT id, title, COALESCE(location,'')
                FROM issuehub_issues
                WHERE deleted_at IS NULL
                  AND status IN ('open','in_progress')
                  AND category = {ph}
                """,
                (category,)
            )
            for existing_id, ex_title, ex_loc in cur.fetchall():
                if _key(ex_loc) == l_key and _similar(_key(ex_title), t_key):
                    return jsonify({
                        "error": "duplicate_issue",
                        "message": "A very similar issue for this equipment is already open.",
                        "existing_id": existing_id
                    }), 409
        finally:
            cur.close()

    # ---- insert ----
    now = datetime.utcnow()
    new_id = next_id(db)

    cur = db.cursor()
    try:
        if _is_pg(db):
            cur.execute(
                """
                INSERT INTO issuehub_issues
                (id, category, title, details, location, priority, status, resolution,
                 reporter, assignee, target_date, created_at, updated_at, resolved_at, deleted_at)
                VALUES
                (%s,%s,%s,%s,%s,%s,%s,NULL,%s,%s,%s,%s,%s,NULL,NULL)
                """,
                (new_id, category, title, details, location, priority,
                 status, reporter, assignee, target_date, now, now),
            )
        else:
            cur.execute(
                """
                INSERT INTO issuehub_issues
                (id, category, title, details, location, priority, status, resolution,
                 reporter, assignee, target_date, created_at, updated_at, resolved_at, deleted_at)
                VALUES
                (?,?,?,?,?,?,?,NULL,?,?,?, ?, ?, NULL, NULL)
                """,
                (new_id, category, title, details, location, priority,
                 status, reporter, assignee, target_date, now, now),
            )
        db.commit()
        return jsonify({
            "id": new_id,
            "category": category,
            "title": title,
            "details": details,
            "location": location,
            "priority": priority,
            "status": status,
            "resolution": None,
            "reporter": reporter,
            "assignee": assignee,
            "target_date": target_date,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "resolved_at": None,
            "deleted_at": None,
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"failed to create: {e}"}), 500
    finally:
        cur.close()





@issue_hub_bp.route("/api/issuehub/update_status", methods=["POST"])
def issuehub_update_status():
    """
    POST JSON:
    {
      "id": "IH001",
      "status": "open" | "in_progress" | "resolved" | "archived",
      "resolution": "text (required when status='resolved')"
    }
    """
    db = _get_db()
    data = request.get_json(silent=True) or {}

    issue_id = (data.get("id") or "").strip()
    status = (data.get("status") or "").strip().lower()
    resolution = (data.get("resolution") or None)
    now = datetime.utcnow()

    if not issue_id:
        return jsonify({"error": "id is required"}), 400
    if status not in ("open", "in_progress", "resolved", "archived"):
        return jsonify({"error": "invalid status"}), 400
    if status == "resolved" and (not resolution or not str(resolution).strip()):
        return jsonify({"error": "resolution text required to resolve"}), 400

    cur = db.cursor()
    try:
        if _is_pg(db):
            if status == "resolved":
                cur.execute(
                    """
                    UPDATE issuehub_issues
                    SET status=%s, resolution=%s, updated_at=%s, resolved_at=%s
                    WHERE id=%s AND deleted_at IS NULL
                    """,
                    (status, resolution, now, now, issue_id),
                )
            elif status == "open":
                cur.execute(
                    """
                    UPDATE issuehub_issues
                    SET status=%s, updated_at=%s, resolved_at=NULL
                    WHERE id=%s AND deleted_at IS NULL
                    """,
                    (status, now, issue_id),
                )
            else:  # in_progress or archived
                cur.execute(
                    """
                    UPDATE issuehub_issues
                    SET status=%s, updated_at=%s
                    WHERE id=%s AND deleted_at IS NULL
                    """,
                    (status, now, issue_id),
                )
        else:
            if status == "resolved":
                cur.execute(
                    """
                    UPDATE issuehub_issues
                    SET status=?, resolution=?, updated_at=?, resolved_at=?
                    WHERE id=? AND deleted_at IS NULL
                    """,
                    (status, resolution, now, now, issue_id),
                )
            elif status == "open":
                cur.execute(
                    """
                    UPDATE issuehub_issues
                    SET status=?, updated_at=?, resolved_at=NULL
                    WHERE id=? AND deleted_at IS NULL
                    """,
                    (status, now, issue_id),
                )
            else:
                cur.execute(
                    """
                    UPDATE issuehub_issues
                    SET status=?, updated_at=?
                    WHERE id=? AND deleted_at IS NULL
                    """,
                    (status, now, issue_id),
                )

        if cur.rowcount == 0:
            db.commit()
            return jsonify({"error": f"no issue found with id {issue_id}"}), 404

        db.commit()
        return jsonify({"ok": True, "id": issue_id, "status": status})
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"update failed: {e}"}), 500
    finally:
        cur.close()
@issue_hub_bp.route("/api/issuehub/trash", methods=["POST"])
def issuehub_trash():
    """
    POST JSON: { "id": "IH001" }
    Soft delete: set deleted_at = now (moves to Trash)
    """
    db = _get_db()
    data = request.get_json(silent=True) or {}
    issue_id = (data.get("id") or "").strip()
    if not issue_id:
        return jsonify({"error": "id is required"}), 400

    now = datetime.utcnow()
    ph = "%s" if _is_pg(db) else "?"
    sql = f"UPDATE issuehub_issues SET deleted_at = {ph}, updated_at = {ph} WHERE id = {ph} AND deleted_at IS NULL;"

    cur = db.cursor()
    try:
        cur.execute(sql, (now, now, issue_id))
        if cur.rowcount == 0:
            db.commit()
            return jsonify({"error": "not found (or already in Trash)"}), 404
        db.commit()
        return jsonify({"ok": True, "id": issue_id})
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"trash failed: {e}"}), 500
    finally:
        cur.close()


@issue_hub_bp.route("/api/issuehub/restore", methods=["POST"])
def issuehub_restore():
    """
    POST JSON: { "id": "IH001" }
    Restore from Trash: set deleted_at = NULL
    """
    db = _get_db()
    data = request.get_json(silent=True) or {}
    issue_id = (data.get("id") or "").strip()
    if not issue_id:
        return jsonify({"error": "id is required"}), 400

    now = datetime.utcnow()
    ph = "%s" if _is_pg(db) else "?"
    sql = f"UPDATE issuehub_issues SET deleted_at = NULL, updated_at = {ph} WHERE id = {ph} AND deleted_at IS NOT NULL;"

    cur = db.cursor()
    try:
        cur.execute(sql, (now, issue_id))
        if cur.rowcount == 0:
            db.commit()
            return jsonify({"error": "not found (or not in Trash)"}), 404
        db.commit()
        return jsonify({"ok": True, "id": issue_id})
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"restore failed: {e}"}), 500
    finally:
        cur.close()

@issue_hub_bp.route("/api/issuehub/update_fields", methods=["POST"])
def issuehub_update_fields():
    """
    POST JSON: {
      "id": "IH001",
      "title": "text?",           # Problem Description
      "notes": "text?",           # mapped to details
      "details": "text?",         # (either notes or details works)
      "location": "text?",        # Equipment Name
      "priority": "low|medium|high",
      "assignee": "text?",
      "target_date": "YYYY-MM-DD or ISO"
    }
    Updates only provided fields. Cannot edit a trashed item.
    """
    db = _get_db()
    data = request.get_json(silent=True) or {}
    issue_id = (data.get("id") or "").strip()
    if not issue_id:
        return jsonify({"error": "id is required"}), 400

    # normalize + allowlist
    fields_map = {}
    if "title" in data:        fields_map["title"]   = (data["title"] or "").strip()
    # notes -> details
    if "notes" in data:        fields_map["details"] = (data["notes"] or "").strip()
    if "details" in data and not fields_map.get("details"):
        fields_map["details"] = (data["details"] or "").strip()
    if "location" in data:     fields_map["location"] = (data["location"] or "").strip()
    if "priority" in data:
        pr = (data["priority"] or "").strip().lower()
        if pr in ("low", "medium", "high"):
            fields_map["priority"] = pr
    if "assignee" in data:     fields_map["assignee"] = (data["assignee"] or "").strip()
    if "target_date" in data:
        td = (data["target_date"] or "").strip()
        fields_map["target_date"] = (td or None)

    if not fields_map:
        return jsonify({"error": "no fields to update"}), 400

    ph = "%s" if _is_pg(db) else "?"
    sets, vals = [], []
    for k, v in fields_map.items():
        sets.append(f"{k} = {ph}")
        vals.append(v)

    sets.append("updated_at = CURRENT_TIMESTAMP")

    sql = f"UPDATE issuehub_issues SET {', '.join(sets)} WHERE id = {ph} AND deleted_at IS NULL;"
    vals.append(issue_id)

    cur = db.cursor()
    try:
        cur.execute(sql, tuple(vals))
        if cur.rowcount == 0:
            db.commit()
            return jsonify({"error": "not found (or in Trash)"}), 404
        db.commit()
        return jsonify({"ok": True, "id": issue_id})
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"update failed: {e}"}), 500
    finally:
        cur.close()


# =========================
# Employees API
# =========================
@issue_hub_bp.route("/api/employees", methods=["GET", "POST"])
def employees_collection():
    """
    GET  /api/employees           -> list active employees
    POST /api/employees {name}    -> add employee
       - If name exists and active=0 -> revive (active=1), 200
       - If name exists and active=1 -> return exists, 200
       - Else insert new -> 201
    """
    db = _get_db()
    cur = db.cursor()
    try:
        if request.method == "GET":
            cur.execute("SELECT id, name FROM employees WHERE active=1 ORDER BY name ASC;")
            rows = cur.fetchall()
            return jsonify({"items": [{"id": r[0], "name": r[1]} for r in rows]})

        # POST (add or revive)
        data = request.get_json(silent=True) or {}
        raw_name = (data.get("name") or "").strip()
        name = " ".join(raw_name.split())  # collapse extra spaces

        if not name:
            return jsonify({"error": "name is required"}), 400

        emp_id = next_id(db, prefix="EMP-", entity="emp", width=3)

        try:
            if _is_pg(db):
                cur.execute(
                    "INSERT INTO employees (id, name, active) VALUES (%s, %s, 1);",
                    (emp_id, name),
                )
            else:
                cur.execute(
                    "INSERT INTO employees (id, name, active) VALUES (?, ?, 1);",
                    (emp_id, name),
                )
            db.commit()
            return jsonify({"id": emp_id, "name": name}), 201

        except Exception:
            # Likely UNIQUE(name) violation. Try to find existing row (case-insensitive) and revive.
            db.rollback()
            cur2 = db.cursor()
            try:
                if _is_pg(db):
                    cur2.execute("SELECT id, active, name FROM employees WHERE LOWER(name)=LOWER(%s);", (name,))
                else:
                    cur2.execute("SELECT id, active, name FROM employees WHERE LOWER(name)=LOWER(?);", (name,))
                row = cur2.fetchone()
                if row:
                    existing_id, active_flag, existing_name = row[0], row[1], row[2]
                    # revive if inactive
                    if int(active_flag) == 0:
                        if _is_pg(db):
                            cur2.execute("UPDATE employees SET active=1 WHERE id=%s;", (existing_id,))
                        else:
                            cur2.execute("UPDATE employees SET active=1 WHERE id=?;", (existing_id,))
                        db.commit()
                        return jsonify({"id": existing_id, "name": existing_name, "revived": True}), 200
                    # already active -> treat as OK
                    return jsonify({"id": existing_id, "name": existing_name, "exists": True}), 200
            finally:
                cur2.close()

            # Unknown failure
            return jsonify({"error": "could not add employee"}), 500

    finally:
        cur.close()


@issue_hub_bp.route("/api/employees/<emp_id>", methods=["DELETE", "PATCH"])
def employees_item(emp_id):
    """
    DELETE /api/employees/<id>        -> soft delete (active=0)
    PATCH  /api/employees/<id> {name} -> rename
    """
    db = _get_db()
    cur = db.cursor()
    try:
        if request.method == "DELETE":
            if _is_pg(db):
                cur.execute("UPDATE employees SET active=0 WHERE id=%s;", (emp_id,))
            else:
                cur.execute("UPDATE employees SET active=0 WHERE id=?;", (emp_id,))
            if cur.rowcount == 0:
                db.commit()
                return jsonify({"error": "not found"}), 404
            db.commit()
            return jsonify({"ok": True})

        # PATCH (rename)
        data = request.get_json(silent=True) or {}
        new_name = (data.get("name") or "").strip()
        if not new_name:
            return jsonify({"error": "name is required"}), 400

        if _is_pg(db):
            cur.execute("UPDATE employees SET name=%s WHERE id=%s;", (new_name, emp_id))
        else:
            cur.execute("UPDATE employees SET name=? WHERE id=?;", (new_name, emp_id))

        if cur.rowcount == 0:
            db.commit()
            return jsonify({"error": "not found"}), 404

        db.commit()
        return jsonify({"ok": True, "id": emp_id, "name": new_name})
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"update failed: {e}"}), 500
    finally:
        cur.close()


# -------- delete (hard delete) ---------------------------------------------
@issue_hub_bp.route("/api/issuehub/delete", methods=["POST", "DELETE"])
def issuehub_delete():
    """
    POST/DELETE JSON: { "id": "IH001" }
    Hard-delete an Issue Hub item.
    """
    db = _get_db()
    data = request.get_json(silent=True) or {}
    issue_id = (data.get("id") or "").strip()
    if not issue_id:
        return jsonify({"error": "id is required"}), 400

    cur = db.cursor()
    try:
        if _is_pg(db):
            cur.execute("DELETE FROM issuehub_issues WHERE id=%s;", (issue_id,))
        else:
            cur.execute("DELETE FROM issuehub_issues WHERE id=?;", (issue_id,))
        if cur.rowcount == 0:
            db.commit()
            return jsonify({"error": "not found"}), 404
        db.commit()
        return jsonify({"ok": True, "id": issue_id})
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"delete failed: {e}"}), 500
    finally:
        cur.close()


# -------- register from app.py ---------------------------------------------
def register_issue_hub_blueprint(app, get_db_fn, ensure_id_sequences_fn):
    global _get_db_fn
    _get_db_fn = get_db_fn
    # make tables while app context is active
    with app.app_context():
        ensure_issuehub_tables(get_db_fn, ensure_id_sequences_fn)
    app.register_blueprint(issue_hub_bp)
