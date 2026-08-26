// Giữ tệp là MODULE - xem chú thích ở services/newsroom-service/test/reviveDead.test.ts.
export {};

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Ô "Tìm kiếm…" ở header, và việc gỡ thanh thẻ khỏi /blog (26/08/2026).
 *
 * ⚠️ Vì sao có tệp này: trước đợt này ô tìm kiếm ở header là một `<input>` KHÔNG
 * có state, KHÔNG có form, KHÔNG có onSubmit. Gõ vào rồi bấm Enter thì không có
 * gì xảy ra - một ô trang trí đặt ở chỗ dễ thấy nhất của site, và không cổng nào
 * bắt được vì một `<input>` không hành động thì cũng không lỗi.
 *
 * Đó là lớp hỏng chỉ MẮT NGƯỜI mới thấy, nên phải khoá bằng test quét NGUỒN -
 * cùng cách `themeTokens.test.ts` canh ba bản sao màu nền.
 *
 * `testEnvironment: 'node'` nên không dựng được React ở đây; kiểm bằng cấu trúc
 * nguồn là đúng tầm: thứ cần khoá là "ô này có dẫn đi đâu không", không phải
 * pixel.
 */

const ROOT = join(__dirname, '..', '..', '..');
const HEADER = join(ROOT, 'packages', 'ui', 'src', 'components', 'SiteHeader.tsx');
const BLOG = join(ROOT, 'apps', 'frontend-main', 'pages', 'blog', 'index.tsx');
const SEARCH = join(ROOT, 'apps', 'frontend-main', 'pages', 'search.tsx');

const header = readFileSync(HEADER, 'utf8');
const blog = readFileSync(BLOG, 'utf8');
const search = readFileSync(SEARCH, 'utf8');

describe('ô tìm kiếm ở header dẫn vào bộ tìm kiếm của /search', () => {
  test('là một <form method="get"> trỏ vào /search, không phải input trơ', () => {
    expect(header).toMatch(/<form[^>]*action="\/search"/s);
    expect(header).toMatch(/method="get"/);
    // `name="q"` là thứ biến ô nhập thành tham số URL. Thiếu nó thì biểu mẫu vẫn
    // gửi, vẫn tới /search, và vẫn KHÔNG mang theo từ khoá - hỏng im lặng.
    expect(header).toMatch(/name="q"/);
  });

  test('không còn <input> tìm kiếm nào đứng ngoài form', () => {
    const formStart = header.indexOf('action="/search"');
    expect(formStart).toBeGreaterThan(-1);
    const beforeForm = header.slice(0, formStart);
    expect(beforeForm).not.toMatch(/placeholder="Tìm kiếm/);
  });

  test('có lối vào /search cho màn hình hẹp', () => {
    // Ô ở thanh trên chỉ hiện từ breakpoint `xl`. Không có mục trong menu di
    // động thì máy điện thoại mất hẳn đường tới tìm kiếm - và đợt này vừa gỡ
    // thanh thẻ khỏi /blog, tức gỡ luôn đường duyệt thay thế.
    const mobileNav = header.slice(header.indexOf('aria-label="Di động"'));
    expect(mobileNav).toMatch(/href="\/search"/);
  });

  test('người dùng submit được bằng bàn phím', () => {
    expect(header).toMatch(/type="submit"/);
  });
});

describe('/blog nhường việc lọc theo thẻ cho /search', () => {
  test('không còn thanh lọc theo thẻ', () => {
    expect(blog).not.toMatch(/aria-label="Lọc theo thẻ"/);
    // Nhắm vào LIÊN KẾT, không nhắm vào chuỗi trần: chuỗi `/blog?tag=` vẫn còn
    // hợp lệ trong chú thích và trong đích chuyển hướng, và bản đầu của test này
    // đã đỏ vì bắt trúng đúng một dòng chú thích.
    expect(blog).not.toMatch(/href=[^>\n]*\/blog\?tag=/);
  });

  test('vẫn giữ lối vào /search', () => {
    expect(blog).toMatch(/href="\/search"/);
  });

  test('vẫn hiện thẻ của từng bài để nhận diện chủ đề', () => {
    expect(blog).toMatch(/p\.tags \|\| \[\]/);
  });

  // Liên kết cũ còn nằm trong bookmark và trong lịch sử trình duyệt. Bỏ nhánh
  // này thì `/blog?tag=x` lặng lẽ trả về trang KHÔNG lọc gì - sai kết quả mà
  // không báo lỗi, tệ hơn 404.
  test('`?tag=` cũ chuyển hướng sang /search chứ không im lặng bỏ qua', () => {
    expect(blog).toMatch(/redirect/);
    expect(blog).toMatch(/\/search\?tag=\$\{encodeURIComponent\(tag\)\}/);
  });
});

describe('/search nhận thanh duyệt thẻ', () => {
  test('có nguồn thẻ riêng để duyệt khi chưa gõ gì', () => {
    expect(search).toMatch(/allTags/);
    // Chỉ dựa vào `facets.tag` là không đủ: facet chỉ tồn tại KHI đã có truy vấn,
    // nên trang mở ra sẽ trống trơn và không gợi ý được gì.
    expect(search).toMatch(/!hasQuery && allTags\.length > 0/);
  });

  test('vẫn giữ facet thẻ kèm số lượng cho lúc đã có truy vấn', () => {
    expect(search).toMatch(/result\.facets\.tag/);
  });
});

describe('không còn đường tìm kiếm thứ hai nào trong app', () => {
  // Toàn bộ mục đích của đợt này là ĐỒNG BỘ: một bộ tìm kiếm, một chỗ dùng.
  // Thêm một ô tìm kiếm cục bộ ở trang khác là dựng lại đúng cái vừa gỡ.
  test('chỉ /search giữ ô nhập tìm kiếm', () => {
    const pages = join(ROOT, 'apps', 'frontend-main', 'pages');
    expect(existsSync(pages)).toBe(true);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, name.name);
        if (name.isDirectory()) walk(p);
        else if (/\.tsx$/.test(name.name)) {
          if (p.endsWith(join('pages', 'search.tsx'))) continue;
          const src = readFileSync(p, 'utf8');
          if (/placeholder="Tìm kiếm/.test(src)) offenders.push(p.slice(ROOT.length + 1));
        }
      }
    };
    walk(pages);
    expect(offenders).toEqual([]);
  });
});
