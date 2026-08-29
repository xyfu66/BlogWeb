# deploy common lib: exit codes, config loading, SSH/SCP orchestration, audit and validation.
$ErrorActionPreference = 'Stop'

$script:ExitPreflight = 10
$script:ExitBuild     = 20
$script:ExitDeploy    = 30
$script:ExitHealth    = 40
$script:ExitScp       = 50

$script:DeployRoot    = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script:RepoRoot      = Split-Path -Parent $script:DeployRoot
$script:BlogWebRoot   = Join-Path $script:RepoRoot 'source/blog-web'
$script:DeployEnvPath = Join-Path $script:DeployRoot '.env'
$script:ArtifactsDir  = Join-Path $script:DeployRoot 'artifacts'
$script:AuditLogPath  = Join-Path $script:ArtifactsDir 'deploy-audit.jsonl'

function Get-DeployConfig {
    param([switch]$DryRun)
    $envPath = $script:DeployEnvPath
    if (-not (Test-Path $envPath)) {
        $examplePath = Join-Path $script:DeployRoot '.env.example'
        if ($DryRun -and (Test-Path $examplePath)) {
            Write-Warning 'deploy/.env not found, using deploy/.env.example for DryRun preview.'
            $envPath = $examplePath
        } else {
            Write-Error 'Missing deploy/.env — copy deploy/.env.example to deploy/.env and configure.'
            exit $script:ExitPreflight
        }
    }
    $cfg = @{}
    foreach ($line in Get-Content $envPath -Encoding UTF8) {
        $line = $line.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) { continue }
        $idx = $line.IndexOf('=')
        if ($idx -lt 1) { continue }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        $cfg[$key] = $val
    }
    foreach ($required in @('SSH_HOST', 'SSH_USER', 'REMOTE_BLOG_DIR', 'REMOTE_REPO_ROOT', 'GIT_REMOTE_BRANCH')) {
        if (-not $cfg.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($cfg[$required])) {
            Write-Error ('deploy/.env missing required key: {0}' -f $required)
            exit $script:ExitPreflight
        }
    }
    if (-not $cfg.ContainsKey('SSH_PORT')) { $cfg['SSH_PORT'] = '22' }
    if (-not $cfg.ContainsKey('DEPLOY_PROFILE')) { $cfg['DEPLOY_PROFILE'] = 'prod' }
    return $cfg
}

function Get-SshTarget {
    param([hashtable]$Config)
    return ('{0}@{1}' -f $Config['SSH_USER'], $Config['SSH_HOST'])
}

function Get-SshBaseArgs {
    param([hashtable]$Config)
    $baseArgs = @('-p', $Config['SSH_PORT'], '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new')
    if ($Config.ContainsKey('SSH_KEY') -and -not [string]::IsNullOrWhiteSpace($Config['SSH_KEY'])) {
        $keyPath = $Config['SSH_KEY'].Replace('~', $env:USERPROFILE)
        $baseArgs += @('-i', $keyPath)
    }
    return $baseArgs
}

# Note: SCP uses -P for port, while SSH uses -p
function Get-ScpBaseArgs {
    param([hashtable]$Config)
    $baseArgs = @('-P', $Config['SSH_PORT'], '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new')
    if ($Config.ContainsKey('SSH_KEY') -and -not [string]::IsNullOrWhiteSpace($Config['SSH_KEY'])) {
        $keyPath = $Config['SSH_KEY'].Replace('~', $env:USERPROFILE)
        $baseArgs += @('-i', $keyPath)
    }
    return $baseArgs
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
        Write-Host ('[DryRun] ssh {0}' -f ($sshArgs -join ' '))
        return
    }
    & ssh @sshArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Error ('SSH failed (exit {0}): {1}' -f $LASTEXITCODE, $RemoteCommand)
        exit $script:ExitDeploy
    }
}

function Invoke-DeployScp {
    param(
        [hashtable]$Config,
        [string[]]$ScpArgs,
        [switch]$DryRun
    )
    $base = @(Get-ScpBaseArgs -Config $Config) + $ScpArgs
    if ($DryRun) {
        Write-Host ('[DryRun] scp {0}' -f ($base -join ' '))
        return
    }
    & scp @base
    if ($LASTEXITCODE -ne 0) {
        Write-Error ('SCP failed (exit {0})' -f $LASTEXITCODE)
        exit $script:ExitScp
    }
}

function Sync-RemoteDeployScripts {
    param(
        [hashtable]$Config,
        [switch]$DryRun
    )
    $remoteDir = ($Config['REMOTE_REPO_ROOT'].TrimEnd('/')) + '/deploy/scripts/remote'
    $remoteLibDir = ($Config['REMOTE_REPO_ROOT'].TrimEnd('/')) + '/deploy/scripts/lib'
    $localRemoteDir = Join-Path $script:DeployRoot 'scripts/remote'
    $localLibDir = Join-Path $script:DeployRoot 'scripts/lib'

    Invoke-DeploySsh -Config $Config -DryRun:$DryRun -RemoteCommand ('mkdir -p ''{0}'' ''{1}''' -f $remoteDir, $remoteLibDir)

    # 1. Sync lib/common.sh
    $localCommonSh = Join-Path $localLibDir 'common.sh'
    if (Test-Path $localCommonSh) {
        $content = Convert-DotEnvContentToLf -Content (Get-Content $localCommonSh -Raw -Encoding UTF8)
        $tempFile = Write-LfTempFile -Content $content
        try {
            $destLib = ('{0}@{1}:{2}/common.sh' -f $Config['SSH_USER'], $Config['SSH_HOST'], $remoteLibDir)
            Invoke-DeployScp -Config $Config -DryRun:$DryRun -ScpArgs @($tempFile, $destLib)
        } finally {
            if ($tempFile -and (Test-Path $tempFile)) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
        }
    }

    # 2. Sync remote/*.sh
    $files = Get-ChildItem -Path $localRemoteDir -Filter '*.sh' -File
    foreach ($f in $files) {
        $dest = ('{0}@{1}:{2}/{3}' -f $Config['SSH_USER'], $Config['SSH_HOST'], $remoteDir, $f.Name)
        $content = Convert-DotEnvContentToLf -Content (Get-Content $f.FullName -Raw -Encoding UTF8)
        $tempFile = Write-LfTempFile -Content $content
        try {
            Invoke-DeployScp -Config $Config -DryRun:$DryRun -ScpArgs @($tempFile, $dest)
        } finally {
            if ($tempFile -and (Test-Path $tempFile)) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
        }
        if (-not $DryRun) {
            Invoke-DeploySsh -Config $Config -RemoteCommand ('chmod +x ''{0}/{1}''' -f $remoteDir, $f.Name)
        }
    }
}

# Align remote git clone to target branch and reset hard to origin
function Invoke-RemoteGitPull {
    param(
        [hashtable]$Config,
        [switch]$DryRun
    )
    $root = $Config['REMOTE_REPO_ROOT']
    $branch = $Config['GIT_REMOTE_BRANCH']
    $cmd = 'cd ''{0}'' && git fetch origin ''{1}'' && git checkout ''{1}'' && git reset --hard ''origin/{1}''' -f $root, $branch
    Invoke-DeploySsh -Config $Config -DryRun:$DryRun -RemoteCommand $cmd
}

function Get-RemoteGitSha {
    param([hashtable]$Config)
    $root = $Config['REMOTE_REPO_ROOT']
    $target = Get-SshTarget -Config $Config
    $sshArgs = @(Get-SshBaseArgs -Config $Config) + @($target, ('cd ''{0}'' && git rev-parse --short HEAD' -f $root))
    $result = & ssh @sshArgs 2>$null
    if ($LASTEXITCODE -ne 0) { return (Get-LocalGitSha) }
    return ($result | Select-Object -Last 1).Trim()
}

function Get-LocalGitSha {
    try {
        $sha = git rev-parse --short HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($sha)) {
            return ($sha | Select-Object -Last 1).Trim()
        }
    } catch {}
    return 'local'
}

function Write-DeployAudit {
    param(
        [string[]]$Components = @('BlogWeb'),
        [hashtable]$Config,
        [string]$GitSha = 'local'
    )
    if (-not (Test-Path $script:ArtifactsDir)) {
        New-Item -ItemType Directory -Path $script:ArtifactsDir -Force | Out-Null
    }
    $entry = [ordered]@{
        timestamp  = (Get-Date).ToUniversalTime().ToString('o')
        operator   = $env:USERNAME
        gitSha     = $GitSha
        components = $Components
        profile    = $Config['DEPLOY_PROFILE']
        host       = $Config['SSH_HOST']
    } | ConvertTo-Json -Compress
    Add-Content -Path $script:AuditLogPath -Value $entry -Encoding UTF8
    Write-Host ('Audit: {0}' -f $entry)
}

function Convert-DotEnvContentToLf {
    param([string]$Content)
    return ($Content -replace "`r`n", "`n" -replace "`r", "`n")
}

function Write-LfTempFile {
    param([string]$Content)
    $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ('blog-env-{0}' -f [Guid]::NewGuid().ToString('N'))
    [System.IO.File]::WriteAllText($tempFile, $Content, [System.Text.UTF8Encoding]::new($false))
    return $tempFile
}

function Sync-NginxSitesEnv {
    param(
        [hashtable]$Config,
        [switch]$DryRun
    )
    $localPath = Join-Path $script:DeployRoot 'nginx/sites.env'
    if (-not (Test-Path $localPath)) {
        Write-Host 'Skip Sync-NginxSitesEnv: deploy/nginx/sites.env not found locally'
        return
    }
    $remoteDir = ($Config['REMOTE_REPO_ROOT'].TrimEnd('/')) + '/deploy/nginx'
    $target = Get-SshTarget -Config $Config
    $content = Convert-DotEnvContentToLf -Content (Get-Content $localPath -Raw -Encoding UTF8)
    $tempFile = Write-LfTempFile -Content $content
    try {
        if ($DryRun) {
            Write-Host ('[DryRun] scp deploy/nginx/sites.env -> {0}:{1}/sites.env' -f $target, $remoteDir)
            Write-Host ('[DryRun] ssh chmod 600 {0}/sites.env' -f $remoteDir)
            return
        }
        Invoke-DeploySsh -Config $Config -RemoteCommand ('mkdir -p ''{0}''' -f $remoteDir)
        $dest = ('{0}:{1}/sites.env' -f $target, $remoteDir)
        Invoke-DeployScp -Config $Config -ScpArgs @($tempFile, $dest)
        Invoke-DeploySsh -Config $Config -RemoteCommand ('chmod 600 ''{0}/sites.env''' -f $remoteDir)
        Write-Host 'Synced deploy/nginx/sites.env to remote'
    }
    finally {
        if ($tempFile -and (Test-Path $tempFile)) {
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        }
    }
}

function Test-DomainNotPlaceholder {
    param([hashtable]$Config)
    if ($Config['SSH_HOST'] -match 'example\.com' -or $Config['SSH_HOST'] -match 'your-server' -or $Config['SSH_HOST'] -match 'your\.server') {
        Write-Error ('deploy/.env SSH_HOST contains placeholder ({0}) — deployment blocked.' -f $Config['SSH_HOST'])
        exit $script:ExitPreflight
    }
    $sitesEnv = Join-Path $script:DeployRoot 'nginx/sites.env'
    if (Test-Path $sitesEnv) {
        $content = Get-Content $sitesEnv -Raw -Encoding UTF8
        if ($content -match 'example\.com') {
            Write-Error 'deploy/nginx/sites.env contains example.com — configure real domain.'
            exit $script:ExitPreflight
        }
    }
}

function Test-LocalTools {
    $requiredCmds = @('node', 'npm', 'ssh', 'scp')
    foreach ($cmd in $requiredCmds) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
            Write-Error ('Missing required tool in PATH: {0}' -f $cmd)
            exit $script:ExitPreflight
        }
    }
}
