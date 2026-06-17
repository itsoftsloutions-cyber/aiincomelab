@echo off
REM ============================================================
REM  AIIncomeLab — FULLY AUTOMATED GITHUB DEPLOY
REM  GitHub user: itsoftsloutions-cyber
REM  Repo:        aiincomelab
REM
REM  All you need to do:
REM    1. Create a FREE GitHub token (30 seconds):
REM       https://github.com/settings/tokens/new
REM       -> Check "repo" scope -> Generate -> Copy the token
REM    2. Paste it when prompted below
REM    Everything else is automatic.
REM ============================================================

SET GH_USER=itsoftsloutions-cyber
SET GH_REPO=aiincomelab

cd /d "%~dp0.."

echo.
echo ============================================================
echo   AIIncomeLab — Auto Deploy for %GH_USER%/%GH_REPO%
echo ============================================================

REM ── Get GitHub token ────────────────────────────────────────
echo.
echo [Step 1] GitHub Personal Access Token
echo.
echo   Create one FREE at (takes 30 seconds):
echo   https://github.com/settings/tokens/new
echo.
echo   Tick the "repo" checkbox then click "Generate token"
echo   Copy the token (starts with ghp_...)
echo.
set /p GH_TOKEN="   Paste your token here and press Enter: "

IF "%GH_TOKEN%"=="" (
  echo   No token entered. Exiting.
  pause
  exit /b 1
)

REM ── Build site ──────────────────────────────────────────────
echo.
echo [Step 2] Building site...
node build.js
IF ERRORLEVEL 1 (echo   BUILD FAILED && pause && exit /b 1)

REM ── Create GitHub repo via API ───────────────────────────────
echo.
echo [Step 3] Creating GitHub repo %GH_USER%/%GH_REPO%...
node scripts\create-repo.mjs "%GH_TOKEN%" "%GH_USER%" "%GH_REPO%"
IF ERRORLEVEL 1 (echo   Repo creation step had an issue — may already exist, continuing... )

REM ── Configure git and push ──────────────────────────────────
echo.
echo [Step 4] Pushing code to GitHub...
git config user.name "%GH_USER%"
git config user.email "%GH_USER%@users.noreply.github.com"
git remote remove origin 2>nul
git remote add origin https://%GH_TOKEN%@github.com/%GH_USER%/%GH_REPO%.git
git branch -M master
git add -A
git commit -m "auto: initial deploy from AIIncomeLab" 2>nul || echo (nothing new to commit)
git push -u origin master
IF ERRORLEVEL 1 (
  echo.
  echo   Push failed. Common fixes:
  echo   - Make sure the token has "repo" scope
  echo   - Try running this script as Administrator
  pause
  exit /b 1
)

REM ── Enable GitHub Pages ─────────────────────────────────────
echo.
echo [Step 5] Enabling GitHub Pages...
node scripts\enable-pages.mjs "%GH_TOKEN%" "%GH_USER%" "%GH_REPO%"

REM ── Register 2-hour Windows scheduler ───────────────────────
echo.
echo [Step 6] Registering 2-hour auto-publish scheduler...
powershell -ExecutionPolicy Bypass -File "%~dp0schedule-windows.ps1" 2>nul
IF ERRORLEVEL 1 (echo   Run as Administrator to register the scheduler)

REM ── Done ────────────────────────────────────────────────────
echo.
echo ============================================================
echo   SUCCESS!
echo.
echo   Blog code: https://github.com/%GH_USER%/%GH_REPO%
echo   Live URL:  https://%GH_USER%.github.io/%GH_REPO%/
echo              (takes 1-2 min to go live)
echo.
echo   GitHub Actions will auto-publish a new post every 2 hours.
echo.
echo   NEXT: Apply for Google AdSense at https://adsense.google.com
echo         Use URL: https://%GH_USER%.github.io/%GH_REPO%/
echo ============================================================
echo.
start "" "https://github.com/%GH_USER%/%GH_REPO%"
timeout /t 3 >nul
start "" "https://%GH_USER%.github.io/%GH_REPO%/"
pause
