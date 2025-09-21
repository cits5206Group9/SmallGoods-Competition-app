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
