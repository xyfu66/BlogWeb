# Deploy & Hot-reload Nginx snippet safely with auto-rollback.
param(
    [switch]$DryRun,
    [switch]$SkipReload,
    [switch]$SkipPreflight
)

$ErrorActionPreference = 'Stop'

$script:ExitPreflight = 10
$script:ExitDeploy = 30
$script:ExitNginxConfig = 40

$script:DeployRoot = $PSScriptRoot
$script:PreflightScript = Join-Path $script:DeployRoot 'scripts/preflight.ps1'
$script:DeployEnvPath = Join-Path $script:DeployRoot '.env'
$script:NginxLocalConf = Join-Path $script:DeployRoot 'nginx/blog.conf'

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
    foreach ($required in @('SSH_HOST', 'SSH_USER')) {
        if (-not $cfg.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($cfg[$required])) {
            Write-Error ('deploy/.env missing required key: {0}' -f $required)
            exit $script:ExitPreflight
        }
    }
    if (-not $cfg.ContainsKey('SSH_PORT')) { $cfg['SSH_PORT'] = '22' }
    if (-not $cfg.ContainsKey('REMOTE_NGINX_CONF_PATH') -or [string]::IsNullOrWhiteSpace($cfg['REMOTE_NGINX_CONF_PATH'])) {
        $cfg['REMOTE_NGINX_CONF_PATH'] = '/etc/nginx/snippets/blog-web.conf'
    }
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

# --- Pre-check ---
if (-not (Test-Path $script:NginxLocalConf)) {
    Write-Error ('Local Nginx template missing: {0}' -f $script:NginxLocalConf)
    exit $script:ExitPreflight
}

$cfg = @{}
if ($DryRun) {
    if (Test-Path $script:DeployEnvPath) {
        $cfg = Get-DeployConfig
    } else {
        $cfg = @{
            'SSH_HOST' = 'your.server.com'
            'SSH_USER' = 'deploy'
            'SSH_PORT' = '22'
            'REMOTE_NGINX_CONF_PATH' = '/etc/nginx/snippets/blog-web.conf'
        }
    }
} else {
    $cfg = Get-DeployConfig
}

if (-not $SkipPreflight -and -not $DryRun) {
    if (Test-Path $script:PreflightScript) {
        Write-Host "Running preflight environment check (with Nginx sudo check)..." -ForegroundColor Cyan
        & powershell -ExecutionPolicy Bypass -File $script:PreflightScript -CheckNginxSudo
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Preflight checks failed. Halting Nginx configuration."
            exit $script:ExitPreflight
        }
    }
}

$target = Get-SshTarget -Config $cfg
$remoteConfPath = $cfg['REMOTE_NGINX_CONF_PATH']
$remoteTmpUpload = '/tmp/blog-web.conf.tmp'

$reloadCommand = if (-not $SkipReload) {
    'echo "Reloading Nginx service..."; sudo systemctl reload nginx || sudo nginx -s reload; echo "Nginx reload completed successfully."'
} else {
    'echo "SkipReload set - skipped Nginx reload."'
}

$remoteScript = @"
set -euo pipefail
CONF_TARGET='$remoteConfPath'
CONF_DIR=`$(dirname "`$CONF_TARGET")
TMP_UPLOAD='$remoteTmpUpload'

echo "Ensuring directory exists: `$CONF_DIR"
sudo mkdir -p "`$CONF_DIR"

# Backup existing configuration if present
if [ -f "`$CONF_TARGET" ]; then
    echo "Backing up existing config to `$CONF_TARGET.bak"
    sudo cp "`$CONF_TARGET" "`$CONF_TARGET.bak"
fi

# Apply new snippet with proper permissions
echo "Applying new configuration to `$CONF_TARGET..."
sudo cp "`$TMP_UPLOAD" "`$CONF_TARGET"
sudo chmod 644 "`$CONF_TARGET"
rm -f "`$TMP_UPLOAD"

# Validate configuration syntax before reloading
echo "Testing Nginx configuration syntax (nginx -t)..."
if sudo nginx -t; then
    echo "Nginx configuration syntax test passed!"
    $reloadCommand
else
    echo "ERROR: Nginx configuration test FAILED! Rolling back..." >&2
    if [ -f "`$CONF_TARGET.bak" ]; then
        sudo cp "`$CONF_TARGET.bak" "`$CONF_TARGET"
        echo "Restored previous configuration backup." >&2
    else
        sudo rm -f "`$CONF_TARGET"
        echo "Removed invalid new configuration." >&2
    fi
    exit 40
fi
"@

if ($DryRun) {
    Write-Host ('[DryRun] scp {0} -> {1}:{2}' -f $script:NginxLocalConf, $target, $remoteTmpUpload)
    Write-Host "`n--- [DryRun] Remote Execution Script ---" -ForegroundColor Cyan
    Write-Host $remoteScript
    Write-Host "----------------------------------------`n" -ForegroundColor Cyan
    Write-Host 'DryRun completed successfully.'
    exit 0
}

Write-Host ('Uploading Nginx snippet to temporary path: {0}' -f $remoteTmpUpload)
Invoke-DeployScp -Config $cfg -ScpArgs @($script:NginxLocalConf, ('{0}:{1}' -f $target, $remoteTmpUpload))

Write-Host 'Applying Nginx configuration on remote server...'
Invoke-DeploySsh -Config $cfg -RemoteCommand $remoteScript

Write-Host 'Nginx automated configuration completed successfully!' -ForegroundColor Green
