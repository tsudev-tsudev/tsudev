import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { useCanSeeTrust } from '../lib/useTrustNav';
// tsudev là MỘT site nên href tương đối. Trước đây có hai origin (trang chính và
// diễn đàn) nên mọi link điều hướng buộc phải là URL tuyệt đối.
type NavItem = { key: string; path: string; label: string; needsTrust?: boolean };

const NAV: NavItem[] = [
  { key: 'home', path: '/', label: 'Trang chủ' },
  { key: 'projects', path: '/projects', label: 'Dự án' },
  { key: 'blog', path: '/blog', label: 'Blog' },
  { key: 'docs', path: '/docs', label: 'Tài liệu' },
  // Chỉ hiện với tài khoản đã đổi mã mời - xem useCanSeeTrust.
  { key: 'trust', path: '/trust', label: 'Con dấu', needsTrust: true },
];

// Trang truyền `active` theo đường dẫn ('/blog') hoặc theo khoá ('home').
const isActive = (n: NavItem, active: string) => active === n.key || active === n.path;

type SiteHeaderProps = { active?: string };

export const SiteHeader = ({ active = '/' }: SiteHeaderProps) => {
  const { data: session } = useSession();
  const canSeeTrust = useCanSeeTrust();
  const nav = NAV.filter((n) => !n.needsTrust || canSeeTrust);
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 border-b border-hairline backdrop-blur"
      style={{ backgroundColor: 'color-mix(in srgb, var(--panel) 88%, transparent)' }}
    >
      <a href="#main-content" className="skip-link">
        Bỏ qua tới nội dung
      </a>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <a href="/" className="shrink-0" aria-label="tsudev trang chủ">
            <Logo />
          </a>
          <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label="Chính">
            {nav.map((n) => (
              <a
                key={n.key}
                href={n.path}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive(n, active)
                    ? 'text-brandink bg-panel2'
                    : 'text-inksoft hover:text-ink hover:bg-panel2'
                }`}
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="hidden xl:flex items-center gap-2 h-9 px-3 rounded-md border border-hairline bg-surface text-muted focus-within:border-brand">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="M20 20l-3.2-3.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            <input
              aria-label="Tìm kiếm"
              placeholder="Tìm kiếm…"
              className="bg-transparent outline-none text-sm text-ink w-40 placeholder:text-muted"
            />
          </label>
          <ThemeToggle />
          {session ? (
            <div className="flex items-center gap-2">
              <span className="hidden lg:inline text-sm text-inksoft max-w-[10rem] truncate">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center h-8 px-3 rounded-md text-sm font-medium text-inksoft hover:bg-panel2 hover:text-ink transition-colors"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            // Link chứ không phải nút gọi signIn(): trang /login là trang thật
            // của site, và một thẻ <a> mở được bằng chuột giữa, bookmark được,
            // và hoạt động cả khi JavaScript chưa kịp tải.
            <a
              href="/login"
              className="inline-flex items-center h-8 px-4 rounded-md text-sm font-semibold text-brandcontrast bg-brand hover:brightness-110 transition"
            >
              Đăng nhập
            </a>
          )}
          <button
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md text-inksoft hover:bg-panel2 hover:text-ink transition-colors"
            aria-label="Menu"
            onClick={() => setOpen(!open)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t border-hairline bg-panel px-4 py-2" aria-label="Di động">
          {nav.map((n) => (
            <a
              key={n.key}
              href={n.path}
              className="block px-2 py-2.5 rounded-md text-sm text-inksoft hover:bg-panel2"
            >
              {n.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
};

export default SiteHeader;
