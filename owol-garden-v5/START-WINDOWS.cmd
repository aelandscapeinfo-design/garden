@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Please install Node.js 24 LTS, then run this file again.
 pause
 exit /b 1
)
echo Open http://localhost:5178 on this computer after the server starts.
node scripts/serve.mjs
pause
