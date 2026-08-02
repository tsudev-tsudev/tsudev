Param(
    [switch]$AllowWipe
)

$log = Join-Path $PSScriptRoot 'docker-repair.log'
if (Test-Path $log) { Remove-Item $log -Force -ErrorAction SilentlyContinue }
Start-Transcript -Path $log -Force

Write-Host "==== docker-repair: $(Get-Date) ===="
Write-Host "User: $(whoami)"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Host "IsElevated: $isAdmin"

# Stop Docker service if present
try {
    $svc = Get-Service -Name 'com.docker.service' -ErrorAction SilentlyContinue
} catch { $svc = $null }
if ($svc) {
    Write-Host "Found service com.docker.service - Status: $($svc.Status)"
    if ($svc.Status -ne 'Stopped') {
        Write-Host 'Stopping com.docker.service...'
        try { Stop-Service -Name 'com.docker.service' -Force -ErrorAction Stop; Start-Sleep -Seconds 3; Write-Host 'Service stopped' } catch { Write-Warning "Stop-Service failed: $_" }
    } else { Write-Host 'Service already stopped' }
} else {
    Write-Host 'Service com.docker.service not found'
}

# Kill lingering Docker-related processes
$procNames = @('Docker Desktop','Docker Desktop.exe','com.docker.backend','com.docker.diagnose','com.docker.cli','docker')
foreach ($n in $procNames) {
    $procs = Get-Process -Name $n -ErrorAction SilentlyContinue
    if ($procs) {
        foreach ($p in $procs) {
            try { Write-Host "Stopping process $($p.ProcessName) (PID $($p.Id))"; Stop-Process -Id $p.Id -Force -ErrorAction Stop } catch { Write-Warning "Stop-Process failed: $_" }
        }
    }
}

Write-Host 'Shutting down WSL...'
try { wsl --shutdown } catch { Write-Warning "wsl --shutdown failed: $_" }

# Locate Docker Desktop executable
$exe = $null
$candidatePaths = @(
    'C:\Program Files\Docker\Docker\Docker Desktop.exe',
    'C:\Program Files\Docker\Docker Desktop\\Docker Desktop.exe',
    'C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe'
)
foreach ($p in $candidatePaths) { if (Test-Path $p) { $exe = $p; break } }
if (-not $exe) {
    try { $exe = Get-ChildItem -Path 'C:\Program Files','C:\Program Files (x86)' -Filter 'Docker Desktop.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName } catch {}
}

if ($exe) {
    Write-Host "Starting Docker Desktop: $exe"
    try { Start-Process -FilePath $exe } catch { Write-Warning "Start-Process failed: $_" }
} else {
    Write-Warning 'Docker Desktop executable not found; aborting.'
    Stop-Transcript
    exit 1
}

# Wait for docker daemon to respond
Write-Host 'Waiting for Docker daemon (timeout 180s)...'
$timeout = 180
$startTime = Get-Date
$daemonReady = $false
while ((Get-Date) -lt $startTime.AddSeconds($timeout)) {
    try {
        docker info > $null 2>&1
        if ($LASTEXITCODE -eq 0) { $daemonReady = $true; break }
    } catch {}
    Start-Sleep -Seconds 3
}

if (-not $daemonReady) {
    Write-Warning 'Docker daemon did not respond within timeout. Attempting to start service if present.'
    if ($svc) {
        try { Start-Service -Name 'com.docker.service' -ErrorAction Stop; Start-Sleep -Seconds 5 } catch { Write-Warning 'Start-Service failed.' }
        $start2 = Get-Date
        while ((Get-Date) -lt $start2.AddSeconds(60)) {
            try { docker info > $null 2>&1; if ($LASTEXITCODE -eq 0) { $daemonReady = $true; break } } catch {}
            Start-Sleep -Seconds 3
        }
    }
}

if (-not $daemonReady) {
    Write-Warning 'Docker daemon still not available. Exiting without destructive actions.'
    Write-Host 'If you want to wipe docker-desktop WSL distros and recreate, rerun this script with -AllowWipe.'
    Stop-Transcript
    exit 2
}

Write-Host 'Docker daemon is available.'
Write-Host 'Running docker compose up for tsudev (repository root)...'
try {
    Push-Location $PSScriptRoot\..    
    docker compose --project-name tsudev up --build -d
    docker compose ps
    Pop-Location
} catch { Write-Warning "docker compose up failed: $_" }

Write-Host 'Repair script completed.'
Stop-Transcript
