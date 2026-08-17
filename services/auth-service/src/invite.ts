import { createHash, randomBytes } from 'crypto'

import { prisma } from '@tsudev/db'
import { hasAtLeastRole } from '@tsudev/types'
import type { Role } from '@tsudev/types'

import { constantTimeEqual } from './tokens'

/**
 * Mã mời vào Con dấu tín nhiệm.
 *
 * Con dấu là vùng chỉ-dành-cho-khách-mời. Đổi một mã hợp lệ = được nâng lên
 * `Role.VIP`, và cổng thật là `requireRole('VIP')` ở trust-service — thứ đọc
 * `User.role` từ DB và fail closed. Ở đây KHÔNG dựng hệ phân quyền thứ hai;
 * xem gotcha REQUIRE_ROLE_ENFORCEMENT ở CLAUDE.md.
 *
 * Ba bất biến của tệp này, cả ba đều hỏng ÂM THẦM nếu làm sai:
 *
 *  1. DB chỉ giữ SHA-256 của mã. Cùng lý do với AuthToken.tokenHash — một bản
 *     sao DB bị rò không được phép thành một xấp mã dùng được.
 *  2. Đếm lượt bằng MỘT câu lệnh có điều kiện. Đọc-rồi-ghi cho hai người cùng
 *     tiêu lượt cuối cùng, và không có gì báo lỗi.
 *  3. Trần cứng là VIP, ghi trong MÃ chứ không trong dữ liệu. Mã mời là đường
 *     leo thang đặc quyền: nếu bậc vai trò do dòng dữ liệu quyết định thì ai
 *     ghi được vào bảng đó là ghi được cho mình quyền ADMIN.
 */

/** Trần cứng. Không bao giờ đọc từ dữ liệu — xem bất biến 3. */
export const INVITE_GRANTS_ROLE: Role = 'VIP'

/** Không có I, L, O, 0, 1 — B32 của RFC 4648 vốn đã bỏ chúng. Đọc qua điện thoại được. */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Ba nhóm 5 ký tự = 75 bit entropy. Đủ để dò là vô vọng, ngắn để đọc được. */
const GROUPS = 3
const GROUP_LEN = 5

/** Dạng chuẩn hoá: `TSU-XXXXX-XXXXX-XXXXX`. Regex khớp phần thân đã bỏ gạch. */
const BODY_RE = new RegExp(`^[A-Z2-7]{${GROUPS * GROUP_LEN}}$`)

export const hashInviteCode = (raw: string): string =>
  createHash('sha256').update(raw).digest('hex')

/**
 * Chuẩn hoá mã người dùng gõ vào: bỏ khoảng trắng/gạch, viết hoa, bỏ tiền tố.
 *
 * Trả về chuỗi rỗng nếu không đúng hình dạng — người gọi coi đó là "không khớp"
 * chứ không phải lỗi riêng, để không tiết lộ mã hợp lệ trông như thế nào.
 */
export function normalizeInviteCode(supplied: string): string {
  const cleaned = supplied.toUpperCase().replace(/[\s-]/g, '').replace(/^TSU/, '')
  return BODY_RE.test(cleaned) ? cleaned : ''
}

/** Dạng hiển thị cho người vận hành chép đi. Chỉ hiện ĐÚNG MỘT LẦN, lúc cấp. */
export function formatInviteCode(body: string): string {
  const groups: string[] = []
  for (let i = 0; i < body.length; i += GROUP_LEN) groups.push(body.slice(i, i + GROUP_LEN))
  return `TSU-${groups.join('-')}`
}

/** Sinh mã bằng CSPRNG. Trả về cả phần thân (để băm) và dạng hiển thị. */
export function generateInviteCode(): { body: string; display: string } {
  let bits = ''
  for (const b of randomBytes(GROUPS * GROUP_LEN)) bits += b.toString(2).padStart(8, '0')
  let body = ''
  for (let i = 0; body.length < GROUPS * GROUP_LEN; i += 5) {
    body += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]
  }
  return { body, display: formatInviteCode(body) }
}

export type RedeemOutcome =
  | { ok: true; role: Role; invite: { id: string; label: string }; alreadyVip: boolean }
  | { ok: false; reason: 'invalid' | 'exhausted' }

/**
 * Đổi mã lấy vai trò VIP.
 *
 * `reason` cố ý chỉ có HAI giá trị. "Mã không tồn tại", "mã hết hạn" và "mã đã
 * thu hồi" đều trả `invalid` — phân biệt chúng biến ô nhập mã thành công cụ dò
 * xem mã nào từng tồn tại.
 */
export async function redeemInvite(
  user: { id: string; role: string },
  supplied: string
): Promise<RedeemOutcome> {
  const body = normalizeInviteCode(supplied)
  if (!body) return { ok: false, reason: 'invalid' }

  const codeHash = hashInviteCode(body)
  const invite = await prisma.trustInvite.findUnique({ where: { codeHash } })
  // So sánh theo thời gian hằng dù đã tra bằng khoá duy nhất: `findUnique` chỉ
  // chứng minh có dòng khớp chỉ mục, phép so sánh này là thứ khoá lại bất biến
  // "không rò rỉ qua thời gian trả lời" nếu sau này ai đó đổi sang findFirst.
  if (!invite || !constantTimeEqual(invite.codeHash, codeHash)) {
    return { ok: false, reason: 'invalid' }
  }
  if (invite.revokedAt) return { ok: false, reason: 'invalid' }
  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: 'invalid' }
  }

  // Người đã đổi mã này rồi: trả về thành công mà KHÔNG tiêu thêm lượt. Ràng
  // buộc @@unique([inviteId, userId]) là thứ chặn thật; nhánh này chỉ để họ
  // không thấy một lỗi khó hiểu khi bấm hai lần.
  const already = await prisma.trustInviteRedemption.findUnique({
    where: { inviteId_userId: { inviteId: invite.id, userId: user.id } },
  })
  if (already) {
    return {
      ok: true,
      role: promotedRole(user.role),
      invite: { id: invite.id, label: invite.label },
      alreadyVip: true,
    }
  }

  if (invite.usedCount >= invite.maxUses) return { ok: false, reason: 'exhausted' }

  const nextRole = promotedRole(user.role)
  try {
    await prisma.$transaction(async (tx) => {
      // Điều kiện `usedCount: invite.usedCount` là phép so-sánh-rồi-đổi: hai
      // người cùng tiêu lượt cuối thì chỉ một người đếm được 1 dòng đã đổi.
      const claimed = await tx.trustInvite.updateMany({
        where: {
          id: invite.id,
          usedCount: invite.usedCount,
          revokedAt: null,
        },
        data: { usedCount: { increment: 1 } },
      })
      if (claimed.count !== 1) throw new RaceLost()

      await tx.trustInviteRedemption.create({ data: { inviteId: invite.id, userId: user.id } })

      // KHÔNG hạ vai trò: một ADMIN đổi mã vẫn là ADMIN. `promotedRole` lo phần
      // đó, và `sessionVersion` KHÔNG tăng — nâng quyền không phải lý do để đá
      // người ta ra khỏi phiên đang dùng, và phiên cũ mang vai trò cũ chỉ có
      // ít quyền hơn chứ không nhiều hơn.
      if (nextRole !== user.role) {
        await tx.user.update({ where: { id: user.id }, data: { role: nextRole } })
      }
    })
  } catch (e) {
    if (e instanceof RaceLost) return { ok: false, reason: 'exhausted' }
    throw e
  }

  return {
    ok: true,
    role: nextRole,
    invite: { id: invite.id, label: invite.label },
    alreadyVip: false,
  }
}

class RaceLost extends Error {}

/**
 * Vai trò sau khi đổi mã.
 *
 * Trần cứng ở VIP theo cả hai chiều: người thấp hơn được nâng LÊN đúng VIP,
 * người cao hơn giữ nguyên. Mã mời không bao giờ cấp MODERATOR/ADMIN và cũng
 * không bao giờ hạ ai xuống.
 */
export function promotedRole(current: string): Role {
  return hasAtLeastRole(current, INVITE_GRANTS_ROLE) ? (current as Role) : INVITE_GRANTS_ROLE
}
