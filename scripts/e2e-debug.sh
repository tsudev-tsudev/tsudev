#!/bin/sh
set -eux

echo "=== ENVIRONMENT VARIABLES ==="
env | egrep 'E2E|PATH|NODE' || env

echo "\n=== /etc/hosts ==="
cat /etc/hosts || true

echo "\n=== resolve frontend-main via getent (if available) ==="
getent hosts frontend-main || true

echo "\n=== curl frontend-main:3000 ==="
curl -sS -I http://frontend-main:3000 || true

echo "\n=== curl by IP 172.18.0.10:3000 ==="
curl -sS -I http://172.18.0.10:3000 || true

echo "\n=== quick node check ==="
node -e "console.log('NODE_OK E2E_IN_DOCKER=' + (process.env.E2E_IN_DOCKER||'unset'))" || true

echo "\n=== short playwright node invocation (no browser) ==="
node -e "console.log('playwright', typeof require('playwright'))" || true

# Run the full E2E script (headless) to reproduce Playwright behavior
echo "\n=== running full e2e-sso-upload.js ==="
node /work/scripts/e2e-sso-upload.js || true

# End
