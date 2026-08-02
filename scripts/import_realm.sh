#!/bin/bash
set -e

# Acquire admin token
curl -s -X POST 'http://localhost:8080/realms/master/protocol/openid-connect/token' \
  -d 'client_id=admin-cli' -d 'username=admin' -d 'password=admin' -d 'grant_type=password' -o /tmp/token.json

# Extract token
TOKEN=$(python3 -c 'import json,sys; print(json.load(open("/tmp/token.json"))["access_token"])')
echo "TOKEN prefix: ${TOKEN:0:20}..."

# Post realm JSON to create/import realm
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data-binary @/mnt/g/Projects/tsudev/apps/sso-auth/keycloak/realm-export.json \
  http://localhost:8080/admin/realms -w "\nHTTP_CODE:%{http_code}\n"
