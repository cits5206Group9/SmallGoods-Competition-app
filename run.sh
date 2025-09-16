#!/bin/bash

# Flask logging helper script
# Usage examples:
#   ./flask_run.sh           # No debug, no custom logging
#   ./flask_run.sh INFO      # Custom logging with INFO level
#   ./flask_run.sh DEBUG     # Custom logging with DEBUG level
#   ./flask_run.sh WARNING   # Custom logging with WARNING level

LOG_LEVEL=${1}

echo "Starting Flask with log level: ${LOG_LEVEL:-'NONE (production mode)'}"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# If log level is provided, set environment variable and run with custom logging
if [ ! -z "$LOG_LEVEL" ]; then
    echo "🔧 Running with custom logging level: $LOG_LEVEL"
    export FLASK_LOG_LEVEL=$LOG_LEVEL
    flask run
else
    echo "🚀 Running in production mode (no custom logging)"
    # Ensure no log level is set
    unset FLASK_LOG_LEVEL
    flask run
fi
