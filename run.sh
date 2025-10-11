#!/bin/bash

# Flask-SocketIO logging helper script
# This script now runs the Python file directly, which correctly
# initializes the Socket.IO server.
# Usage examples:
#   ./run.sh                 # No debug, no custom logging
#   ./run.sh INFO            # Custom logging with INFO level
#   ./run.sh DEBUG           # Custom logging with DEBUG level
#   ./run.sh format          # Run ruff format --fix
#   ./run.sh check           # Run ruff check --fix

MODE=${1}

# Check if first argument is a command
if [ "$MODE" = "format" ]; then
    echo "Running ruff format --fix..."
    # Use local venv if available
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    ruff format .
    exit 0
fi

if [ "$MODE" = "check" ]; then
    echo "Running ruff check --fix..."
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    ruff check --fix .
    exit 0
fi

# Otherwise treat first argument as log level
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
