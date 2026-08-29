# Preflight verification script for BlogWeb deployment.
# Verifies local environment, dependencies, deploy/.env, SSH credentials, and remote host readiness.
param(
    [switch]$CheckRemote,
    [switch]$CheckNginxSudo
)

$ErrorActionPreference = 'Stop'
$script:ExitPreflight = 10

$script:ScriptsDir = $PSScriptRoot
$script:DeployRoot = Split-Path -Parent $script:ScriptsDir
$script:RepoRoot = Split-Path -Parent $script:DeployRoot
$script:DeployEnvPath = Join-Path $script:DeployRoot '.env'
$script:BlogWebRoot = Join-Path $script:RepoRoot 'source/blog-web'

$script:PassedChecks = 0
$script:FailedChecks = 0

function Write-CheckPass {
    param([string]$Message)
    Write-Host ("[PASS] " + $Message) -ForegroundColor Green
    $script:PassedChecks++
}

function Write-CheckFail {
    param([string]$Message)
    Write-Host ("[FAIL] " + $Message) -ForegroundColor Red
    $script:FailedChecks++
}

function Write-CheckWarn {
    param([string]$Message)
    Write-Host ("[WARN] " + $Message) -ForegroundColor Yellow
}

function Get-DeployConfig {
    if (-not (Test-Path $script:DeployEnvPath)) {
        Write-CheckFail "deploy/.env does not exist. Please copy deploy/.env.example to deploy/.env and configure it."
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
    return $cfg
}

Write-Host "=== [1/4] Checking Local Toolchain ===" -ForegroundColor Cyan

# 1. Check Node.js
try {
    $nodeVer = (node --version 2>&1).ToString().Trim()
    Write-CheckPass "Node.js installed: $nodeVer"
} catch {
    Write-CheckFail "Node.js is not installed or not in PATH."
}

# 2. Check npm
try {
    $npmVer = (npm --version 2>&1).ToString().Trim()
    Write-CheckPass "npm installed: v$npmVer"
} catch {
    Write-CheckFail "npm is not installed or not in PATH."
}

# 3. Check OpenSSH client (ssh and scp)
try {
    $sshCmd = Get-Command ssh -ErrorAction Stop
    $sshVer = (cmd.exe /c "ssh -V 2>&1").Trim()
    Write-CheckPass "OpenSSH client available: $sshVer ($($sshCmd.Source))"
} catch {
    Write-CheckFail "ssh is not installed or not in PATH."
}

try {
    $scpCmd = Get-Command scp -ErrorAction Stop
    Write-CheckPass "scp command is available ($($scpCmd.Source))"
} catch {
    Write-CheckFail "scp is not installed or not in PATH."
}

Write-Host "`n=== [2/4] Checking Configuration (deploy/.env) ===" -ForegroundColor Cyan

$config = Get-DeployConfig

$requiredKeys = @('SSH_HOST', 'SSH_USER', 'REMOTE_BLOG_DIR')
foreach ($key in $requiredKeys) {
    if ($config.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($config[$key])) {
        Write-CheckPass "Config key '$key' = '$($config[$key])'"
    } else {
        Write-CheckFail "Missing required configuration key: $key in deploy/.env"
    }
}

if (-not $config.ContainsKey('SSH_PORT')) { $config['SSH_PORT'] = '22' }
if (-not $config.ContainsKey('REMOTE_NGINX_CONF_PATH')) { $config['REMOTE_NGINX_CONF_PATH'] = '/etc/nginx/snippets/blog-web.conf' }

Write-Host "`n=== [3/4] Checking SSH Credentials & Keys ===" -ForegroundColor Cyan

$sshKeyPath = $null
if ($config.ContainsKey('SSH_KEY') -and -not [string]::IsNullOrWhiteSpace($config['SSH_KEY'])) {
    $sshKeyPath = $config['SSH_KEY'].Replace('~', $env:USERPROFILE)
    if (Test-Path $sshKeyPath) {
        Write-CheckPass "SSH private key found at: $sshKeyPath"
    } else {
        Write-CheckFail "SSH private key file NOT found: $sshKeyPath"
    }
} else {
    Write-CheckWarn "SSH_KEY is not configured in deploy/.env (will rely on default ssh-agent or ~/.ssh/id_rsa)"
}

Write-Host "`n=== [4/4] Checking Remote Server Connectivity & Environment ===" -ForegroundColor Cyan

$target = "$($config['SSH_USER'])@$($config['SSH_HOST'])"
$sshArgs = @('-p', $config['SSH_PORT'], '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=10')
if ($sshKeyPath) {
    $sshArgs += @('-i', $sshKeyPath)
}

# 1. Test SSH connectivity with BatchMode
$sshTestTarget = $sshArgs + @($target, 'echo preflight_ssh_ok')
try {
    $res = & ssh @sshTestTarget 2>&1
    if ($LASTEXITCODE -eq 0 -and $res -match 'preflight_ssh_ok') {
        Write-CheckPass "SSH non-interactive connection to $target succeeded"
    } else {
        Write-CheckFail "SSH connection failed: $res (Exit code: $LASTEXITCODE)"
    }
} catch {
    Write-CheckFail "SSH connection threw an exception: $_"
}

# 2. Check remote blog parent directory
$remoteDir = $config['REMOTE_BLOG_DIR']
$checkDirCmd = "if [ -d '$remoteDir' ]; then echo 'DIR_EXISTS'; else mkdir -p '$remoteDir' 2>/dev/null && echo 'DIR_CREATED' || echo 'DIR_NO_PERMISSION'; fi"
$sshDirCheck = $sshArgs + @($target, $checkDirCmd)
try {
    $dirRes = (& ssh @sshDirCheck 2>&1).ToString().Trim()
    if ($dirRes -match 'DIR_EXISTS') {
        Write-CheckPass "Remote target directory '$remoteDir' exists and is ready"
    } elseif ($dirRes -match 'DIR_CREATED') {
        Write-CheckPass "Remote target directory '$remoteDir' created successfully"
    } else {
        Write-CheckWarn "Remote target directory '$remoteDir' does not exist or user lacks permission to create it directly"
    }
} catch {
    Write-CheckWarn "Could not verify remote directory: $_"
}

# 3. Optional Nginx sudo check
if ($CheckNginxSudo) {
    $sudoCheckCmd = "sudo -n nginx -t 2>&1"
    $sshSudoCheck = $sshArgs + @($target, $sudoCheckCmd)
    try {
        $sudoRes = & ssh @sshSudoCheck 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-CheckPass "Remote user '$($config['SSH_USER'])' has sudo permissions for 'nginx -t'"
        } else {
            Write-CheckWarn "Remote sudo 'nginx -t' returned non-zero. Sudoers may require password: $sudoRes"
        }
    } catch {
        Write-CheckWarn "Sudo verification skipped or failed: $_"
    }
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " Preflight Summary: $script:PassedChecks Passed, $script:FailedChecks Failed" -ForegroundColor $(if ($script:FailedChecks -eq 0) { "Green" } else { "Red" })
Write-Host "========================================================" -ForegroundColor Cyan

if ($script:FailedChecks -gt 0) {
    Write-Error "Preflight checks failed with $script:FailedChecks error(s). Please fix the issues above before deploying."
    exit $script:ExitPreflight
}

Write-Host "All preflight checks passed! System is ready for deployment.`n" -ForegroundColor Green
exit 0
