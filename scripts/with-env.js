#!/usr/bin/env node
'use strict';
// Chạy một lệnh với .env Ở GỐC REPO đã được nạp.
//
// npm KHÔNG đọc .env, và Prisma CLI chỉ tìm .env cạnh schema (packages/db/) —
// nên `npm run db:migrate` chết với "Environment variable not found:
// DATABASE_URL" trên máy sạch, dù đó là bước nằm giữa `npm run dev:full`, lệnh
// chạy-lần-đầu được ghi trong CLAUDE.md.
//
// dotenv KHÔNG ghi đè biến đã có, nên ở CI (DATABASE_URL đến từ env của job,
// không có tệp .env) đây là no-op.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { spawn } = require('child_process');
const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('with-env: thiếu lệnh để chạy');
  process.exit(2);
}
spawn(cmd, args, { stdio: 'inherit', shell: false }).on('exit', (code, signal) => {
  process.exit(signal ? 1 : code ?? 1);
});
