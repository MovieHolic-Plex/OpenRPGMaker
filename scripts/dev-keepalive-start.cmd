@echo off
setlocal
cd /d "%~dp0.."
if not exist "output\dev" mkdir "output\dev"
REM Outer supervisor (detached) restarts keepalive; keepalive restarts vite.
node scripts\dev-keepalive-supervisor.mjs --detach
endlocal
