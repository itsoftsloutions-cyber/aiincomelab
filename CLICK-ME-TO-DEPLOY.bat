@echo off
REM ============================================================
REM  AIIncomeLab — Double-click this to deploy your blog!
REM  GitHub: itsoftsloutions-cyber / aiincomelab
REM ============================================================
echo Starting AIIncomeLab deploy...
powershell -ExecutionPolicy Bypass -File "%~dp0DEPLOY.ps1"
pause
