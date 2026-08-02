#!/usr/bin/env node
const fetch = globalThis.fetch || require('node-fetch');
(async () => {
  try {
    const admin = process.env.KEYCLOAK_ADMIN || 'admin';
    const pass = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
    const kcBase = process.env.KEYCLOAK_BASE || 'http://localhost:8080';

    const tokenResp = await fetch(`${kcBase}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: 'admin-cli',
        grant_type: 'password',
        username: admin,
        password: pass,
      }),
    });
    const tokenJson = await tokenResp.json();
    const token = tokenJson.access_token;
    const realmsResp = await fetch(`${kcBase}/admin/realms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const realms = await realmsResp.json();
    console.log(
      'Realms:',
      realms.map((r) => r.realm)
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
