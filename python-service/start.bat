@echo off
echo Starting Speech Analysis Service...
echo.

REM Activate virtual environment and start service
call venv\Scripts\activate.bat
python analyze.py
