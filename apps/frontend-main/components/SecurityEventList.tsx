import React from 'react';
import { formatDateTimeVN } from '../lib/format';

/**
 * Danh sách sự kiện bảo mật, dùng chung cho hai bề mặt:
 *  - `variant="user"`: "Hoạt động gần đây" của chính chủ ở /settings/security.
 *  - `variant="admin"`: console OWNER xuyên tài khoản ở /admin/security (thêm cột
 *    tài khoản).
 *
 * Nhãn loại sự kiện sống ở ĐÂY (một bản đồ), không rải trong JSX: thêm loại mới
 * chỉ sửa một chỗ, và loại chưa có nhãn vẫn hiện mã thô thay vì biến mất.
 */
export type SecurityEvent = {
  id: string;
  type: string;
  ip: string | null;
  userAgent: string | null;
  byAdmin: boolean;
  actorName: string | null;
  note: string | null;
  createdAt: string;
  // Chỉ có ở variant admin:
  userId?: string;
  username?: string;
  userDisplayName?: string | null;
};

const LABELS: Record<string, string> = {
  login: 'Đăng nhập',
  account_created: 'Tạo tài khoản',
  email_verified: 'Xác minh email',
  password_change: 'Đổi mật khẩu',
  password_reset: 'Đặt lại mật khẩu',
  email_change_request: 'Yêu cầu đổi email',
  email_changed: 'Đổi email',
  totp_enabled: 'Bật xác thực hai bước (TOTP)',
  totp_disabled: 'Tắt xác thực hai bước (TOTP)',
  passkey_added: 'Thêm passkey',
  passkey_removed: 'Xoá passkey',
  role_changed: 'Đổi vai trò',
  sessions_revoked: 'Thu hồi mọi phiên',
};

const label = (type: string): string => LABELS[type] ?? type;

/** Rút gọn User-Agent thành "Trình duyệt · Hệ điều hành" cho người đọc. */
function deviceOf(ua: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
    ? 'Opera'
    : /Chrome\//.test(ua)
    ? 'Chrome'
    : /Firefox\//.test(ua)
    ? 'Firefox'
    : /Safari\//.test(ua)
    ? 'Safari'
    : null;
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iOS/.test(ua)
    ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua)
    ? 'macOS'
    : /Linux/.test(ua)
    ? 'Linux'
    : null;
  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(' · ') : ua.slice(0, 40);
}

export const SecurityEventList = ({
  events,
  variant = 'user',
}: {
  events: SecurityEvent[];
  variant?: 'user' | 'admin';
}) => {
  if (events.length === 0) {
    return <p className="text-sm text-fg-muted">Chưa có sự kiện nào.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {events.map((e) => {
        const device = deviceOf(e.userAgent);
        return (
          <li
            key={e.id}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5"
          >
            <div className="min-w-0">
              <span className="text-sm font-medium text-fg">{label(e.type)}</span>
              {variant === 'admin' && (
                <span className="ml-2 text-sm text-fg-muted">
                  @{e.username}
                  {e.userDisplayName ? ` (${e.userDisplayName})` : ''}
                </span>
              )}
              {e.byAdmin && (
                <span className="ml-2 text-xs text-warning">
                  bởi quản trị{e.actorName ? ` (${e.actorName})` : ''}
                </span>
              )}
              {e.note && <span className="ml-2 text-xs text-fg-muted">{e.note}</span>}
              <div className="text-xs text-fg-muted">
                {[device, e.ip].filter(Boolean).join(' · ') || 'không rõ thiết bị'}
              </div>
            </div>
            <span className="shrink-0 text-xs text-fg-muted">{formatDateTimeVN(e.createdAt)}</span>
          </li>
        );
      })}
    </ul>
  );
};

export default SecurityEventList;
