# Preflight: Check local tools, deploy config, and SSH reachability probe.
param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"

Write-Host '===> Running Preflight Checks...' -ForegroundColor Cyan

# 1. Local tools check
Test-LocalTools
Write-Host '[OK] Local tools found (node, npm, ssh, scp)' -ForegroundColor Green

# 2. Load deploy configuration
$cfg = Get-DeployConfig -DryRun:$DryRun
$target = Get-SshTarget -Config $cfg
Write-Host ('[OK] Deploy target: {0} (Port: {1})' -f $target, $cfg['SSH_PORT']) -ForegroundColor Green

# 3. Domain placeholder check
if (-not $DryRun) {
    Test-DomainNotPlaceholder -Config $cfg
}

# 4. SSH reachability probe (BatchMode=yes)
if ($DryRun) {
    Write-Host '[DryRun] SSH connectivity test skipped' -ForegroundColor Yellow
    Write-Host 'Preflight OK (DryRun)' -ForegroundColor Green
    exit 0
}

$sshArgs = @(Get-SshBaseArgs -Config $cfg) + @($target, 'echo deploy-preflight-ok')
$probe = & ssh @sshArgs 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ($probe | Out-String) -ForegroundColor Red
    Write-Error ('SSH unreachable with key authentication: {0}. Ensure SSH_KEY is added to authorized_keys.' -f $target)
    exit $script:ExitPreflight
}
Write-Host ('[OK] SSH connection successful: {0}' -f ($probe | Out-String).Trim()) -ForegroundColor Green

# 5. Remote repository root probe (existence and writability)
$checkRepoCmd = ('test -d ''{0}'' && test -w ''{0}'' && test -w ''{0}/deploy''' -f $cfg['REMOTE_REPO_ROOT'])
$sshRepoArgs = @(Get-SshBaseArgs -Config $cfg) + @($target, $checkRepoCmd)
& ssh @sshRepoArgs | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error ('Remote REMOTE_REPO_ROOT ({0}) does not exist or is not writable by user ''{1}''. Ensure git clone is completed and fix ownership on server: sudo chown -R {1}:{1} {0}' -f $cfg['REMOTE_REPO_ROOT'], $cfg['SSH_USER'])
    exit $script:ExitPreflight
}
Write-Host ('[OK] Remote repository root found and writable: {0}' -f $cfg['REMOTE_REPO_ROOT']) -ForegroundColor Green

# 6. Remote target directory permissions
$checkDirCmd = ('mkdir -p ''{0}'' && test -w ''{0}''' -f $cfg['REMOTE_BLOG_DIR'])
$sshDirArgs = @(Get-SshBaseArgs -Config $cfg) + @($target, $checkDirCmd)
& ssh @sshDirArgs | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error ('Remote target directory not writable or parent permission denied: {0}' -f $cfg['REMOTE_BLOG_DIR'])
    exit $script:ExitPreflight
}
Write-Host ('[OK] Remote target directory is writable: {0}' -f $cfg['REMOTE_BLOG_DIR']) -ForegroundColor Green

Write-Host 'Preflight OK' -ForegroundColor Green
