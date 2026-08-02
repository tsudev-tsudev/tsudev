# E2E: Presign + Upload Fallback

Summary

- Direct browser PUTs to MinIO using presigned URLs can fail in mixed host/container environments due to hostname/signature/resolution differences.
- The E2E scripts include a safe server-side fallback: request a presigned URL from `/api/presign`, and if a direct PUT fails, POST the file to the storage service `/api/upload` which performs the S3 upload server-side.

How it works

- Normal (browser): frontend requests `/api/presign`, browser PUTs the returned URL directly to MinIO.
- Fallback (server): tests or the runner call `/api/presign` then POST to `/api/upload?key=...` which uploads via the service's S3 client.

Running the E2E test

- Stable (recommended for CI/local runs): force server-side fallback:

  - Local: `E2E_FORCE_FALLBACK=1 node scripts/e2e-sso-upload.js`
  - Compose: The compose service sets `E2E_FORCE_FALLBACK=1` by default; `docker compose up --build --abort-on-container-exit e2e-runner` will use the fallback path.

- Validate direct browser PUT (in-network): run the runner inside the compose network without the forced fallback.
  1. Ensure services are up (minio, storage-service, frontend, keycloak, backing services):
     ```bash
     docker compose up -d minio postgres redis user-service content-service storage-service keycloak frontend-main
     ```
  2. Build the runner image (so the container has node_modules & browsers):
     ```bash
     docker compose build e2e-runner
     ```
  3. Run the runner one-off inside the compose network (overrides fallback):
     ```bash
     # find the project network name (usually <directory>_default), then:
     docker run --rm --network $(docker network ls --filter name=$(basename $(pwd)) -q)_default -e E2E_FORCE_FALLBACK=0 <e2e-runner-image>
     ```

Notes

- The repository's default for CI is to prefer the server-side fallback because it is reliable across environments. Use the direct browser PUT validation to verify end-to-end when you control the full compose environment.

Files

- Script: `scripts/e2e-sso-upload.js` — contains the fallback and instrumentation.
- Storage API: `services/storage-service/src/index.js` — provides `/api/presign` and `/api/upload`.
