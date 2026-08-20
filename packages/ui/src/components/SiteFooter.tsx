import React from 'react';
import { Logo } from './Logo';
import { useCanSeeTrust } from '../lib/useTrustNav';

// Riêng đăng nhập giữ đường dẫn tương đối: phiên next-auth thuộc về chính app
// đang mở, đẩy sang origin khác sẽ đăng nhập nhầm chỗ.
// tsudev là MỘT site nên href tương đối.
type FooterLink = [label: string, href: string];

const eco = (label: string, path: string): FooterLink => [label, path];

type Col = { title: string; links: FooterLink[] };

/**
 * Ba mục Con dấu chỉ hiện với tài khoản đã đổi mã mời (chế độ mời - xem
 * useCanSeeTrust). Cột đổi luôn TIÊU ĐỀ khi không có mục nào của Con dấu: một
 * cột tên "Tín nhiệm" chỉ chứa mỗi liên kết Đăng nhập đọc như một lỗi bố cục.
 */
const columns = (canSeeTrust: boolean): Col[] => [
  {
    title: 'Nội dung',
    links: [eco('Dự án', '/projects'), eco('Blog', '/blog'), eco('Tài liệu', '/docs')],
  },
  {
    title: canSeeTrust ? 'Tín nhiệm' : 'Tài khoản',
    links: [
      ...(canSeeTrust
        ? [
            eco('Con dấu tín nhiệm', '/trust'),
            eco('Tra cứu chứng chỉ', '/trust/verify'),
            eco('Danh bạ đã cấp dấu', '/trust/directory'),
          ]
        : []),
      // Trang /login của site, không phải trang mặc định của next-auth.
      ['Đăng nhập', '/login'] as FooterLink,
    ],
  },
  {
    title: 'Pháp lý',
    links: [
      eco('Quyền riêng tư', '/privacy'),
      eco('Điều khoản', '/terms'),
      eco('Nội quy', '/rules'),
    ],
  },
];

// Footer không có nền riêng - nó nằm thẳng trên nền trang. Ranh giới với phần
// nội dung chính chỉ do MỘT đường kẻ đảm nhiệm, dùng --border-strong vì ở chế
// độ tối đường mảnh --border gần như không thấy, còn ở chế độ sáng nó cho ra
// một ranh giới rõ mà không cần đổi nền.
export const SiteFooter = () => {
  const COLS = columns(useCanSeeTrust());
  return (
    <footer className="mt-16 border-t border-line-strong">
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-6 grid gap-x-8 gap-y-7 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-2.5 text-sm text-fg-muted max-w-xs leading-relaxed">
            Hệ sinh thái công nghệ đa nền tảng cho developer. Decoding the Future, One Commit at a
            Time.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted font-mono">
              {c.title}
            </h4>
            <ul className="mt-2.5 space-y-1.5">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-fg-secondary hover:text-link transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="max-w-6xl mx-auto px-4 pb-6 flex flex-col sm:flex-row justify-between gap-1.5 text-xs text-fg-muted font-mono">
        <span>© {new Date().getFullYear()} tsudev - Nguyễn Trang Tình Sử</span>
        <span>Built with Next.js · Node · PostgreSQL</span>
      </div>
    </footer>
  );
};

export default SiteFooter;
