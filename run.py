import os
from venv import logger
from app import create_app
from app.extensions import socketio
LOG_LEVEL = os.environ.get('FLASK_LOG_LEVEL', '').upper()
DEBUG_MODE_ON = True if LOG_LEVEL else False
app = create_app()

if __name__ == '__main__':
    # Use socketio.run instead of app.run for WebSocket support
    logger.info(f"Log level set to {LOG_LEVEL}")
    # Use 0.0.0.0 to bind to all network interfaces (accessible on local network)
    # Use 127.0.0.1 to bind only to localhost (same machine only)
    socketio.run(app, debug=DEBUG_MODE_ON, port=5001, host='0.0.0.0', allow_unsafe_werkzeug=True)