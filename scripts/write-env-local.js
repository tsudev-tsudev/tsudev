#!/usr/bin/env node
'use strict';
// Sinh apps/*/.env.local từ .env gốc để Next đọc được lúc dev.
//
// Không thể copy nguyên .env sang cả hai app: NEXTAUTH_URL phải trỏ về origin
// của chính app đó, nếu dùng chung một giá trị thì đăng nhập ở diễn đàn (:3001)
// sẽ bị next-auth đá callback về :3000. Nên ở đây ta thay dòng NEXTAUTH_URL
// bằng URL riêng của từng app, lấy từ NEXT_PUBLIC_MAIN_URL/NEXT_PUBLIC_FORUM_URL.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROOT_ENV = path.join(ROOT, '.env');

function parseEnv(content) {
  const out = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  });
  return out;
}

// Cổng/URL lấy từ config/topology.json — không hardcode. Ở chế độ proxy, URL
// công khai phân biệt bằng subdomain qua dev-proxy chứ không bằng số cổng.
const { loadTopology, publicUrl } = require('./topology/load');
const TOPO = loadTopology();

const APPS = [
  {
    dir: 'apps/frontend-main',
    urlKey: 'NEXT_PUBLIC_MAIN_URL',
    fallback: publicUrl(TOPO, 'main'),
  },
  {
    dir: 'apps/frontend-forum',
    urlKey: 'NEXT_PUBLIC_FORUM_URL',
    fallback: publicUrl(TOPO, 'forum'),
  },
];

function writeEnvLocal() {
  if (!fs.existsSync(ROOT_ENV)) {
    console.warn('Không thấy .env ở gốc — bỏ qua sinh .env.local');
    return;
  }
  const content = fs.readFileSync(ROOT_ENV, 'utf8');
  const vars = parseEnv(content);

  APPS.forEach(({ dir, urlKey, fallback }) => {
    const appUrl = (vars[urlKey] || fallback).replace(/\/+$/, '');
    // Bỏ NEXTAUTH_URL của .env gốc rồi ghi lại giá trị riêng của app này.
    const body = content
      .split(/\r?\n/)
      .filter((line) => !/^\s*NEXTAUTH_URL\s*=/.test(line))
      .join('\n')
      .replace(/\n+$/, '\n');

    const out = `${body}
# --- Sinh tự động bởi scripts/write-env-local.js — đừng sửa tay ---
# NEXTAUTH_URL riêng cho ${dir}, lấy từ ${urlKey}.
NEXTAUTH_URL=${appUrl}
`;

    const dest = path.join(ROOT, dir, '.env.local');
    try {
      if (fs.existsSync(dest) && fs.readFileSync(dest, 'utf8') === out) return;
      fs.writeFileSync(dest, out, 'utf8');
      console.log(`Wrote ${dir}/.env.local (NEXTAUTH_URL=${appUrl})`);
    } catch (err) {
      console.warn(`Failed to write ${dest}: ${err.message}`);
    }
  });
}

if (require.main === module) writeEnvLocal();

module.exports = { writeEnvLocal };
