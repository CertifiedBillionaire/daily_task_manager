# issue_hub_bp.py
# Issue Hub lives in its own blueprint.
# It is now correctly passed the database functions from app.py.

from flask import Blueprint, render_template, request, jsonify
from datetime import datetime

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
    db = get_db_fn()
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

        # id counter row: 'ih'
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

# -------- page route (keeps endpoint name 'issue_hub') ----------------------
@issue_hub_bp.route("/issue-hub")
def issue_hub_page():
    return render_template("issue_hub.html", page_title="Issue Hub")

# -------- APIs: list + create ----------------------------------------------
@issue_hub_bp.route("/api/issuehub/list", methods=["GET"])
def issuehub_list():
    """
    GET /api/issuehub/list?category=gameroom|facility&status=open|in_progress|resolved|archived
    Both filters optional.
    """
    db = _get_db()
    cur = db.cursor()
    category = request.args.get("category")
    status = request.args.get("status")

    try:
        base = "SELECT id, category, title, details, location, priority, status, resolution, reporter, assignee, created_at, updated_at, resolved_at FROM issuehub_issues"
        where = []
        params = []

        if category:
            where.append("category = %s" if _is_pg(db) else "category = ?")
            params.append(category)
        if status:
            where.append("status = %s" if _is_pg(db) else "status = ?")
            params.append(status)

        if where:
            base += " WHERE " + " AND ".join(where)
        base += " ORDER BY created_at DESC"

        cur.execute(base, tuple(params))
        rows = cur.fetchall()

        # rows are tuples for pg and sqlite Row/tuples; use indices
        items = []
        for r in rows:
            items.append({
                "id": r[0],
                "category": r[1],
                "title": r[2],
                "details": r[3],
                "location": r[4],
                "priority": r[5],
                "status": r[6],
                "resolution": r[7],
                "reporter": r[8],
                "assignee": r[9],
                "created_at": str(r[10]),
                "updated_at": str(r[11]),
                "resolved_at": (str(r[12]) if r[12] else None),
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
      "details": "text?",
      "location": "text?",
      "priority": "low|medium|high" (default medium),
      "reporter": "text?",
      "assignee": "text?"
    }
    """
    db = _get_db()
    data = request.get_json(silent=True) or {}

    # minimal validation
    category = (data.get("category") or "").strip().lower()
    title = (data.get("title") or "").strip()
    if category not in ("gameroom", "facility"):
        return jsonify({"error": "category must be 'gameroom' or 'facility'"}), 400
    if not title:
        return jsonify({"error": "title is required"}), 400

    details = (data.get("details") or "").strip() or None
    location = (data.get("location") or "").strip() or None
    priority = (data.get("priority") or "medium").strip().lower()
    if priority not in ("low", "medium", "high"):
        priority = "medium"
    reporter = (data.get("reporter") or "").strip() or None
    assignee = (data.get("assignee") or "").strip() or None

    now = datetime.utcnow()
    new_id = next_id(db)

    cur = db.cursor()
    try:
        if _is_pg(db):
            cur.execute(
                """
                INSERT INTO issuehub_issues
                (id, category, title, details, location, priority, status, resolution,
                 reporter, assignee, created_at, updated_at, resolved_at)
                VALUES
                (%s,%s,%s,%s,%s,%s,'open',NULL,%s,%s,%s,%s,NULL)
                """,
                (new_id, category, title, details, location, priority, reporter, assignee, now, now),
            )
        else:
            cur.execute(
                """
                INSERT INTO issuehub_issues
                (id, category, title, details, location, priority, status, resolution,
                 reporter, assignee, created_at, updated_at, resolved_at)
                VALUES
                (?,?,?,?,?,?,'open',NULL,?,?,?, ?, NULL)
                """,
                (new_id, category, title, details, location, priority, reporter, assignee, now, now),
            )
        db.commit()
        return jsonify({
            "id": new_id,
            "category": category,
            "title": title,
            "details": details,
            "location": location,
            "priority": priority,
            "status": "open",
            "resolution": None,
            "reporter": reporter,
            "assignee": assignee,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "resolved_at": None
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
                    WHERE id=%s
                    """,
                    (status, resolution, now, now, issue_id),
                )
            elif status == "open":
                cur.execute(
                    """
                    UPDATE issuehub_issues
                    SET status=%s, updated_at=%s, resolved_at=NULL
                    WHERE id=%s
                    """,
                    (status, now, issue_id),
                )
            else:  # in_progress or archived
                cur.execute(
                    """
                    UPDATE issuehub_issues
                    SET status=%s, updated_at=%s
                    WHERE id=%s
                    """,
                    (status, now, issue_id),
                )
        else:
            if status == "resolved":
                cur.execute(
                    """
                    UPDATE issuehub_issues
                    SET status=?, resolution=?, updated_at=?, resolved_at=?
                    WHERE id=?
                    """,
                    (status, resolution, now, now, issue_id),
                )
            elif status == "open":
                cur.execute(
                    """
                    UPDATE issuehub_issues
                    SET status=?, updated_at=?, resolved_at=NULL
                    WHERE id=?
                    """,
                    (status, now, issue_id),
                )
            else:
                cur.execute(
                    """
                    UPDATE issuehub_issues
                    SET status=?, updated_at=?
                    WHERE id=?
                    """,
                    (status, now, issue_id),
                )

        if cur.rowcount == 0:
            db.rollback()
            return jsonify({"error": f"no issue found with id {issue_id}"}), 404

        db.commit()
        return jsonify({"ok": True, "id": issue_id, "status": status})
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"update failed: {e}"}), 500
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