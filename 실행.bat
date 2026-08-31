@echo off
start "Planit Backend" cmd /k "cd /d %~dp0 && python -m uvicorn server:app --reload"
start "Planit Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"