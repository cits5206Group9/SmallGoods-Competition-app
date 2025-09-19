from flask import Blueprint, render_template, request, jsonify
from ..extensions import db
from ..models import Competition, SportType, Exercise, CompetitionType, Athlete, SportCategory
from datetime import datetime

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@admin_bp.route('/')
def admin_dashboard():
    return render_template('admin/admin.html')

@admin_bp.route('/competition-model')
def competition_model():
    return render_template('admin/competition_model.html')

@admin_bp.route('/competition-model/create')
def competition_create():
    return render_template('admin/competition_create.html')

@admin_bp.route('/competition-model/edit')
def competition_edit():
    competitions = Competition.query.all()
    return render_template('admin/competition_edit.html', competitions=competitions)

@admin_bp.route('/live-event')
def live_event():
    return render_template('admin/live_event.html')

@admin_bp.route('/data')
def data():
    return render_template('admin/data.html')

#@admin_bp.route('/timer')
#def timer():
    #return render_template('admin/timer.html')

@admin_bp.route('/referee')
def referee():
    return render_template('admin/referee.html')

@admin_bp.route('/referee/login')
def referee_login():
    return render_template('auth/referee_login.html')

@admin_bp.route('/referee/<int:referee_id>')
def individual_referee(referee_id):
    if referee_id not in [1, 2, 3]:
        return "Invalid referee ID", 400
    return render_template('admin/individual_referee.html', referee_id=str(referee_id))

@admin_bp.route('/results')
def results_dashboard():
    return render_template('admin/results_dashboard.html')

@admin_bp.route('/display')
def display():
    return render_template('admin/display.html')

# API Routes below
@admin_bp.route('/competition-model/get/<int:id>')
def get_competition_model(id):
    competition = Competition.query.get_or_404(id)
    return jsonify({
        'id': competition.id,
        'name': competition.name,
        'description': competition.description,
        'sport_type': competition.sport_type.value if competition.sport_type else None,
        'config': competition.config or {
            'name': competition.name,
            'sport_type': competition.sport_type.value if competition.sport_type else None,
            'features': {
                'allowAthleteInput': True,
                'allowCoachAssignment': True,
                'enableAttemptOrdering': True
            },
            'events': []
        },
        'is_active': competition.is_active
    })

@admin_bp.route('/competition-model/save', methods=['POST'])
def save_competition_model():
    try:
        data = request.get_json()
        print("Received data:", data)  # Debug log
        
        # Create new competition or update existing one
        competition_id = data.get('id')
        if competition_id:
            competition = Competition.query.get_or_404(competition_id)
        else:
            competition = Competition()

        # Update basic fields
        competition.name = data['name']
        competition.sport_type = SportType(data['sport_type'])
        competition.description = f"Sport type: {data['sport_type']}"
        competition.start_date = datetime.now().date()
        competition.end_date = datetime.now().date()
        competition.is_active = True
        
        day = CompetitionDay(
            competition=competition,
            day_number=1,
            date=datetime.now().date(),
            is_active=True
        )
        db.session.add(day)
        db.session.flush()
        
        for event_data in data.get('events', []):
            category = SportCategory(
                competition_day=day,
                name=event_data['name'],
                is_active=True
            )
            db.session.add(category)
            db.session.flush()
            
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
                
                comp_type = CompetitionType(
                    exercise=exercise,
                    name=movement.get('scoring', {}).get('name', 'Standard'),
                    is_active=True
                )
                db.session.add(comp_type)
        
        if not competition_id:
            db.session.add(competition)
        
        # Commit the changes
        db.session.commit()
        
        print("Saved competition:", competition.id, competition.config)  # Debug log
        
        return jsonify({
            'status': 'success',
            'competition_id': competition.id,
            'message': 'Competition model saved successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        print("Error saving competition:", str(e))  # Debug log
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400
        
        
        
# ensure /admin/timer gets registered on admin_bp
from . import timer
@admin_bp.route('/atheletes-management')
def atheletes_management():
    # Get pagination parameters
    page = request.args.get('page', 1, type=int)
    per_page = 10
    
    # Get all competitions for the filter dropdown
    competitions = Competition.query.all()
    
    # Get athletes with pagination
    athletes_query = Athlete.query
    athletes = athletes_query.paginate(page=page, per_page=per_page, error_out=False)
    
    return render_template('admin/atheletes_management.html', 
                         athletes=athletes.items,
                         competitions=competitions,
                         pagination=athletes,
                         page=page,
                         per_page=per_page,
                         total=athletes.total)

@admin_bp.route('/flights-management')
def flights_management():
    # Get all competitions for the selection dropdown
    competitions = Competition.query.all()
    
    return render_template('admin/flights_management.html',
                         competitions=competitions)
