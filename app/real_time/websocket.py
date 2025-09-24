"""
WebSocket server implementation for real-time competition data
"""
from flask_socketio import emit, join_room, leave_room
from flask import request
from app.extensions import socketio
import logging

logger = logging.getLogger(__name__)


class CompetitionRealTime:
    """
    Manages real-time WebSocket communication for competition data
    """

    def __init__(self):
        self.connected_clients = {}
        self.competition_rooms = {}

    def register_handlers(self):
        """Register WebSocket event handlers"""

        @socketio.on('connect')
        def handle_connect():
            """Handle client connection"""
            client_id = request.sid
            logger.info(f"Client {client_id} connected")
            self.connected_clients[client_id] = {
                'connected_at': None,
                'competition_id': None,
                'user_type': None
            }
            emit('connection_established', {'client_id': client_id})

        @socketio.on('disconnect')
        def handle_disconnect():
            """Handle client disconnection"""
            client_id = request.sid
            logger.info(f"Client {client_id} disconnected")

            # Clean up client data
            if client_id in self.connected_clients:
                client_data = self.connected_clients[client_id]
                competition_id = client_data.get('competition_id')

                # Leave competition room if joined
                if competition_id:
                    self.leave_competition_room(client_id, competition_id)

                del self.connected_clients[client_id]

        @socketio.on('join_competition')
        def handle_join_competition(data):
            """Handle client joining a competition room"""
            client_id = request.sid
            competition_id = data.get('competition_id')
            user_type = data.get('user_type', 'spectator')

            if not competition_id:
                emit('error', {'message': 'Competition ID required'})
                return

            # Join the competition room
            self.join_competition_room(client_id, competition_id, user_type)
            emit('joined_competition', {
                'competition_id': competition_id,
                'user_type': user_type
            })

        @socketio.on('leave_competition')
        def handle_leave_competition(data):
            """Handle client leaving a competition room"""
            client_id = request.sid
            competition_id = data.get('competition_id')

            if competition_id:
                self.leave_competition_room(client_id, competition_id)
                emit('left_competition', {'competition_id': competition_id})

    def join_competition_room(self, client_id, competition_id, user_type='spectator'):
        """Add client to competition room"""
        room_name = f"competition_{competition_id}"
        join_room(room_name)

        # Update client data
        if client_id in self.connected_clients:
            self.connected_clients[client_id]['competition_id'] = competition_id
            self.connected_clients[client_id]['user_type'] = user_type

        # Track room participants
        if competition_id not in self.competition_rooms:
            self.competition_rooms[competition_id] = {}
        self.competition_rooms[competition_id][client_id] = user_type

        logger.info(f"Client {client_id} joined competition {competition_id} as {user_type}")

    def leave_competition_room(self, client_id, competition_id):
        """Remove client from competition room"""
        room_name = f"competition_{competition_id}"
        leave_room(room_name)

        # Update client data
        if client_id in self.connected_clients:
            self.connected_clients[client_id]['competition_id'] = None
            self.connected_clients[client_id]['user_type'] = None

        # Remove from room tracking
        if competition_id in self.competition_rooms:
            self.competition_rooms[competition_id].pop(client_id, None)

            # Clean up empty rooms
            if not self.competition_rooms[competition_id]:
                del self.competition_rooms[competition_id]

        logger.info(f"Client {client_id} left competition {competition_id}")

    def broadcast_to_competition(self, competition_id, event, data):
        """Broadcast data to all clients in a competition room"""
        room_name = f"competition_{competition_id}"
        socketio.emit(event, data, room=room_name)
        logger.debug(f"Broadcasted {event} to competition {competition_id}")

    def broadcast_timer_update(self, competition_id, timer_data):
        """Broadcast timer update to competition room"""
        self.broadcast_to_competition(competition_id, 'timer_update', timer_data)

    def broadcast_referee_decision(self, competition_id, decision_data):
        """Broadcast referee decision to competition room"""
        self.broadcast_to_competition(competition_id, 'referee_decision', decision_data)

    def broadcast_attempt_result(self, competition_id, result_data):
        """Broadcast attempt result to competition room"""
        self.broadcast_to_competition(competition_id, 'attempt_result', result_data)

    def get_connected_clients_count(self, competition_id=None):
        """Get count of connected clients"""
        if competition_id:
            return len(self.competition_rooms.get(competition_id, {}))
        return len(self.connected_clients)

    def get_competition_clients(self, competition_id):
        """Get clients connected to specific competition"""
        return self.competition_rooms.get(competition_id, {})


# Global instance
competition_realtime = CompetitionRealTime()