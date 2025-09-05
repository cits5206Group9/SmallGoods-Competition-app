"""
SocketIO event handlers for real-time communication
Handles referee inputs, timer updates, athlete notifications, and live scoring
"""

from flask import request, current_app
from flask_socketio import emit, join_room, leave_room, disconnect
from .extensions import socketio, db
from .models import Competition, Attempt, Timer, AttemptResult, Athlete, Event
from datetime import datetime
import json

# Connection management
@socketio.on('connect')
def handle_connect():
    """Handle client connections"""
    print(f'Client {request.sid} connected')
    emit('status', {'msg': f'Connected to Small Goods Competition Server'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnections"""
    print(f'Client {request.sid} disconnected')

# Room management for different roles
@socketio.on('join_competition')
def handle_join_competition(data):
    """Join a competition room based on role"""
    competition_id = data.get('competition_id')
    role = data.get('role', 'spectator')  # admin, referee, athlete, coach, display, spectator
    
    if not competition_id:
        emit('error', {'msg': 'Competition ID required'})
        return
    
    room = f"competition_{competition_id}_{role}"
    join_room(room)
    
    print(f'Client {request.sid} joined {room}')
    emit('joined', {'room': room, 'role': role, 'competition_id': competition_id})

@socketio.on('leave_competition')
def handle_leave_competition(data):
    """Leave a competition room"""
    competition_id = data.get('competition_id')
    role = data.get('role', 'spectator')
    
    room = f"competition_{competition_id}_{role}"
    leave_room(room)
    
    emit('left', {'room': room})

# Referee input handling (FR4)
@socketio.on('referee_decision')
def handle_referee_decision(data):
    """Handle referee decision input"""
    try:
        attempt_id = data.get('attempt_id')
        referee_id = data.get('referee_id')
        decision = data.get('decision')  # good_lift, no_lift, etc.
        
        if not all([attempt_id, referee_id, decision]):
            emit('error', {'msg': 'Missing required fields'})
            return
        
        # Validate decision
        if decision not in [result.value for result in AttemptResult]:
            emit('error', {'msg': 'Invalid decision'})
            return
        
        # Update attempt in database
        attempt = Attempt.query.get(attempt_id)
        if not attempt:
            emit('error', {'msg': 'Attempt not found'})
            return
        
        # Store referee decision
        decisions = attempt.referee_decisions or {}
        decisions[f'referee_{referee_id}'] = decision
        attempt.referee_decisions = decisions
        
        # For single-referee sports, set final result immediately
        # For multi-referee sports, check if all referees have decided
        competition = attempt.athlete.competition
        if competition.sport_type.value in ['powerlifting']:  # Single referee sports
            attempt.result = AttemptResult(decision)
            attempt.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        # Broadcast to all competition participants
        competition_id = attempt.athlete.competition_id
        socketio.emit('attempt_updated', {
            'attempt_id': attempt_id,
            'athlete_name': attempt.athlete.name,
            'decision': decision,
            'referee_id': referee_id,
            'is_final': attempt.result is not None
        }, room=f"competition_{competition_id}_admin")
        
        socketio.emit('display_update', {
            'type': 'attempt_result',
            'attempt_id': attempt_id,
            'result': attempt.result.value if attempt.result else None
        }, room=f"competition_{competition_id}_display")
        
        emit('decision_recorded', {'attempt_id': attempt_id, 'decision': decision})
        
    except Exception as e:
        current_app.logger.error(f"Error in referee_decision: {str(e)}")
        emit('error', {'msg': 'Failed to record decision'})

# Timer management (FR7)
@socketio.on('timer_start')
def handle_timer_start(data):
    """Start the competition timer"""
    try:
        event_id = data.get('event_id')
        duration = data.get('duration_seconds', 60)
        
        if not event_id:
            emit('error', {'msg': 'Event ID required'})
            return
        
        # Update timer in database
        timer = Timer.query.filter_by(event_id=event_id).first()
        if not timer:
            timer = Timer(event_id=event_id)
            db.session.add(timer)
        
        timer.duration_seconds = duration
        timer.remaining_seconds = duration
        timer.is_running = True
        timer.started_at = datetime.utcnow()
        timer.paused_at = None
        
        db.session.commit()
        
        # Broadcast timer start
        competition_id = Event.query.get(event_id).competition_id
        socketio.emit('timer_started', {
            'event_id': event_id,
            'duration': duration,
            'started_at': timer.started_at.isoformat()
        }, room=f"competition_{competition_id}_admin")
        
        socketio.emit('timer_started', {
            'event_id': event_id,
            'duration': duration,
            'started_at': timer.started_at.isoformat()
        }, room=f"competition_{competition_id}_display")
        
        emit('timer_started', {'event_id': event_id, 'duration': duration})
        
    except Exception as e:
        current_app.logger.error(f"Error starting timer: {str(e)}")
        emit('error', {'msg': 'Failed to start timer'})

@socketio.on('timer_pause')
def handle_timer_pause(data):
    """Pause the competition timer"""
    try:
        event_id = data.get('event_id')
        
        timer = Timer.query.filter_by(event_id=event_id).first()
        if not timer:
            emit('error', {'msg': 'Timer not found'})
            return
        
        timer.is_running = False
        timer.paused_at = datetime.utcnow()
        
        db.session.commit()
        
        # Broadcast timer pause
        competition_id = Event.query.get(event_id).competition_id
        socketio.emit('timer_paused', {
            'event_id': event_id,
            'remaining_seconds': timer.remaining_seconds
        }, room=f"competition_{competition_id}_admin")
        
        socketio.emit('timer_paused', {
            'event_id': event_id,
            'remaining_seconds': timer.remaining_seconds
        }, room=f"competition_{competition_id}_display")
        
        emit('timer_paused', {'event_id': event_id})
        
    except Exception as e:
        current_app.logger.error(f"Error pausing timer: {str(e)}")
        emit('error', {'msg': 'Failed to pause timer'})

@socketio.on('timer_reset')
def handle_timer_reset(data):
    """Reset the competition timer"""
    try:
        event_id = data.get('event_id')
        
        timer = Timer.query.filter_by(event_id=event_id).first()
        if not timer:
            emit('error', {'msg': 'Timer not found'})
            return
        
        timer.is_running = False
        timer.remaining_seconds = timer.duration_seconds
        timer.started_at = None
        timer.paused_at = None
        
        db.session.commit()
        
        # Broadcast timer reset
        competition_id = Event.query.get(event_id).competition_id
        socketio.emit('timer_reset', {
            'event_id': event_id,
            'duration': timer.duration_seconds
        }, room=f"competition_{competition_id}_admin")
        
        socketio.emit('timer_reset', {
            'event_id': event_id,
            'duration': timer.duration_seconds
        }, room=f"competition_{competition_id}_display")
        
        emit('timer_reset', {'event_id': event_id})
        
    except Exception as e:
        current_app.logger.error(f"Error resetting timer: {str(e)}")
        emit('error', {'msg': 'Failed to reset timer'})

# Live model editing (FR3)
@socketio.on('update_competition_model')
def handle_model_update(data):
    """Handle live competition model updates"""
    try:
        update_type = data.get('type')  # 'athlete_order', 'weight_change', 'add_athlete', etc.
        competition_id = data.get('competition_id')
        
        if not all([update_type, competition_id]):
            emit('error', {'msg': 'Missing required fields'})
            return
        
        # Handle different types of updates
        if update_type == 'athlete_order':
            # Update athlete lifting order (FR6)
            new_order = data.get('new_order', [])
            for i, attempt_id in enumerate(new_order):
                attempt = Attempt.query.get(attempt_id)
                if attempt:
                    attempt.lifting_order = i + 1
            
            db.session.commit()
            
            # Broadcast order update
            socketio.emit('athlete_order_updated', {
                'new_order': new_order
            }, room=f"competition_{competition_id}_admin")
            
            socketio.emit('display_update', {
                'type': 'athlete_order',
                'new_order': new_order
            }, room=f"competition_{competition_id}_display")
        
        elif update_type == 'weight_change':
            # Handle weight changes
            attempt_id = data.get('attempt_id')
            new_weight = data.get('new_weight')
            
            attempt = Attempt.query.get(attempt_id)
            if attempt:
                attempt.requested_weight = new_weight
                db.session.commit()
                
                socketio.emit('weight_changed', {
                    'attempt_id': attempt_id,
                    'new_weight': new_weight,
                    'athlete_name': attempt.athlete.name
                }, room=f"competition_{competition_id}_admin")
        
        emit('model_updated', {'type': update_type, 'status': 'success'})
        
    except Exception as e:
        current_app.logger.error(f"Error updating model: {str(e)}")
        emit('error', {'msg': 'Failed to update model'})

# Athlete notifications (FR10)
@socketio.on('notify_athlete')
def handle_athlete_notification(data):
    """Send notification to specific athlete"""
    try:
        athlete_id = data.get('athlete_id')
        message = data.get('message')
        notification_type = data.get('type', 'info')  # info, warning, upcoming_attempt
        
        if not all([athlete_id, message]):
            emit('error', {'msg': 'Missing required fields'})
            return
        
        athlete = Athlete.query.get(athlete_id)
        if not athlete:
            emit('error', {'msg': 'Athlete not found'})
            return
        
        # Send to athlete's room
        competition_id = athlete.competition_id
        socketio.emit('athlete_notification', {
            'athlete_id': athlete_id,
            'athlete_name': athlete.name,
            'message': message,
            'type': notification_type,
            'timestamp': datetime.utcnow().isoformat()
        }, room=f"competition_{competition_id}_athlete")
        
        emit('notification_sent', {
            'athlete_id': athlete_id,
            'message': message
        })
        
    except Exception as e:
        current_app.logger.error(f"Error sending notification: {str(e)}")
        emit('error', {'msg': 'Failed to send notification'})

# Display updates for public screen (FR11)
@socketio.on('get_display_data')
def handle_get_display_data(data):
    """Get current display data for public screen"""
    try:
        competition_id = data.get('competition_id')
        
        if not competition_id:
            emit('error', {'msg': 'Competition ID required'})
            return
        
        # Get current competition state
        competition = Competition.query.get(competition_id)
        if not competition:
            emit('error', {'msg': 'Competition not found'})
            return
        
        # Get current active event
        active_event = Event.query.filter_by(
            competition_id=competition_id, 
            is_active=True
        ).first()
        
        display_data = {
            'competition_name': competition.name,
            'sport_type': competition.sport_type.value,
            'current_event': None,
            'current_athlete': None,
            'next_athletes': [],
            'rankings': [],
            'timer_status': None
        }
        
        if active_event:
            display_data['current_event'] = {
                'name': active_event.name,
                'weight_category': active_event.weight_category,
                'gender': active_event.gender
            }
            
            # Get current lifting order
            current_attempts = Attempt.query.join(Athlete).filter(
                Athlete.competition_id == competition_id,
                Attempt.result.is_(None)
            ).order_by(Attempt.lifting_order).limit(5).all()
            
            if current_attempts:
                current_attempt = current_attempts[0]
                display_data['current_athlete'] = {
                    'name': current_attempt.athlete.name,
                    'team': current_attempt.athlete.team,
                    'weight': current_attempt.requested_weight,
                    'attempt_number': current_attempt.attempt_number,
                    'lift_name': current_attempt.lift.name
                }
                
                display_data['next_athletes'] = [
                    {
                        'name': attempt.athlete.name,
                        'weight': attempt.requested_weight,
                        'attempt_number': attempt.attempt_number
                    }
                    for attempt in current_attempts[1:4]
                ]
            
            # Get timer status
            timer = Timer.query.filter_by(event_id=active_event.id).first()
            if timer:
                display_data['timer_status'] = {
                    'remaining_seconds': timer.remaining_seconds,
                    'is_running': timer.is_running,
                    'is_break': timer.is_break
                }
        
        emit('display_data', display_data)
        
    except Exception as e:
        current_app.logger.error(f"Error getting display data: {str(e)}")
        emit('error', {'msg': 'Failed to get display data'})

# Error handler
@socketio.on_error_default
def default_error_handler(e):
    """Default error handler for SocketIO"""
    current_app.logger.error(f"SocketIO error: {str(e)}")
    emit('error', {'msg': 'An error occurred'})
