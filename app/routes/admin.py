from flask import Blueprint, render_template, request, jsonify
from ..extensions import db
from ..models import Competition, SportType, Exercise, CompetitionType
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

@admin_bp.route('/timer')
def timer():
    return render_template('admin/timer.html')

@admin_bp.route('/referee')
def referee():
    return render_template('admin/referee.html')



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
        
        # Store the complete configuration including events, movements, and groups
        competition.config = {
            'name': data['name'],
            'sport_type': data['sport_type'],
            'features': data.get('features', {
                'allowAthleteInput': True,
                'allowCoachAssignment': True,
                'enableAttemptOrdering': True
            }),
            'events': data.get('events', [])
        }
        
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

@admin_bp.route('/api/competitions', methods=['GET'])
def get_competitions():
    try:
        competitions = Competition.query.all()
        return jsonify([
            {
                'id': comp.id,
                'name': comp.name,
                'sport_type': comp.sport_type.value if comp.sport_type else None,
                'is_active': comp.is_active,
                'start_date': comp.start_date.isoformat() if comp.start_date else None,
                'end_date': comp.end_date.isoformat() if comp.end_date else None
            }
            for comp in competitions
        ])
    except Exception as e:
        print("Error fetching competitions:", str(e))
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400

@admin_bp.route('/api/competitions/<int:competition_id>', methods=['GET'])
def get_competition_details(competition_id):
    try:
        competition = Competition.query.get_or_404(competition_id)
        
        # Extract events from config if available
        events = []
        if competition.config and 'events' in competition.config:
            events = competition.config['events']
        
        return jsonify({
            'id': competition.id,
            'name': competition.name,
            'sport_type': competition.sport_type.value if competition.sport_type else None,
            'description': competition.description,
            'is_active': competition.is_active,
            'start_date': competition.start_date.isoformat() if competition.start_date else None,
            'end_date': competition.end_date.isoformat() if competition.end_date else None,
            'events': events,
            'config': competition.config
        })
    except Exception as e:
        print("Error fetching competition details:", str(e))
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400