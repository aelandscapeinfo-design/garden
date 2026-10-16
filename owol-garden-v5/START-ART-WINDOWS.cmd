@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js is not installed. This local server requires Node.js 24.
 echo For the local server, install Node.js 24 LTS and run this file again.
 pause
 exit /b 1
)
node serve.mjs --open
pause
