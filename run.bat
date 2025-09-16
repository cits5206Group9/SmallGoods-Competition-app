@echo off
REM Flask logging helper script for Windows
REM Usage examples:
REM   run.bat               - No debug, no custom logging
REM   run.bat INFO          - Custom logging with INFO level
REM   run.bat DEBUG         - Custom logging with DEBUG level
REM   run.bat WARNING       - Custom logging with WARNING level

set LOG_LEVEL=%1

if "%LOG_LEVEL%"=="" (
    echo Starting Flask with log level: NONE ^(production mode^)
) else (
    echo Starting Flask with log level: %LOG_LEVEL%
)

REM Activate virtual environment if it exists
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else if exist ".venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call .venv\Scripts\activate.bat
) else (
    echo No virtual environment found, continuing...
)

REM If log level is provided, set environment variable and run with custom logging
if not "%LOG_LEVEL%"=="" (
    echo 🔧 Running with custom logging level: %LOG_LEVEL%
    set FLASK_LOG_LEVEL=%LOG_LEVEL%
    flask run
) else (
    echo 🚀 Running in production mode ^(no custom logging^)
    REM Ensure no log level is set
    set FLASK_LOG_LEVEL=
    flask run
)
