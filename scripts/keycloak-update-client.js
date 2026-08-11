#!/usr/bin/env node
const fetch = globalThis.fetch || require('node-fetch');
(async () => {
  try {
    const admin = process.env.KEYCLOAK_ADMIN || 'admin';
    const pass = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
    const realm = process.env.KEYCLOAK_REALM || 'tsudev-local';
    const clientId = process.env.KEYCLOAK_CLIENT_ID || 'tsudev-frontend';
    const kcBase =
      process.env.KEYCLOAK_BASE ||
      require('./topology/load').publicUrl(require('./topology/load').loadTopology(), 'auth');

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

    console.log('Finding client by clientId...');
    const clientsResp = await fetch(
      `${kcBase}/admin/realms/${realm}/clients?clientId=${encodeURIComponent(clientId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!clientsResp.ok) throw new Error('Failed to list clients: ' + (await clientsResp.text()));
    const clients = await clientsResp.json();
    if (!clients || clients.length === 0) throw new Error('Client not found: ' + clientId);
    const id = clients[0].id;
    console.log('Found client id:', id);

    console.log('Fetching client representation...');
    const repResp = await fetch(`${kcBase}/admin/realms/${realm}/clients/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rep = await repResp.json();

    const addRedirects = [
      'http://frontend-main:3000/*',
      'http://frontend-main:3000',
      'http://frontend-forum:3001/*',
      'http://frontend-forum:3001',
    ];
    rep.redirectUris = Array.from(new Set([...(rep.redirectUris || []), ...addRedirects]));
    rep.webOrigins = Array.from(
      new Set([
        ...(rep.webOrigins || []),
        'http://frontend-main:3000',
        'http://frontend-forum:3001',
      ])
    );
    rep.rootUrl = rep.rootUrl || 'http://frontend-main:3000';

    console.log('Updating client with new redirectUris/webOrigins...');
    const putResp = await fetch(`${kcBase}/admin/realms/${realm}/clients/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(rep),
    });
    if (!putResp.ok) throw new Error('Failed to update client: ' + (await putResp.text()));
    console.log('Client updated successfully');
  } catch (err) {
    console.error('ERROR', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
