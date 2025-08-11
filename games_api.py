# --- NEW CODE HERE ---
"""
games_api.py
API endpoints for the Game Inventory system.
Separate from app.py to keep code modular and clean.
"""

from flask import request, jsonify
from psycopg2 import sql

def register_game_routes(app, get_db):
    """
    Registers all /api/games routes with the Flask app.
    """

    @app.route('/api/games', methods=['GET', 'POST'])
    def handle_games():
        db = get_db()
        is_postgres = hasattr(db, 'dsn')
        cur = db.cursor()

        if request.method == 'GET':
            try:
                cur.execute("SELECT id, name, status, down_reason, updated_at FROM games ORDER BY id;")
                rows = cur.fetchall()

                def safe_iso(val):
                    if val is None:
                        return None
                    return val.isoformat() if hasattr(val, "isoformat") else str(val)

                games_list = []
                for row in rows:
                    games_list.append({
                        "id": row[0],
                        "name": row[1],
                        "status": row[2],
                        "down_reason": row[3],
                        "updated_at": safe_iso(row[4])
                    })

                return jsonify(games_list)
            except Exception as e:
                print(f"ERROR: Failed to fetch games: {e}")
                return jsonify({"error": "Failed to retrieve games"}), 500
            finally:
                cur.close()

        elif request.method == 'POST':
            try:
                data = request.get_json(force=True)
                name = data.get('name')
                status = data.get('status')
                down_reason = data.get('down_reason', None)

                if not name or not status:
                    return jsonify({"error": "Missing required fields: name, status"}), 400

                placeholder = '%s' if is_postgres else '?'
                query = f"""
                    INSERT INTO games (name, status, down_reason, updated_at)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, CURRENT_TIMESTAMP)
                """

                cur.execute(query, (name, status, down_reason))
                db.commit()

                return jsonify({"message": "Game added successfully!"}), 201
            except Exception as e:
                db.rollback()
                print(f"ERROR: Failed to add game: {e}")
                return jsonify({"error": "Failed to add game"}), 500
            finally:
                cur.close()

    @app.route('/api/games/<int:game_id>', methods=['PUT', 'DELETE'])
    def modify_game(game_id):
        db = get_db()
        is_postgres = hasattr(db, 'dsn')
        cur = db.cursor()

        if request.method == 'PUT':
            try:
                data = request.get_json(force=True)
                allowed_fields = ['name', 'status', 'down_reason']

                set_parts = []
                values = []
                placeholder = '%s' if is_postgres else '?'

                for field in allowed_fields:
                    if field in data:
                        set_parts.append(f"{field} = {placeholder}")
                        values.append(data[field])

                if not set_parts:
                    return jsonify({"error": "No fields to update"}), 400

                set_parts.append("updated_at = CURRENT_TIMESTAMP")

                query = f"""
                    UPDATE games
                    SET {', '.join(set_parts)}
                    WHERE id = {placeholder}
                """

                values.append(game_id)
                cur.execute(query, tuple(values))

                if cur.rowcount == 0:
                    db.commit()
                    return jsonify({"error": "Game not found"}), 404

                db.commit()
                return jsonify({"message": "Game updated successfully!"})
            except Exception as e:
                db.rollback()
                print(f"ERROR: Failed to update game: {e}")
                return jsonify({"error": "Failed to update game"}), 500
            finally:
                cur.close()

        elif request.method == 'DELETE':
            try:
                placeholder = '%s' if is_postgres else '?'
                cur.execute(f"DELETE FROM games WHERE id = {placeholder}", (game_id,))
                if cur.rowcount == 0:
                    db.commit()
                    return jsonify({"error": "Game not found"}), 404

                db.commit()
                return jsonify({"message": "Game deleted successfully!"})
            except Exception as e:
                db.rollback()
                print(f"ERROR: Failed to delete game: {e}")
                return jsonify({"error": "Failed to delete game"}), 500
            finally:
                cur.close()
# --- END NEW CODE ---
