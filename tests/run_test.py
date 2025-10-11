"""
Test run.py WebSocket server configuration
"""

import pytest
import sys
import os

# Add the parent directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_run_imports():
    """Test that run.py imports are working"""
    try:
        # Import the main components
        from app import create_app
        from app.extensions import socketio

        assert create_app is not None
        assert socketio is not None

    except ImportError as e:
        pytest.fail(f"Failed to import from run.py: {e}")


def test_app_creation():
    """Test that app can be created successfully"""
    try:
        from app import create_app

        app = create_app("testing")
        assert app is not None
        assert hasattr(app, "config")

    except Exception as e:
        pytest.fail(f"Failed to create app: {e}")


def test_socketio_integration():
    """Test SocketIO integration with app"""
    try:
        from app import create_app
        from app.extensions import socketio

        app = create_app("testing")

        # Check that SocketIO is properly integrated
        assert hasattr(app, "extensions")
        assert "socketio" in app.extensions

        # Check that SocketIO has the app reference
        assert socketio.server is not None

    except Exception as e:
        pytest.fail(f"Failed SocketIO integration test: {e}")


def test_websocket_methods():
    """Test that SocketIO has required methods"""
    try:
        from app.extensions import socketio

        # Check required methods for WebSocket server
        required_methods = ["run", "emit", "init_app"]

        for method_name in required_methods:
            assert hasattr(socketio, method_name)
            assert callable(getattr(socketio, method_name))

    except Exception as e:
        pytest.fail(f"Failed WebSocket methods test: {e}")


if __name__ == "__main__":
    pytest.main([__file__])
