import React, { useEffect, useRef, useState } from 'react';
import { PAGE_SIZES, type PageMeta, type PageSize } from '@tsudev/types';
import { pageAfterResize } from '../lib/usePageSize';

/**
 * Chân vùng bản ghi - DATA_TABLE.md mục 3, 6, 7.
 *
 * Chia BA phần cố định: trái bộ chọn, giữa dòng tóm tắt, phải phân trang. Vị trí
 * bộ chọn là quy tắc cứng của quy ước ("góc dưới bên trái của vùng chứa bản ghi",
 * kể cả trong modal, kể cả ở màn hình hẹp) - đừng dời nó lên thanh công cụ hay
 * vào menu ba chấm.
 *
 * Dùng cho MỌI vùng danh sách có thể vượt 10 bản ghi, không riêng `<table>`.
 */

/** `1.128` - dấu phân cách hàng nghìn theo tiếng Việt (mục 6). */
const num = (n: number) => n.toLocaleString('vi-VN');

/**
 * Dãy ô phân trang, tối đa 7 ô: `< 1 ... 5 6 7 ... 13 >`.
 * `null` là dấu lược (...), không bấm được.
 */
function pageWindow(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, null, totalPages];
  if (page >= totalPages - 3)
    return [1, null, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, null, page - 1, page, page + 1, null, totalPages];
}

const cell =
  'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md text-sm ' +
  'border border-line-control transition-colors';

export type RecordFooterProps = {
  meta: PageMeta;
  pageSize: PageSize;
  onPageSize: (size: PageSize, nextPage: number) => void;
  onPage: (page: number) => void;
  /** Khoá lại trong lúc tải; bộ chọn PHẢI mờ đi chứ không biến mất (mục 4). */
  loading?: boolean;
  /** Tổng số trước khi lọc - có thì dòng tóm tắt thành `1-10 / 42 (lọc từ 128)`. */
  totalUnfiltered?: number;
  /** Số mục đang chọn; thay hẳn dòng tóm tắt (mục 6). */
  selectedCount?: number;
  onClearSelection?: () => void;
  /** Nhãn cho trình đọc màn hình, phân biệt nhiều bảng trên cùng trang. */
  label?: string;
};

export const RecordFooter = ({
  meta,
  pageSize,
  onPageSize,
  onPage,
  loading = false,
  totalUnfiltered,
  selectedCount = 0,
  onClearSelection,
  label = 'bản ghi',
}: RecordFooterProps) => {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [announce, setAnnounce] = useState('');
  const firstLoad = useRef(true);

  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.page_size + 1;
  const to = Math.min(meta.total, meta.page * meta.page_size);

  // Thông báo cho trình đọc màn hình SAU KHI dữ liệu đã về (mục 7). Bỏ qua lần
  // dựng đầu: lúc đó chưa có gì "vừa đổi" để mà báo.
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    if (loading) return;
    setAnnounce(
      meta.total === 0
        ? 'Không có mục nào'
        : `Đang hiển thị ${num(from)} đến ${num(to)} trong ${num(meta.total)} mục`
    );
  }, [meta.page, meta.page_size, meta.total, loading, from, to]);

  const changeSize = (raw: string) => {
    const next = Number(raw) as PageSize;
    // Giữ nguyên bản ghi đầu đang nhìn thấy thay vì nhảy về trang 1 (mục 4).
    onPageSize(next, pageAfterResize(meta.page, meta.page_size, next));
    // Tiêu điểm PHẢI ở lại trên bộ chọn (mục 7); React giữ sẵn, chỉ cần không
    // ai kéo tiêu điểm đi chỗ khác sau khi dữ liệu về.
    selectRef.current?.focus();
  };

  const summary =
    selectedCount > 0 ? (
      <span className="flex items-center gap-2">
        Đã chọn {num(selectedCount)} mục
        {onClearSelection && (
          <button type="button" onClick={onClearSelection} className="underline hover:text-link">
            Bỏ chọn
          </button>
        )}
      </span>
    ) : meta.total === 0 ? null : meta.total_pages === 1 ? ( // rỗng: không hiện dòng tóm tắt
      <>{num(meta.total)} mục</>
    ) : totalUnfiltered != null && totalUnfiltered !== meta.total ? (
      <>
        {num(from)}-{num(to)} / {num(meta.total)} (lọc từ {num(totalUnfiltered)})
      </>
    ) : (
      <>
        {num(from)}-{num(to)} / {num(meta.total)}
      </>
    );

  const cells = pageWindow(meta.page, meta.total_pages);

  return (
    <div
      className={
        'border-t border-line bg-subtle px-4 ' +
        // Màn hình hẹp xếp hai hàng, nhưng bộ chọn VẪN bên trái - nó là thứ
        // không đổi vị trí ở mọi điểm ngắt (mục 3.1).
        'flex flex-col gap-2 py-2 sm:h-12 sm:flex-row sm:items-center sm:justify-between sm:py-0'
      }
    >
      {/* TRÁI: bộ chọn */}
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <span className="flex items-center gap-2">
          <select
            ref={selectRef}
            value={pageSize}
            disabled={loading}
            onChange={(e) => changeSize(e.target.value)}
            aria-label={`Số ${label} mỗi trang`}
            className="h-8 rounded-md border border-line-control bg-surface px-2 text-sm disabled:opacity-60"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="text-[13px] text-fg-muted">/ trang</span>
        </span>
        {/* Ở màn hình hẹp dòng tóm tắt nằm cùng hàng, bên phải (mục 3.1). */}
        <span className="text-[13px] text-fg-muted sm:hidden">{summary}</span>
      </div>

      {/* GIỮA: dòng tóm tắt */}
      <span className="hidden text-[13px] text-fg-muted sm:block">{summary}</span>

      {/* PHẢI: phân trang */}
      <nav
        aria-label="Phân trang"
        className="flex items-center justify-between gap-1 sm:justify-end"
      >
        <button
          type="button"
          onClick={() => onPage(meta.page - 1)}
          disabled={loading || meta.page <= 1}
          aria-label="Trang trước"
          className={cell + ' disabled:opacity-40 disabled:cursor-not-allowed hover:bg-hovered'}
        >
          <span aria-hidden="true">‹</span>
          <span className="ml-1 sm:hidden">Trước</span>
        </button>

        <span className="hidden items-center gap-1 sm:flex">
          {cells.map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1 text-fg-muted" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                disabled={loading}
                aria-current={p === meta.page ? 'page' : undefined}
                aria-label={`Trang ${p}`}
                className={
                  cell +
                  (p === meta.page
                    ? ' bg-primary text-on-primary border-transparent'
                    : ' hover:bg-hovered')
                }
              >
                {p}
              </button>
            )
          )}
        </span>

        <button
          type="button"
          onClick={() => onPage(meta.page + 1)}
          disabled={loading || meta.page >= meta.total_pages}
          aria-label="Trang sau"
          className={cell + ' disabled:opacity-40 disabled:cursor-not-allowed hover:bg-hovered'}
        >
          <span className="mr-1 sm:hidden">Sau</span>
          <span aria-hidden="true">›</span>
        </button>
      </nav>

      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
};

export default RecordFooter;
