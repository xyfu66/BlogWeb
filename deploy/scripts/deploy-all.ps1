# deploy-all: preflight -> git pull -> deploy-blog -> audit log
param(
    [switch]$SkipBuild,
    [switch]$SkipGitPull,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"

$cfg = Get-DeployConfig -DryRun:$DryRun

Write-Host '=================================================================' -ForegroundColor Cyan
Write-Host '  BlogWeb -- Production Deployment Pipeline (deploy-all)' -ForegroundColor Cyan
Write-Host '=================================================================' -ForegroundColor Cyan

# 1. Run preflight checks
& "$PSScriptRoot/preflight.ps1" -DryRun:$DryRun
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 2. Align remote git repository checkout
if (-not $SkipGitPull) {
    if ($DryRun) {
        Write-Host '[DryRun] remote deploy checkout sync once (git fetch & reset --hard)'
    } else {
        Invoke-RemoteGitPull -Config $cfg
    }
}

# 3. Run deploy-blog
& "$PSScriptRoot/deploy-blog.ps1" -DryRun:$DryRun -SkipBuild:$SkipBuild
if ($LASTEXITCODE -ne 0) {
    Write-Error 'deploy-all failed during deploy-blog'
    exit $LASTEXITCODE
}

# 4. Record deployment audit log
$gitSha = if ($DryRun) { 'dry-run' } else { Get-RemoteGitSha -Config $cfg }
if (-not $DryRun) {
    Write-DeployAudit -Components @('BlogWeb') -Config $cfg -GitSha $gitSha
}

Write-Host ''
Write-Host '=================================================================' -ForegroundColor Green
if ($DryRun) {
    Write-Host ' [DRY-RUN COMPLETE] All deployment pipeline steps verified successfully.' -ForegroundColor Yellow
} else {
    Write-Host ' [DEPLOY SUCCESS] BlogWeb personal blog published successfully!' -ForegroundColor Green
    Write-Host (' Target Path: ' + $cfg['REMOTE_BLOG_DIR']) -ForegroundColor White
}
Write-Host '=================================================================' -ForegroundColor Green
