// Nhãn tiếng Việt cho các enum của Project. Một chỗ duy nhất — trang công khai,
// trang chi tiết và trang quản trị phải gọi cùng một tên cho cùng một trạng thái.

export const KIND_LABEL: Record<string, string> = {
  APP: 'Ứng dụng',
  TOOL: 'Công cụ',
  LIBRARY: 'Thư viện',
  SERVICE: 'Dịch vụ',
};

export const STATUS_LABEL: Record<string, string> = {
  WIP: 'Đang phát triển',
  BETA: 'Thử nghiệm',
  STABLE: 'Ổn định',
  ARCHIVED: 'Ngừng phát triển',
};

// `tone` khớp bộ tone của Badge trong @tsudev/ui. REGISTERED dùng `success` vì
// đó là khẳng định đã có giấy chứng nhận — đừng dùng cho PENDING.
import type { BadgeTone } from '@tsudev/ui';

// `tone` là union của Badge, không phải string: một tông sai chính tả sẽ lặng
// lẽ rơi về mặc định trên giao diện thay vì báo lỗi.
export type CopyrightMeta = { label: string; tone: BadgeTone };

export const COPYRIGHT: Record<string, CopyrightMeta> = {
  NONE: { label: 'Chưa đăng ký bản quyền', tone: 'outline' },
  PENDING: { label: 'Đang chờ cấp bản quyền', tone: 'warning' },
  REGISTERED: { label: 'Đã đăng ký bản quyền', tone: 'success' },
};

/**
 * Tra bảng bản quyền an toàn: `copyrightStatus` tới từ API nên là chuỗi tự do.
 * Bản cũ viết `COPYRIGHT[x] || COPYRIGHT.NONE` ở từng trang — cùng một dự phòng
 * chép ba lần, và không có gì bảo đảm ba lần đó giống nhau.
 */
export const copyrightMeta = (status: string | null | undefined): CopyrightMeta =>
  (status ? COPYRIGHT[status] : undefined) ?? COPYRIGHT.NONE!;

export const KINDS = Object.keys(KIND_LABEL);
export const STATUSES = Object.keys(STATUS_LABEL);
export const COPYRIGHT_STATUSES = Object.keys(COPYRIGHT);
