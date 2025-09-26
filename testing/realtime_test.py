"""
Test CompetitionRealTime class functionality
"""
import pytest
import sys
import os

# Add the parent directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def test_competition_realtime_import():
    """Test CompetitionRealTime class can be imported"""
    try:
        from app.real_time.websocket import CompetitionRealTime
        assert CompetitionRealTime is not None
    except ImportError as e:
        pytest.fail(f"Failed to import CompetitionRealTime: {e}")


def test_competition_realtime_initialization():
    """Test CompetitionRealTime class initialization"""
    try:
        from app.real_time.websocket import CompetitionRealTime

        realtime = CompetitionRealTime()

        # Check initial state
        assert isinstance(realtime.connected_clients, dict)
        assert isinstance(realtime.competition_rooms, dict)
        assert len(realtime.connected_clients) == 0
        assert len(realtime.competition_rooms) == 0

    except Exception as e:
        pytest.fail(f"Failed to initialize CompetitionRealTime: {e}")


def test_competition_realtime_methods():
    """Test CompetitionRealTime class has required methods"""
    try:
        from app.real_time.websocket import CompetitionRealTime

        realtime = CompetitionRealTime()

        # Check required methods exist
        required_methods = [
            'register_handlers',
            'join_competition_room',
            'leave_competition_room',
            'broadcast_to_competition',
            'broadcast_timer_update',
            'broadcast_referee_decision',
            'broadcast_attempt_result',
            'get_connected_clients_count',
            'get_competition_clients'
        ]

        for method_name in required_methods:
            assert hasattr(realtime, method_name)
            assert callable(getattr(realtime, method_name))

    except Exception as e:
        pytest.fail(f"Failed to verify CompetitionRealTime methods: {e}")


def test_client_tracking():
    """Test client tracking functionality"""
    try:
        from app.real_time.websocket import CompetitionRealTime

        realtime = CompetitionRealTime()

        # Test initial count
        assert realtime.get_connected_clients_count() == 0

        # Test room management (without actual WebSocket)
        test_client_id = "test_client_123"
        test_competition_id = 1

        # Simulate joining room (basic logic test)
        if test_competition_id not in realtime.competition_rooms:
            realtime.competition_rooms[test_competition_id] = {}

        realtime.competition_rooms[test_competition_id][test_client_id] = 'referee'

        # Test tracking
        assert realtime.get_connected_clients_count(test_competition_id) == 1
        clients = realtime.get_competition_clients(test_competition_id)
        assert test_client_id in clients
        assert clients[test_client_id] == 'referee'

    except Exception as e:
        pytest.fail(f"Failed client tracking test: {e}")


if __name__ == "__main__":
    pytest.main([__file__])