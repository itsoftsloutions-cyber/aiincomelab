@echo off
REM ============================================================
REM  AIIncomeLab — one-command GitHub deploy (Windows)
REM  Run this ONCE to push your blog to GitHub Pages for free.
REM
REM  Before running:
REM    1. Create a FREE GitHub account at https://github.com
REM    2. Create a new EMPTY public repo (e.g. aiincomelab)
REM    3. Install Git from https://git-scm.com  (if not already)
REM    4. Replace YOUR_GITHUB_USERNAME and YOUR_REPO_NAME below
REM ============================================================

SET GH_USER=YOUR_GITHUB_USERNAME
SET GH_REPO=YOUR_REPO_NAME

cd /d "%~dp0.."

echo [1/4] Setting GitHub remote...
git remote remove origin 2>nul
git remote add origin https://github.com/%GH_USER%/%GH_REPO%.git

echo [2/4] Pushing code to GitHub...
git branch -M master
git push -u origin master

echo.
echo [3/4] DONE - code pushed!
echo.
echo [4/4] Now enable GitHub Pages (FREE hosting + auto-deploy every 2h):
echo   1. Open: https://github.com/%GH_USER%/%GH_REPO%/settings/pages
echo   2. Source -^> "GitHub Actions"
echo   3. Save.  Your blog will be live at:
echo      https://%GH_USER%.github.io/%GH_REPO%/
echo.
echo After it deploys (1-2 min), the 2-hour auto-publish starts automatically!
echo.
pause
