"""
Test WebSocket extension configuration
"""
import pytest
import sys
import os

# Add the parent directory to sys.path to import the app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

def test_socketio_extension_import():
    """Test that SocketIO extension can be imported"""
    try:
        from app.extensions import socketio
        assert socketio is not None
        assert hasattr(socketio, 'init_app')
    except ImportError as e:
        pytest.fail(f"Failed to import SocketIO extension: {e}")


def test_extensions_initialization():
    """Test that all extensions are properly configured"""
    try:
        from app.extensions import db, migrate, socketio

        # Check that extensions are instances of expected classes
        from flask_sqlalchemy import SQLAlchemy
        from flask_migrate import Migrate
        from flask_socketio import SocketIO

        assert isinstance(db, SQLAlchemy)
        assert isinstance(migrate, Migrate)
        assert isinstance(socketio, SocketIO)

    except ImportError as e:
        pytest.fail(f"Failed to import extensions: {e}")


def test_app_creation_with_socketio():
    """Test that Flask app can be created with SocketIO extension"""
    try:
        from app import create_app
        app = create_app('testing')

        # Check that SocketIO is properly initialized
        assert hasattr(app, 'extensions')
        assert 'socketio' in app.extensions

    except Exception as e:
        pytest.fail(f"Failed to create app with SocketIO: {e}")


if __name__ == "__main__":
    pytest.main([__file__])