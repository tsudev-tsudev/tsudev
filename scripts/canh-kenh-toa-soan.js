#!/usr/bin/env node
/**
 * CỔNG CANH: kênh nào của toà soạn đang im lặng mà không ai biết.
 *
 * Khác `newsroom:chan-doan` ở MỘT điểm quyết định: script này có MÃ THOÁT.
 * `chan-doan` là báo cáo để người đọc lần ra nguyên nhân, nên nó luôn thoát 0;
 * cổng thì phải trả lời được đạt/trượt cho một cái cron hay một job CI, và một
 * cổng không có mã thoát thì không phải cổng.
 *
 * Vì sao cần cả hai: `/docs` chết nhiều ngày trong khi `newsroom:check` in
 * "✔ Toà soạn ĐANG CHẠY THẬT" và `chan-doan` cho thấy mọi van đều mở - cả hai
 * đều đúng, vì cả hai hỏi "toà soạn có chạy không" chứ không hỏi "KÊNH NÀY đã
 * bao lâu không ra bài".
 *
 * CHỈ ĐỌC. Không ghi một dòng nào vào database, không gọi LLM, không gọi tick.
 *
 *   DATABASE_URL=<...> node scripts/canh-kenh-toa-soan.js
 *
 * Không truyền `DATABASE_URL` thì đọc từ `backup/production-env-*.txt`, giống
 * `scripts/chan-doan-toa-soan.js`. Đừng in giá trị đó ra đâu cả.
 *
 * Mã thoát:  0 = mọi kênh ổn   ·   1 = có kênh ĐỎ   ·   2 = script tự hỏng
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
    process.exit(2);
  }
  const line = fs
    .readFileSync(path.join(dir, bak), 'utf8')
    .split('\n')
    .find((l) => l.startsWith('DATABASE_URL='));
  if (!line) {
    console.error(`✘ ${bak} không có DATABASE_URL`);
    process.exit(2);
  }
  process.env.DATABASE_URL = line.slice('DATABASE_URL='.length).trim();
}

// Logic quyết định nằm trong service (đã biên dịch), KHÔNG viết lại ở đây - viết
// lại là có hai bản luật rồi chúng lệch nhau trong im lặng. `dist/` có sau
// `npm run build:services`.
const HEALTH = path.join(ROOT, 'services/newsroom-service/dist/channelHealth.js');
if (!fs.existsSync(HEALTH)) {
  console.error('✘ chưa có services/newsroom-service/dist/ - chạy `npm run build:services` trước');
  process.exit(2);
}
const { canhToaSoan, datCong, NGUONG_MAC_DINH } = require(HEALTH);

const { prisma } = require(path.join(ROOT, 'packages/db'));

// Mọi trạng thái phải có ký hiệu. Thiếu một cái thì dòng đó in ra `undefined` -
// và một cổng báo động mà tự nó in `undefined` thì người đọc sẽ ngờ cả kết luận.
const BIEU = { XANH: '✔', VANG: '!', DO: '✘', TAT: '·', KHONG_NGUON: '·' };

(async () => {
  const now = new Date();

  const [channels, sources, published] = await Promise.all([
    prisma.newsroomChannel.findMany({
      select: { target: true, enabled: true, dailyPostCap: true },
      orderBy: { target: 'asc' },
    }),
    prisma.newsroomSource.findMany({
      select: {
        label: true,
        kind: true,
        target: true,
        enabled: true,
        lastScanAt: true,
        lastError: true,
        createdAt: true,
      },
    }),
    // Lần gần nhất MỖI kênh đăng được một thứ. `ContentDraft` là chỗ duy nhất
    // biết bài thuộc kênh nào - `Post` không mang `target`, và `Doc` thì không
    // phân biệt được bài agent với tài liệu seed. Index `[status, target,
    // updatedAt]` phủ đúng truy vấn này.
    prisma.contentDraft.groupBy({
      by: ['target'],
      where: { status: 'PUBLISHED' },
      _max: { updatedAt: true },
    }),
  ]);

  const lanCuoi = new Map(published.map((p) => [String(p.target), p._max.updatedAt ?? null]));

  const ketLuan = canhToaSoan(
    channels.map((c) => ({
      target: String(c.target),
      enabled: c.enabled,
      sources: sources.filter((s) => String(s.target) === String(c.target)),
      lastPublishedAt: lanCuoi.get(String(c.target)) ?? null,
    })),
    now,
    NGUONG_MAC_DINH
  );

  console.log(
    `Cổng canh kênh toà soạn - ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC\n`
  );
  for (const k of ketLuan) {
    console.log(`${BIEU[k.trangThai]} ${k.target.padEnd(8)} ${k.lyDo}`);
  }

  const do_ = ketLuan.filter((k) => k.trangThai === 'DO');
  const vang = ketLuan.filter((k) => k.trangThai === 'VANG');
  console.log('');
  if (do_.length) {
    console.log(`✘ TRƯỢT - ${do_.length} kênh có vấn đề: ${do_.map((k) => k.target).join(', ')}`);
    console.log('  Lần ra nguyên nhân: npm run newsroom:chan-doan');
  } else {
    console.log('✔ ĐẠT - không kênh nào đang im lặng bất thường.');
  }
  // Cảnh báo KHÔNG làm trượt cổng, nhưng im luôn thì nó vô hình. Nói ra ở cả hai
  // nhánh: một nguồn ngủ 8 ngày đáng biết kể cả khi trang vẫn đầy bài.
  if (vang.length) {
    console.log(
      `! ${vang.length} cảnh báo (không chặn): ${vang.map((k) => `${k.target}/${k.ma}`).join(', ')}`
    );
  }

  await prisma.$disconnect();
  process.exit(datCong(ketLuan) ? 0 : 1);
})().catch(async (e) => {
  console.error('LỖI:', e.message);
  try {
    await prisma.$disconnect();
  } catch {
    /* đang hỏng rồi, đừng che mất lỗi gốc */
  }
  process.exit(2);
});
