.PHONY: format lint ci e2e-up e2e-run e2e-down

format:
	npm run format

lint:
	npm run lint:fix

ci:
	npm ci --no-audit --no-fund
	npm run format:check
	npm run lint

e2e-up:
	docker compose up -d minio postgres content-service storage-service trust-service frontend-main

e2e-run:
	docker compose build e2e-runner
	docker run --rm --network tsudev_default -e E2E_FORCE_FALLBACK=0 -e E2E_IN_DOCKER=1 tsudev-e2e-runner:latest

e2e-down:
	docker compose down
