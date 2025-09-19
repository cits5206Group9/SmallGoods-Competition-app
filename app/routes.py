from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from .extensions import db
from .models import (
    Competition, CompetitionDay, SportCategory, 
    Exercise, CompetitionType, db, User
)
from datetime import datetime

main_bp = Blueprint('main', __name__)
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
display_bp = Blueprint('display', __name__, url_prefix='/display' )
coach_bp = Blueprint('coach', __name__, url_prefix='/coach')

@main_bp.route('/')
def index():
    return render_template('index.html')

@main_bp.route('/referee/login')
def referee_login_main():
    return render_template('auth/referee_login.html')

@main_bp.route('/referee/<int:referee_id>')
def individual_referee_main(referee_id):
    if referee_id not in [1, 2, 3]:
        return "Invalid referee ID", 400
    return render_template('admin/individual_referee.html', referee_id=str(referee_id))


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

# API Routes for Referee
@admin_bp.route('/api/competitions')
def api_competitions():
    """Get all competitions for referee selection"""
    competitions = Competition.query.filter_by(is_active=True).all()
    return jsonify([{
        'id': comp.id,
        'name': comp.name,
        'description': comp.description,
        'start_date': comp.start_date.isoformat() if comp.start_date else None,
        'end_date': comp.end_date.isoformat() if comp.end_date else None
    } for comp in competitions])

@admin_bp.route('/api/competitions/<int:competition_id>')
def api_competition_detail(competition_id):
    """Get competition details with events"""
    competition = Competition.query.get_or_404(competition_id)
    
    # Get competition days and their events
    events = []
    for day in competition.days:
        for category in day.sport_categories:
            event_data = {
                'name': category.name,
                'id': category.id,
                'day_number': day.day_number,
                'movements': []
            }
            
            for exercise in category.exercises:
                movement = {
                    'name': exercise.name,
                    'order': exercise.order,
                    'timer': {
                        'attempt_seconds': exercise.attempt_time_limit,
                        'break_seconds': exercise.break_time_default
                    }
                }
                event_data['movements'].append(movement)
            
            events.append(event_data)
    
    return jsonify({
        'id': competition.id,
        'name': competition.name,
        'description': competition.description,
        'events': events
    })

@admin_bp.route('/api/competitions/<int:competition_id>/athletes')
def api_competition_athletes(competition_id):
    """Get athletes for a competition"""
    # For demo purposes, return sample athletes
    # In a real implementation, this would fetch from the database
    sample_athletes = [
        {
            'id': 1,
            'name': 'John Smith',
            'weightClass': '73kg',
            'team': 'Team Alpha',
            'startingWeight': 120
        },
        {
            'id': 2,
            'name': 'Sarah Johnson',
            'weightClass': '63kg',
            'team': 'Team Beta',
            'startingWeight': 100
        },
        {
            'id': 3,
            'name': 'Mike Chen',
            'weightClass': '81kg',
            'team': 'Team Gamma',
            'startingWeight': 140
        },
        {
            'id': 4,
            'name': 'Emma Wilson',
            'weightClass': '58kg',
            'team': 'Team Delta',
            'startingWeight': 90
        },
        {
            'id': 5,
            'name': 'David Rodriguez',
            'weightClass': '89kg',
            'team': 'Team Epsilon',
            'startingWeight': 155
        }
    ]
    
    return jsonify(sample_athletes)

@admin_bp.route('/api/attempts', methods=['POST'])
def api_save_attempt():
    """Save an attempt result from referee"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['athleteId', 'attemptNumber', 'weight', 'result', 'finalDecision']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # For demo purposes, just log the attempt
        # In a real implementation, this would save to the database
        attempt_data = {
            'athlete_id': data['athleteId'],
            'attempt_number': data['attemptNumber'],
            'weight': data['weight'],
            'result': data['result'],
            'final_decision': data['finalDecision'],
            'referee_votes': data.get('refereeVotes', {}),
            'violations': data.get('violations', []),
            'timestamp': data.get('timestamp'),
            'competition_id': data.get('competitionId'),
            'event_id': data.get('eventId')
        }
        
        # Here you would typically save to an Attempt model
        # attempt = Attempt(**attempt_data)
        # db.session.add(attempt)
        # db.session.commit()
        
        print(f"Saved attempt: {attempt_data}")
        
        return jsonify({
            'status': 'success',
            'message': 'Attempt saved successfully',
            'attempt_id': f"demo_{data['athleteId']}_{data['attemptNumber']}"
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@admin_bp.route('/api/competitions/<int:competition_id>/results')
def api_competition_results(competition_id):
    """Get current competition results"""
    # For demo purposes, return sample results
    # In a real implementation, this would calculate from stored attempts
    sample_results = [
        {
            'rank': 1,
            'athlete_name': 'John Smith',
            'best_lift': 125,
            'total': 125,
            'status': 'Active'
        },
        {
            'rank': 2,
            'athlete_name': 'Mike Chen',
            'best_lift': 120,
            'total': 120,
            'status': 'Active'
        },
        {
            'rank': 3,
            'athlete_name': 'Sarah Johnson',
            'best_lift': 105,
            'total': 105,
            'status': 'Completed'
        }
    ]
    
    return jsonify(sample_results)

# Individual Referee API endpoints
current_attempt_data = {
    'status': 'waiting',  # or 'active'
    'athlete': None,
    'attemptNumber': 0,
    'weight': 0,
    'liftType': '',
    'timer': {'remaining': 60},
    'votes': {}
}

@admin_bp.route('/api/current-attempt')
def api_current_attempt():
    """Get current attempt data for individual referees"""
    return jsonify(current_attempt_data)

@admin_bp.route('/api/current-attempt', methods=['POST'])
def api_set_current_attempt():
    """Set current attempt data (called from admin interface)"""
    global current_attempt_data
    try:
        data = request.get_json()
        current_attempt_data = {
            'status': 'active',
            'athlete': {
                'name': data.get('athleteName', 'Unknown'),
                'weightClass': data.get('weightClass', ''),
                'team': data.get('team', '')
            },
            'attemptNumber': data.get('attemptNumber', 1),
            'weight': data.get('weight', 0),
            'liftType': data.get('liftType', 'Unknown'),
            'timer': {'remaining': data.get('timerSeconds', 60)},
            'votes': {}
        }
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@admin_bp.route('/api/referee-vote', methods=['POST'])
def api_referee_vote():
    """Submit individual referee vote"""
    global current_attempt_data
    try:
        data = request.get_json()
        referee_id = data['refereeId']
        vote = data['vote']
        
        # Store the vote
        if 'votes' not in current_attempt_data:
            current_attempt_data['votes'] = {}
        
        current_attempt_data['votes'][referee_id] = vote
        
        # Log the vote (in production, save to database)
        print(f"Referee {referee_id} voted: {vote}")
        
        return jsonify({
            'status': 'success',
            'message': 'Vote recorded successfully',
            'votes': current_attempt_data['votes']
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@admin_bp.route('/api/clear-attempt', methods=['POST'])
def api_clear_attempt():
    """Clear current attempt (move to next)"""
    global current_attempt_data
    current_attempt_data = {
        'status': 'waiting',
        'athlete': None,
        'attemptNumber': 0,
        'weight': 0,
        'liftType': '',
        'timer': {'remaining': 60},
        'votes': {}
    }
    return jsonify({'status': 'success'})

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