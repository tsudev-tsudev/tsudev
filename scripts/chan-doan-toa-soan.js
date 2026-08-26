#!/usr/bin/env node
/**
 * Vì sao nhịp toà soạn nhận 202 mà KHÔNG có lượt agent nào chạy.
 *
 * `npm run newsroom:check` chứng minh được rằng nhịp tới nơi và token khớp, rồi
 * dừng ở đó: nó chỉ đếm `AgentRun`, nên khi số đó đứng im nó chỉ liệt kê được
 * "một trong hai nhánh" mà không nói được là nhánh nào. Script này phân định
 * bằng cách hỏi thẳng những cái van mà `tick()` hỏi, theo ĐÚNG thứ tự `tick()`
 * hỏi chúng - van nào đóng trước thì nó là nguyên nhân, những cái sau không còn
 * ý nghĩa.
 *
 * CHỈ ĐỌC. Không ghi một dòng nào vào database, không gọi LLM, không gọi tick.
 *
 *   DATABASE_URL=<...> node scripts/chan-doan-toa-soan.js
 *
 * Không truyền `DATABASE_URL` thì nó đọc từ `backup/production-env-*.txt` giống
 * `scripts/kiem-toa-soan.sh`. Đừng in giá trị đó ra đâu cả.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

if (!process.env.DATABASE_URL) {
  const dir = path.join(ROOT, 'backup');
  const bak = fs.existsSync(dir)
    ? fs.readdirSync(dir).find((f) => /^production-env-.*\.txt$/.test(f))
    : null;
  if (!bak) {
    console.error('✘ không có DATABASE_URL và không thấy backup/production-env-*.txt');
    process.exit(1);
  }
  const line = fs
    .readFileSync(path.join(dir, bak), 'utf8')
    .split('\n')
    .find((l) => l.startsWith('DATABASE_URL='));
  if (!line) {
    console.error(`✘ ${bak} không có DATABASE_URL`);
    process.exit(1);
  }
  process.env.DATABASE_URL = line.slice('DATABASE_URL='.length);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const iso = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : '-');
const utcDayStart = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

(async () => {
  const day = utcDayStart();
  console.log(`Bây giờ: ${iso(new Date())} UTC  ·  mốc ngày: ${iso(day)} UTC\n`);

  // --- Van 1: có việc để làm không -----------------------------------------
  const byStatus = Object.fromEntries(
    (await prisma.newsroomEvent.groupBy({ by: ['status'], _count: { _all: true } })).map((r) => [
      r.status,
      r._count._all,
    ])
  );
  console.log('1. Hàng đợi sự kiện:', JSON.stringify(byStatus));
  const pending = byStatus.PENDING || 0;
  const dead = byStatus.DEAD || 0;

  // --- Van 2: nhà cung cấp có bị đánh dấu cạn hôm nay không ------------------
  const exhausted = await prisma.newsroomEvent.findMany({
    where: { type: 'provider.exhausted', createdAt: { gte: day } },
    select: { createdAt: true, payload: true },
  });
  console.log(
    '2. provider.exhausted HÔM NAY:',
    exhausted.length
      ? exhausted.map((e) => `${e.payload?.provider}@${iso(e.createdAt)}`).join(', ')
      : 'không có'
  );

  // --- Van 3: sổ Neuron của ta ----------------------------------------------
  const agg = await prisma.agentRun.aggregate({
    _sum: { neuronsUsed: true },
    where: { startedAt: { gte: day } },
  });
  const budget = parseInt(process.env.NEWSROOM_DAILY_NEURON_BUDGET || '8000', 10);
  console.log(`3. Neuron theo sổ ta hôm nay: ${agg._sum.neuronsUsed ?? 0} / ${budget}`);

  // --- Van 4: kênh có bật không ---------------------------------------------
  console.log('4. Kênh:');
  for (const c of await prisma.newsroomChannel.findMany())
    console.log(
      `     ${c.target}  autonomy=${c.autonomy}  enabled=${c.enabled}  cap=${c.dailyPostCap}`
    );

  // --- Van 5: có nguồn đề tài không -----------------------------------------
  const srcs = await prisma.newsroomSource.findMany({
    select: {
      label: true,
      kind: true,
      target: true,
      enabled: true,
      lastScanAt: true,
      lastError: true,
    },
    orderBy: { target: 'asc' },
  });
  console.log('5. Nguồn đề tài:');
  const perTarget = {};
  for (const s of srcs) {
    perTarget[s.target] = (perTarget[s.target] || 0) + (s.enabled ? 1 : 0);
    console.log(
      `     ${s.target}  ${s.kind}  enabled=${s.enabled}  quét=${iso(
        s.lastScanAt
      )}  ${s.label.slice(0, 30)}` + (s.lastError ? `  LỖI: ${s.lastError.slice(0, 60)}` : '')
    );
  }
  for (const t of ['BLOG', 'DOC', 'PROJECT'])
    if (!perTarget[t]) console.log(`     ⚠️ ${t}: KHÔNG có nguồn nào đang bật`);

  // --- Van 6: đầu ra ---------------------------------------------------------
  const lastPost = await prisma.post.findFirst({
    orderBy: { publishedAt: 'desc' },
    select: { publishedAt: true },
  });
  console.log(
    `6. Đầu ra: Post mới nhất ${iso(lastPost?.publishedAt)} · Doc ${await prisma.doc.count({
      where: { deletedAt: null },
    })} · AgentRun 24h ${await prisma.agentRun.count({
      where: { startedAt: { gte: new Date(Date.now() - 864e5) } },
    })}`
  );

  // --- Nhật ký gần nhất ------------------------------------------------------
  console.log('\nSự kiện gần nhất:');
  for (const e of await prisma.newsroomEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { createdAt: true, type: true, status: true, payload: true },
  }))
    console.log(
      `  ${iso(e.createdAt)}  ${e.status.padEnd(7)} ${e.type}  ${JSON.stringify(e.payload).slice(
        0,
        80
      )}`
    );

  // --- Có dấu hiệu MÁY chạy hôm nay không -----------------------------------
  //
  // Đây là phép đo phân định `NEWSROOM_ENABLED`, và nó phải loại trừ sự kiện do
  // NGƯỜI tạo: bấm "Duyệt đăng" sinh `publish.requested` với actorKind="human"
  // ngay cả khi toà soạn tắt ngóm, nên đếm tất tần tật sẽ kết luận ngược.
  const machineToday = await prisma.newsroomEvent.count({
    where: { createdAt: { gte: day }, actorKind: { not: 'human' } },
  });

  // --- Kết luận --------------------------------------------------------------
  console.log('\n--- Kết luận ---');
  console.log(`   (sự kiện do MÁY tạo hôm nay: ${machineToday})`);
  if (!machineToday) {
    // `tick()` thoát ở dòng đầu khi công tắc tắt - TRƯỚC mọi lệnh ghi nhật ký.
    // Mọi đường thoát KHÁC đều để lại dấu, nên số 0 tuyệt đối chỉ có một nghĩa.
    console.log('✘ KHÔNG có sự kiện máy nào hôm nay ⇒ tick thoát ở dòng đầu.');
    console.log(
      "  ⇒ NEWSROOM_ENABLED chưa phải 'true' ở Render. Đây là kết luận, không phải phỏng đoán:"
    );
    console.log(
      '     mọi đường thoát khác của tick() đều để lại dấu (budget.exhausted, scan.skipped, scan.failed).'
    );
  } else if (exhausted.length) {
    console.log('✘ Nhà cung cấp đã bị đánh dấu CẠN HÔM NAY - tick thoát sớm. Đặt lại 00:00 UTC.');
  } else if ((agg._sum.neuronsUsed ?? 0) >= budget) {
    console.log('✘ Van ngân sách Neuron của ta đã đóng.');
  } else if (!pending) {
    console.log('· Hàng đợi KHÔNG có việc PENDING nào. Hệ khoẻ, chỉ là đang rảnh.');
  } else {
    console.log('✔ Toà soạn ĐANG CHẠY. Các van đều mở và hàng đợi có việc.');
  }
  if (pending > 20)
    console.log(
      `· Tồn ${pending} việc PENDING. Mỗi nhịp nhặt 5 và nhịp là mỗi giờ ⇒ cần ~${Math.ceil(
        pending / 5
      )} giờ để rút hết. Gõ thêm nhịp bằng "npm run newsroom:check" nếu muốn nhanh hơn.`
    );
  if (dead)
    console.log(`· ${dead} sự kiện đang DEAD - bấm "Hồi sinh việc đã dừng" ở /admin/newsroom.`);
  if (!perTarget.DOC)
    console.log('· Kênh DOC không có nguồn nào ⇒ /docs sẽ không bao giờ có bài của agent.');

  await prisma.$disconnect();
})().catch((e) => {
  console.error('LỖI:', e.message);
  process.exit(1);
});
