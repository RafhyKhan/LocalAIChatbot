@echo off

:: Check if backend (port 8000) is already running — if so, do nothing
netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo RainAI is already running.
    timeout /t 2 /nobreak >nul
    exit
)

echo Starting RainAI...

:: Start SearXNG via Docker Compose
echo [1/3] Starting SearXNG...
docker-compose -f "%~dp0docker-compose.yml" up -d
echo       SearXNG ready at http://localhost:8080

:: Start backend
echo [2/3] Starting backend...
start "Backend" cmd /k "cd /d %~dp0backend && pip install -r requirements.txt -q && python -m uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

:: Start frontend
echo [3/3] Starting frontend...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  SearXNG: http://localhost:8080
echo  Backend: http://localhost:8000
echo  App:     http://localhost:5173
echo.
