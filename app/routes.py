from flask import Blueprint, render_template

main_bp = Blueprint('main', __name__)
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@main_bp.route('/')
def index():
    return render_template('index.html')

@admin_bp.route('/')
def admin_dashboard():
    return render_template('admin/admin.html')

@admin_bp.route('/competition-model')
def competition_model():
    return render_template('admin/competition_model.html')

@admin_bp.route('/live-event')
def live_event():
    return render_template('admin/live_event.html')

@admin_bp.route('/data')
def data():
    return render_template('admin/data.html')

@admin_bp.route("/timer",endpoint="timer")
def timer_page():
    # Temporary context data (stub) for display only
    ctx = {
        "now":  {"athlete": "Jane Doe", "attempt": 2, "lift": "Snatch", "declared": 85.0},
        "next": {"athlete": "Alex Kim", "attempt": 1, "lift": "Snatch", "declared": 86.0},
        "avg_sec_per_lift": 90,
        "notes": "Bar change expected after next attempt."
    }
    # Defaults for MVP: 60s attempt, 10 min break
    return render_template(
        "admin/timer.html",
        default_attempt_seconds=60,
        default_break_seconds=600,
        context = ctx
    )

@admin_bp.route('/referee')
def referee():
    return render_template('admin/referee.html')

@admin_bp.route('/display')
def display():
    return render_template('admin/display.html')
