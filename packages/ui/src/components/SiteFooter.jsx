import React from 'react';
import { Logo } from './Logo';
import { siteUrl } from '../lib/siteUrls';

// Footer dùng chung cho cả hai frontend nên link phải tuyệt đối, xem lib/siteUrls.
// Riêng đăng nhập giữ đường dẫn tương đối: phiên next-auth thuộc về chính app
// đang mở, đẩy sang origin khác sẽ đăng nhập nhầm chỗ.
const eco = (label, path) => [label, siteUrl('main', path)];

const COLS = [
  {
    title: 'Hệ sinh thái',
    links: [
      eco('Blog', '/blog'),
      eco('Tài liệu', '/docs'),
      ['Diễn đàn', siteUrl('forum', '/')],
      eco('Kho lưu trữ', '/docs'),
    ],
  },
  {
    title: 'Cộng đồng',
    links: [
      eco('Thành viên', '/members'),
      eco('Bảng xếp hạng', '/members'),
      eco('Nội quy', '/rules'),
      ['Đăng nhập', '/api/auth/signin'],
    ],
  },
  { title: 'Pháp lý', links: [eco('Quyền riêng tư', '/privacy'), eco('Điều khoản', '/terms')] },
];

// Footer không có nền riêng — nó nằm thẳng trên nền trang. Ranh giới với phần
// nội dung chính chỉ do MỘT đường kẻ đảm nhiệm, dùng --border-strong để đủ nổi
// trên nền đen (đường mảnh --border sẽ gần như không thấy).
export const SiteFooter = () => (
  <footer className="mt-16 border-t border-hairstrong">
    <div className="max-w-6xl mx-auto px-4 pt-8 pb-6 grid gap-x-8 gap-y-7 md:grid-cols-[1.4fr_repeat(3,1fr)]">
      <div>
        <Logo />
        <p className="mt-2.5 text-sm text-muted max-w-xs leading-relaxed">
          Hệ sinh thái công nghệ đa nền tảng cho developer. Decoding the Future, One Commit at a
          Time.
        </p>
      </div>
      {COLS.map((c) => (
        <div key={c.title}>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
            {c.title}
          </h4>
          <ul className="mt-2.5 space-y-1.5">
            {c.links.map(([label, href]) => (
              <li key={label}>
                <a
                  href={href}
                  className="text-sm text-inksoft hover:text-brandink transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="max-w-6xl mx-auto px-4 pb-6 flex flex-col sm:flex-row justify-between gap-1.5 text-xs text-muted font-mono">
      <span>© {new Date().getFullYear()} tsudev — Nguyễn Trang Tình Sử</span>
      <span>Built with Next.js · Node · PostgreSQL</span>
    </div>
  </footer>
);

export default SiteFooter;
