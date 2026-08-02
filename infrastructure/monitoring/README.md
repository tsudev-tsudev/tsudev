# Monitoring & Alerting (Placeholders)

This directory contains placeholders and integration notes for APM and error tracking:

- Sentry: configure DSN per-environment and add SDK to frontend/backend code.
- New Relic: add `NEW_RELIC_LICENSE_KEY` and initialize agent in backend services.
- Alerting: configure Sentry and New Relic to forward critical alerts to a Telegram bot and email.

Example quick steps:

1. Create Sentry project(s) and obtain DSN.
2. Add SENTRY_DSN to `.env` for each service.
3. Configure New Relic agent with `NEW_RELIC_LICENSE_KEY`.
