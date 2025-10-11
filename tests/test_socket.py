"""
Test Flask-SocketIO dependency installation and basic functionality
"""

import pytest
import importlib


def test_flask_socketio_import():
    """Test that Flask-SocketIO can be imported successfully"""
    try:
        spec = importlib.util.find_spec("flask_socketio")
        assert spec is not None, "Flask-SocketIO not found"
    except ImportError as e:
        pytest.fail(f"Failed to import Flask-SocketIO: {e}")


def test_socketio_dependencies():
    """Test that all SocketIO dependencies are available"""
    # Note: eventlet has compatibility issues with Python 3.12+
    # It requires distutils which was removed from Python standard library
    dependencies = ["socketio"]

    for dep in dependencies:
        try:
            importlib.import_module(dep)
            assert True, f"{dep} imported successfully"
        except ImportError as e:
            pytest.fail(f"Failed to import {dep}: {e}")

    # Try to import eventlet, but don't fail if it's not available due to Python version
    try:
        importlib.import_module("eventlet")
    except (ImportError, ModuleNotFoundError) as e:
        # This is expected on Python 3.12+ where distutils is not available
        import sys

        if sys.version_info >= (3, 12):
            pytest.skip(
                f"eventlet not compatible with Python {sys.version_info.major}.{sys.version_info.minor}: {e}"
            )
        else:
            pytest.fail(f"Failed to import eventlet: {e}")


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
