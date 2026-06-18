# Set GitHub Actions secrets for AIIncomeLab social auto-posting pipeline.
#
# Usage:
#   1. Create a GitHub Personal Access Token (PAT) with `repo` scope:
#      GitHub.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens
#      Repo access: "itsoftsloutions-cyber/aiincomelab" → Contents: Read and write
#
#   2. Run this script:
#      $env:GH_PAT = "ghp_..."   # or set your token below
#      .\scripts\set-github-secrets.ps1
#
# The script will prompt for each missing credential interactively,
# or you can pre-set env vars and run with -NonInteractive.
#
# Secrets set by this script:
#   - X_API_KEY
#   - X_API_SECRET
#   - X_ACCESS_TOKEN
#   - X_ACCESS_SECRET
#   - LINKEDIN_ACCESS_TOKEN
#   - LINKEDIN_AUTHOR_URN
#   - FACEBOOK_PAGE_ID       (deferred per board decision)
#   - FACEBOOK_PAGE_TOKEN    (deferred per board decision)
#   - IG_USER_ID             (deferred per board decision)
#   - IG_ACCESS_TOKEN        (deferred per board decision)

param(
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"

$repoOwner = "itsoftsloutions-cyber"
$repoName = "aiincomelab"
$apiBase = "https://api.github.com"

# ---- Credential map ----
$secrets = @(
    @{ Name = "X_API_KEY";           EnvVar = "X_API_KEY";           Prompt = "Twitter/X API Key" }
    @{ Name = "X_API_SECRET";        EnvVar = "X_API_SECRET";        Prompt = "Twitter/X API Secret" }
    @{ Name = "X_ACCESS_TOKEN";      EnvVar = "X_ACCESS_TOKEN";      Prompt = "Twitter/X Access Token" }
    @{ Name = "X_ACCESS_SECRET";     EnvVar = "X_ACCESS_SECRET";     Prompt = "Twitter/X Access Secret" }
    @{ Name = "LINKEDIN_ACCESS_TOKEN"; EnvVar = "LINKEDIN_ACCESS_TOKEN"; Prompt = "LinkedIn Access Token" }
    @{ Name = "LINKEDIN_AUTHOR_URN";   EnvVar = "LINKEDIN_AUTHOR_URN";   Prompt = "LinkedIn Author URN" }
    # Facebook/Instagram are deferred per board decision (social_media_update.txt).
    # The autopublish workflow references them; they no-op cleanly when absent.
    @{ Name = "FACEBOOK_PAGE_ID";      EnvVar = "FACEBOOK_PAGE_ID";      Prompt = "Facebook Page ID (deferred)" }
    @{ Name = "FACEBOOK_PAGE_TOKEN";   EnvVar = "FACEBOOK_PAGE_TOKEN";   Prompt = "Facebook Page Token (deferred)" }
    @{ Name = "IG_USER_ID";            EnvVar = "IG_USER_ID";            Prompt = "Instagram User ID (deferred)" }
    @{ Name = "IG_ACCESS_TOKEN";       EnvVar = "IG_ACCESS_TOKEN";       Prompt = "Instagram Access Token (deferred)" }
)

# ---- Get PAT ----
$pat = $env:GH_PAT
if (-not $pat) {
    $pat = Read-Host "Enter GitHub Personal Access Token (with repo scope)" -AsSecureString
    $pat = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pat)
    )
}

$headers = @{
    Authorization = "Bearer $pat"
    "Accept"      = "application/vnd.github.v3+json"
    "User-Agent"  = "aiincomelab-setup-script"
}

# ---- Verify token ----
Write-Host "Verifying GitHub token..." -ForegroundColor Cyan
try {
    $userCheck = Invoke-RestMethod -Uri "$apiBase/user" -Headers $headers -ErrorAction Stop
    Write-Host "Authenticated as: $($userCheck.login)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: GitHub token is invalid or lacks permissions. $_" -ForegroundColor Red
    exit 1
}

# ---- Verify repo access ----
try {
    $repoCheck = Invoke-RestMethod -Uri "$apiBase/repos/$repoOwner/$repoName" -Headers $headers -ErrorAction Stop
    Write-Host "Repo: $($repoCheck.full_name) ($($repoCheck.visibility))" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Cannot access repo $repoOwner/$repoName. Check PAT scope. $_" -ForegroundColor Red
    exit 1
}

# ---- Get public key for encryption ----
Write-Host "Fetching repo public key..." -ForegroundColor Cyan
$pubKey = Invoke-RestMethod -Uri "$apiBase/repos/$repoOwner/$repoName/actions/secrets/public-key" -Headers $headers
Write-Host "Public key ID: $($pubKey.key_id)" -ForegroundColor Green

# ---- Helper: encrypt secret value ----
function Set-GitHubSecret {
    param($Name, $Value, $PublicKeyId, $PublicKey)
    
    if (-not $Value) { return $false }
    
    # Convert to bytes
    $valueBytes = [System.Text.Encoding.UTF8]::GetBytes($Value)
    
    # Use .NET cryptographic operations
    $keyBytes = [System.Convert]::FromBase64String($PublicKey)
    
    # Create RSA parameters
    $rsa = [System.Security.Cryptography.RSA]::Create()
    
    # Parse DER-encoded public key (subject public key info format)
    # GitHub returns a base64-encoded SPKI format key
    $rsa.ImportSubjectPublicKeyInfo($keyBytes, [ref]0)
    
    # Encrypt with OAEP-SHA256 padding
    $encryptedBytes = $rsa.Encrypt($valueBytes, [System.Security.Cryptography.RSAEncryptionPadding]::OaepSHA256)
    $encryptedValue = [System.Convert]::ToBase64String($encryptedBytes)
    
    # Send to GitHub API
    $body = @{
        encrypted_value = $encryptedValue
        key_id          = $PublicKeyId
    } | ConvertTo-Json
    
    try {
        $result = Invoke-RestMethod -Uri "$apiBase/repos/$repoOwner/$repoName/actions/secrets/$Name" `
            -Headers $headers `
            -Method Put `
            -Body $body `
            -ContentType "application/json" `
            -ErrorAction Stop
        return $true
    } catch {
        Write-Host "  FAILED: $_" -ForegroundColor Red
        return $false
    }
}

# ---- Set each secret ----
Write-Host "`nSetting GitHub Secrets..." -ForegroundColor Cyan
$successCount = 0
$failCount = 0

foreach ($s in $secrets) {
    $value = $env:$($s.EnvVar)
    
    if (-not $value -and -not $NonInteractive) {
        $value = Read-Host "$($s.Prompt) (or press Enter to skip)" 
    }
    
    if ($value) {
        Write-Host "  Setting $($s.Name)..." -ForegroundColor Yellow
        if (Set-GitHubSecret -Name $s.Name -Value $value -PublicKeyId $pubKey.key_id -PublicKey $pubKey.key) {
            Write-Host "    OK" -ForegroundColor Green
            $successCount++
        } else {
            $failCount++
        }
    } else {
        Write-Host "  SKIPPED: $($s.Name) (no value provided)" -ForegroundColor DarkYellow
    }
}

# ---- Summary ----
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "  Secrets set:     $successCount" -ForegroundColor Green
Write-Host "  Secrets failed:  $failCount" -ForegroundColor Red
Write-Host "  Secrets skipped: $($secrets.Count - $successCount - $failCount)" -ForegroundColor DarkYellow

if ($successCount -gt 0 -or $failCount -eq 0) {
    Write-Host "`nNext step: Set repo variable AUTO_PUBLISH_ENABLED to true in GitHub UI when ready." -ForegroundColor Cyan
    Write-Host "  Settings → Secrets and variables → Actions → Variables → New repository variable" -ForegroundColor White
}
