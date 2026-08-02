#!/usr/bin/env bash
set -euo pipefail

echo "Running local CI checks..."

# Install in a reproducible way for the workspace
npm ci --no-audit --no-fund

echo "Running Prettier check"
npm run format:check

echo "Running ESLint"
npm run lint

echo "CI checks completed"
