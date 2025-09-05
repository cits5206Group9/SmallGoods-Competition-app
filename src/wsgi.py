"""
WSGI entry point for Small Goods Competition App
"""

import os
import sys

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import socketio, db

# Create the Flask application
app = create_app(os.environ.get('FLASK_ENV', 'development'))

# Initialize database on first run (only if database doesn't exist)
with app.app_context():
    # Only create tables if they don't exist to avoid issues
    try:
        db.create_all()
    except Exception as e:
        print(f"Database initialization error (this may be normal): {e}")
        # Continue anyway as the database might already be set up

if __name__ == "__main__":
    # For development server with SocketIO
    socketio.run(app, 
                host='0.0.0.0', 
                port=int(os.environ.get('PORT', 5000)),
                debug=app.config['DEBUG'])
