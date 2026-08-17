#!/usr/bin/env node
'use strict';
// Đồng bộ .env và .env.example theo config/topology.json.
//
// Cố ý KHÔNG viết lại cả file: .env.example mang phần lớn tài liệu về biến môi
// trường của repo này, ghi đè nó là mất tài liệu. Cách làm:
//   - khoá đã có  → chỉ thay GIÁ TRỊ tại chỗ, giữ nguyên chú thích quanh nó
//   - khoá chưa có → thêm vào cuối, trong một khối có dấu mốc
//
// Chạy: npm run topology:gen  (thêm --check để chỉ báo lệch, không ghi)

const fs = require('fs');
const path = require('path');
const { ROOT, loadTopology, managedEnv, managedProdEnv } = require('./load');

const BEGIN = '# >>> topology: sinh tự động, đừng sửa tay >>>';
const END = '# <<< topology <<<';
// Hai nhóm biến khác hẳn nhau: .env* mang URL DEV, còn .env.production mang URL
// PRODUCTION mà Next nướng vào bundle lúc build. Dùng chung một bộ là đưa
// localhost lên production.
const TARGETS = [
  { file: '.env', vars: managedEnv },
  { file: '.env.example', vars: managedEnv },
  { file: 'apps/frontend-main/.env.production', vars: managedProdEnv },
];

function syncFile(file, vars, { check }) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return { file, skipped: true, changes: [] };

  const original = fs.readFileSync(abs, 'utf8');
  const changes = [];
  const remaining = new Map(Object.entries(vars));

  // Bước 0 - gỡ khối mốc ra TRƯỚC. Nếu để lại, bước 1 sẽ "tìm thấy" khoá ngay
  // trong khối do chính mình sinh ra, `remaining` rỗng, rồi bước 2 xoá khối đi
  // mà không dựng lại - mỗi lần chạy lại báo lệch dù không có gì đổi.
  const blockRe = new RegExp(`\\n*${escapeRe(BEGIN)}[\\s\\S]*?${escapeRe(END)}\\n*`, 'g');
  const stripped = original.replace(blockRe, '\n');

  // Bước 1 - thay giá trị tại chỗ cho khoá khai bên ngoài khối mốc.
  const lines = stripped.split(/\r?\n/).map((line) => {
    const m = line.match(/^(\s*)([A-Z0-9_]+)\s*=(.*)$/);
    if (!m) return line;
    const [, indent, key, oldRaw] = m;
    if (!remaining.has(key)) return line;
    const want = remaining.get(key);
    remaining.delete(key);
    const old = oldRaw.trim().replace(/^["']|["']$/g, '');
    if (old === want) return line;
    changes.push(`${key}: ${old || '(rỗng)'} → ${want}`);
    return `${indent}${key}=${want}`;
  });

  // Bước 2 - khoá còn lại đi vào khối mốc ở cuối file.
  let body = lines.join('\n').replace(/\n{3,}$/, '\n');

  if (remaining.size) {
    remaining.forEach((v, k) => {
      // Khoá đã có sẵn đúng giá trị trong khối cũ thì không phải "thiếu".
      if (!new RegExp(`^\\s*${k}\\s*=\\s*${escapeRe(v)}\\s*$`, 'm').test(original)) {
        changes.push(`${k}: (thiếu) → ${v}`);
      }
    });
    const block = [...remaining].map(([k, v]) => `${k}=${v}`).join('\n');
    body = `${body.replace(/\n+$/, '')}\n\n${BEGIN}\n${block}\n${END}\n`;
  } else if (!body.endsWith('\n')) {
    body += '\n';
  }

  if (body !== original && !check) fs.writeFileSync(abs, body, 'utf8');
  return { file, changes, drifted: body !== original };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * `wrangler.jsonc` KHÔNG được sinh tự động - nó là cấu hình phát hành, có bình
 * luận và nhiều khối không liên quan tới topology. Nhưng nó PHẢI khai đủ mọi
 * biến `internalEnv`, nếu không biến rơi về giá trị dự phòng
 * `http://localhost:<port>` trong `lib/services.ts`, và Worker gọi vào chính nó.
 *
 * Đã xảy ra thật: thêm `auth-service` vào topology nhưng quên khai
 * `AUTH_SERVICE_URL` ở đây ⇒ đăng nhập ở production hỏng hoàn toàn, trong khi
 * `/api/auth/providers` vẫn trả về đúng nên nhìn qua thì tưởng đã xong.
 *
 * Chỉ kiểm SỰ CÓ MẶT, không kiểm giá trị: URL production đến từ Render/
 * Cloudflare chứ không suy ra được từ topology.
 */
function checkWranglerVars(topo) {
  const file = 'apps/frontend-main/wrangler.jsonc';
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return { file, missing: [], skipped: true };
  const body = fs.readFileSync(abs, 'utf8');
  const missing = topo.nodes
    .filter((n) => n.internalEnv)
    .map((n) => n.internalEnv)
    .filter((name) => !new RegExp(`"${escapeRe(name)}"\\s*:`).test(body));
  return { file, missing };
}

function main() {
  const check = process.argv.includes('--check');
  const topo = loadTopology();

  let drifted = false;
  TARGETS.forEach(({ file, vars }) => {
    const r = syncFile(file, vars(topo), { check });
    if (r.skipped) return console.log(`- ${file} (không có, bỏ qua)`);
    if (!r.drifted) return console.log(`✓ ${file} khớp topology`);
    drifted = true;
    console.log(`${check ? '✗' : '↻'} ${file}`);
    r.changes.forEach((c) => console.log(`    ${c}`));
  });

  const w = checkWranglerVars(topo);
  if (w.skipped) {
    console.log(`- ${w.file} (không có, bỏ qua)`);
  } else if (w.missing.length) {
    drifted = true;
    console.log(`✗ ${w.file} thiếu biến: ${w.missing.join(', ')}`);
    console.log('    Thêm BẰNG TAY - tệp này không được sinh tự động.');
  } else {
    console.log(`✓ ${w.file} khai đủ biến service`);
  }

  if (check && drifted) {
    console.error(
      '\n✗ Cấu hình lệch topology. Chạy: npm run topology:gen (và sửa tay wrangler.jsonc nếu được nhắc)'
    );
    process.exit(1);
  }
  if (!check && drifted) console.log('\nĐã đồng bộ. Khởi động lại dev để nạp giá trị mới.');
}

if (require.main === module) main();
module.exports = { syncFile };
