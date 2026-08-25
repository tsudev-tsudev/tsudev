// @tsudev/search - chuẩn hoá và lập chỉ mục tìm kiếm tiếng Việt DÙNG CHUNG.
//
// Theo .standards/docs/SEARCH_AND_FILTER.md §3. Một nguồn duy nhất cho việc bỏ
// dấu và chuẩn hoá - backend tính cột `search*Norm` lúc GHI, frontend đếm từ và
// (sau này) tô sáng dùng CÙNG logic này. Mỗi bản sao là một cơ hội để hai chỗ
// chuẩn hoá lệch nhau và kết quả tìm kiếm mâu thuẫn.
//
// Thuần TypeScript, KHÔNG phụ thuộc - chạy được cả trong Node (services) lẫn
// Cloudflare Workers (frontend).

/**
 * Bỏ dấu tiếng Việt. Xử lý riêng đ/Đ vì NFD KHÔNG tách được hai ký tự này -
 * đây là cái bẫy phổ biến nhất khi xử lý tiếng Việt.
 */
export function viRemoveDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D');
}

/** Chuẩn hoá để so khớp: NFC -> chữ thường -> bỏ dấu -> gộp khoảng trắng. */
export function viNormalizeText(input: string): string {
  return viRemoveDiacritics(input.normalize('NFC').toLowerCase()).replace(/\s+/g, ' ').trim();
}

/**
 * Đếm từ theo cụm cách nhau bởi khoảng trắng (mức tối thiểu ở tầng giao diện,
 * SEARCH_AND_FILTER §3.3 / RICH_TEXT_EDITOR §3.5). Đây là logic dùng chung giữa
 * ô đếm từ của trình soạn thảo và mọi nơi cần ước lượng độ dài.
 */
export function viWordCount(input: string): number {
  const t = input.replace(/\s+/g, ' ').trim();
  if (!t) return 0;
  return t.split(' ').length;
}

/**
 * Rút văn bản thuần từ Markdown/HTML để lập chỉ mục: bỏ thẻ, GIỮ lại `alt` của
 * ảnh và chữ hiển thị của liên kết (SEARCH_AND_FILTER §3.1 bước 1). KHÔNG lập
 * chỉ mục trực tiếp trên chuỗi thô có cú pháp.
 */
export function stripToPlainText(input: string): string {
  return (
    input
      // khối mã ```...``` và mã inline `...` -> giữ nội dung, bỏ dấu nháy
      .replace(/```[\w-]*\n?([\s\S]*?)```/g, ' $1 ')
      .replace(/`([^`]+)`/g, '$1')
      // ảnh ![alt](url) -> giữ alt
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
      // liên kết [text](url) -> giữ text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // thẻ HTML
      .replace(/<[^>]+>/g, ' ')
      // dấu markdown đầu dòng / nhấn mạnh
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
      .replace(/^[ \t]*>[ \t]?/gm, '')
      .replace(/^[ \t]*[-*+][ \t]+/gm, '')
      .replace(/[*_~]{1,3}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Tính SẴN hai cột chỉ mục cho một bài, gọi ở MỌI đường ghi Post (người viết lẫn
 * Toà soạn Agent AI). `searchBodyNorm` gộp tóm tắt + nội dung để một lần khớp phủ
 * cả hai. Đây là điểm duy nhất quyết định cái gì lọt vào chỉ mục.
 */
export function buildPostSearch(input: {
  title: string;
  excerpt?: string | null;
  contentMd: string;
}): { searchTitleNorm: string; searchBodyNorm: string } {
  const body = [input.excerpt ?? '', stripToPlainText(input.contentMd)].filter(Boolean).join(' ');
  return {
    searchTitleNorm: viNormalizeText(input.title),
    searchBodyNorm: viNormalizeText(body),
  };
}

/**
 * Tính SẴN hai cột chỉ mục cho một TÀI LIỆU (`Doc`). Tách khỏi `buildPostSearch`
 * vì Doc không có cột tóm tắt - gộp chung bằng một hàm nhận `excerpt?` sẽ khiến
 * chỗ gọi im lặng truyền thiếu và không ai biết. Gọi ở MỌI đường ghi Doc.
 */
export function buildDocSearch(input: { title: string; contentMd: string }): {
  searchTitleNorm: string;
  searchBodyNorm: string;
} {
  return {
    searchTitleNorm: viNormalizeText(input.title),
    searchBodyNorm: viNormalizeText(stripToPlainText(input.contentMd)),
  };
}

/**
 * Rút một đoạn trích quanh vị trí khớp ĐẦU TIÊN, để thẻ kết quả của Doc có phần
 * mô tả (Doc không có cột tóm tắt). Trả về văn bản GỐC đã cắt, nên `findMatchRanges`
 * vẫn tô sáng đúng trên đó. Không khớp ⇒ lấy phần đầu bài.
 */
export function buildSnippet(contentMd: string, query: string, radius = 90): string {
  const plain = stripToPlainText(contentMd);
  if (!plain) return '';
  const ranges = query ? findMatchRanges(plain, query) : [];
  const hit = ranges[0];
  const width = radius * 2;
  if (!hit) return plain.length <= width ? plain : plain.slice(0, width).trimEnd() + '…';
  const start = Math.max(0, hit[0] - radius);
  const end = Math.min(plain.length, hit[1] + radius);
  return (start > 0 ? '…' : '') + plain.slice(start, end).trim() + (end < plain.length ? '…' : '');
}

/**
 * Tìm các đoạn KHỚP trong chuỗi GỐC để tô sáng, kể cả khi người dùng gõ KHÔNG
 * DẤU mà văn bản gốc CÓ DẤU (SEARCH_AND_FILTER §2.3). Trả về mảng [start, end)
 * theo chỉ số của chuỗi GỐC - đây là chỗ hầu hết cách làm sai, vì vị trí ký tự
 * của chuỗi đã chuẩn hoá không trùng chuỗi gốc.
 *
 * Cách làm: chuẩn hoá gốc theo TỪNG ký tự, giữ hai bảng ánh xạ (đầu/cuối gốc của
 * mỗi ký tự chuẩn hoá), gộp khoảng trắng đồng bộ với `viNormalizeText`, rồi tìm
 * từ khoá đã chuẩn hoá trên chuỗi chuẩn hoá và ánh xạ ngược vị trí.
 */
export function findMatchRanges(original: string, query: string): Array<[number, number]> {
  const qn = viNormalizeText(query);
  if (!qn) return [];

  let norm = '';
  const startOf: number[] = []; // startOf[i] = chỉ số đầu (gốc) của ký tự chuẩn hoá i
  const endOf: number[] = []; // endOf[i]   = chỉ số cuối exclusive (gốc)
  let prevSpace = false;
  let origIdx = 0;
  for (const ch of original) {
    const nextIdx = origIdx + ch.length;
    if (/\s/.test(ch)) {
      // Chỉ thêm MỘT khoảng trắng giữa các từ (khớp bước gộp của viNormalizeText),
      // và không thêm khoảng trắng dẫn đầu.
      if (!prevSpace && norm.length > 0) {
        norm += ' ';
        startOf.push(origIdx);
        endOf.push(nextIdx);
      }
      prevSpace = true;
    } else {
      const n = viRemoveDiacritics(ch.normalize('NFC').toLowerCase());
      for (const c of n) {
        norm += c;
        startOf.push(origIdx);
        endOf.push(nextIdx);
      }
      prevSpace = false;
    }
    origIdx = nextIdx;
  }

  const ranges: Array<[number, number]> = [];
  let from = 0;
  for (;;) {
    const at = norm.indexOf(qn, from);
    if (at < 0) break;
    const last = at + qn.length - 1;
    const s = startOf[at];
    const e = endOf[last];
    if (s !== undefined && e !== undefined) ranges.push([s, e]);
    from = at + qn.length;
  }
  return ranges;
}
