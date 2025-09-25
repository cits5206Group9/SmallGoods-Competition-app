"""
Test WebSocket event handlers functionality
"""
import pytest
import sys
import os

# Add the parent directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def test_event_handlers_import():
    """Test that event handlers can be imported"""
    try:
        from app.real_time.event_handlers import register_all_handlers
        assert register_all_handlers is not None
        assert callable(register_all_handlers)
    except ImportError as e:
        pytest.fail(f"Failed to import event handlers: {e}")


def test_handler_functions_exist():
    """Test that required handler functions exist"""
    try:
        from app.real_time import event_handlers

        # Check that handler functions are defined
        handler_functions = [
            'handle_timer_start',
            'handle_timer_stop',
            'handle_timer_reset',
            'handle_referee_decision',
            'handle_attempt_result',
            'handle_competition_status_update',
            'handle_athlete_queue_update',
            'handle_ping'
        ]

        for func_name in handler_functions:
            assert hasattr(event_handlers, func_name)
            func = getattr(event_handlers, func_name)
            assert callable(func)

    except ImportError as e:
        pytest.fail(f"Failed to import event handlers module: {e}")
    except AttributeError as e:
        pytest.fail(f"Handler function not found: {e}")


def test_register_functions_exist():
    """Test that register functions exist"""
    try:
        from app.real_time.event_handlers import (
            register_all_handlers,
            register_timer_handlers,
            register_referee_handlers,
            register_competition_handlers
        )

        register_functions = [
            register_all_handlers,
            register_timer_handlers,
            register_referee_handlers,
            register_competition_handlers
        ]

        for func in register_functions:
            assert callable(func)

    except ImportError as e:
        pytest.fail(f"Failed to import register functions: {e}")


def test_websocket_integration():
    """Test WebSocket integration with event handlers"""
    try:
        from app.real_time.websocket import competition_realtime
        from app.real_time.event_handlers import register_all_handlers

        # Test that competition_realtime instance exists
        assert competition_realtime is not None
        assert hasattr(competition_realtime, 'register_handlers')

        # Test that register_all_handlers can be called
        # Note: This won't actually register in testing environment
        # but verifies the function structure
        register_all_handlers()

    except Exception as e:
        pytest.fail(f"WebSocket integration test failed: {e}")


if __name__ == "__main__":
    pytest.main([__file__])