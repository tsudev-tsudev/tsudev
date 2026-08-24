import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Nút chọn giao diện - BỐN lựa chọn: Sáng · Ấm · Tối · Theo hệ thống.
 *
 * Vì sao là bốn chứ không phải ba: `.standards/docs/DESIGN_SYSTEM.md` §1 muốn chế độ mặc
 * định bám theo hệ điều hành, còn `CLAUDE.md` cấm điều đó - một site đổi diện
 * mạo theo cài đặt máy nghĩa là hai người mở CÙNG một đường link thấy hai thứ
 * khác nhau mà không ai chọn gì cả, và người viết bài không biết bài mình trông
 * ra sao. Cách hoà giải: MẶC ĐỊNH vẫn là Sáng (quyết định của sản phẩm), nhưng
 * "theo hệ điều hành" có mặt như một lựa chọn NGƯỜI DÙNG TỰ CHỌN. Ai muốn hành
 * vi của §1 thì bật một lần, còn khách vãng lai luôn thấy cùng một trang.
 *
 * Chế độ Ấm (sepia) cố ý chỉ đến bằng tay: §1 xếp nó là lựa chọn thủ công cho
 * phiên làm việc dài, không có tín hiệu hệ thống nào tương ứng để tự suy ra.
 *
 * Lựa chọn ghi vào localStorage và được áp lại TRƯỚC KHI VẼ bởi script nội tuyến
 * trong `apps/frontend-main/pages/_document.tsx`. Component này chỉ phụ trách
 * việc ĐỔI, không phụ trách việc khôi phục - hai phần đó dùng chung đúng một
 * khoá và đúng một bảng màu nền, và `apps/frontend-main/test/themeTokens.test.ts`
 * canh cho chúng không trôi lệch.
 *
 * Vì sao có `mounted`: HTML do server dựng luôn ở trạng thái Sáng (server không
 * đọc được localStorage), còn trình duyệt có thể đã ở chế độ khác. Vẽ đúng biểu
 * tượng ngay lượt đầu sẽ làm React báo lệch hydration. Nên lượt đầu vẽ một ô giữ
 * chỗ ĐÚNG KÍCH THƯỚC - không có nó thì header nhảy một nhịp khi nút xuất hiện.
 */
const STORAGE_KEY = 'tsudev-theme';

/** Chế độ THẬT được ghi vào `data-theme`. */
export type ThemeMode = 'light' | 'warm' | 'dark';
/** Điều người dùng CHỌN - thêm 'system' là một lựa chọn, không phải một bảng màu. */
export type ThemeChoice = ThemeMode | 'system';

// Phải khớp `--bg-base` của ba chế độ trong tokens.css (sinh từ
// tokens/design-tokens.json); có test canh. Dùng cho <meta name="theme-color">,
// thứ chạy trước khi trình duyệt tính lại style nên không đọc được biến CSS.
const BASE: Record<ThemeMode, string> = {
  light: '#eef4fb',
  warm: '#f6f1e6',
  dark: '#0f1b2d',
};

const CHOICES: Array<{ value: ThemeChoice; label: string; hint: string }> = [
  { value: 'light', label: 'Sáng', hint: 'Ban ngày, phòng sáng' },
  { value: 'warm', label: 'Ấm', hint: 'Làm việc lâu, ánh sáng gắt' },
  { value: 'dark', label: 'Tối', hint: 'Ban đêm, phòng tối' },
  { value: 'system', label: 'Theo hệ thống', hint: 'Bám cài đặt của máy' },
];

const prefersDark = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Lựa chọn của người dùng → bảng màu thật sự được vẽ. */
export const resolveTheme = (choice: ThemeChoice): ThemeMode =>
  choice === 'system' ? (prefersDark() ? 'dark' : 'light') : choice;

const applyTheme = (mode: ThemeMode) => {
  document.documentElement.setAttribute('data-theme', mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BASE[mode]);
};

const readChoice = (): ThemeChoice => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'warm' || v === 'dark' || v === 'system') return v;
  } catch (e) {
    // localStorage ném lỗi khi cookie bên thứ ba bị chặn hoặc trang chạy trong
    // iframe sandbox. Hỏng ở đây phải là "về mặc định", không phải trang trắng.
  }
  return 'light';
};

// Icon 16px nét mảnh stroke 1.5, đúng đặc tả item dropdown ở DESIGN_SYSTEM.md §5.
const ICONS: Record<ThemeChoice, React.ReactNode> = {
  light: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
    </>
  ),
  warm: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3.2v1.6M12 19.2v1.6M3.2 12h1.6M19.2 12h1.6M5.8 5.8l1.2 1.2M17 17l1.2 1.2M18.2 5.8L17 7M7 17l-1.2 1.2" />
      <path d="M9.4 12a2.6 2.6 0 0 0 5.2 0" />
    </>
  ),
  dark: <path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8Z" />,
  system: (
    <>
      <rect x="2.8" y="4.4" width="18.4" height="12.2" rx="1.6" />
      <path d="M8.6 20.2h6.8M12 16.6v3.6" />
    </>
  ),
};

const Glyph = ({ choice }: { choice: ThemeChoice }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {ICONS[choice]}
  </svg>
);

export const ThemeToggle = () => {
  const [choice, setChoice] = useState<ThemeChoice>('light');
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setChoice(readChoice());
  }, []);

  // Chọn "Theo hệ thống" thì phải đổi NGAY khi máy đổi, không chờ tải lại trang -
  // nếu không thì lựa chọn đó chỉ đúng tại thời điểm bấm, và người dùng sẽ kết
  // luận là nó hỏng.
  useEffect(() => {
    if (choice !== 'system' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(resolveTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [choice]);

  // Đóng menu khi bấm ra ngoài hoặc nhấn ESC (§5: mọi lớp nổi đóng được bằng ESC).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = useCallback((next: ThemeChoice) => {
    setChoice(next);
    applyTheme(resolveTheme(next));
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      // Chế độ vẫn đổi cho phiên này; chỉ là không nhớ được sang lần sau.
    }
  }, []);

  if (!mounted) return <span className="inline-block h-control w-control" aria-hidden="true" />;

  const current = CHOICES.find((c) => c.value === choice) ?? CHOICES[0]!;

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Giao diện: ${current.label}. Đổi giao diện`}
        title={`Giao diện: ${current.label}`}
        className="inline-flex h-control w-control items-center justify-center rounded-md text-fg-muted transition-colors duration-fast ease-standard hover:bg-hovered hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Glyph choice={choice} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Chọn giao diện"
          className="absolute right-0 mt-2 w-56 rounded-md border border-line bg-surface p-1 shadow-md z-dropdown"
        >
          {CHOICES.map((c) => {
            const active = c.value === choice;
            return (
              <button
                key={c.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => pick(c.value)}
                className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors duration-fast ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
                  active ? 'bg-subtle text-fg' : 'text-fg-secondary hover:bg-hovered hover:text-fg'
                }`}
              >
                <span className={active ? 'text-icon-nav' : 'text-fg-muted'}>
                  <Glyph choice={c.value} />
                </span>
                <span className="flex-1">
                  <span className="block font-medium">{c.label}</span>
                  {/* Chú thích 12px - bậc nhỏ nhất mà quy ước cho phép. */}
                  <span className="block text-xs text-fg-muted">{c.hint}</span>
                </span>
                {/* Dấu chọn là hình, không phải màu - §1 cấm để màu đứng một mình. */}
                {active && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12.8 9.6 17.4 19 8" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
