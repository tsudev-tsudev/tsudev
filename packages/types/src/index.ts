// Hằng số và hợp đồng nhẹ dùng chung giữa các service và frontend.

// Thang vai trò TUYẾN TÍNH. AUTHOR nằm TRÊN VIP có chủ đích: khách VIP của Con
// dấu KHÔNG được đăng bài (hasAtLeastRole(VIP, 'AUTHOR') = false), còn nhân sự
// đăng bài thì đương nhiên vượt ngưỡng VIP. OWNER là trần tuyệt đối, chỉ tài
// khoản tsudev giữ, và KHÔNG bao giờ cấp được bằng dữ liệu (xem ASSIGNABLE_ROLES
// ở auth-service) - đúng nguyên tắc "ai ghi được vào bảng role là tự leo thang".
export const ROLES = ['GUEST', 'MEMBER', 'VIP', 'AUTHOR', 'MODERATOR', 'ADMIN', 'OWNER'] as const;

/** Vai trò hợp lệ. Là union chứ không phải `string` - xem ghi chú ở hasAtLeastRole. */
export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Readonly<Record<Role, number>> = {
  GUEST: 0,
  MEMBER: 1,
  VIP: 2,
  AUTHOR: 3,
  MODERATOR: 4,
  ADMIN: 5,
  OWNER: 6,
};

/** Thu hẹp một giá trị không rõ nguồn (DB, JWT claim) về Role. */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * `userRole` có đạt tối thiểu `required` không?
 *
 * HAI THAM SỐ ĐƯỢC ĐỐI XỬ KHÁC NHAU CÓ CHỦ ĐÍCH:
 *
 * - `userRole` là `unknown` vì nó đến từ ngoài (cột DB, claim trong token).
 *   Không nhận dạng được ⇒ trả false. Fail closed.
 * - `required` là `Role` vì nó do LẬP TRÌNH VIÊN viết ra tại chỗ gọi, luôn là
 *   literal. Ràng bằng union nên gõ sai là lỗi biên dịch.
 *
 * Bản JS cũ nhận cả hai là `string` và tra bảng bằng `ROLE_RANK[required] ?? 0`.
 * Hệ quả: gõ nhầm `required` (ví dụ 'MODERATR') làm vế phải thành 0 và hàm trả
 * TRUE với mọi vai trò - fail open. Cả 7 nơi gọi hiện tại đều truyền literal
 * đúng nên chưa từng kích hoạt, nhưng nó chờ sẵn ở đó. Union type dập lớp lỗi
 * này tại thời điểm biên dịch thay vì trông vào việc gõ đúng.
 *
 * Đổi hành vi kèm theo: trước đây vai trò rác vẫn qua được ngưỡng 'GUEST'
 * (0 >= 0). Nay không. Không nơi gọi nào dùng ngưỡng 'GUEST' nên không ảnh
 * hưởng gì đang chạy.
 */
export function hasAtLeastRole(userRole: unknown, required: Role): boolean {
  if (!isRole(userRole)) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

// ---------------------------------------------------------------------------
// Ân hạn xác minh email
//
// Tài khoản chưa xác minh email VẪN đăng nhập và đọc được, nhưng sau một thời
// gian ân hạn thì các hành động nhạy cảm (đăng bài, nâng vai trò tự phục vụ) bị
// chặn tới khi xác minh. Đây là chặn MỀM: đủ để không biến email thành rào chắn
// tuyệt đối (nếu Resend hỏng thì cả hệ vẫn dùng được trong cửa sổ ân hạn), vẫn
// đóng cửa dần với tài khoản không chịu xác minh.
//
// Cùng một phép tính chạy ở BA nơi (auth-service, content-service, frontend) nên
// nó sống ở đây, không nhân bản. Nhân bản là cách hai nơi lệch ngưỡng mà không ai
// biết.
// ---------------------------------------------------------------------------

/** Số ngày ân hạn kể từ khi tạo tài khoản. */
export const EMAIL_VERIFY_GRACE_DAYS = 7;
export const EMAIL_VERIFY_GRACE_MS = EMAIL_VERIFY_GRACE_DAYS * 24 * 60 * 60 * 1000;

/** Chuẩn hoá Date | chuỗi ISO | null về mốc thời gian (ms), hoặc null nếu không đọc được. */
function toMillis(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Email của tài khoản có ĐỦ DÙNG cho hành động nhạy cảm không?
 *
 * True nếu đã xác minh, HOẶC chưa xác minh nhưng còn trong cửa sổ ân hạn tính từ
 * `createdAt`. Fail SAFE cho người dùng thật: `createdAt` không đọc được (dữ liệu
 * lạ) thì coi như còn ân hạn - phía service vẫn có `requireRole`/`requireAuthor`
 * chặn thật, hàm này chỉ thêm một lớp, không phải cổng duy nhất.
 */
export function emailUsable(
  emailVerifiedAt: Date | string | null | undefined,
  createdAt: Date | string | null | undefined,
  now: Date | number = Date.now()
): boolean {
  if (toMillis(emailVerifiedAt) != null) return true;
  const created = toMillis(createdAt);
  if (created == null) return true;
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return nowMs < created + EMAIL_VERIFY_GRACE_MS;
}

/**
 * Ân hạn còn lại (ms) cho tài khoản CHƯA xác minh; 0 nếu đã xác minh hoặc đã hết
 * hạn. Phục vụ đếm ngược trên giao diện - đừng dùng làm cổng, dùng `emailUsable`.
 */
export function emailGraceRemainingMs(
  emailVerifiedAt: Date | string | null | undefined,
  createdAt: Date | string | null | undefined,
  now: Date | number = Date.now()
): number {
  if (toMillis(emailVerifiedAt) != null) return 0;
  const created = toMillis(createdAt);
  if (created == null) return 0;
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return Math.max(0, created + EMAIL_VERIFY_GRACE_MS - nowMs);
}
