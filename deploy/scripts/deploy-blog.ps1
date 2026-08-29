# Build blog-web locally and atomic-deploy to remote host Nginx (not Docker).
param(
    [switch]$DryRun,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"

$cfg = Get-DeployConfig -DryRun:$DryRun
$target = Get-SshTarget -Config $cfg
$distDir = Join-Path $script:BlogWebRoot 'dist'
$stagingRemote = ($cfg['REMOTE_BLOG_DIR'].TrimEnd('/')) + '.staging'

Write-Host '===> Deploying BlogWeb (Personal Blog)...' -ForegroundColor Cyan
Write-Host (' Target: {0} | RemoteDir: {1}' -f $target, $cfg['REMOTE_BLOG_DIR']) -ForegroundColor DarkGray

if (-not $DryRun) {
    Test-DomainNotPlaceholder -Config $cfg
}

# 1. 本地构建
if (-not $SkipBuild) {
    Write-Host 'Building blog-web (npm ci && npm run build)...' -ForegroundColor Green
    Push-Location $script:BlogWebRoot
    try {
        if ($DryRun) {
            Write-Host '[DryRun] npm ci && npm run build in source/blog-web/' -ForegroundColor Yellow
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
} elseif (-not (Test-Path (Join-Path $distDir 'index.html'))) {
    Write-Error 'SkipBuild specified but dist/index.html is missing. Run build first.'
    exit $script:ExitBuild
}

if (-not $DryRun -and -not (Test-Path (Join-Path $distDir 'index.html'))) {
    Write-Error 'Build completed but dist/index.html is missing.'
    exit $script:ExitBuild
}

if ($DryRun) {
    Write-Host ('[DryRun] scp dist/* -> {0}:{1}/' -f $target, $stagingRemote) -ForegroundColor Yellow
    Write-Host '[DryRun] sync remote scripts & trigger static-atomic-swap.sh' -ForegroundColor Yellow
    Write-Host '[DryRun] trigger health-check.sh' -ForegroundColor Yellow
    exit 0
}

# 2. 准备远端暂存区
Write-Host ('Preparing remote staging dir: {0} ...' -f $stagingRemote) -ForegroundColor Green
Invoke-DeploySsh -Config $cfg -RemoteCommand ('mkdir -p ''{0}'' && rm -rf ''{0}''/*' -f $stagingRemote)

# 3. 同步 dist 至暂存区
Write-Host 'Uploading build artifacts via SCP...' -ForegroundColor Green
$dest = ('{0}:{1}/' -f $target, $stagingRemote)
Invoke-DeployScp -Config $cfg -ScpArgs @('-r', (Join-Path $distDir '.'), $dest)

# 4. 同步远程执行脚本并赋权
Write-Host 'Syncing remote deployment scripts...' -ForegroundColor Green
Sync-RemoteDeployScripts -Config $cfg

# 5. 调用远程原子切换
Write-Host 'Executing static atomic swap...' -ForegroundColor Green
$swapScript = ($cfg['REMOTE_REPO_ROOT'].TrimEnd('/')) + '/deploy/scripts/remote/static-atomic-swap.sh'
$swapCmd = ('REMOTE_STATIC_DIR=''{0}'' bash ''{1}''' -f $cfg['REMOTE_BLOG_DIR'], $swapScript)
Invoke-DeploySsh -Config $cfg -RemoteCommand $swapCmd

# 6. 服务健康探活
Write-Host 'Running post-deployment health checks...' -ForegroundColor Green
$healthScript = ($cfg['REMOTE_REPO_ROOT'].TrimEnd('/')) + '/deploy/scripts/remote/health-check.sh'
$healthCmd = ('REMOTE_STATIC_DIR=''{0}'' bash ''{1}''' -f $cfg['REMOTE_BLOG_DIR'], $healthScript)
Invoke-DeploySsh -Config $cfg -RemoteCommand $healthCmd

Write-Host 'deploy-blog completed successfully.' -ForegroundColor Green
