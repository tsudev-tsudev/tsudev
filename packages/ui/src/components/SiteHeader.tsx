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
      className="sticky top-0 z-40 border-b border-line backdrop-blur"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)' }}
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
                    ? 'text-link bg-subtle'
                    : 'text-fg-secondary hover:text-fg hover:bg-subtle'
                }`}
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="hidden xl:flex items-center gap-2 h-9 px-3 rounded-md border border-line bg-base text-fg-muted focus-within:border-primary">
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
              className="bg-transparent outline-none text-sm text-fg w-40 placeholder:text-fg-muted"
            />
          </label>
          <ThemeToggle />
          {session ? (
            <div className="flex items-center gap-2">
              {/*
                Tên người dùng là LIÊN KẾT, không phải nhãn. Trước đợt này
                `/settings/security` và `/settings/profile` không được nhắc tới ở
                bất kỳ đâu trong giao diện - chỉ vào được bằng cách gõ URL. Một
                trang quản lý tài khoản mà không có lối vào thì nó là trang chết,
                đúng cái số phận mà chính nó được dựng ra để cứu 2FA và passkey
                khỏi mắc phải.
              */}
              <a
                href="/settings/profile"
                className="hidden lg:inline text-sm text-fg-secondary max-w-[10rem] truncate rounded-md px-2 py-1 hover:bg-subtle hover:text-fg transition-colors"
              >
                {session.user?.name || session.user?.email}
              </a>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center h-8 px-3 rounded-md text-sm font-medium text-fg-secondary hover:bg-subtle hover:text-fg transition-colors"
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
              className="inline-flex items-center h-8 px-4 rounded-md text-sm font-semibold text-on-primary bg-primary hover:brightness-110 transition"
            >
              Đăng nhập
            </a>
          )}
          <button
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-subtle hover:text-fg transition-colors"
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
        <nav className="md:hidden border-t border-line bg-surface px-4 py-2" aria-label="Di động">
          {nav.map((n) => (
            <a
              key={n.key}
              href={n.path}
              className="block px-2 py-2.5 rounded-md text-sm text-fg-secondary hover:bg-subtle"
            >
              {n.label}
            </a>
          ))}
          {/*
            Trên màn hình hẹp, tên người dùng ở thanh trên bị ẩn (lg:inline), nên
            hai mục này là lối vào DUY NHẤT tới trang tài khoản. Thiếu chúng thì
            người dùng điện thoại không có đường nào tới đó.
          */}
          {session && (
            <div className="mt-1 border-t border-line pt-1">
              <a
                href="/settings/profile"
                className="block px-2 py-2.5 rounded-md text-sm text-fg-secondary hover:bg-subtle"
              >
                Hồ sơ
              </a>
              <a
                href="/settings/security"
                className="block px-2 py-2.5 rounded-md text-sm text-fg-secondary hover:bg-subtle"
              >
                Bảo mật
              </a>
            </div>
          )}
        </nav>
      )}
    </header>
  );
};

export default SiteHeader;
