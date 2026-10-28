#!/usr/bin/env node
/**
 * DỌN dữ liệu tích luỹ của Toà soạn Agent AI.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * VÌ SAO SCRIPT NÀY TỒN TẠI
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Toà soạn chạy từ tháng 8/2026, mỗi giờ một nhịp, và `grep -rln "deleteMany"`
 * trên `scripts/` cùng `services/newsroom-service/src/` trả về RỖNG tới ngày
 * 28/10/2026. Nghĩa là nó chỉ tích vào, chưa bao giờ xả ra. Ba bảng phình không
 * giới hạn:
 *
 *   DraftRevision   lưu TOÀN VĂN bài viết cho MỌI lần sửa
 *   NewsroomEvent   payload JSON thô, mỗi việc một hàng
 *   AgentRun        một hàng mỗi lượt chạy agent
 *
 * Neon free cho 0,5 GB storage. Vượt là treo, và lúc đó `lib/api` nuốt lỗi thành
 * giá trị rỗng nên MỌI trang công khai trả 200 với nội dung trống - đúng sự cố
 * đã sống hai tháng (xem docs/refactor-tsudev-2026-q4.md §0).
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ĐỌC TRƯỚC KHI CHẠY
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ Nếu hạn mức đang vượt là CU-GIỜ (compute) chứ không phải storage thì script
 * này KHÔNG giúp gì. Hai hạn mức khác nhau cần hai cách chữa trái ngược. Mở Neon
 * console → project → Usage và đọc xem dòng nào đỏ TRƯỚC khi xoá bất cứ thứ gì.
 *
 * ⚠️ Postgres KHÔNG trả dung lượng về cho nhà cung cấp sau khi DELETE - không gian
 * chỉ được tái dùng trong cùng bảng. Nên sau khi chạy, con số storage trên Neon
 * console có thể KHÔNG giảm, và đó là bình thường, không phải thất bại. Muốn trả
 * lại thật thì cần `VACUUM FULL` (khoá bảng) - script in ra câu lệnh, không tự chạy.
 *
 *   node scripts/don-toa-soan.js --dry-run     ĐẾM thôi, không xoá (mặc định)
 *   node scripts/don-toa-soan.js --that        XOÁ thật
 *   node scripts/don-toa-soan.js --that --giu-ban 3 --qua-ngay 45
 *
 * Mặc định là `--dry-run`: một script xoá dữ liệu mà hành vi mặc định là xoá thì
 * chỉ cần gõ thiếu một cờ là mất dữ liệu.
 *
 * Mã thoát: 0 = xong · 1 = có việc cần người quyết · 2 = script tự hỏng
 */
const { prisma } = require('@tsudev/db');

const args = process.argv.slice(2);
const co = (c) => args.includes(c);
const giaTri = (c, md) => {
  const i = args.indexOf(c);
  if (i < 0) return md;
  const n = parseInt(args[i + 1], 10);
  return Number.isNaN(n) ? md : n;
};

const THAT = co('--that');
/// Số bản sửa GẦN NHẤT giữ lại cho mỗi bản nháp. Không giữ 0: lịch sử sửa là thứ
/// duy nhất cho thấy agent đã sửa bài theo góp ý nào, và đó là dữ liệu vận hành
/// thật của toà soạn, không phải rác.
const GIU_BAN = giaTri('--giu-ban', 3);
/// Tuổi (ngày) để một sự kiện ĐÃ XONG hoặc một lượt chạy được coi là xoá được.
const QUA_NGAY = giaTri('--qua-ngay', 45);

const moc = new Date(Date.now() - QUA_NGAY * 86400000);

const dong = (s) => console.log(s);
const so = (n) => n.toLocaleString('vi-VN');

/// Dung lượng THẬT của một bảng, gồm cả index và TOAST.
///
/// `pg_total_relation_size` chứ không phải `pg_relation_size`: văn bản dài được
/// Postgres đẩy sang bảng TOAST riêng, và `DraftRevision.contentMd` đúng là loại
/// đó - đo bằng `pg_relation_size` sẽ báo bảng nặng nhất là bảng nhẹ nhất.
async function coBang(ten) {
  // `quote_ident` là BẮT BUỘC, không phải cho gọn: truyền tên bảng làm tham số
  // rồi để Postgres tự ép sang `regclass` thì nó HẠ CHỮ THƯỜNG tên đó, và bảng
  // của repo này đặt tên CamelCase - kết quả là
  // `relation "draftrevision" does not exist`. Đã xảy ra ở bản đầu.
  //
  // Tên bảng được nội suy thẳng vào câu `count(*)` vì tham số không dùng được ở
  // vị trí định danh. An toàn ở đây vì `ten` chỉ đến từ hằng `BANG` viết cứng
  // trong file này - KHÔNG được truyền giá trị từ bên ngoài vào hàm này.
  const r = await prisma.$queryRawUnsafe(
    `SELECT pg_total_relation_size(quote_ident($1)::regclass) AS b,
            (SELECT count(*) FROM "${ten}") AS n`,
    ten
  );
  return { byte: Number(r[0].b), hang: Number(r[0].n) };
}

const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;

async function main() {
  dong(`\nDỌN TOÀ SOẠN - chế độ: ${THAT ? '🔴 XOÁ THẬT' : '✅ chỉ đếm (--dry-run)'}`);
  dong(`  giữ ${GIU_BAN} bản sửa gần nhất mỗi bản nháp · xoá dữ liệu cũ hơn ${QUA_NGAY} ngày\n`);

  // --- Đo TRƯỚC ------------------------------------------------------------
  const BANG = ['DraftRevision', 'NewsroomEvent', 'AgentRun', 'ContentDraft', 'TopicIdea'];
  const truoc = {};
  let tongTruoc = 0;
  dong('  Dung lượng hiện tại:');
  for (const t of BANG) {
    truoc[t] = await coBang(t);
    tongTruoc += truoc[t].byte;
    dong(`    ${t.padEnd(16)} ${so(truoc[t].hang).padStart(8)} hàng   ${mb(truoc[t].byte)}`);
  }
  dong(`    ${'TỔNG'.padEnd(16)} ${''.padStart(8)}        ${mb(tongTruoc)}\n`);

  // --- 1. DraftRevision: giữ N bản gần nhất mỗi bản nháp --------------------
  //
  // Dùng SQL thô với window function. Prisma không diễn đạt được "giữ N hàng
  // mới nhất mỗi nhóm" trong một câu, và làm bằng vòng lặp JavaScript là một
  // truy vấn cho mỗi bản nháp - trên một database tính tiền theo thời gian
  // compute còn thức thì đó là cách đắt nhất có thể.
  const sqlRevision = `
    WITH xep AS (
      SELECT id, row_number() OVER (PARTITION BY "draftId" ORDER BY seq DESC) AS hang
      FROM "DraftRevision"
    )
    SELECT id FROM xep WHERE hang > $1
  `;
  const duRevision = await prisma.$queryRawUnsafe(sqlRevision, GIU_BAN);
  dong(`  1. DraftRevision quá ${GIU_BAN} bản gần nhất: ${so(duRevision.length)} hàng`);

  // --- 2. NewsroomEvent đã xong/đã chết và quá hạn --------------------------
  //
  // CHỈ xoá trạng thái cuối cùng. `PENDING` là hàng đợi đang chạy; xoá nó là xoá
  // việc chưa làm. `DEAD` thì xoá được - nhưng chỉ sau hạn, vì trang quản trị có
  // nút "Hồi sinh việc đã dừng" và nút đó đọc đúng những hàng này.
  const whereEvent = {
    status: { in: ['DONE', 'DEAD'] },
    createdAt: { lt: moc },
  };
  const demEvent = await prisma.newsroomEvent.count({ where: whereEvent });
  const demDead = await prisma.newsroomEvent.count({
    where: { status: 'DEAD', createdAt: { gte: moc } },
  });
  dong(`  2. NewsroomEvent DONE/DEAD cũ hơn ${QUA_NGAY} ngày: ${so(demEvent)} hàng`);
  if (demDead > 0)
    dong(
      `     (giữ lại ${so(
        demDead
      )} hàng DEAD còn trong hạn - nút "Hồi sinh việc đã dừng" đọc chúng)`
    );

  // --- 3. AgentRun đã kết thúc và quá hạn ----------------------------------
  //
  // `endedAt: not null` là điều kiện BẮT BUỘC: một hàng có `endedAt` null là một
  // lượt chạy đang giữ lease. Xoá nó làm mất bản ghi lease và công việc đó có thể
  // bị nhận lại lần thứ hai.
  const whereRun = { endedAt: { not: null, lt: moc } };
  const demRun = await prisma.agentRun.count({ where: whereRun });
  const demDangChay = await prisma.agentRun.count({ where: { endedAt: null } });
  dong(`  3. AgentRun đã kết thúc, cũ hơn ${QUA_NGAY} ngày: ${so(demRun)} hàng`);
  if (demDangChay > 0)
    dong(`     (giữ lại ${so(demDangChay)} lượt CHƯA kết thúc - chúng đang giữ lease)`);

  const tongXoa = duRevision.length + demEvent + demRun;
  dong(`\n  Tổng sẽ xoá: ${so(tongXoa)} hàng\n`);

  if (!THAT) {
    dong('  Chưa xoá gì. Chạy lại với `--that` để xoá thật.');
    dong('  Trước đó: mở Neon console → Usage, xác nhận dòng đỏ là STORAGE chứ');
    dong('  không phải COMPUTE TIME - dọn dữ liệu không chữa được hạn mức compute.\n');
    return;
  }

  if (tongXoa === 0) {
    dong('  Không có gì để xoá.\n');
    return;
  }

  // --- Xoá thật ------------------------------------------------------------
  //
  // Xoá theo LÔ 5.000 id. Một câu `DELETE ... WHERE id IN (<200k id>)` vượt giới
  // hạn tham số của driver và cũng giữ một giao dịch rất dài - trên Neon free,
  // một giao dịch dài là thời gian compute phải trả tiền.
  const LO = 5000;
  let daXoa = 0;

  for (let i = 0; i < duRevision.length; i += LO) {
    const ids = duRevision.slice(i, i + LO).map((r) => r.id);
    const r = await prisma.draftRevision.deleteMany({ where: { id: { in: ids } } });
    daXoa += r.count;
    dong(`     DraftRevision: ${so(daXoa)}/${so(duRevision.length)}`);
  }

  const rEvent = await prisma.newsroomEvent.deleteMany({ where: whereEvent });
  dong(`     NewsroomEvent: ${so(rEvent.count)}`);

  const rRun = await prisma.agentRun.deleteMany({ where: whereRun });
  dong(`     AgentRun: ${so(rRun.count)}`);

  // --- Đo SAU --------------------------------------------------------------
  dong('\n  Dung lượng sau khi xoá:');
  let tongSau = 0;
  for (const t of BANG) {
    const s = await coBang(t);
    tongSau += s.byte;
    const chenh = truoc[t].byte - s.byte;
    dong(
      `    ${t.padEnd(16)} ${so(s.hang).padStart(8)} hàng   ${mb(s.byte)}` +
        (chenh > 0 ? `   (-${mb(chenh)})` : '')
    );
  }
  dong(`    ${'TỔNG'.padEnd(16)} ${''.padStart(8)}        ${mb(tongSau)}\n`);

  dong('  ⚠️ Con số storage trên Neon console có thể KHÔNG giảm ngay, và đó là');
  dong('     bình thường: Postgres không trả không gian về cho nhà cung cấp sau');
  dong('     DELETE, nó chỉ tái dùng trong cùng bảng. Muốn trả lại thật:');
  dong('');
  dong('       VACUUM FULL "DraftRevision";');
  dong('       VACUUM FULL "NewsroomEvent";');
  dong('       VACUUM FULL "AgentRun";');
  dong('');
  dong('     Script KHÔNG tự chạy chúng: VACUUM FULL khoá bảng và viết lại toàn');
  dong('     bộ, nên nó phải được chạy có người ngồi canh, không phải trong cron.\n');
}

main()
  .catch((e) => {
    console.error('✘ dọn toà soạn:', e && e.message ? e.message : e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
