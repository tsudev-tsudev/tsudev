import React, { useEffect, useRef } from 'react';

/**
 * Thông báo nổi - DESIGN_SYSTEM.md §5: góc PHẢI-TRÊN, nền `bg-surface`, viền
 * trái 3px màu trạng thái, shadow-md, tự đóng sau 4s (lỗi: 6s hoặc đóng tay).
 *
 * Hai thay đổi so với bản trước, cả hai đều là lỗi thật chứ không phải sở thích:
 *
 *   - Vị trí chuyển từ phải-DƯỚI lên phải-TRÊN. Góc dưới-phải là chỗ trình duyệt
 *     di động đặt thanh công cụ và chỗ nhiều trang đặt nút trò chuyện; toast ở đó
 *     bị che đúng lúc nó cần được đọc.
 *   - Có hẹn giờ tự đóng. Trước đây toast chỉ biến mất khi nơi gọi tự xoá state,
 *     nên chỗ nào quên là nó nằm lại vĩnh viễn trên màn hình.
 *
 * Nền là `bg-surface` + dải màu bên trái, không phải nền tô màu trạng thái: nền
 * tô nhạt buộc chữ phải là màu trạng thái, và ở chế độ Sáng cặp đó chỉ đạt
 * ~4.1:1. Dải viền mang cùng lượng thông tin mà chữ vẫn là `--text-primary`.
 */
const TONES = {
  error: { bar: 'var(--danger)', ink: 'var(--danger-ink)', label: 'Lỗi' },
  success: { bar: 'var(--success)', ink: 'var(--success-ink)', label: 'Thành công' },
  warning: { bar: 'var(--warning)', ink: 'var(--warning-ink)', label: 'Cảnh báo' },
  info: { bar: 'var(--info)', ink: 'var(--info-ink)', label: 'Thông tin' },
} as const;

export type ToastType = keyof typeof TONES;

/** Lỗi ở lại lâu hơn: nó thường kèm một việc người dùng phải làm. */
const DURATION: Record<ToastType, number> = {
  error: 6000,
  success: 4000,
  warning: 6000,
  info: 4000,
};

type ToastProps = {
  message?: React.ReactNode;
  type?: ToastType;
  onClose?: () => void;
  /** Đặt 0 để tắt hẹn giờ (thông báo phải do người dùng đóng). */
  duration?: number;
};

export const Toast = ({ message, type = 'info', onClose, duration }: ToastProps) => {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const ms = duration ?? DURATION[type] ?? 4000;
  useEffect(() => {
    if (!message || ms <= 0) return undefined;
    const t = setTimeout(() => closeRef.current?.(), ms);
    return () => clearTimeout(t);
    // `message` trong deps để mỗi thông báo mới được tính lại giờ từ đầu, thay vì
    // kế thừa phần còn lại của thông báo trước.
  }, [message, ms]);

  if (!message) return null;
  const tone = TONES[type] ?? TONES.info;

  return (
    <div
      className="fixed right-4 top-4 z-toast max-w-sm rounded-md border border-line bg-surface py-3 pl-4 pr-3 text-sm shadow-md"
      style={{ borderLeft: `3px solid ${tone.bar}` }}
      // `alert` cho lỗi (ngắt lời trình đọc màn hình), `status` cho phần còn lại.
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 text-fg">
          {/* Nhãn chữ đi kèm dải màu: người không phân biệt được màu vẫn đọc ra
              đây là lỗi hay là xác nhận (§1). */}
          <span className="font-semibold" style={{ color: tone.ink }}>
            {tone.label}.{' '}
          </span>
          {message}
        </div>
        {onClose && (
          <button
            type="button"
            className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors duration-fast ease-standard hover:bg-hovered hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            onClick={onClose}
            aria-label="Đóng thông báo"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;
