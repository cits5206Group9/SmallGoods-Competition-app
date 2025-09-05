#!/usr/bin/env python3
"""
Simple Flask app runner for Small Goods Competition App
"""

import os
import sys

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from app import create_app
from app.extensions import socketio

if __name__ == "__main__":
    # Create the Flask app
    app = create_app('development')
    
    # Run with SocketIO support
    print("Starting Small Goods Competition App...")
    print("Access the app at: http://127.0.0.1:5000")
    print("Press Ctrl+C to stop the server")
    
    socketio.run(app, 
                host='0.0.0.0', 
                port=5000, 
                debug=True,
                allow_unsafe_werkzeug=True)
