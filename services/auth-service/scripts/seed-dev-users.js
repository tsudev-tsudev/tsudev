#!/usr/bin/env node
'use strict'
/**
 * Đặt mật khẩu cho ba tài khoản dev.
 *
 *   node services/auth-service/scripts/seed-dev-users.js
 *
 * CỐ Ý TÁCH KHỎI packages/db/prisma/seed.js, cùng lý do với
 * services/trust-service/scripts/seed-demo.js: seed chính thức chỉ chứa dữ
 * liệu tham chiếu - thứ mà MỌI môi trường, kể cả production, đều cần. Mật khẩu
 * đã biết trước thì ngược lại: đó chính xác là loại dữ liệu không bao giờ được
 * mọc lên ở production.
 *
 * Thay cho `E2E_BYPASS_KEYCLOAK=1` + `devpass`, thứ cho phép đăng nhập bằng BẤT
 * KỲ username nào và chỉ được gác sau một biến môi trường. Ngày 16/08/2026 bản
 * production đã từng mang theo cờ đó. Ở đây mật khẩu là hash Argon2id thật
 * trong DB, đi qua đúng đường mà người dùng thật đi.
 */

require('dotenv').config()
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') })
}

// CHẶN CỨNG, không phải cảnh báo. Nếu script này chạy nhầm ở production thì ba
// tài khoản - trong đó có một ADMIN - sẽ có mật khẩu nằm công khai trong repo.
if (process.env.NODE_ENV === 'production') {
  console.error(
    '[seed-dev-users] TỪ CHỐI chạy ở production: script này đặt mật khẩu đã biết trước.'
  )
  process.exit(1)
}

const { prisma } = require('@tsudev/db')
const { hashPassword } = require('../dist/password')

// Mật khẩu dev, giống nhau cho cả ba. Dài hơn MIN_PASSWORD_LEN vì nó đi qua
// đúng chính sách mà người dùng thật phải qua - không có đường vòng nào.
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'tsudev-dev-2026!'

const USERS = [
  { username: 'tsudev', role: 'ADMIN' },
  { username: 'alice', role: 'MEMBER' },
  { username: 'bob', role: 'VIP' },
]

async function main() {
  const passwordHash = await hashPassword(DEV_PASSWORD)
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { username: u.username },
      // Email đã xác minh sẵn: luồng xác minh cần gửi thư thật, và dev không
      // có RESEND_API_KEY. Đây là điều DUY NHẤT script này bỏ qua.
      update: { passwordHash, emailVerifiedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      create: {
        username: u.username,
        email: `${u.username}@tsudev.local`,
        displayName: u.username,
        role: u.role,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    })
  }
  console.log(`Đặt mật khẩu dev cho: ${USERS.map((u) => `${u.username} (${u.role})`).join(', ')}`)
  console.log(`Mật khẩu: ${DEV_PASSWORD}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
