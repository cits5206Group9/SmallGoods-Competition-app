@echo off
REM Small Goods Competition App Startup Script

echo Starting Small Goods Competition App...
echo.

REM Set environment variables
set FLASK_APP=src/app
set FLASK_ENV=development
set FLASK_DEBUG=1

REM Create instance directory
if not exist "src/instance" mkdir "src\instance"

REM Run the application
echo Access the application at: http://127.0.0.1:5000
echo Press Ctrl+C to stop the server
echo.

E:\github\learn\SmallGoods-Competition-app\venv\Scripts\python.exe src\wsgi.py

pause
