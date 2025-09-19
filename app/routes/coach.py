from flask import Blueprint, render_template

coach_bp = Blueprint('coach', __name__, url_prefix='/coach')

# Coach Routes
@coach_bp.route('/')
def coach_dashboard():
    return render_template('coach/dashboard.html')
@coach_bp.route('/athletes')
def coach_athletes():
    return render_template('coach/athletes.html')
@coach_bp.route('/athlete/int:athlete_id ')
def coach_athlete_detail(athlete_id):
    return render_template('coach/athlete_detail.html', athlete_id=athlete_id)