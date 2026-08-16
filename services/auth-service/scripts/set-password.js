#!/usr/bin/env node
'use strict'
/**
 * Đặt mật khẩu cho MỘT tài khoản. Công cụ vận hành, chạy tay.
 *
 *   # local (mặc định — .env ở gốc repo trỏ DB dev)
 *   NEW_PASSWORD='…' node services/auth-service/scripts/set-password.js <username>
 *
 *   # PRODUCTION — phải xuất DATABASE_URL TRƯỚC, nếu không nó nhắm DB local
 *   set -a; . <(grep '^DATABASE_URL=' backup/production-env-2026-08-16.txt); set +a
 *   NEW_PASSWORD='…' node services/auth-service/scripts/set-password.js <username>
 *
 * Mật khẩu đọc từ biến môi trường NEW_PASSWORD, KHÔNG phải từ tham số dòng
 * lệnh: tham số nằm trong `ps` và trong lịch sử shell, nên một mật khẩu truyền
 * kiểu đó là một mật khẩu đã bị lộ.
 *
 * ⚠️ SCRIPT IN RA HOST CỦA DATABASE TRƯỚC KHI GHI, và đó không phải trang trí.
 * Bản đầu không in gì cả: nó nạp `.env` ở gốc repo (trỏ DB dev), nên chạy với ý
 * định sửa production thì nó báo "thành công" — thành công thật, chỉ là trên
 * máy dev. Người chạy tin rằng tài khoản production đã có mật khẩu, còn thực tế
 * cột `passwordHash` ở đó vẫn rỗng và không đăng nhập được. Đã xảy ra thật.
 *
 * VÌ SAO CẦN
 *
 * Sau khi gỡ Keycloak, tài khoản cũ không có `passwordHash`. Đường tự phục hồi
 * là "quên mật khẩu", nhưng nó chỉ chạy khi tài khoản có địa chỉ email THẬT —
 * mà `resolveUser()` tạo tài khoản với `<username>@tsudev.local`, một tên miền
 * không nhận được thư. Script này là đường vào cho những tài khoản đó.
 *
 * Nó cũng tăng `sessionVersion`, tức là đá mọi phiên đang mở của tài khoản đó.
 * Đặt lại mật khẩu mà để phiên cũ sống tiếp thì không lấy lại được quyền kiểm
 * soát nếu tài khoản đã bị chiếm.
 */

require('dotenv').config()
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') })
}

const { prisma } = require('@tsudev/db')
const { hashPassword, checkPasswordPolicy } = require('../dist/password')

/**
 * Đọc toàn bộ stdin.
 *
 * Chặn ở 4KB: không mật khẩu nào dài thế, và đọc vô hạn từ một ống bị bỏ quên
 * sẽ treo script trong im lặng — đúng kiểu hỏng khó chẩn đoán nhất.
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => {
      data += c
      if (data.length > 4096) reject(new Error('stdin quá dài cho một mật khẩu'))
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

async function main() {
  const username = process.argv[2]

  if (!username) {
    console.error("Dùng: node services/auth-service/scripts/set-password.js <username> <<'MK'")
    console.error('      mật khẩu ở đây')
    console.error('      MK')
    process.exit(2)
  }

  // STDIN trước, NEW_PASSWORD sau.
  //
  // Chỉ bỏ ký tự xuống dòng CUỐI CÙNG do heredoc thêm vào — KHÔNG trim hai đầu.
  // Khoảng trắng có thể là một phần thật của mật khẩu, và tự ý cắt nó nghĩa là
  // đặt một mật khẩu KHÁC cái người dùng nghĩ họ vừa đặt, rồi họ không đăng
  // nhập được và không hiểu vì sao.
  const fromStdin = process.stdin.isTTY ? '' : (await readStdin()).replace(/\r?\n$/, '')
  const password = fromStdin || process.env.NEW_PASSWORD

  if (!password) {
    console.error('Thiếu mật khẩu. Truyền qua stdin (heredoc) hoặc biến NEW_PASSWORD.')
    console.error('KHÔNG truyền qua tham số dòng lệnh — nó nằm trong `ps` và lịch sử shell.')
    process.exit(2)
  }

  // CÙNG chính sách mà người dùng thật phải qua. Một đường vào của quản trị mà
  // nới lỏng quy tắc là một đường vào yếu hơn mọi đường khác.
  const problem = checkPasswordPolicy(password)
  if (problem) {
    console.error(`Mật khẩu không đạt chính sách: ${problem}`)
    process.exit(1)
  }

  // In TRƯỚC khi ghi, và in host chứ không in cả URL (URL chứa mật khẩu DB).
  let host = '(không đọc được DATABASE_URL)'
  try {
    host = new URL(process.env.DATABASE_URL).host
  } catch (e) {
    /* URL hỏng — phép ghi bên dưới sẽ tự thất bại và nói rõ hơn */
  }
  const looksLocal = /^(localhost|127\.0\.0\.1|\[::1\])/.test(host)
  console.log(`Database: ${host}${looksLocal ? '  ← DB LOCAL, KHÔNG phải production' : ''}`)

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) {
    console.error(`Không có tài khoản "${username}".`)
    process.exit(1)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
  })
  console.log(
    `Đã đặt mật khẩu cho "${username}" (${user.role}) trên ${host}. Mọi phiên cũ đã bị đăng xuất.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
