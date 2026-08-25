import { useCallback, useState } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, normalizePageSize, type PageSize } from '@tsudev/types';

/**
 * Ghi nhớ mốc số bản ghi cho MỘT bảng - DATA_TABLE.md mục 5.
 *
 * Thứ tự ưu tiên, đúng theo quy ước:
 *   1. `page_size` trong URL  (liên kết chia sẻ phải tái lập đúng)
 *   2. lựa chọn đã nhớ cho ĐÚNG bảng đó
 *   3. 10
 *
 * Khoá nhớ theo từng bảng (`tsudev.pagesize.<mã-bảng>`), KHÔNG dùng một giá trị
 * chung cho cả ứng dụng: người ta muốn 200 dòng ở bảng nhật ký nhưng vẫn muốn 10
 * ở bảng người dùng.
 *
 * Mọi lần đọc/ghi đều bọc try/catch: `localStorage` ném lỗi thật trong cửa sổ ẩn
 * danh và khi trình duyệt chặn lưu trữ. Đây là tiện nghi hiển thị - mất thì thôi,
 * không được làm hỏng bảng.
 */
const keyOf = (tableId: string) => `tsudev.pagesize.${tableId}`;

function readStored(tableId: string): PageSize | null {
  try {
    const raw = window.localStorage.getItem(keyOf(tableId));
    if (!raw) return null;
    const n = parseInt(raw, 10);
    // Giá trị đọc ra PHẢI kiểm nằm trong bộ mốc chuẩn, không tin thẳng: nó có
    // thể do bản cũ ghi, hoặc do người dùng sửa tay.
    return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : null;
  } catch {
    return null;
  }
}

export function usePageSize(tableId: string, fromUrl?: unknown) {
  const [pageSize, setState] = useState<PageSize>(() => {
    if (fromUrl != null && String(fromUrl) !== '') return normalizePageSize(fromUrl);
    if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE;
    return readStored(tableId) ?? DEFAULT_PAGE_SIZE;
  });

  const setPageSize = useCallback(
    (next: PageSize) => {
      setState(next);
      try {
        window.localStorage.setItem(keyOf(tableId), String(next));
      } catch {
        /* không lưu được thì thôi - bảng vẫn phải chạy */
      }
    },
    [tableId]
  );

  return [pageSize, setPageSize] as const;
}

/**
 * Trang mới khi đổi mốc, sao cho BẢN GHI ĐẦU đang nhìn thấy vẫn nằm trên trang.
 *
 * `trang_mới = floor(chỉ_số_bản_ghi_đầu / mốc_mới) + 1` (mục 4).
 *
 * Không có phép này thì đổi mốc sẽ ném người dùng về trang 1 - đang xem dòng 340
 * mà bị đưa về đầu danh sách là mất dấu công việc.
 */
export function pageAfterResize(page: number, oldSize: number, newSize: number): number {
  const firstIndex = (Math.max(1, page) - 1) * oldSize;
  return Math.floor(firstIndex / newSize) + 1;
}
