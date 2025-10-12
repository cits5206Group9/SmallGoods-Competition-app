#!/bin/bash

# Flask-SocketIO logging helper script
# This script runs the Python file directly, which correctly
# initializes the Socket.IO server.
#
# Usage examples:
#   ./run.sh              # No debug, no custom logging
#   ./run.sh INFO         # Custom logging with INFO level
#   ./run.sh DEBUG        # Custom logging with DEBUG level
#   ./run.sh -h|--help    # Show this help message
#   ./run.sh format       # Run ruff format on the codebase

# Show help message
show_help() {
    cat << EOF
Flask-SocketIO Server Runner

Usage: ./run.sh [OPTION]

Options:
  -h, --help     Show this help message and exit
  format         Run ruff format on the codebase
  INFO           Start server with INFO log level
  DEBUG          Start server with DEBUG log level
  (no option)    Start server with default log level

Examples:
  ./run.sh              # Start server with default logging
  ./run.sh DEBUG        # Start server with DEBUG logging
  ./run.sh format       # Format code with ruff

EOF
    exit 0
}

# Handle command-line arguments
case "$1" in
    -h|--help)
        show_help
        ;;
    format)
        echo "Running ruff format..."
        if command -v ruff &> /dev/null; then
            ruff format .
            echo "✅ Code formatting complete"
        else
            echo "❌ Error: ruff is not installed"
            echo "Install it with: pip install ruff"
            exit 1
        fi
        exit 0
        ;;
esac

LOG_LEVEL=${1}

echo "Starting Flask-SocketIO server with log level: ${LOG_LEVEL:-'NONE'}"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Set a log level environment variable that can be read by the Python app.
# If no log level is provided, the Python app can default to a non-debug mode.
if [ ! -z "$LOG_LEVEL" ]; then
    echo "Setting log level to $LOG_LEVEL"
    export FLASK_LOG_LEVEL=$LOG_LEVEL
else
    echo "No custom log level specified."
    unset FLASK_LOG_LEVEL
fi

python run.py
