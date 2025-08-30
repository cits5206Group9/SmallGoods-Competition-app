#!/usr/bin/env python3
"""
Simple Flask server for testing the frontend without a full backend
Run with: python test_server.py
"""

from flask import Flask, render_template, jsonify, request, send_from_directory
import json
import random
import time
from datetime import datetime

app = Flask(__name__, 
           template_folder='templates',
           static_folder='static',
           static_url_path='/static')

# Mock data for testing
MOCK_COMPETITION = {
    "id": 1,
    "name": "Test Competition 2024",
    "status": "active",
    "currentEvent": "Men's 85kg"
}

MOCK_ATHLETES = [
    {"id": 1, "name": "John Smith", "category": "85kg", "team": "Team A", "currentWeight": 150, "currentAttempt": 2},
    {"id": 2, "name": "Mike Johnson", "category": "85kg", "team": "Team B", "currentWeight": 145, "currentAttempt": 1},
    {"id": 3, "name": "David Wilson", "category": "85kg", "team": "Team C", "currentWeight": 155, "currentAttempt": 3},
    {"id": 4, "name": "Chris Brown", "category": "85kg", "team": "Team A", "currentWeight": 140, "currentAttempt": 1},
    {"id": 5, "name": "Alex Davis", "category": "85kg", "team": "Team B", "currentWeight": 160, "currentAttempt": 2},
]

MOCK_QUEUE = {
    "current": MOCK_ATHLETES[0],
    "order": MOCK_ATHLETES,
    "competitionId": 1
}

MOCK_LEADERBOARD = {
    "rankings": [
        {"id": 5, "name": "Alex Davis", "total": 320, "best": 160},
        {"id": 3, "name": "David Wilson", "total": 310, "best": 155},
        {"id": 1, "name": "John Smith", "total": 300, "best": 150},
        {"id": 2, "name": "Mike Johnson", "total": 290, "best": 145},
        {"id": 4, "name": "Chris Brown", "total": 280, "best": 140},
    ],
    "lastUpdated": datetime.now().isoformat()
}

MOCK_ATTEMPTS = [
    {"id": 1, "athleteId": 1, "athleteName": "John Smith", "lift": "Snatch", "weight": 150, "result": "Good", "timestamp": "2024-01-15T10:30:00"},
    {"id": 2, "athleteId": 2, "athleteName": "Mike Johnson", "lift": "Snatch", "weight": 145, "result": "Good", "timestamp": "2024-01-15T10:25:00"},
    {"id": 3, "athleteId": 3, "athleteName": "David Wilson", "lift": "Snatch", "weight": 155, "result": "No Lift", "timestamp": "2024-01-15T10:20:00"},
    {"id": 4, "athleteId": 1, "athleteName": "John Smith", "lift": "Clean & Jerk", "weight": 180, "result": "Good", "timestamp": "2024-01-15T11:00:00"},
]

# Routes for pages
@app.route('/')
def index():
    return render_template('admin.html', 
                         page_css="admin", 
                         page_js="admin",
                         competition_name=MOCK_COMPETITION["name"],
                         user_role="admin",
                         competition_id=MOCK_COMPETITION["id"],
                         api_endpoint="/api",
                         ws_endpoint="ws://localhost:5000/ws")

@app.route('/admin')
def admin():
    return render_template('admin.html', 
                         page_css="admin", 
                         page_js="admin",
                         competition_name=MOCK_COMPETITION["name"],
                         user_role="admin",
                         competition_id=MOCK_COMPETITION["id"],
                         api_endpoint="/api")

@app.route('/ref')
def referee():
    current_athlete = MOCK_ATHLETES[0]
    current_attempt = {"weight": 150, "number": 2}
    
    return render_template('referee.html', 
                         page_css="referee", 
                         page_js="referee",
                         current_athlete=current_athlete,
                         current_attempt=current_attempt,
                         referee_id="REF001",
                         user_role="referee",
                         can_undo=False)

@app.route('/tc')
@app.route('/timekeeper')
def timekeeper():
    return render_template('timekeeper.html', 
                         page_css="timekeeper", 
                         page_js="timekeeper",
                         user_role="timekeeper",
                         competition_id=MOCK_COMPETITION["id"])

@app.route('/athlete')
def athlete():
    return render_template('athlete.html', 
                         page_css="athlete", 
                         page_js="athlete",
                         user_role="athlete",
                         athlete_id=1,
                         competition_id=MOCK_COMPETITION["id"])

@app.route('/display')
def display():
    return render_template('display.html', 
                         page_css="display", 
                         page_js="display",
                         user_role="public",
                         competition_id=MOCK_COMPETITION["id"])

@app.route('/network')
@app.route('/qr')
def network():
    return render_template('network.html', 
                         page_css="network", 
                         page_js="network",
                         user_role="public")

# API Routes for testing
@app.route('/api/competition')
def api_competition():
    return jsonify(MOCK_COMPETITION)

@app.route('/api/athletes')
def api_athletes():
    competition_id = request.args.get('competitionId')
    return jsonify(MOCK_ATHLETES)

@app.route('/api/queue')
def api_queue():
    competition_id = request.args.get('competitionId')
    return jsonify(MOCK_QUEUE)

@app.route('/api/leaderboard')
def api_leaderboard():
    competition_id = request.args.get('competitionId')
    return jsonify(MOCK_LEADERBOARD)

@app.route('/api/attempts')
def api_attempts():
    query = request.args.get('q', '').lower()
    athlete_id = request.args.get('athleteId')
    
    results = MOCK_ATTEMPTS
    
    if query:
        results = [a for a in results if 
                  query in a['athleteName'].lower() or 
                  query in a['lift'].lower() or 
                  str(a['weight']) == query]
    
    if athlete_id:
        results = [a for a in results if str(a['athleteId']) == str(athlete_id)]
    
    return jsonify(results)

@app.route('/api/referee/decision', methods=['POST'])
def api_referee_decision():
    decision = request.get_json()
    
    # Simulate processing time
    time.sleep(0.5)
    
    # Mock response
    return jsonify({
        "success": True,
        "message": f"Decision '{decision.get('result', 'unknown')}' recorded",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/timer', methods=['POST'])
def api_timer():
    action = request.get_json().get('action')
    
    return jsonify({
        "success": True,
        "action": action,
        "timestamp": datetime.now().isoformat()
    })

# Static file serving (for development)
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

# WebSocket simulation (basic)
@app.route('/ws')
def websocket():
    return "WebSocket endpoint (upgrade to WebSocket in production)", 426

# Test data injection endpoint
@app.route('/api/test/inject')
def inject_test_data():
    global MOCK_ATHLETES, MOCK_QUEUE, MOCK_LEADERBOARD
    
    # Simulate some changes
    MOCK_ATHLETES[0]["currentWeight"] = random.randint(140, 170)
    MOCK_QUEUE["current"] = random.choice(MOCK_ATHLETES)
    
    # Update leaderboard
    for ranking in MOCK_LEADERBOARD["rankings"]:
        ranking["total"] += random.randint(-10, 20)
    
    MOCK_LEADERBOARD["rankings"].sort(key=lambda x: x["total"], reverse=True)
    MOCK_LEADERBOARD["lastUpdated"] = datetime.now().isoformat()
    
    return jsonify({
        "message": "Test data updated",
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("=" * 50)
    print("🏋️  Small Goods Competition Frontend Test Server")
    print("=" * 50)
    print()
    print("Available URLs:")
    print("  🏠 Home/Admin:     http://localhost:5000/")
    print("  👨‍💼 Admin:          http://localhost:5000/admin")
    print("  👨‍⚖️ Referee:        http://localhost:5000/ref")
    print("  ⏱️  Timekeeper:     http://localhost:5000/tc")
    print("  🏋️  Athlete:        http://localhost:5000/athlete")
    print("  📺 Display:        http://localhost:5000/display")
    print("  📱 Network/QR:     http://localhost:5000/network")
    print()
    print("Test Features:")
    print("  🔄 Inject test data: http://localhost:5000/api/test/inject")
    print("  📊 API endpoints:    http://localhost:5000/api/*")
    print()
    print("Press Ctrl+C to stop the server")
    print("=" * 50)
    
    app.run(debug=True, port=5000, host='0.0.0.0')