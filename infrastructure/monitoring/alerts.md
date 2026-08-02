# Alerting Integration Notes

This document lists example approaches for routing alerts to Telegram and email.

Telegram integration (example):

1. Create a Telegram Bot and get a token from @BotFather.
2. Configure Sentry/New Relic to send webhook HTTP POSTs to a small relay service.
3. Relay service validates payload and forwards a formatted message to `https://api.telegram.org/bot<token>/sendMessage`.

Email:

- Use Sentry's built-in email integration or New Relic notification channels to send email to `nguyentrangtinhsu@gmail.com`.
