@echo off
REM Deprecated: use node scripts/dev-keepalive-supervisor.mjs --detach
cd /d "%~dp0.."
node scripts\dev-keepalive-supervisor.mjs --detach
