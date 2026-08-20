import React, { useEffect, useState } from 'react';

/**
 * Mục lục cho bài viết và trang tài liệu.
 *
 * CÓ NỀN VÀ VIỀN RIÊNG, có chủ đích: mục lục là điều hướng chứ không phải nội
 * dung. Không tách nó ra khỏi thân bài bằng một bề mặt riêng thì ở chế độ sáng
 * nó đọc như một danh sách gạch đầu dòng nằm giữa bài - người đọc phải tự đoán
 * đâu là chỗ bấm được.
 *
 * Mục đang đọc được đánh dấu bằng IntersectionObserver. Việc đó không phải để
 * đẹp: với bài dài thì "tôi đang ở đâu" là câu hỏi mà mục lục sinh ra để trả lời.
 */

export type TocItem = { id: string; text: string; level: number };

type TableOfContentsProps = {
  items: TocItem[];
  title?: string;
  className?: string;
};

export const TableOfContents = ({
  items,
  title = 'Mục lục',
  className = '',
}: TableOfContentsProps) => {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (!items.length) return undefined;
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el);
    if (!headings.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        // Lấy mục cao nhất đang nằm trong vùng nhìn. Dùng entry cuối cùng phát
        // ra sự kiện sẽ nhảy lung tung khi cuộn nhanh, vì thứ tự sự kiện không
        // phải thứ tự tài liệu.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // Dải hẹp gần đỉnh: mục được coi là "đang đọc" khi nó chạm phần trên màn
      // hình, không phải khi nó vừa ló ra ở đáy.
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;

  return (
    <nav aria-label={title} className={`rounded-md border border-line bg-surface p-4 ${className}`}>
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                // aria-current cho trình đọc màn hình biết mục nào đang đọc -
                // màu chữ và thanh dọc chỉ nói điều đó với người nhìn thấy.
                aria-current={active ? 'location' : undefined}
                className={`block border-l-2 py-1 pr-2 text-sm transition-colors ${
                  item.level >= 3 ? 'pl-5' : 'pl-3'
                } ${
                  active
                    ? 'border-primary font-medium text-link'
                    : 'border-transparent text-fg-secondary hover:border-line-strong hover:text-fg'
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default TableOfContents;
