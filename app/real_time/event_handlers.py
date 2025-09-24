"""
WebSocket event handlers for real-time competition features
"""
from flask_socketio import emit
from flask import request
from app.extensions import socketio
from .websocket import competition_realtime
import logging

logger = logging.getLogger(__name__)


def register_all_handlers():
    """Register all WebSocket event handlers"""
    competition_realtime.register_handlers()
    register_timer_handlers()
    register_referee_handlers()
    register_competition_handlers()


@socketio.on('timer_start')
def handle_timer_start(data):
    """Handle timer start event"""
    competition_id = data.get('competition_id')
    timer_data = data.get('timer_data', {})

    if not competition_id:
        emit('error', {'message': 'Competition ID required'})
        return

    # Broadcast timer start to all clients in competition
    timer_update = {
        'action': 'start',
        'competition_id': competition_id,
        'timestamp': timer_data.get('start_time'),
        'duration': timer_data.get('duration', 60)
    }

    competition_realtime.broadcast_timer_update(competition_id, timer_update)
    logger.info(f"Timer started for competition {competition_id}")


@socketio.on('timer_stop')
def handle_timer_stop(data):
    """Handle timer stop event"""
    competition_id = data.get('competition_id')

    if not competition_id:
        emit('error', {'message': 'Competition ID required'})
        return

    # Broadcast timer stop
    timer_update = {
        'action': 'stop',
        'competition_id': competition_id,
        'timestamp': data.get('stop_time')
    }

    competition_realtime.broadcast_timer_update(competition_id, timer_update)
    logger.info(f"Timer stopped for competition {competition_id}")


@socketio.on('timer_reset')
def handle_timer_reset(data):
    """Handle timer reset event"""
    competition_id = data.get('competition_id')

    if not competition_id:
        emit('error', {'message': 'Competition ID required'})
        return

    # Broadcast timer reset
    timer_update = {
        'action': 'reset',
        'competition_id': competition_id,
        'timestamp': data.get('reset_time')
    }

    competition_realtime.broadcast_timer_update(competition_id, timer_update)
    logger.info(f"Timer reset for competition {competition_id}")


def register_timer_handlers():
    """Register timer-specific event handlers"""
    # Timer handlers are defined above as decorators
    pass


@socketio.on('referee_decision')
def handle_referee_decision(data):
    """Handle referee decision submission"""
    competition_id = data.get('competition_id')
    referee_id = data.get('referee_id')
    decision = data.get('decision')
    attempt_id = data.get('attempt_id')

    if not all([competition_id, referee_id, decision, attempt_id]):
        emit('error', {'message': 'Missing required decision data'})
        return

    # Broadcast referee decision
    decision_data = {
        'competition_id': competition_id,
        'referee_id': referee_id,
        'decision': decision,
        'attempt_id': attempt_id,
        'timestamp': data.get('timestamp')
    }

    competition_realtime.broadcast_referee_decision(competition_id, decision_data)
    logger.info(f"Referee {referee_id} decision broadcast for competition {competition_id}")


@socketio.on('attempt_result')
def handle_attempt_result(data):
    """Handle attempt result broadcast"""
    competition_id = data.get('competition_id')
    athlete_id = data.get('athlete_id')
    result = data.get('result')

    if not all([competition_id, athlete_id, result]):
        emit('error', {'message': 'Missing required result data'})
        return

    # Broadcast attempt result
    result_data = {
        'competition_id': competition_id,
        'athlete_id': athlete_id,
        'result': result,
        'timestamp': data.get('timestamp')
    }

    competition_realtime.broadcast_attempt_result(competition_id, result_data)
    logger.info(f"Attempt result broadcast for athlete {athlete_id} in competition {competition_id}")


def register_referee_handlers():
    """Register referee-specific event handlers"""
    # Referee handlers are defined above as decorators
    pass


@socketio.on('competition_status_update')
def handle_competition_status_update(data):
    """Handle competition status updates"""
    competition_id = data.get('competition_id')
    status = data.get('status')

    if not all([competition_id, status]):
        emit('error', {'message': 'Missing competition status data'})
        return

    # Broadcast competition status update
    status_data = {
        'competition_id': competition_id,
        'status': status,
        'timestamp': data.get('timestamp')
    }

    competition_realtime.broadcast_to_competition(
        competition_id, 'competition_status_update', status_data
    )
    logger.info(f"Competition {competition_id} status updated to {status}")


@socketio.on('athlete_queue_update')
def handle_athlete_queue_update(data):
    """Handle athlete queue order updates"""
    competition_id = data.get('competition_id')
    queue_data = data.get('queue_data')

    if not all([competition_id, queue_data]):
        emit('error', {'message': 'Missing queue data'})
        return

    # Broadcast queue update
    queue_update = {
        'competition_id': competition_id,
        'queue_data': queue_data,
        'timestamp': data.get('timestamp')
    }

    competition_realtime.broadcast_to_competition(
        competition_id, 'athlete_queue_update', queue_update
    )
    logger.info(f"Athlete queue updated for competition {competition_id}")


def register_competition_handlers():
    """Register competition-specific event handlers"""
    # Competition handlers are defined above as decorators
    pass


@socketio.on('ping')
def handle_ping(data=None):
    """Handle ping for connection testing"""
    timestamp = data.get('timestamp') if data else None
    emit('pong', {'timestamp': timestamp})