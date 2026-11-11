@echo off
cd /d "%~dp0"
echo Pokrecem IzlazNS server...
start "IzlazNS server - ne zatvaraj ovaj prozor" cmd /k "node server.js"
timeout /t 2 /nobreak >nul
start http://localhost:3000
