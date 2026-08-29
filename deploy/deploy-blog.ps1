# Build blog-web locally and atomic-deploy to remote host Nginx (not Docker).
param(
    [switch]$DryRun,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$script:ExitPreflight = 10
$script:ExitBuild = 20
$script:ExitDeploy = 30

$script:DeployRoot = $PSScriptRoot
$script:RepoRoot = Split-Path -Parent $script:DeployRoot
$script:DeployEnvPath = Join-Path $script:DeployRoot '.env'
$script:BlogWebRoot = Join-Path $script:RepoRoot 'source/blog-web'
$script:DistDir = Join-Path $script:BlogWebRoot 'dist'

function Get-DeployConfig {
    if (-not (Test-Path $script:DeployEnvPath)) {
        Write-Error 'Missing deploy/.env - copy deploy/.env.example and configure.'
        exit $script:ExitPreflight
    }
    $cfg = @{}
    foreach ($line in Get-Content $script:DeployEnvPath -Encoding UTF8) {
        $line = $line.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) { continue }
        $idx = $line.IndexOf('=')
        if ($idx -lt 1) { continue }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        $cfg[$key] = $val
    }
    foreach ($required in @('SSH_HOST', 'SSH_USER', 'REMOTE_BLOG_DIR')) {
        if (-not $cfg.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($cfg[$required])) {
            Write-Error ('deploy/.env missing required key: {0}' -f $required)
            exit $script:ExitPreflight
        }
    }
    if (-not $cfg.ContainsKey('SSH_PORT')) { $cfg['SSH_PORT'] = '22' }
    return $cfg
}

function Get-SshTarget {
    param([hashtable]$Config)
    return ('{0}@{1}' -f $Config['SSH_USER'], $Config['SSH_HOST'])
}

function Get-SshBaseArgs {
    param([hashtable]$Config)
    $args = @('-p', $Config['SSH_PORT'], '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new')
    if ($Config.ContainsKey('SSH_KEY') -and -not [string]::IsNullOrWhiteSpace($Config['SSH_KEY'])) {
        $keyPath = $Config['SSH_KEY'].Replace('~', $env:USERPROFILE)
        $args += @('-i', $keyPath)
    }
    return $args
}

function Get-ScpBaseArgs {
    param([hashtable]$Config)
    $args = @('-P', $Config['SSH_PORT'], '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new')
    if ($Config.ContainsKey('SSH_KEY') -and -not [string]::IsNullOrWhiteSpace($Config['SSH_KEY'])) {
        $keyPath = $Config['SSH_KEY'].Replace('~', $env:USERPROFILE)
        $args += @('-i', $keyPath)
    }
    return $args
}

function Invoke-DeploySsh {
    param(
        [hashtable]$Config,
        [string]$RemoteCommand,
        [switch]$DryRun
    )
    $target = Get-SshTarget -Config $Config
    $sshArgs = @(Get-SshBaseArgs -Config $Config) + @($target, $RemoteCommand)
    if ($DryRun) {
        Write-Host ('[DryRun] ssh {0} "{1}"' -f $target, $RemoteCommand)
        return
    }
    & ssh @sshArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Error ('SSH command failed with exit code {0}: {1}' -f $LASTEXITCODE, $RemoteCommand)
        exit $script:ExitDeploy
    }
}

function Invoke-DeployScp {
    param(
        [hashtable]$Config,
        [string[]]$ScpArgs,
        [switch]$DryRun
    )
    $finalArgs = @(Get-ScpBaseArgs -Config $Config) + $ScpArgs
    if ($DryRun) {
        Write-Host ('[DryRun] scp {0}' -f ($ScpArgs -join ' '))
        return
    }
    & scp @finalArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Error ('SCP command failed with exit code {0}' -f $LASTEXITCODE)
        exit $script:ExitDeploy
    }
}

# --- Main execution ---
$cfg = @{}
if ($DryRun) {
    if (Test-Path $script:DeployEnvPath) {
        $cfg = Get-DeployConfig
    } else {
        $cfg = @{
            'SSH_HOST' = 'your.server.com'
            'SSH_USER' = 'deploy'
            'SSH_PORT' = '22'
            'REMOTE_BLOG_DIR' = '/var/www/me/blog'
        }
    }
} else {
    $cfg = Get-DeployConfig
}

$remoteBlogDir = $cfg['REMOTE_BLOG_DIR'].TrimEnd('/')
$stagingRemote = "$remoteBlogDir.staging"
$bakRemote = "$remoteBlogDir.bak"
$target = Get-SshTarget -Config $cfg

if (-not $SkipBuild) {
    Write-Host 'Building blog-web...'
    Push-Location $script:BlogWebRoot
    try {
        if ($DryRun) {
            Write-Host '[DryRun] npm ci && npm run build'
        } else {
            if (Test-Path 'package-lock.json') {
                npm ci
            } else {
                npm install
            }
            if ($LASTEXITCODE -ne 0) { exit $script:ExitBuild }
            npm run build
            if ($LASTEXITCODE -ne 0) { exit $script:ExitBuild }
        }
    } finally {
        Pop-Location
    }
} elseif (-not (Test-Path (Join-Path $script:DistDir 'index.html'))) {
    Write-Error 'SkipBuild specified but dist/index.html is missing.'
    exit $script:ExitBuild
}

$swapCmd = "set -euo pipefail; if [ ! -f '$stagingRemote/index.html' ]; then echo 'staging missing index.html: $stagingRemote/index.html' >&2; exit 1; fi; rm -rf '$bakRemote'; if [ -d '$remoteBlogDir' ]; then mv '$remoteBlogDir' '$bakRemote'; fi; mv '$stagingRemote' '$remoteBlogDir'; mkdir -p '$stagingRemote'; chmod -R u=rwX,go=rX '$remoteBlogDir'; echo 'static atomic swap done'"

if ($DryRun) {
    Write-Host ('[DryRun] scp dist/. -> {0}:{1}/' -f $target, $stagingRemote)
    Write-Host ('[DryRun] ssh {0} "{1}"' -f $target, $swapCmd)
    Write-Host 'DryRun completed successfully.'
    exit 0
}

Write-Host ('Preparing remote staging directory: {0}' -f $stagingRemote)
Invoke-DeploySsh -Config $cfg -RemoteCommand ('mkdir -p ''{0}'' && rm -rf ''{0}''/*' -f $stagingRemote)

Write-Host 'Uploading dist files to remote staging...'
$dest = ('{0}:{1}/' -f $target, $stagingRemote)
Invoke-DeployScp -Config $cfg -ScpArgs @('-r', (Join-Path $script:DistDir '.'), $dest)

Write-Host 'Performing atomic swap on remote host...'
Invoke-DeploySsh -Config $cfg -RemoteCommand $swapCmd

Write-Host 'deploy-blog completed successfully!'
