@echo off
REM Publishes the next queued topic and rebuilds the site.
REM Schedule this every 2 hours with Windows Task Scheduler (see scripts\schedule-windows.ps1).
cd /d "%~dp0.."
node new-post.js
node build.js
echo Done at %DATE% %TIME%
