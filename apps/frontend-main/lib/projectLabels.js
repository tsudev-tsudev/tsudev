// Nhãn tiếng Việt cho các enum của Project. Một chỗ duy nhất — trang công khai,
// trang chi tiết và trang quản trị phải gọi cùng một tên cho cùng một trạng thái.

export const KIND_LABEL = {
  APP: 'Ứng dụng',
  TOOL: 'Công cụ',
  LIBRARY: 'Thư viện',
  SERVICE: 'Dịch vụ',
};

export const STATUS_LABEL = {
  WIP: 'Đang phát triển',
  BETA: 'Thử nghiệm',
  STABLE: 'Ổn định',
  ARCHIVED: 'Ngừng phát triển',
};

// `tone` khớp bộ tone của Badge trong @tsudev/ui. REGISTERED dùng `success` vì
// đó là khẳng định đã có giấy chứng nhận — đừng dùng cho PENDING.
export const COPYRIGHT = {
  NONE: { label: 'Chưa đăng ký bản quyền', tone: 'outline' },
  PENDING: { label: 'Đang chờ cấp bản quyền', tone: 'warning' },
  REGISTERED: { label: 'Đã đăng ký bản quyền', tone: 'success' },
};

export const KINDS = Object.keys(KIND_LABEL);
export const STATUSES = Object.keys(STATUS_LABEL);
export const COPYRIGHT_STATUSES = Object.keys(COPYRIGHT);
