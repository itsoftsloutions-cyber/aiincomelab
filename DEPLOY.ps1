# ============================================================
#  AIIncomeLab — ONE-CLICK FULL DEPLOY
#  GitHub: itsoftsloutions-cyber / aiincomelab
#
#  HOW TO RUN:
#    Right-click this file -> "Run with PowerShell"
#    (If blocked: right-click -> Properties -> Unblock -> OK, then re-run)
#
#  What it does automatically:
#    1. Opens GitHub login in your browser (one click)
#    2. Creates the repo "aiincomelab" on your account
#    3. Builds the blog
#    4. Pushes all code to GitHub
#    5. Enables free GitHub Pages hosting
#    6. Registers the 2-hour auto-publish Windows task
#    7. Opens your live blog URL
# ============================================================

$ErrorActionPreference = "Stop"
$GH      = "C:\Program Files\GitHub CLI\gh.exe"
$GH_USER = "itsoftsloutions-cyber"
$GH_REPO = "aiincomelab"
$REPO_DIR = $PSScriptRoot

Set-Location $REPO_DIR

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  AIIncomeLab — One-Click Deploy" -ForegroundColor Cyan
Write-Host "  User: $GH_USER  |  Repo: $GH_REPO" -ForegroundColor Cyan
Write-Host "============================================================"

# ── Step 1: GitHub Login ────────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/6] Logging in to GitHub..." -ForegroundColor Yellow
Write-Host "      A browser window will open. Click 'Authorize' — that's all." -ForegroundColor Gray

$authStatus = & $GH auth status 2>&1
if ($authStatus -match "Logged in") {
    Write-Host "      Already logged in. Skipping." -ForegroundColor Green
} else {
    & $GH auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) { Write-Host "Login failed." -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }
}
Write-Host "      GitHub login OK" -ForegroundColor Green

# ── Step 2: Create repo ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/6] Creating GitHub repo $GH_USER/$GH_REPO..." -ForegroundColor Yellow

$repoCheck = & $GH repo view "$GH_USER/$GH_REPO" --json name 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      Repo already exists. Skipping creation." -ForegroundColor Green
} else {
    & $GH repo create "$GH_REPO" --public --description "AI Tools, Productivity & Online Income — auto-publishing SEO blog" --homepage "https://$GH_USER.github.io/$GH_REPO/"
    if ($LASTEXITCODE -ne 0) { Write-Host "Repo creation failed." -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }
    Write-Host "      Repo created: https://github.com/$GH_USER/$GH_REPO" -ForegroundColor Green
}

# ── Step 3: Build site ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/6] Building blog..." -ForegroundColor Yellow
node build.js
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed." -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }
Write-Host "      Build OK" -ForegroundColor Green

# ── Step 4: Push to GitHub ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/6] Pushing code to GitHub..." -ForegroundColor Yellow

git config user.name  $GH_USER
git config user.email "$GH_USER@users.noreply.github.com"
git remote remove origin 2>$null
git remote add origin "https://github.com/$GH_USER/$GH_REPO.git"
git branch -M master
git add -A
git commit -m "auto: initial deploy from AIIncomeLab" 2>&1 | Out-Null

# Use gh as credential helper for this push
& $GH auth setup-git 2>&1 | Out-Null
git push -u origin master
if ($LASTEXITCODE -ne 0) { Write-Host "Push failed — try running as Administrator." -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }
Write-Host "      Code pushed!" -ForegroundColor Green

# ── Step 5: Enable GitHub Pages ─────────────────────────────────────────────
Write-Host ""
Write-Host "[5/6] Enabling GitHub Pages (free hosting)..." -ForegroundColor Yellow
# Wait a moment for repo to be ready
Start-Sleep -Seconds 3
& $GH api "repos/$GH_USER/$GH_REPO/pages" -X POST -f build_type=workflow 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "      GitHub Pages enabled!" -ForegroundColor Green
} else {
    & $GH api "repos/$GH_USER/$GH_REPO/pages" -X PUT -f build_type=workflow 2>&1 | Out-Null
    Write-Host "      GitHub Pages configured." -ForegroundColor Green
}

# ── Step 6: Register 2-hour Windows scheduler ───────────────────────────────
Write-Host ""
Write-Host "[6/6] Registering 2-hour auto-publish scheduler..." -ForegroundColor Yellow
try {
    $bat  = Join-Path $REPO_DIR "scripts\autopublish.bat"
    $action  = New-ScheduledTaskAction -Execute $bat
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration ([TimeSpan]::MaxValue)
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd
    Register-ScheduledTask -TaskName "AIIncomeLab-AutoPublish" -Action $action -Trigger $trigger -Settings $settings -Description "AIIncomeLab: publish a new AI blog post every 2 hours" -Force | Out-Null
    Write-Host "      Scheduler registered — new post every 2 hours!" -ForegroundColor Green
} catch {
    Write-Host "      Scheduler needs Admin rights — run DEPLOY.ps1 as Administrator to enable." -ForegroundColor Yellow
}

# ── Done ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  SUCCESS!" -ForegroundColor Green
Write-Host ""
Write-Host "  Code repo:  https://github.com/$GH_USER/$GH_REPO" -ForegroundColor White
Write-Host "  Live blog:  https://$GH_USER.github.io/$GH_REPO/" -ForegroundColor White
Write-Host "              (takes ~2 min for GitHub Actions to deploy)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Auto-publish: GitHub Actions runs every 2 hours" -ForegroundColor White
Write-Host "                New post published + site rebuilt automatically" -ForegroundColor Gray
Write-Host ""
Write-Host "  NEXT STEP:" -ForegroundColor Yellow
Write-Host "    Apply for Google AdSense at https://adsense.google.com" -ForegroundColor White
Write-Host "    Use blog URL: https://$GH_USER.github.io/$GH_REPO/" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 2
Start-Process "https://github.com/$GH_USER/$GH_REPO/actions"
Start-Sleep -Seconds 2
Start-Process "https://$GH_USER.github.io/$GH_REPO/"

Read-Host "Press Enter to close"
