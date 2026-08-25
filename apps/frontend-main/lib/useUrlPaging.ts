import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { usePageSize } from '@tsudev/ui';
import {
  DEFAULT_PAGE_SIZE,
  normalizePage,
  normalizePageSize,
  type PageMeta,
  type PageSize,
} from '@tsudev/types';

/**
 * Trạng thái phân trang của MỘT vùng bản ghi, có neo vào URL - DATA_TABLE.md
 * mục 4, 5, 8.1.
 *
 * Vì sao là một hook dùng chung chứ không phải mỗi trang tự viết: ở đây có một
 * cái bẫy của Next mà bản viết tay đầu tiên (`/admin/accounts`, đợt 1) đã dính.
 *
 * Trang KHÔNG có `getServerSideProps` được Next tối ưu tĩnh, và trên trang đó
 * `router.query` **rỗng ở lần dựng đầu**, chỉ được điền sau khi hydrat xong
 * (`router.isReady`). Đọc `router.query.page` trong bộ khởi tạo của `useState`
 * vì thế luôn ra 1. Tự nó chỉ là "không tái lập được liên kết chia sẻ" - nhưng
 * effect ghi ngược lên URL chạy ngay sau đó lại thấy trạng thái là trang 1 và
 * **GHI ĐÈ `?page=3` của người ta thành `?page=1`**. Liên kết chia sẻ không
 * phải là không hoạt động, nó bị chính trang đó xoá đi khi vừa mở.
 *
 * Cách chữa: chờ `router.isReady`, NHẬN giá trị từ URL vào state, rồi mới bật
 * `ready`. Effect ghi ngược (`useUrlPagingSync`) chỉ chạy khi `ready` - nên
 * không lần nào nó ghi bằng trạng thái mặc định.
 */
export type UrlPaging = {
  page: number;
  setPage: (p: number) => void;
  pageSize: PageSize;
  setPageSize: (s: PageSize) => void;
  meta: PageMeta;
  setMeta: (m: PageMeta) => void;
  /** Đã đọc xong tham số URL chưa. Đừng gọi máy chủ trước lúc này. */
  ready: boolean;
  /** Tên tham số trên URL - `useUrlPagingSync` dùng tới. */
  pageKey: string;
  sizeKey: string;
};

export const EMPTY_PAGE_META: PageMeta = {
  total: 0,
  page: 1,
  page_size: DEFAULT_PAGE_SIZE,
  total_pages: 1,
};

/**
 * `prefix` chỉ cần khi một trang có NHIỀU vùng bản ghi (ví dụ `/admin/trust` có
 * bốn): một cặp `page`/`page_size` dùng chung sẽ làm lật trang nhật ký kéo theo
 * cả hàng đợi thẩm định. Tham số gửi LÊN máy chủ vẫn luôn mang tên chuẩn
 * `page`/`page_size` (mục 8.1) - tiền tố chỉ sống trong URL của trang.
 */
export function useUrlPaging(tableId: string, prefix = ''): UrlPaging {
  const router = useRouter();
  const pageKey = prefix ? `${prefix}_page` : 'page';
  const sizeKey = prefix ? `${prefix}_page_size` : 'page_size';

  const [pageSize, setPageSize] = usePageSize(tableId, router.query[sizeKey]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PageMeta>(EMPTY_PAGE_META);
  const [ready, setReady] = useState(false);
  const adopted = useRef(false);

  useEffect(() => {
    if (!router.isReady || adopted.current) return;
    adopted.current = true;
    setPage(normalizePage(router.query[pageKey]));
    // URL thắng lựa chọn đã nhớ (mục 5) - kể cả khi lựa chọn đã nhớ đọc được
    // trước, vì nó đọc ở lần dựng đầu còn URL chỉ có sau khi router sẵn sàng.
    const raw = router.query[sizeKey];
    if (raw != null && String(raw) !== '') setPageSize(normalizePageSize(raw));
    setReady(true);
    // Chỉ chạy một lần, ngay khi router sẵn sàng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  return { page, setPage, pageSize, setPageSize, meta, setMeta, ready, pageKey, sizeKey };
}

/**
 * Ghi mốc và trang hiện tại ngược lên URL để liên kết chia sẻ tái lập đúng
 * (mục 8.1). `replace` chứ không `push`: đổi mốc không đáng một mục lịch sử.
 *
 * Nhận CẢ DANH SÁCH bảng và ghi MỘT lần, vì nhiều effect cùng gọi
 * `router.replace` trong một lượt sẽ giẫm lên nhau: mỗi effect trải
 * `router.query` cũ, nên effect chạy sau xoá tham số mà effect chạy trước vừa
 * đặt. Trên `/admin/trust` (bốn bảng) điều đó xảy ra ngay ở lần dựng đầu.
 */
export function useUrlPagingSync(tables: UrlPaging[]) {
  const router = useRouter();
  const key = tables.map((t) => `${t.ready}:${t.page}:${t.pageSize}`).join('|');
  useEffect(() => {
    if (!router.isReady || tables.some((t) => !t.ready)) return;
    const next: Record<string, string> = {};
    for (const t of tables) {
      next[t.pageKey] = String(t.page);
      next[t.sizeKey] = String(t.pageSize);
    }
    if (Object.entries(next).every(([k, v]) => router.query[k] === v)) return;
    router.replace({ pathname: router.pathname, query: { ...router.query, ...next } }, undefined, {
      shallow: true,
    });
    // `router` cố ý không nằm trong deps: nó đổi định danh mỗi lần replace shallow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, router.isReady]);
}
