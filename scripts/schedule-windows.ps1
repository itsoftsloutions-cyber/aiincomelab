# Registers a Windows Scheduled Task that auto-publishes a new post every 2 hours.
# Run once in an elevated PowerShell:  powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$bat  = Join-Path $repo "scripts\autopublish.bat"

$action  = New-ScheduledTaskAction -Execute $bat
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
           -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration ([TimeSpan]::MaxValue)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName "AIIncomeLab-AutoPublish" -Action $action -Trigger $trigger `
  -Settings $settings -Description "Publish a new AI blog post every 2 hours" -Force

Write-Host "Scheduled task 'AIIncomeLab-AutoPublish' created (every 2 hours)."
Write-Host "Remove with: Unregister-ScheduledTask -TaskName AIIncomeLab-AutoPublish -Confirm:`$false"
