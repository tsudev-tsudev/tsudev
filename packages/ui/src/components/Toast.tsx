import React from 'react';

// Nền tô nhạt + chữ cùng tông ngữ nghĩa. Chữ trắng trên nền đỏ/xanh bão hoà
// không đạt WCAG AA trên giao diện tối, nên đảo lại: nền tối, chữ sáng.
const TONES = {
  error: 'var(--error)',
  success: 'var(--success)',
  info: 'var(--ink)',
} as const;

export type ToastType = keyof typeof TONES;

type ToastProps = {
  message?: React.ReactNode;
  type?: ToastType;
  onClose?: React.MouseEventHandler<HTMLButtonElement>;
};

export const Toast = ({ message, type = 'info', onClose }: ToastProps) => {
  if (!message) return null;
  const fg = TONES[type] ?? TONES.info;
  const bg = type === 'info' ? 'var(--panel-2)' : `color-mix(in srgb, ${fg} 18%, var(--panel))`;
  // Toast nổi trên nội dung nên giữ một viền mảnh để tách lớp — có chức năng,
  // khác với khung trang trí đã lược bỏ ở các bề mặt tĩnh.
  const border =
    type === 'info' ? 'var(--border-strong)' : `color-mix(in srgb, ${fg} 35%, transparent)`;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium"
      style={{ backgroundColor: bg, color: fg, border: `1px solid ${border}` }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1">{message}</div>
        {onClose && (
          <button
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;
