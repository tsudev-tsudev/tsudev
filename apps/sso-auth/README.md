# SSO / Authentication

This folder contains guidance and configuration for the Identity Provider (Keycloak) and SSO plumbing.

We use Keycloak in dev for OIDC/OAuth2 flows. The `docker-compose.yml` starts a Keycloak container on port 8080.

Place custom realm exports under `apps/sso-auth/keycloak/realm-export.json` for automatic import in development.

Local Keycloak setup (dev):

1. Start Docker Desktop (or run Keycloak directly). Then `docker compose up keycloak` to start Keycloak.
2. Keycloak will import the realm export at `apps/sso-auth/keycloak/realm-export.json` (it is configured in `docker-compose.yml` for dev import).
3. The included realm defines a `tsudev-frontend` public client and a development user `devuser` / `devpass`.
4. Configure frontend envs: copy `.env.example` → `.env` and ensure `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`, and `KEYCLOAK_CLIENT_SECRET` match values in the realm export.

Notes:

- If Docker is not available, you can use an external Keycloak instance and point `KEYCLOAK_ISSUER` to it.
- For production, clients should be `confidential` and have secure client secrets; use HTTPS.
