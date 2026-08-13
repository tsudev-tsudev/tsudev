# Verification script for tsudev docker-compose stack
# Usage: Open PowerShell as your normal user and run:
#   cd G:\Projects\tsudev
#   .\scripts\verify-stack.ps1

$ErrorActionPreference = 'Continue'
$OutDir = "verify-output"
if (-Not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

# Ensure script runs from repository root (script is in scripts/)
$scriptDir = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
try {
  $repoRoot = Resolve-Path -Path (Join-Path $scriptDir '..')
  Set-Location -LiteralPath $repoRoot
} catch {
  Write-Output "Warning: could not set location to repo root; continuing from $(Get-Location)"
}

Write-Output "Project: $(Get-Location)"

function Fetch-UrlToFile($url, $outfile) {
  $curlExe = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curlExe) {
    try { & curl.exe -sS $url 2>$null | Out-File -Encoding utf8 -FilePath $outfile } catch { "no-response" | Out-File -FilePath $outfile }
  } else {
    try { Invoke-RestMethod -Uri $url -ErrorAction Stop | Out-File -Encoding utf8 -FilePath $outfile } catch { "no-response" | Out-File -FilePath $outfile }
  }
}

Write-Output "Starting/updating compose stack (may take a few minutes)..."
try {
  & docker compose up -d --build 2>&1 | Tee-Object -FilePath "$OutDir/compose-up.txt"
} catch {
  Write-Output "Warning: 'docker compose up' returned an error or non-zero exit; output saved to $OutDir/compose-up.txt"
  try { $_ | Out-File -FilePath "$OutDir/compose-up.txt" -Append } catch { }
}

Write-Output "Listing compose services..."
try { docker compose ps --all --format 'table {{.Name}}\t{{.Service}}\t{{.State}}\t{{.Ports}}' 2>&1 | Tee-Object -FilePath "$OutDir/compose-ps.txt" } catch { "" | Out-File -FilePath "$OutDir/compose-ps.txt" }

Write-Output "Collecting recent logs (tail 200)..."
try { docker compose logs --tail=200 keycloak minio postgres user-service content-service storage-service frontend-main 2>&1 | Tee-Object -FilePath "$OutDir/compose-logs.txt" } catch { "" | Out-File -FilePath "$OutDir/compose-logs.txt" }

Write-Output "Checking health endpoints..."
$endpoints = @(
  @{name='storage'; url='http://localhost:4002/health'},
  @{name='user'; url='http://localhost:4000/health'},
  @{name='content'; url='http://localhost:4001/health'},
  @{name='frontend-main'; url='http://localhost:3000/'},
)
foreach ($ep in $endpoints) {
  Write-Output "-> $($ep.name): $($ep.url)"
  Fetch-UrlToFile $ep.url "$OutDir/health-$($ep.name).txt"
}

Write-Output "Fetching Keycloak OIDC discovery"
Fetch-UrlToFile 'http://localhost:8080/realms/tsudev-local/.well-known/openid-configuration' "$OutDir/keycloak-oidc.json"

Write-Output "Requesting presigned URL from storage-service"
$body = '{"fileName":"verify.txt","contentType":"text/plain"}'
$curlExe = Get-Command curl.exe -ErrorAction SilentlyContinue
if ($curlExe) {
  try { & curl.exe -sS -X POST http://localhost:4002/api/presign -H "Content-Type: application/json" -d $body | Out-File -Encoding utf8 -FilePath "$OutDir/presign-response.json" } catch { "no-response" | Out-File -FilePath "$OutDir/presign-response.json" }
} else {
  try { Invoke-RestMethod -Uri 'http://localhost:4002/api/presign' -Method Post -ContentType 'application/json' -Body $body -ErrorAction Stop | Out-File -Encoding utf8 -FilePath "$OutDir/presign-response.json" } catch { "no-response" | Out-File -FilePath "$OutDir/presign-response.json" }
}

try {
  $presign = Get-Content -Raw -Path "$OutDir/presign-response.json"
  $json = $null
  try { $json = ConvertFrom-Json $presign -ErrorAction Stop } catch { $json = $null }
  if ($json -and $json.url) {
    Write-Output "Got presigned URL; attempting PUT upload"
    if ($curlExe) {
      try { & curl.exe -sS -X PUT -H "Content-Type: text/plain" --data-binary "hello from verify script" "$($json.url)" -w "%{http_code}" -o "$OutDir/put-output-body.txt" | Out-File -FilePath "$OutDir/put-status.txt" } catch { "put-failed" | Out-File -FilePath "$OutDir/put-status.txt" }
    } else {
      try { Invoke-WebRequest -Uri $json.url -Method Put -Body "hello from verify script" -ContentType 'text/plain' -ErrorAction Stop | Out-Null; "200" | Out-File -FilePath "$OutDir/put-status.txt" } catch { "put-failed" | Out-File -FilePath "$OutDir/put-status.txt" }
    }
  } else {
    Write-Output "No url in presign response"
  }
} catch {
  Write-Output "Presign response not valid JSON or no URL"
}

Write-Output "Listing files via storage-service API"
Fetch-UrlToFile 'http://localhost:4002/api/files' "$OutDir/storage-files.json"

Write-Output "Done. Output files are in $OutDir. Please paste the contents of these files or attach them here for analysis:"
Get-ChildItem -Path $OutDir | ForEach-Object { " - $($_.Name)" }

Write-Output "If any service failed to start, attach the file 'compose-logs.txt' and 'compose-up.txt' for troubleshooting."
