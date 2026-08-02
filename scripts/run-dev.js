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

const processes = [
  { name: 'user-service', type: 'service', cwd: path.join(ROOT, 'services/user-service') },
  { name: 'content-service', type: 'service', cwd: path.join(ROOT, 'services/content-service') },
  { name: 'storage-service', type: 'service', cwd: path.join(ROOT, 'services/storage-service') },
  { name: 'trust-service', type: 'service', cwd: path.join(ROOT, 'services/trust-service') },
  {
    name: 'frontend-main',
    type: 'next',
    port: 3000,
    urlKey: 'NEXT_PUBLIC_MAIN_URL',
    cwd: path.join(ROOT, 'apps/frontend-main'),
  },
  {
    name: 'frontend-forum',
    type: 'next',
    port: 3001,
    urlKey: 'NEXT_PUBLIC_FORUM_URL',
    cwd: path.join(ROOT, 'apps/frontend-forum'),
  },
];

const children = [];

function spawnProc(def) {
  const cwd = def.cwd || ROOT;
  // Per-app env: each Next frontend needs its own NEXTAUTH_URL (correct port)
  // so next-auth builds callback URLs against the right host.
  const childEnv = Object.assign({}, process.env);
  if (def.type === 'next' && def.port) {
    const appUrl = (process.env[def.urlKey] || `http://localhost:${def.port}`).replace(/\/+$/, '');
    childEnv.NEXTAUTH_URL = appUrl;
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
        [nodemonBin, '-L', '--watch', 'src', '--ext', 'js,json', '--exec', 'node src/index.js'],
        spawnOpts
      );
    } catch (err) {
      // fallback to npm script if resolution fails
      child = spawn('npm', ['run', 'dev'], spawnOpts);
    }
  } else if (def.type === 'next') {
    try {
      const nextBin = require.resolve('next/dist/bin/next', { paths: [cwd] });
      child = spawn(process.execPath, [nextBin, 'dev', '-p', String(def.port)], spawnOpts);
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
