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

// ---------------------------------------------------------------------------
// Phân trang chuẩn - DATA_TABLE.md mục 8 + SEARCH_AND_FILTER.md mục 7.
//
// Đặt ở @tsudev/types vì cả hai phía đều cần cùng một sự thật: máy chủ để CHẶN,
// giao diện để dựng bộ chọn. Hai bên tự giữ danh sách mốc riêng là cách bộ chọn
// hiện mốc 200 trong khi máy chủ vẫn cắt ở 100, và không gì báo lỗi.
// ---------------------------------------------------------------------------

/** Năm mốc chuẩn. Không thêm, không bớt, KHÔNG có "Tất cả" - đó là một truy vấn
 *  không có trần. */
export const PAGE_SIZES = [10, 20, 50, 100, 200] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

/** Mặc định lần đầu vào một bảng. */
export const DEFAULT_PAGE_SIZE: PageSize = 10;

/** Trần cứng phía máy chủ. MUST NOT phục vụ lớn hơn với BẤT KỲ lý do gì, kể cả
 *  cho quản trị viên hay tác vụ nội bộ - cần nhiều hơn thì đi đường xuất tệp. */
export const MAX_PAGE_SIZE: PageSize = 200;

/** Từ mốc này trở lên phải chịu giới hạn tần suất riêng, chặt hơn (mục 8.4).
 *  Đó là CÁI GIÁ của việc nâng trần từ 100 lên 200, và là điều kiện của nó. */
export const LARGE_PAGE_SIZE: PageSize = 100;

/**
 * Quy một giá trị `page_size` bất kỳ về mốc hợp lệ.
 *
 * Giá trị lạ `MUST` được quy về **mốc gần nhất không lớn hơn nó**, `MUST NOT`
 * trả lỗi: một tham số hiển thị sai không đáng làm hỏng cả trang. Nhỏ hơn mốc
 * nhỏ nhất, hoặc không đọc được, thì về mặc định.
 *
 *   15 -> 10 · 99 -> 50 · 250 -> 200 · 3 -> 10 · "abc" -> 10
 */
export function normalizePageSize(raw: unknown): PageSize {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < PAGE_SIZES[0]) return DEFAULT_PAGE_SIZE;
  let out: PageSize = PAGE_SIZES[0];
  for (const size of PAGE_SIZES) if (size <= n) out = size;
  return out;
}

/** `page` bắt đầu từ 1. Giá trị lạ về 1 thay vì báo lỗi, cùng lý do như trên. */
export function normalizePage(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export type Paging = {
  page: number;
  pageSize: PageSize;
  /** Dùng thẳng cho Prisma. */
  skip: number;
  take: PageSize;
};

/** Đọc `page` + `page_size` từ query của một request đã chuẩn hoá. */
export function parsePaging(query: {
  page?: unknown;
  page_size?: unknown;
  pageSize?: unknown;
}): Paging {
  const page = normalizePage(query.page);
  const pageSize = normalizePageSize(query.page_size ?? query.pageSize);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export type PageMeta = {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

/**
 * Khối `meta` chuẩn của phản hồi danh sách.
 *
 * `total_pages` tối thiểu là 1: bảng rỗng vẫn là "trang 1 trên 1", còn 0 làm
 * giao diện phân trang hiện "trang 1 / 0".
 */
export function pageMeta(total: number, paging: Paging): PageMeta {
  return {
    total,
    page: paging.page,
    page_size: paging.pageSize,
    total_pages: Math.max(1, Math.ceil(total / paging.pageSize)),
  };
}
