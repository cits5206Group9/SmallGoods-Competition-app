from flask import Blueprint, render_template, jsonify, request, flash, redirect, url_for
from sqlalchemy.orm import joinedload
from .extensions import db
from datetime import datetime
from .models import (
    Athlete, 
    AthleteEntry, 
    CompetitionType, 
    Exercise, 
    SportCategory,
    Attempt,
    Competition,
    CompetitionDay
)

main_bp = Blueprint('main', __name__)
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
athlete_bp = Blueprint('athlete', __name__, url_prefix='/athlete')

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

@admin_bp.route('/timer')
def timer():
    return render_template('admin/timer.html')

@admin_bp.route('/referee')
def referee():
    return render_template('admin/referee.html')

@admin_bp.route('/display')
def display():
    return render_template('admin/display.html')

# --- Athlete Routes --- #

# Mock data for athlete events
athlete_events_data = [
        {
            'type': 'Weightlifting',
            'flight': 'Flight 1',
            'opener': '25',
            'rank': 4,
            'attempts': {
                'snatch': [
                    {'order': 1, 'weight': 25, 'result': 'Success'},
                    {'order': 2, 'weight': 28, 'result': 'Success'},
                    {'order': 3, 'weight': 30, 'result': None, 'time': 300}
                ],
                'clean_and_jerk': [
                    {'order': 1, 'weight': 35, 'result': None},
                    {'order': 2, 'weight': 40, 'result': None},
                    {'order': 3, 'weight': 45, 'result': None}
                ]
            }
        },
        {
            'type': 'Powerlifting',
            'flight': 'Flight 2',
            'opener': '40',
            'rank': 3,
            'attempts': {
                'squat': [
                    {'order': 1, 'weight': 40, 'result': None},
                    {'order': 2, 'weight': 160, 'result': None},
                    {'order': 3, 'weight': 170, 'result': None}
                ],
                'bench_press': [
                    {'order': 1, 'weight': 100, 'result': None},
                    {'order': 2, 'weight': 105, 'result': None},
                    {'order': 3, 'weight': 110, 'result': None}
                ],
                'deadlift': [
                    {'order': 1, 'weight': 180, 'result': None},
                    {'order': 2, 'weight': 190, 'result': None},
                    {'order': 3, 'weight': 200, 'result': None}
                ]
            }
        }
    ]


def determine_competition_status(event):
    """
    Determine competition status based on attempt results
    Returns: 'Not Started', 'In Progress', or 'Completed'
    """
    if not event.get('attempts'):
        return 'Not Registered'
    # TODO: CHANGE TO THIS AFTER DB IS READY
    # if not event.attempts.count():
    #     return 'Not Registered'

    total_attempts = 0
    completed_attempts = 0
    has_next = False

    # Check all attempts in all lift types
    for lift_type, attempts in event['attempts'].items():
        for attempt in attempts:
            total_attempts += 1
            if attempt.get('result'):
                completed_attempts += 1
            elif attempt.get('status') == 'Next':
                has_next = True

    # Determine status based on attempt completion
    if completed_attempts == 0:
        return 'Not Started'
    elif completed_attempts == total_attempts:
        return 'Completed'
    elif has_next or completed_attempts > 0:
        return 'In Progress'
    else:
        return 'Pending'

    # TODO: CHANGE TO THIS AFTER DB IS READY
    # total_attempts = event.attempts.count()
    # completed_attempts = event.attempts.filter(Attempt.final_result.isnot(None)).count()
    # has_next = event.attempts.filter(Attempt.status == 'Next').first() is not None

    # if completed_attempts == 0:
    #     return 'Not Started'
    # elif completed_attempts == total_attempts:
    #     return 'Completed'
    # elif has_next or completed_attempts > 0:
    #     return 'In Progress'
    # else:
    #     return 'Pending'


def determine_attempt_status(attempts, current_attempt):
    """Helper function to determine attempt status based on order and completion"""
    if current_attempt.get('result'):
    # TODO: CHANGE TO THIS AFTER DB IS READY
    # if current_attempt.final_result:
        return 'Completed'
    
    # Find the first non-completed attempt in this lift type
    pending_attempts = [a for a in attempts if not a.get('result')]
    if pending_attempts and pending_attempts[0]['order'] == current_attempt['order']:
    # pending_attempts = [a for a in attempts if not a.final_result]
    # if pending_attempts and pending_attempts[0].attempt_number == current_attempt.attempt_number:
        return 'Next'
    
    return 'Pending'

# def find_next_attempt():
#     """Helper function to query the next attempt from database"""
#     return Attempt.query.join(
#         AthleteEntry
#     ).filter(
#         AthleteEntry.athlete_id == current_user.id,
#         Attempt.final_result.is_(None)
#     ).order_by(
#         Attempt.attempt_number
#     ).first()


@athlete_bp.route('/next-attempt-timer')
def get_next_attempt_timer():
    try:
        # TODO: CHANGE TO THIS AFTER DB IS READY
        # Example with SQLAlchemy:
        """
        next_attempt = find_next_attempt()
        if next_attempt:
            return jsonify({
                'time': next_attempt.time_remaining or 600,
                'event_type': next_attempt.athlete_entry.competition_type.exercise.sport_category.name,
                'lift_type': next_attempt.lift_type,
                'order': next_attempt.attempt_number,
                'weight': next_attempt.requested_weight
            })
        return jsonify({'error': 'No next attempt found'})
    except Exception as e:
        print(f"Error fetching next attempt timer: {str(e)}")
        return jsonify({'error': 'Error fetching timer data'}), 500
        """
        
        # Using mock data for now
        for event in athlete_events_data:
            if event['type'] == 'Weightlifting':
                # Determine status for snatch attempts
                snatch_attempts = event['attempts']['snatch']
                for attempt in snatch_attempts:
                    attempt['status'] = determine_attempt_status(snatch_attempts, attempt)
                    if attempt['status'] == 'Next':
                        return jsonify({
                            'time': attempt.get('time', 300),  # Default to 300 if not specified
                            'event_type': 'Weightlifting',
                            'lift_type': 'Snatch',
                            'order': attempt['order'],
                            'weight': attempt['weight']
                        })
                
                # Determine status for clean_and_jerk attempts
                clean_and_jerk_attempts = event['attempts']['clean_and_jerk']
                for attempt in clean_and_jerk_attempts:
                    attempt['status'] = determine_attempt_status(clean_and_jerk_attempts, attempt)
                    if attempt['status'] == 'Next':
                        return jsonify({
                            'time': attempt.get('time', 300),  # Default to 300 if not specified
                            'event_type': 'Weightlifting',
                            'lift_type': 'Clean & Jerk',
                            'order': attempt['order'],
                            'weight': attempt['weight']
                        })
                        
        return jsonify({'error': 'No next attempt found'})
    except Exception as e:
        print(f"Error fetching next attempt timer: {str(e)}")
        return jsonify({'error': 'Error fetching timer data'}), 500


@athlete_bp.route('/update-attempt-weight', methods=['POST'])
def update_attempt_weight():
    try:
        attempt_id = request.form.get('attempt_id')
        new_weight = float(request.form.get('weight'))
        # TODO: CHANGE TO THIS AFTER DB IS READY, NOT SURE IF BELOW IS CORRECT SO CHECK LATER
        """
        attempt = Attempt.query.get_or_404(request.form.get('attempt_id'))
        
        # Verify this attempt belongs to current user
        if attempt.athlete_entry.athlete_id != current_user.id:
            flash('Unauthorized access', 'error')
            return redirect(url_for('athlete.athlete_dashboard'))
        
        attempt.requested_weight = float(request.form.get('weight'))
        db.session.commit()
        
        flash(f'Successfully updated weight to {attempt.requested_weight}kg', 'success')
        """

        # Find the attempt in mock data (change to DB query later)
        for event in athlete_events_data:
            attempts = event['attempts']
            for lift_type in attempts:
                for attempt in attempts[lift_type]:
                    if attempt.get('id') == attempt_id:
                        attempt['weight'] = new_weight
                        return jsonify({
                            'success': True,
                            'weight': new_weight,
                            'message': f'Successfully updated weight to {new_weight}kg'
                        })
        
        return jsonify({
            'success': False,
            'error': 'Attempt not found'
        }), 404
        
    except Exception as e:
        print(f"Error updating attempt weight: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Error updating weight'
        }), 500

@athlete_bp.route('/event-detail')
def get_event_detail():
    try:
        event_type = request.args.get('event_type', '').lower()
        
        if event_type == 'weightlifting':
            event_type = 'Weightlifting'
        elif event_type == 'powerlifting':
            event_type = 'Powerlifting'

        # Find the event in athlete_events_data
        matching_events = [event for event in athlete_events_data if event['type'] == event_type]
        
        if matching_events:
            event = matching_events[0]
            return jsonify({
                'type': event['type'],
                'flight': event.get('flight'),
                'opener': event.get('opener'),
                'status': event.get('status'),
                'attempts': event.get('attempts', {})
            })
        
        return jsonify({
            'type': event_type,
            'flight': None,
            'opener': None,
            'status': 'Not Registered',
            'attempts': {}
        })
    except Exception as e:
        print(f"Error fetching event detail: {str(e)}")
        return jsonify({'error': 'Error fetching event data'}), 500
    
    # TODO: CHANGE TO THIS AFTER DB IS READY
    """
    try:
        event_type = request.args.get('event_type')
        if not event_type:
            return jsonify({'error': 'Event type is required'}), 400

        # Get athlete's event entry for the specified event type
        event = AthleteEntry.query.join(
            CompetitionType,
            Exercise,
            SportCategory
        ).filter(
            AthleteEntry.athlete_id == current_user.id,
            SportCategory.name == event_type
        ).first()

        if event:
            # Get all attempts for this event
            attempts = event.attempts.order_by(Attempt.attempt_number).all()
            for attempt in attempts:
                attempt.status = determine_attempt_status(attempts, attempt)

            return jsonify({
                'type': event_type,
                'flight': event.flight,
                'opener': event.opener,
                'status': determine_competition_status(event),
                'attempts': {
                    'snatch': [
                        {
                            'order': a.attempt_number,
                            'weight': a.requested_weight,
                            'result': a.final_result,
                            'status': a.status,
                            'time': a.time_remaining
                        } for a in attempts if a.lift_type == 'snatch'
                    ],
                    'clean_and_jerk': [
                        {
                            'order': a.attempt_number,
                            'weight': a.requested_weight,
                            'result': a.final_result,
                            'status': a.status,
                            'time': a.time_remaining
                        } for a in attempts if a.lift_type == 'clean_and_jerk'
                    ]
                } if event_type == 'Weightlifting' else {
                    'squat': [
                        {
                            'order': a.attempt_number,
                            'weight': a.requested_weight,
                            'result': a.final_result,
                            'status': a.status,
                            'time': a.time_remaining
                        } for a in attempts if a.lift_type == 'squat'
                    ],
                    'bench_press': [
                        {
                            'order': a.attempt_number,
                            'weight': a.requested_weight,
                            'result': a.final_result,
                            'status': a.status,
                            'time': a.time_remaining
                        } for a in attempts if a.lift_type == 'bench_press'
                    ],
                    'deadlift': [
                        {
                            'order': a.attempt_number,
                            'weight': a.requested_weight,
                            'result': a.final_result,
                            'status': a.status,
                            'time': a.time_remaining
                        } for a in attempts if a.lift_type == 'deadlift'
                    ]
                }
            })
        """
@athlete_bp.route('/')
def athlete_dashboard():
    athlete_data = {
        'name': 'Ann',
        'id': 'ann@email.com',
        'gender': 'F'
    }
    
    competition_data = {
        'name': '2025 SG Throwdown',
        'date': 'Sept 12-15, 2025',
    }
    
    # Update attempt statuses for all events
    for event in athlete_events_data:
        if event['type'] == 'Weightlifting':
            for lift_type in ['snatch', 'clean_and_jerk']:
                attempts = event['attempts'][lift_type]
                for attempt in attempts:
                    attempt['status'] = determine_attempt_status(attempts, attempt)
        elif event['type'] == 'Powerlifting':
            for lift_type in ['squat', 'bench_press', 'deadlift']:
                attempts = event['attempts'][lift_type]
                for attempt in attempts:
                    attempt['status'] = determine_attempt_status(attempts, attempt)
        
        # Update event status
        event['status'] = determine_competition_status(event)

    # Find next attempt for timer
    next_attempt = None
    for event in athlete_events_data:
        if event['type'] == 'Weightlifting':
            for lift_type in ['snatch', 'clean_and_jerk']:
                for attempt in event['attempts'][lift_type]:
                    if attempt['status'] == 'Next':
                        next_attempt = {
                            'event_type': 'Weightlifting',
                            'lift_type': lift_type.replace('_', ' ').title(),
                            'order': attempt['order'],
                            'weight': attempt['weight'],
                            'time': attempt.get('time', 300)
                        }
                        break
                if next_attempt:
                    break
            if next_attempt:
                break
    
    # TODO: CHANGE TO THIS AFTER DB IS READY
    """
    # Get athlete data from database
    athlete = Athlete.query.get_or_404(current_user.id)
    
    # Get athlete's events with all related data
    athlete_events = AthleteEntry.query.options(
        joinedload('competition_type')
        .joinedload('exercise')
        .joinedload('sport_category')
    ).filter_by(athlete_id=current_user.id).all()
    
    # Get current competition
    competition = Competition.query.join(
        CompetitionDay
    ).filter(
        CompetitionDay.date >= datetime.now()
    ).first()

    # Convert database objects to dict format matching current template
    athlete_data = {
        'name': f"{athlete.first_name}",
        'id': athlete.email,
        'gender': athlete.gender
    }
    
    competition_data = {
        'name': competition.name,
        'date': competition.start_date.strftime('%B %d-%d, %Y')
    }

    # Update attempt statuses
    for event in athlete_events:
        attempts = event.attempts.order_by(Attempt.attempt_number).all()
        for attempt in attempts:
            attempt.status = determine_attempt_status(attempts, attempt)
        
        event.status = determine_competition_status(event)
    """

    return render_template(
        'athlete/athlete.html',
        athlete=athlete_data,
        competition=competition_data,
        athlete_events=athlete_events_data,
        # TODO: CHANGE TO THIS AFTER DB IS READY
        # athlete_events=athlete_events,
        next_attempt=next_attempt
        # next_attempt=find_next_attempt()
    )
