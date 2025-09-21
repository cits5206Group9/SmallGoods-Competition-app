from flask import render_template, request
from .admin import admin_bp  # reuse the existing /admin blueprint

@admin_bp.route("/timer", endpoint="timer")
def timer_page():
    flight_id = request.args.get("flight_id", type=int)
    ctx = {
        "now":  {"athlete": "Jane Doe", "attempt": 2, "lift": "Snatch", "declared": 85.0},
        "next": {"athlete": "Alex Kim", "attempt": 1, "lift": "Snatch", "declared": 86.0},
        "avg_sec_per_lift": 90,
        "notes": "Bar change expected after next attempt."
    }
    return render_template(
        "admin/timer.html",
        default_attempt_seconds=60,
        default_break_seconds=600,
        context=ctx,
        flight_id=flight_id,
    )


# ---- TEMP MOCKS for Timekeeper Flights panel ----
from flask import jsonify
from .admin import admin_bp

# Competitions list
@admin_bp.get("/competitions")
def _mock_competitions():
    return jsonify([
        {"id": 1, "name": "Event Name 1"},
        # removed Interclub Meet
    ])

@admin_bp.get("/competitions/<int:comp_id>/events")
def _mock_events(comp_id):
    data = {
        1: [
            {"id": 101, "name": "Snatch"},
            {"id": 102, "name": "Clean & Jerk"},
        ],
        # removed comp_id=2
    }
    return jsonify(data.get(comp_id, []))

@admin_bp.get("/events/<int:event_id>/flights")
def _mock_flights(event_id):
    data = {
        101: [
            {"id": 1001, "name": "Flight A", "order": 1, "is_active": True},
            {"id": 1002, "name": "Flight B", "order": 2, "is_active": True},
        ],
        102: [
            {"id": 1101, "name": "Flight A", "order": 1, "is_active": False},
        ],
       
    }
    return jsonify(data.get(event_id, []))