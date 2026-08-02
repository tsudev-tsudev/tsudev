#!/usr/bin/env node
const fetch = globalThis.fetch || require('node-fetch');
const fs = require('fs');
(async () => {
  try {
    const admin = process.env.KEYCLOAK_ADMIN || 'admin';
    const pass = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
    const kcBase = process.env.KEYCLOAK_BASE || 'http://localhost:8080';
    const realmFile =
      process.env.KEYCLOAK_REALM_FILE || './apps/sso-auth/keycloak/realm-export.json';

    if (!fs.existsSync(realmFile)) throw new Error('Realm file not found: ' + realmFile);
    const realmJson = JSON.parse(fs.readFileSync(realmFile, 'utf8'));
    const realmName = realmJson.realm || realmJson.id || '<unknown>';

    console.log('Getting admin token...');
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
    if (!tokenResp.ok) throw new Error('Failed to get token: ' + (await tokenResp.text()));
    const tokenJson = await tokenResp.json();
    const token = tokenJson.access_token;
    console.log('Token acquired');

    console.log('Checking if realm exists...');
    const realmsResp = await fetch(`${kcBase}/admin/realms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!realmsResp.ok) throw new Error('Failed to list realms: ' + (await realmsResp.text()));
    const realms = await realmsResp.json();
    if (realms.find((r) => r.realm === realmName)) {
      console.log('Realm already exists:', realmName);
      process.exit(0);
    }

    console.log('Importing realm:', realmName);
    const importResp = await fetch(`${kcBase}/admin/realms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(realmJson),
    });
    if (!importResp.ok) throw new Error('Failed to import realm: ' + (await importResp.text()));
    console.log('Realm imported successfully');
  } catch (err) {
    console.error('ERROR', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
