from flask import Blueprint, render_template, request, jsonify

pm_bp = Blueprint('pm', __name__)

# Route to display the PM tracking page
@pm_bp.route('/pm-tracking')
def pm_tracking_page():
    return render_template('pm_tracking.html')

# API endpoint to get all PM logs
@pm_bp.route('/api/pms', methods=['GET'])
def get_pms():
    # Example: fetch data from a database or a JSON file
    # For now, let's use a placeholder list
    data = [
        {'date': '2025-08-16', 'location': 'Game Room', 'task': 'Clean game cabinets', 'notes': 'Wiped down all games with a microfiber cloth.', 'completedBy': 'John'},
        {'date': '2025-08-15', 'location': 'Kitchen', 'task': 'Check soda fountain lines', 'notes': 'All lines are clear.', 'completedBy': 'Sarah'},
    ]
    return jsonify(data)

# API endpoint to add a new PM log
@pm_bp.route('/api/pms/add', methods=['POST'])
def add_pm():
    new_pm_data = request.json
    # Logic to save the new PM entry to your database
    # ...
    return jsonify({'success': True, 'message': 'PM logged successfully!'})