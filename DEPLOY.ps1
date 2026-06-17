# AIIncomeLab - One-Click Deploy
# GitHub: itsoftsloutions-cyber / aiincomelab
#
# HOW TO RUN:
#   Right-click this file -> "Run with PowerShell"
#   (If blocked: right-click -> Properties -> Unblock -> OK, then re-run)
#
# What happens automatically:
#   1. GitHub login opens in browser (click Authorize - one click)
#   2. Creates repo "aiincomelab" on your account
#   3. Builds the blog site
#   4. Pushes all code to GitHub
#   5. Enables free GitHub Pages hosting
#   6. Registers 2-hour auto-publish Windows task
#   7. Opens your live blog

$ErrorActionPreference = "Continue"
$GH      = "C:\Program Files\GitHub CLI\gh.exe"
$GH_USER = "itsoftsloutions-cyber"
$GH_REPO = "aiincomelab"
$REPO_DIR = $PSScriptRoot

Set-Location $REPO_DIR

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  AIIncomeLab - One-Click Deploy" -ForegroundColor Cyan
Write-Host "  User: $GH_USER  |  Repo: $GH_REPO" -ForegroundColor Cyan
Write-Host "============================================================"

# STEP 1: GitHub Login
Write-Host ""
Write-Host "[1/6] Logging in to GitHub..." -ForegroundColor Yellow
Write-Host "      A browser window will open - click Authorize" -ForegroundColor Gray

$authOutput = & $GH auth status 2>&1
$isLoggedIn = $authOutput | Select-String -Pattern "Logged in" -Quiet

if ($isLoggedIn) {
    Write-Host "      Already logged in. Skipping." -ForegroundColor Green
} else {
    & $GH auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Login failed. Please try again." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}
Write-Host "      GitHub login OK" -ForegroundColor Green

# STEP 2: Create repo
Write-Host ""
Write-Host "[2/6] Creating GitHub repo $GH_USER/$GH_REPO..." -ForegroundColor Yellow

$repoCheck = & $GH repo view "$GH_USER/$GH_REPO" --json name 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      Repo already exists. Skipping creation." -ForegroundColor Green
} else {
    & $GH repo create $GH_REPO --public --description "AI Tools and Online Income - auto-publishing SEO blog"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Repo creation failed." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "      Repo created: https://github.com/$GH_USER/$GH_REPO" -ForegroundColor Green
}

# STEP 3: Build site
Write-Host ""
Write-Host "[3/6] Building blog..." -ForegroundColor Yellow
node build.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "      Build OK" -ForegroundColor Green

# STEP 4: Push to GitHub
Write-Host ""
Write-Host "[4/6] Pushing code to GitHub..." -ForegroundColor Yellow

git config user.name $GH_USER
git config user.email "$GH_USER@users.noreply.github.com"
git remote remove origin 2>$null
git remote add origin "https://github.com/$GH_USER/$GH_REPO.git"
git branch -M master
git add -A
$commitMsg = "auto: initial deploy from AIIncomeLab"
git commit -m $commitMsg 2>&1 | Out-Null

& $GH auth setup-git 2>&1 | Out-Null
git push -u origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed. Try running this script as Administrator." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "      Code pushed!" -ForegroundColor Green

# STEP 5: Enable GitHub Pages
Write-Host ""
Write-Host "[5/6] Enabling GitHub Pages (free hosting)..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

& $GH api "repos/$GH_USER/$GH_REPO/pages" -X POST -f build_type=workflow 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "      GitHub Pages enabled!" -ForegroundColor Green
} else {
    & $GH api "repos/$GH_USER/$GH_REPO/pages" -X PUT -f build_type=workflow 2>&1 | Out-Null
    Write-Host "      GitHub Pages configured." -ForegroundColor Green
}

# STEP 6: Register 2-hour Windows scheduler
Write-Host ""
Write-Host "[6/6] Registering 2-hour auto-publish scheduler..." -ForegroundColor Yellow

$schedOk = $false
try {
    $batPath = Join-Path $REPO_DIR "scripts\autopublish.bat"
    $taskAction = New-ScheduledTaskAction -Execute $batPath
    $taskInterval = New-TimeSpan -Hours 2
    $taskDuration = [TimeSpan]::MaxValue
    $taskTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval $taskInterval -RepetitionDuration $taskDuration
    $taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd
    $taskDesc = "AIIncomeLab: publish new AI blog post every 2 hours"
    Register-ScheduledTask -TaskName "AIIncomeLab-AutoPublish" -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Description $taskDesc -Force | Out-Null
    $schedOk = $true
} catch {
    $schedOk = $false
}

if ($schedOk) {
    Write-Host "      Scheduler registered - new post every 2 hours!" -ForegroundColor Green
} else {
    Write-Host "      Scheduler needs Admin rights." -ForegroundColor Yellow
    Write-Host "      Right-click DEPLOY.ps1 -> Run as Administrator to enable." -ForegroundColor Yellow
}

# DONE
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "  SUCCESS!" -ForegroundColor Green
Write-Host ""
Write-Host "  Code:  https://github.com/$GH_USER/$GH_REPO" -ForegroundColor White
Write-Host "  Blog:  https://$GH_USER.github.io/$GH_REPO/" -ForegroundColor White
Write-Host "         (GitHub Actions deploys in 1-2 minutes)" -ForegroundColor Gray
Write-Host ""
Write-Host "  NEXT: Apply for AdSense at https://adsense.google.com" -ForegroundColor Yellow
Write-Host "        Use URL: https://$GH_USER.github.io/$GH_REPO/" -ForegroundColor White
Write-Host "===========================================================" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 2
Start-Process "https://github.com/$GH_USER/$GH_REPO/actions"
Start-Sleep -Seconds 2
Start-Process "https://$GH_USER.github.io/$GH_REPO/"

Read-Host "Press Enter to close"
