#!/usr/bin/env node
'use strict'
/**
 * Đặt mật khẩu cho MỘT tài khoản. Công cụ vận hành, chạy tay.
 *
 *   node services/auth-service/scripts/set-password.js <username>
 *
 * Mật khẩu đọc từ biến môi trường NEW_PASSWORD, KHÔNG phải từ tham số dòng
 * lệnh: tham số nằm trong `ps` và trong lịch sử shell, nên một mật khẩu truyền
 * kiểu đó là một mật khẩu đã bị lộ.
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

async function main() {
  const username = process.argv[2]
  const password = process.env.NEW_PASSWORD

  if (!username) {
    console.error(
      'Dùng: NEW_PASSWORD=... node services/auth-service/scripts/set-password.js <username>'
    )
    process.exit(2)
  }
  if (!password) {
    console.error('Thiếu NEW_PASSWORD. Truyền qua biến môi trường, không phải tham số dòng lệnh.')
    process.exit(2)
  }

  // CÙNG chính sách mà người dùng thật phải qua. Một đường vào của quản trị mà
  // nới lỏng quy tắc là một đường vào yếu hơn mọi đường khác.
  const problem = checkPasswordPolicy(password)
  if (problem) {
    console.error(`Mật khẩu không đạt chính sách: ${problem}`)
    process.exit(1)
  }

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
  console.log(`Đã đặt mật khẩu cho "${username}" (${user.role}). Mọi phiên cũ đã bị đăng xuất.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
