from flask import Blueprint, render_template, request, jsonify
from .models import (
    Competition, CompetitionDay, SportCategory, 
    Exercise, CompetitionType, db
)
from datetime import datetime

main_bp = Blueprint('main', __name__)
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
display_bp = Blueprint('display', __name__, url_prefix='/display' )
coach_bp = Blueprint('coach', __name__, url_prefix='/coach')

@main_bp.route('/')
def index():
    return render_template('index.html')


# Admin Routes

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

@admin_bp.route('/timer')
def timer():
    return render_template('admin/timer.html')

@admin_bp.route('/referee')
def referee():
    return render_template('admin/referee.html')

@admin_bp.route('/display')
def display():
    return render_template('admin/display.html')
@display_bp.route('/')
def display_index():
    return render_template('display/selection.html')

@display_bp.route('/competition')
def display_competition():
    return render_template('display/competition.html')

@display_bp.route('/datatable')
def display_datatable():
    return render_template('display/datatable.html')

@admin_bp.route('/competition-model/save', methods=['POST'])
def save_competition_model():
    try:
        data = request.get_json()
        
        # Create Competition
        competition = Competition(
            name=data['name'],
            description=f"Sport type: {data['sport_type']}",
            start_date=datetime.now().date(),  # You might want to add these to the form
            end_date=datetime.now().date(),
            is_active=True
        )
        db.session.add(competition)
        db.session.flush()  # Get ID while in transaction
        
        # Create single competition day (can be expanded)
        day = CompetitionDay(
            competition=competition,
            day_number=1,
            date=datetime.now().date(),
            is_active=True
        )
        db.session.add(day)
        db.session.flush()
        
        # Process each event
        for event_data in data.get('events', []):
            # Create sport category for each event
            category = SportCategory(
                competition_day=day,
                name=event_data['name'],
                is_active=True
            )
            db.session.add(category)
            db.session.flush()
            
            # Process movements/lifts
            for idx, movement in enumerate(event_data.get('movements', []), 1):
                exercise = Exercise(
                    sport_category=category,
                    name=movement['name'],
                    order=idx,
                    attempt_time_limit=movement['timer'].get('attempt_seconds', 60),
                    break_time_default=movement['timer'].get('break_seconds', 120)
                )
                db.session.add(exercise)
                db.session.flush()
                
                # Create competition type
                comp_type = CompetitionType(
                    exercise=exercise,
                    name=movement.get('scoring', {}).get('name', 'Standard'),
                    is_active=True
                )
                db.session.add(comp_type)
        
        db.session.commit()
        return jsonify({
            'status': 'success',
            'competition_id': competition.id,
            'message': 'Competition model saved successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400

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