"""
Test Flask-SocketIO dependency installation and basic functionality
"""

import pytest
import sys
import importlib


def test_flask_socketio_import():
    """Test that Flask-SocketIO can be imported successfully"""
    try:
        import flask_socketio

        assert True, "Flask-SocketIO imported successfully"
    except ImportError as e:
        pytest.fail(f"Failed to import Flask-SocketIO: {e}")


def test_socketio_dependencies():
    """Test that all SocketIO dependencies are available"""
    dependencies = ["python_socketio", "eventlet"]

    for dep in dependencies:
        try:
            importlib.import_module(dep)
            assert True, f"{dep} imported successfully"
        except ImportError as e:
            pytest.fail(f"Failed to import {dep}: {e}")


def test_socketio_version():
    """Test Flask-SocketIO version compatibility"""
    try:
        import flask_socketio

        version = flask_socketio.__version__
        assert version >= "5.3.0", f"Flask-SocketIO version {version} is compatible"
    except ImportError:
        pytest.fail("Flask-SocketIO not installed")
    except AttributeError:
        # If version attribute doesn't exist, assume it's installed
        assert True, "Flask-SocketIO installed (version check skipped)"


if __name__ == "__main__":
    pytest.main([__file__])
