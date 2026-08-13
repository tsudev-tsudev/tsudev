#!/usr/bin/env node
'use strict';
// Đọc config/topology.json và dẫn xuất URL. Mọi script khác lấy cổng/hostname
// từ đây, không hardcode. Xem docs/refactor-network-topology.md.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TOPOLOGY_PATH = path.join(ROOT, 'config', 'topology.json');

function loadTopology() {
  const topo = JSON.parse(fs.readFileSync(TOPOLOGY_PATH, 'utf8'));
  const seenId = new Set();
  const seenPort = new Map();
  topo.nodes.forEach((n) => {
    if (seenId.has(n.id)) throw new Error(`topology: node trùng id "${n.id}"`);
    seenId.add(n.id);
    if (seenPort.has(n.port)) {
      throw new Error(
        `topology: cổng ${n.port} bị "${n.id}" và "${seenPort.get(n.port)}" tranh nhau`
      );
    }
    seenPort.set(n.port, n.id);
  });
  return topo;
}

function node(topo, id) {
  const found = topo.nodes.find((n) => n.id === id);
  if (!found) throw new Error(`topology: không có node "${id}"`);
  return found;
}

/** Cổng của một node trong một môi trường, đã tính override. */
function port(topo, id, env = 'dev') {
  const ov = topo.overrides && topo.overrides[env] && topo.overrides[env][id];
  return ov && ov.port ? ov.port : node(topo, id).port;
}

/**
 * URL tầng INTERNAL — SSR, BFF, service gọi service. Không bao giờ đi qua proxy:
 * vòng lại qua cổng vào công khai chỉ thêm một điểm hỏng.
 */
function internalUrl(topo, id, env = 'dev') {
  return `http://${topo.dev.host}:${port(topo, id, env)}`;
}

/**
 * URL tầng PUBLIC — cái trình duyệt gõ. Hai hình trạng:
 *   mode=ports  → http://localhost:3000        (hiện trạng)
 *   mode=proxy  → http://<sub>.tsudev.localhost:8080
 */
function publicUrl(topo, id, env = 'dev') {
  const n = node(topo, id);
  if (!n.public) throw new Error(`topology: node "${id}" không công khai, dùng internalUrl()`);
  if (topo.dev.mode === 'proxy') {
    const host = n.sub === '@' ? topo.dev.domain : `${n.sub}.${topo.dev.domain}`;
    const p = topo.dev.proxyPort;
    return `http://${host}${p === 80 ? '' : `:${p}`}`;
  }
  return `http://${topo.dev.host}:${port(topo, id, env)}`;
}

/** URL công khai ở production, dẫn từ subdomain. */
function prodUrl(topo, id) {
  const n = node(topo, id);
  if (!n.public) throw new Error(`topology: node "${id}" không công khai`);
  const host = n.sub === '@' ? topo.prod.domain : `${n.sub}.${topo.prod.domain}`;
  return `${topo.prod.scheme}://${host}`;
}

/**
 * Tập biến môi trường do topology quản lý. gen-env.js ghi đúng những khoá này
 * và không đụng khoá nào khác.
 */
function managedEnv(topo, env = 'dev') {
  const out = {};
  topo.nodes.forEach((n) => {
    if (n.publicEnv) out[n.publicEnv] = publicUrl(topo, n.id, env);
    if (n.internalEnv) out[n.internalEnv] = internalUrl(topo, n.id, env);
  });
  out.KEYCLOAK_ISSUER = `${publicUrl(topo, 'auth', env)}/realms/${topo.dev.realm}`;
  // Cả lý do tồn tại của dev-proxy: cookie phiên đặt trên .tsudev.localhost thì
  // main và forum dùng chung, y như .tsudev.vn trên production. Ở chế độ ports
  // thì để trống — localhost:3000 và localhost:3001 vốn đã chung kho cookie nên
  // đặt domain vào chỉ tổ sai.
  out.NEXTAUTH_COOKIE_DOMAIN = topo.dev.mode === 'proxy' ? `.${topo.dev.domain}` : '';

  // Origin được phép gọi CHÉO tới service. Sau giai đoạn 4 trình duyệt đi qua BFF
  // nên danh sách này gần như không dùng tới — giữ lại như lưới chắn, và để
  // trống ở production là khoá hẳn (BFF không bị ảnh hưởng, nó gọi server↔server).
  out.CORS_ALLOWED_ORIGINS = topo.nodes
    .filter((n) => n.public && ['main', 'forum'].includes(n.id))
    .map((n) => publicUrl(topo, n.id, env))
    .join(',');

  // URL presign trả về cho TRÌNH DUYỆT, nên phải là host công khai. Bỏ trống thì
  // storage-service rơi về S3_ENDPOINT nội bộ và trình duyệt nhận URL trỏ
  // `http://minio:9000` — đúng cái bẫy S3_ENDPOINT/S3_PUBLIC_ENDPOINT mà
  // CLAUDE.md cảnh báo. Ở dev, cdn.<domain> do dev-proxy chuyển tới MinIO.
  out.S3_PUBLIC_ENDPOINT = publicUrl(topo, 'cdn', env);

  // Service chỉ nghe loopback ở máy dev. KHÔNG đặt biến này trong container:
  // bind 127.0.0.1 bên trong container là tự cắt liên lạc giữa các container.
  out.BIND_HOST = '127.0.0.1';
  return out;
}

/** Mọi cổng hợp lệ ở mọi môi trường — check.js dùng để bắt số lạ. */
function knownPorts(topo) {
  const set = new Set(topo.nodes.map((n) => n.port));
  Object.values(topo.overrides || {}).forEach((envOv) => {
    if (typeof envOv !== 'object') return;
    Object.values(envOv).forEach((o) => o && o.port && set.add(o.port));
  });
  set.add(topo.dev.proxyPort);
  return set;
}

module.exports = {
  ROOT,
  TOPOLOGY_PATH,
  loadTopology,
  node,
  port,
  internalUrl,
  publicUrl,
  prodUrl,
  managedEnv,
  knownPorts,
};

if (require.main === module) {
  const topo = loadTopology();
  console.log(`mode=${topo.dev.mode}\n`);
  console.log('Biến do topology quản lý:');
  Object.entries(managedEnv(topo)).forEach(([k, v]) => console.log(`  ${k}=${v}`));
  console.log('\nProduction:');
  topo.nodes
    .filter((n) => n.public)
    .forEach((n) => console.log(`  ${n.id.padEnd(6)} ${prodUrl(topo, n.id)}`));
}
