@echo off
setlocal
title ShortLearn Web
cd /d "%~dp0"

echo Starting ShortLearn Web at http://localhost:8090 ...
start "ShortLearn Web Server" /min cmd /c "npx.cmd expo start --web --port 8090"
timeout /t 8 /nobreak >nul
start "" "http://localhost:8090"

endlocal
