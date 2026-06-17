@echo off
REM ============================================================
REM  AIIncomeLab — ONE-SHOT FULL SETUP AUTOMATION
REM  Runs in order:
REM    1. Verify Node.js is installed
REM    2. Build the site
REM    3. Run preview server briefly to confirm output
REM    4. Push to GitHub (if credentials set below)
REM    5. Register Windows 2-hour auto-publish task
REM    6. Open the deploy guide in Notepad
REM
REM  !! Before running, fill in your GitHub info below !!
REM ============================================================

SET GH_USER=YOUR_GITHUB_USERNAME
SET GH_REPO=YOUR_REPO_NAME

echo.
echo ============================================================
echo   AIIncomeLab — One-Shot Setup
echo ============================================================

REM ── Step 1: Node check ──────────────────────────────────────
echo.
echo [Step 1/5] Checking Node.js...
node --version >nul 2>&1
IF ERRORLEVEL 1 (
  echo   ERROR: Node.js not found.
  echo   Download it FREE at: https://nodejs.org  (choose LTS)
  pause
  start https://nodejs.org
  exit /b 1
)
echo   Node.js OK: && node --version

REM ── Step 2: Build ───────────────────────────────────────────
echo.
echo [Step 2/5] Building site...
cd /d "%~dp0.."
node build.js
IF ERRORLEVEL 1 (echo   BUILD FAILED — check errors above && pause && exit /b 1)
echo   Site built into public/

REM ── Step 3: Publish 1 new post ──────────────────────────────
echo.
echo [Step 3/5] Publishing next queued post...
node new-post.js
node build.js

REM ── Step 4: GitHub push ─────────────────────────────────────
echo.
echo [Step 4/5] Pushing to GitHub...
IF "%GH_USER%"=="YOUR_GITHUB_USERNAME" (
  echo   SKIPPED — edit GH_USER and GH_REPO at the top of this file first.
) ELSE (
  git remote remove origin 2>nul
  git remote add origin https://github.com/%GH_USER%/%GH_REPO%.git
  git add -A
  git commit -m "auto: setup and initial deploy" 2>nul || echo   (nothing new to commit)
  git branch -M master
  git push -u origin master
  IF ERRORLEVEL 1 (
    echo   Push failed — make sure the repo exists at github.com/%GH_USER%/%GH_REPO%
    echo   and that you are authenticated (run: git credential-manager configure)
  ) ELSE (
    echo   Pushed! Enable Pages at:
    echo   https://github.com/%GH_USER%/%GH_REPO%/settings/pages
    echo   Source -^> GitHub Actions -^> Save
    start https://github.com/%GH_USER%/%GH_REPO%/settings/pages
  )
)

REM ── Step 5: Register 2-hour Windows Task Scheduler ──────────
echo.
echo [Step 5/5] Registering 2-hour auto-publish scheduler...
powershell -ExecutionPolicy Bypass -File "%~dp0schedule-windows.ps1"
IF ERRORLEVEL 1 (
  echo   Scheduler setup failed (may need to run as Administrator).
  echo   Right-click this file -^> "Run as administrator" to retry.
) ELSE (
  echo   Scheduled task registered — posts every 2 hours automatically!
)

REM ── Done ────────────────────────────────────────────────────
echo.
echo ============================================================
echo   Setup complete!
echo.
echo   Your blog: D:\paperclipoutput\aiblog\public\
echo   Preview:   node serve.js  then open http://localhost:8080
echo.
echo   Next steps:
echo   1. Apply for Google AdSense at https://adsense.google.com
echo   2. Add your ca-pub-ID to data\site.json
echo   3. Submit sitemap at https://search.google.com/search-console
echo ============================================================
echo.
start "" "notepad.exe" "%~dp0setup-adsense.md"
pause
