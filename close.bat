@echo off
echo Stopping RainAI...

:: Kill backend (port 8000)
echo [1/3] Stopping backend...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Kill frontend (port 5173)
echo [2/3] Stopping frontend...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Stop SearXNG Docker container
echo [3/3] Stopping SearXNG...
docker-compose -f "%~dp0docker-compose.yml" down >nul 2>&1

echo.
echo  RainAI stopped.
timeout /t 2 /nobreak >nul
