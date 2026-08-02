#!/usr/bin/env node
/*
  Simple HS256 JWT generator for local development/testing.
  Usage:
    node scripts/generate-dev-jwt.js --sub alice --roles "admin,storage:upload" --exp 3600

  This generator uses an HMAC secret from DEV_JWT_SECRET (default: 'dev-secret').
  The token is printed to stdout and a curl example is shown.
*/
const crypto = require('crypto');

function base64url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Minimal arg parsing to avoid extra deps
const argv = process.argv.slice(2);
function getArg(name, short) {
  const idx = argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];
  if (short) {
    const sidx = argv.indexOf(`-${short}`);
    if (sidx !== -1 && sidx + 1 < argv.length) return argv[sidx + 1];
  }
  return undefined;
}

const sub = getArg('sub', 's') || 'dev';
const roles = (getArg('roles', 'r') || 'admin')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const expSec = parseInt(getArg('exp', 'e') || '3600', 10);
const secret = process.env.DEV_JWT_SECRET || 'dev-secret';

const header = { alg: 'HS256', typ: 'JWT' };
const now = Math.floor(Date.now() / 1000);
const claimsRaw = getArg('claims', 'c');
const payload = Object.assign(
  { sub, iat: now, exp: now + expSec, preferred_username: sub },
  claimsRaw ? JSON.parse(claimsRaw) : {}
);
if (roles.length) payload.realm_access = { roles };

const headerB = Buffer.from(JSON.stringify(header));
const payloadB = Buffer.from(JSON.stringify(payload));
const signingInput = `${base64url(headerB)}.${base64url(payloadB)}`;
const sig = crypto.createHmac('sha256', secret).update(signingInput).digest();
const token = `${signingInput}.${base64url(sig)}`;

console.log(token);
console.log('\nExample curl:');
console.log(
  `curl -H "Authorization: Bearer ${token}" http://localhost:4002/api/presign?fileName=test.txt`
);
