import React, { useEffect, useState } from 'react';

/**
 * Nút chuyển Sáng ↔ Tối.
 *
 * Mặc định là SÁNG. Lựa chọn ghi vào localStorage và được áp lại trước khi vẽ
 * bởi script nội tuyến trong `apps/frontend-main/pages/_document.tsx` - component
 * này chỉ phụ trách việc ĐỔI, không phụ trách việc khôi phục.
 *
 * Vì sao có `mounted`: HTML do server dựng luôn ở trạng thái sáng (server không
 * đọc được localStorage), còn trình duyệt có thể đã ở chế độ tối. Vẽ đúng biểu
 * tượng ngay lượt đầu sẽ làm React báo lệch hydration. Nên lượt đầu vẽ một ô
 * giữ chỗ ĐÚNG KÍCH THƯỚC - không có nó thì header nhảy một nhịp khi nút xuất
 * hiện.
 */
const STORAGE_KEY = 'tsudev-theme';

// Phải khớp `--surface` của hai chế độ trong tokens.css; có test canh.
const SURFACE = { light: '#eef3fa', dark: '#000000' } as const;

type Mode = 'light' | 'dark';

const applyMode = (mode: Mode) => {
  const root = document.documentElement;
  if (mode === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', SURFACE[mode]);
};

export const ThemeToggle = () => {
  const [mode, setMode] = useState<Mode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setMode(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    applyMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      // Chế độ vẫn đổi cho phiên này; chỉ là không nhớ được sang lần sau.
    }
  };

  if (!mounted) return <span className="inline-block h-8 w-8" aria-hidden="true" />;

  const dark = mode === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      // aria-pressed chứ không phải đổi nhãn: trình đọc màn hình thông báo được
      // trạng thái bật/tắt mà không cần người dùng đoán nghĩa của biểu tượng.
      aria-pressed={dark}
      aria-label={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      title={dark ? 'Chế độ sáng' : 'Chế độ tối'}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-panel2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {dark ? (
        // Mặt trời - bấm để về chế độ sáng.
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        // Mặt trăng - bấm để sang chế độ tối.
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;
