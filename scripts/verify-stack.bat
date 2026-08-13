@echo off
REM Cross-platform quick verifier for users who cannot run PowerShell scripts
SETLOCAL ENABLEDELAYEDEXPANSION
cd /d %~dp0\..
IF NOT EXIST verify-output mkdir verify-output

echo Running Node verification script...
node "%~dp0\verify-stack.js"
IF ERRORLEVEL 1 (
  echo Node script failed; attempting direct docker commands (best-effort)...
  docker compose up -d --build > verify-output\compose-up.txt 2>&1
  docker compose ps --all --format "table {{.Name}}\t{{.Service}}\t{{.State}}\t{{.Ports}}" > verify-output\compose-ps.txt 2>&1
  docker compose logs --tail=200 keycloak minio postgres user-service content-service storage-service frontend-main > verify-output\compose-logs.txt 2>&1
  curl -sS -X POST http://localhost:4002/api/presign -H "Content-Type: application/json" -d "{\"fileName\":\"verify.txt\",\"contentType\":\"text/plain\"}" > verify-output\presign-response.json 2>&1
  curl -sS http://localhost:4002/api/files > verify-output\storage-files.json 2>&1
)

echo Done. Files are in verify-output\
