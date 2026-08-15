#!/usr/bin/env node
'use strict';
// Lightweight dev orchestrator for local development (no Docker required)
// - Loads root .env (if present) and injects env into child processes
// - Writes a copy of root .env to `apps/*/.env.local` to help Next.js in dev
// - Spawns service and frontend `npm run dev` commands and prefixes logs

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { writeEnvLocal } = require('./write-env-local');

const ROOT = process.cwd();
const ROOT_ENV = path.join(ROOT, '.env');

function loadRootEnv() {
  if (!fs.existsSync(ROOT_ENV)) return;
  try {
    require('dotenv').config({ path: ROOT_ENV });
    console.log('Loaded .env via dotenv');
    return;
  } catch (e) {
    // fallback to manual parse
    const content = fs.readFileSync(ROOT_ENV, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      let key = trimmed.substring(0, eq).trim();
      let val = trimmed.substring(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    });
    console.log('Loaded .env (manual parse)');
  }
}

loadRootEnv();

// Mỗi app cần NEXTAUTH_URL riêng nên không copy thẳng .env — xem write-env-local.js.
writeEnvLocal();

// Enable polling-based file watchers to be robust when working on mounted
// Windows drives (WSL /mnt). This helps Next.js (chokidar) and other
// tools notice file changes reliably without Docker.
process.env.CHOKIDAR_USEPOLLING = process.env.CHOKIDAR_USEPOLLING || 'true';
// increase polling interval to reduce IO overhead on WSL-mounted drives
process.env.CHOKIDAR_INTERVAL = process.env.CHOKIDAR_INTERVAL || '300';
process.env.WATCHPACK_POLLING = process.env.WATCHPACK_POLLING || '300';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log('Polling watchers enabled:', {
  CHOKIDAR_USEPOLLING: process.env.CHOKIDAR_USEPOLLING,
  CHOKIDAR_INTERVAL: process.env.CHOKIDAR_INTERVAL,
  WATCHPACK_POLLING: process.env.WATCHPACK_POLLING,
});

const { loadTopology, port: portOf, publicUrl } = require('./topology/load');
const TOPO = loadTopology();

// DEV_PROXY=0 là đường lui: bỏ qua proxy, quay về gõ thẳng cổng của từng app
// như trước giai đoạn 3, phòng khi dev-proxy hỏng giữa chừng.
const USE_PROXY = TOPO.dev.mode === 'proxy' && process.env.DEV_PROXY !== '0';

const processes = [
  { name: 'content-service', type: 'service', cwd: path.join(ROOT, 'services/content-service') },
  { name: 'storage-service', type: 'service', cwd: path.join(ROOT, 'services/storage-service') },
  { name: 'trust-service', type: 'service', cwd: path.join(ROOT, 'services/trust-service') },
  {
    name: 'frontend-main',
    type: 'next',
    port: portOf(TOPO, 'main'),
    url: USE_PROXY ? publicUrl(TOPO, 'main') : `http://localhost:${portOf(TOPO, 'main')}`,
    cwd: path.join(ROOT, 'apps/frontend-main'),
  },
];

// Proxy phải lên TRƯỚC hai app Next: nó là thứ người dùng gõ vào trình duyệt,
// và bật sẵn thì lần tải đầu không rơi vào ECONNREFUSED.
if (USE_PROXY) processes.unshift({ name: 'dev-proxy', type: 'proxy', cwd: ROOT });

const children = [];

function spawnProc(def) {
  const cwd = def.cwd || ROOT;
  // Per-app env: each Next frontend needs its own NEXTAUTH_URL (correct port)
  // so next-auth builds callback URLs against the right host.
  const childEnv = Object.assign({}, process.env);
  if (def.type === 'next' && def.port) {
    // NEXTAUTH_URL phải là URL CÔNG KHAI (qua proxy), không phải cổng nội bộ —
    // next-auth dựng callback từ đây, sai là đăng nhập nhảy về sai origin.
    childEnv.NEXTAUTH_URL = String(def.url).replace(/\/+$/, '');
    childEnv.PORT = String(def.port);
  }
  const spawnOpts = {
    env: childEnv,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
    cwd,
  };

  let child;
  if (def.type === 'service') {
    try {
      const nodemonBin = require.resolve('nodemon/bin/nodemon.js', { paths: [cwd] });
      child = spawn(
        process.execPath,
        // Theo dõi .ts và chạy dist/: services đã sang TypeScript. `tsc -b` ở đây
        // là biên dịch tăng dần trên toàn solution nên chỉ tốn vài trăm ms mỗi lần.
        [
          nodemonBin,
          '-L',
          '--watch',
          'src',
          '--ext',
          'ts,json',
          '--exec',
          'tsc -b ../.. && node dist/index.js',
        ],
        spawnOpts
      );
    } catch (err) {
      // fallback to npm script if resolution fails
      child = spawn('npm', ['run', 'dev'], spawnOpts);
    }
  } else if (def.type === 'proxy') {
    child = spawn(process.execPath, [path.join(ROOT, 'scripts/dev-proxy.js')], spawnOpts);
  } else if (def.type === 'next') {
    try {
      const nextBin = require.resolve('next/dist/bin/next', { paths: [cwd] });
      // Sau proxy thì Next chỉ cần nghe loopback — không việc gì phải phơi ra
      // mọi giao diện mạng của máy.
      const args = [nextBin, 'dev', '-p', String(def.port)];
      if (USE_PROXY) args.push('-H', '127.0.0.1');
      child = spawn(process.execPath, args, spawnOpts);
    } catch (err) {
      child = spawn('npm', ['run', 'dev'], spawnOpts);
    }
  } else {
    child = spawn('npm', ['run', 'dev'], spawnOpts);
  }

  child.stdout.on('data', (data) => {
    process.stdout.write(`[${def.name}] ${data.toString()}`);
  });
  child.stderr.on('data', (data) => {
    process.stderr.write(`[${def.name}] ${data.toString()}`);
  });
  child.on('exit', (code, signal) => {
    console.log(`[${def.name}] exited code=${code} signal=${signal}`);
  });
  children.push(child);
}

processes.forEach(spawnProc);

function shutdown() {
  console.log('Shutting down children...');
  children.forEach((c) => {
    try {
      c.kill('SIGINT');
    } catch (e) {
      /* tiến trình con đã thoát */
    }
  });
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
