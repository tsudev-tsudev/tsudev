#!/usr/bin/env node
'use strict';
// Cổng chặn hồi quy cho hợp đồng mạng. Chạy trong CI (job lint) và .husky/pre-push.
//
// Không có bước này thì cả cuộc tái cấu trúc chỉ mua được vài tháng: cổng
// hardcode sẽ mọc lại từng dòng một, đúng cách nó đã mọc ra 17 chỗ hiện nay.
//
// Ba khẳng định:
//   A. Không có literal `localhost:<cổng>` ngoài danh sách config/topology.allow.
//   B. Mọi số cổng xuất hiện trong literal đều phải có trong topology (bắt số lạ
//      ngay cả ở file đã được miễn trừ).
//   C. Cổng công bố trong docker-compose.yml khớp topology, hoặc có override
//      kèm lý do.
//
// Chạy: npm run topology:check

const fs = require('fs');
const path = require('path');
const { ROOT, loadTopology, knownPorts } = require('./load');

const ALLOW_PATH = path.join(ROOT, 'config', 'topology.allow');
const SCAN_DIRS = [
  'apps',
  'packages',
  'services',
  'scripts',
  'e2e',
  'config',
  'docker',
  '.github',
  // Tài liệu cũng phải khớp topology. Giai đoạn 3 đổi hình trạng mạng và bốn file
  // trong docs/ lặng lẽ nói sai — không cổng chặn nào bắt được, vì hồi đó docs/
  // nằm ngoài phạm vi quét.
  'docs',
  'infrastructure',
];
const SCAN_ROOT_FILES = ['.env.example', 'docker-compose.yml', 'render.yaml', 'README.md'];
const SCAN_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.yml', '.yaml', '.sh', '.md']);
const SCAN_BASENAME = new Set(['Dockerfile']);
const SKIP_DIR = new Set([
  'node_modules',
  '.next',
  '.open-next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  'test-results',
]);

// [::1] gộp vào vì `*.localhost` phân giải ra IPv6 — xem §2.2 của kế hoạch.
const LITERAL = /(?:localhost|127\.0\.0\.1|\[::1\]):(\d{2,5})/g;

function loadAllow() {
  if (!fs.existsSync(ALLOW_PATH)) return new Set();
  return new Set(
    fs
      .readFileSync(ALLOW_PATH, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter(Boolean)
  );
}

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      yield* walk(full);
    } else if (SCAN_EXT.has(path.extname(e.name)) || SCAN_BASENAME.has(e.name)) {
      yield full;
    }
  }
}

function collectHits() {
  const files = [];
  SCAN_DIRS.forEach((d) => files.push(...walk(path.join(ROOT, d))));
  SCAN_ROOT_FILES.forEach((f) => {
    const abs = path.join(ROOT, f);
    if (fs.existsSync(abs)) files.push(abs);
  });

  const hits = [];
  files.forEach((abs) => {
    const rel = path.relative(ROOT, abs);
    // dev-proxy.js là phần hiện thực của chính hệ thống topology (như
    // scripts/topology/*): bảng định tuyến trong chú thích của nó là tài liệu,
    // không phải hardcode lén.
    if (
      rel.startsWith(path.join('scripts', 'topology')) ||
      rel === path.join('scripts', 'dev-proxy.js') ||
      rel.startsWith('config/topology')
    ) {
      return;
    }
    const text = fs.readFileSync(abs, 'utf8');
    text.split(/\r?\n/).forEach((line, i) => {
      let m;
      LITERAL.lastIndex = 0;
      while ((m = LITERAL.exec(line))) {
        hits.push({ rel, line: i + 1, port: Number(m[1]), text: line.trim().slice(0, 100) });
      }
    });
  });
  return hits;
}

function checkCompose(topo, errors) {
  const abs = path.join(ROOT, 'docker-compose.yml');
  if (!fs.existsSync(abs)) return;
  const ov = (topo.overrides && topo.overrides.docker) || {};
  const byPort = new Map(topo.nodes.map((n) => [n.port, n]));

  fs.readFileSync(abs, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      const m = line.match(/^\s*-\s*['"](\d{2,5}):(\d{2,5})['"]\s*$/);
      if (!m) return;
      const [, host, container] = m.map(Number);
      const n = byPort.get(container);
      if (!n) return; // cổng container không thuộc topology — không phải việc của check này
      const allowed = ov[n.id] && ov[n.id].port ? ov[n.id].port : n.port;
      if (host !== allowed) {
        errors.push(
          `docker-compose.yml:${i + 1} — "${
            n.id
          }" công bố ${host}:${container}, topology nói ${allowed}. ` +
            `Sửa compose, hoặc khai overrides.docker.${n.id} kèm lý do.`
        );
      }
    });
}

function main() {
  const topo = loadTopology();
  const allow = loadAllow();
  const ports = knownPorts(topo);
  const hits = collectHits();

  const errors = [];
  const unlisted = new Map();
  const usedAllow = new Set();

  hits.forEach((h) => {
    if (!ports.has(h.port)) {
      errors.push(`${h.rel}:${h.line} — cổng ${h.port} KHÔNG có trong topology.\n      ${h.text}`);
      return;
    }
    if (allow.has(h.rel)) {
      usedAllow.add(h.rel);
      return;
    }
    if (!unlisted.has(h.rel)) unlisted.set(h.rel, []);
    unlisted.get(h.rel).push(h);
  });

  unlisted.forEach((list, rel) => {
    errors.push(
      `${rel} — hardcode cổng ${[...new Set(list.map((h) => h.port))].join(', ')} ` +
        `(dòng ${list.map((h) => h.line).join(', ')}).\n` +
        `      Lấy từ scripts/topology/load.js, hoặc thêm vào config/topology.allow kèm lý do.`
    );
  });

  checkCompose(topo, errors);

  // Mục allow không còn hit nào là rác — dọn để danh sách miễn trừ không phình.
  // Chỉ báo khi không còn lỗi nào khác: một hardcode sai cổng cũng làm mục allow
  // của chính file đó "hết tác dụng", báo kèm chỉ khiến lỗi thật bị loãng.
  const stale = errors.length ? [] : [...allow].filter((a) => !usedAllow.has(a));
  if (stale.length) {
    errors.push(
      `config/topology.allow có ${stale.length} mục đã hết tác dụng, xoá đi:\n      ` +
        stale.join('\n      ')
    );
  }

  if (errors.length) {
    console.error(`\n✗ topology:check — ${errors.length} vấn đề\n`);
    errors.forEach((e) => console.error(`  • ${e}\n`));
    process.exit(1);
  }

  console.log(
    `✓ topology:check — ${hits.length} literal cổng, tất cả khớp topology ` +
      `(${allow.size} file được miễn trừ có chủ ý)`
  );
}

if (require.main === module) main();
