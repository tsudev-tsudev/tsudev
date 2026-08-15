#!/usr/bin/env node
'use strict';
// Xuất toàn bộ dữ liệu của các bảng SẮP BỊ XOÁ ra JSON, trước khi chạy migration
// DROP ở giai đoạn 4. Đây là ĐƯỜNG LÙI DUY NHẤT: migration đã áp dụng là bất
// biến, và DROP thì không có undo.
//
// Chạy trên chính DB sắp bị đổi:
//   DATABASE_URL=... node scripts/export-legacy-data.js
//
// Ghi ra backup/legacy-<ngày>/<Model>.json + manifest.json. Thoát khác 0 nếu có
// bảng nào không đọc được — thà dừng còn hơn xuất thiếu rồi tưởng là đã xong.
//
// ⚠️ SCRIPT NÀY NAY LUÔN BÁO "đã qua migration DROP" — ĐỪNG TIN NÓ.
// Cửa vào bên dưới kiểm `prisma[model]`, mà Prisma client đã được sinh từ schema
// ĐÃ XOÁ các model đó, nên điều kiện luôn đúng bất kể DB thật ra sao. Giữ file
// lại làm hiện vật lịch sử. Muốn biết DB thật có bảng cũ hay không thì hỏi thẳng
// catalog, đừng hỏi Prisma client:
//
//   SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
//   WHERE n.nspname='public' AND c.relkind='r';

const fs = require('fs');
const path = require('path');
const { prisma } = require('@tsudev/db');

// Thứ tự đặt theo quan hệ cha→con để đọc lại cho dễ, không ảnh hưởng lúc xuất.
const MODELS = [
  // Diễn đàn
  'category',
  'board',
  'thread',
  'forumPost',
  'reaction',
  // Chợ ký quỹ
  'listing',
  'order',
  // Tin nhắn
  'conversation',
  'conversationParticipant',
  'message',
  // Kiểm duyệt
  'report',
  'modAction',
  'ban',
  // Uy tín thành viên
  'reputationEvent',
];

const stamp = new Date().toISOString().slice(0, 10);
const outDir = path.join(__dirname, '..', 'backup', `legacy-${stamp}`);

async function main() {
  // Sau khi migration DROP đã chạy, Prisma client không còn delegate nào trong
  // MODELS. Đó là trạng thái ĐÚNG, không phải lỗi — thoát 0 và nói rõ, thay vì
  // báo "15 bảng không xuất được" khiến người chạy tưởng hỏng.
  if (!MODELS.some((m) => prisma[m])) {
    console.log('DB này đã qua migration DROP của giai đoạn 4 — không còn bảng cũ để xuất.');
    console.log('Bản xuất trước đó nằm trong backup/legacy-<ngày>/.');
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });

  const manifest = { exportedAt: new Date().toISOString(), counts: {}, failures: [] };

  for (const m of MODELS) {
    if (!prisma[m]) {
      manifest.failures.push(`${m}: không có trong Prisma client`);
      continue;
    }
    try {
      const rows = await prisma[m].findMany();
      const file = path.join(outDir, `${m}.json`);
      fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
      manifest.counts[m] = rows.length;
      console.log(`  ${String(rows.length).padStart(5)}  ${m}`);
    } catch (e) {
      manifest.failures.push(`${m}: ${e.message.split('\n')[0]}`);
      console.error(`  LỖI   ${m}: ${e.message.split('\n')[0]}`);
    }
  }

  // Cột User.reputation cũng biến mất — xuất riêng, không xuất cả bảng User
  // (bảng đó được GIỮ, chỉ mất một cột).
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, reputation: true },
    });
    fs.writeFileSync(
      path.join(outDir, 'user-reputation.json'),
      JSON.stringify(users, null, 2),
      'utf8'
    );
    manifest.counts['user.reputation'] = users.length;
    console.log(`  ${String(users.length).padStart(5)}  user.reputation (chỉ cột bị xoá)`);
  } catch (e) {
    manifest.failures.push(`user.reputation: ${e.message.split('\n')[0]}`);
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const total = Object.values(manifest.counts).reduce((a, b) => a + b, 0);
  console.log(`\n→ ${outDir}`);
  console.log(`  ${total} bản ghi, ${Object.keys(manifest.counts).length} bảng`);

  if (manifest.failures.length) {
    console.error(`\n✗ ${manifest.failures.length} bảng KHÔNG xuất được:`);
    manifest.failures.forEach((f) => console.error(`  • ${f}`));
    console.error('\nĐỪNG chạy migration DROP khi bản xuất còn thiếu.');
    process.exitCode = 1;
    return;
  }
  console.log('\n✓ Xuất đủ. Giữ thư mục này cho tới khi chắc chắn không cần quay lại.');
}

main()
  .catch((e) => {
    console.error('export-legacy-data thất bại:', e && (e.stack || e.message));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
