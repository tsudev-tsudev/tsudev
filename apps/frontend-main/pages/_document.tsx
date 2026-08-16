import { Html, Head, Main, NextScript } from 'next/document';

// Màu nền của hai chế độ, phải khớp `--surface` trong packages/ui/src/tokens.css.
// Dùng cho <meta name="theme-color"> (thanh địa chỉ trên di động) và cho nền
// vẽ trước khi CSS tải xong.
const LIGHT_SURFACE = '#eef3fa';
const DARK_SURFACE = '#000000';

/**
 * Áp chế độ hiển thị TRƯỚC KHI TRANG ĐƯỢC VẼ.
 *
 * Phải là script đồng bộ, nội tuyến, đặt trong <head>. Bất cứ thứ gì chạy sau
 * lần vẽ đầu — useEffect, script defer, next/script — đều cho ra một khung hình
 * sáng trắng trước khi chuyển sang tối. Trên nền đen tuyền của chế độ tối thì
 * cú nháy đó chói mắt, và nó xuất hiện ở MỌI lần tải trang.
 *
 * Bọc trong try/catch vì localStorage ném lỗi khi cookie bên thứ ba bị chặn
 * hoặc khi trang chạy trong iframe sandbox. Hỏng ở đây phải là "hiện chế độ
 * sáng mặc định", không phải "trang trắng vì script chết".
 */
const THEME_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('tsudev-theme');
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', '${DARK_SURFACE}');
    }
  } catch (e) {}
})();
`;

export default function Document() {
  return (
    <Html lang="vi">
      <Head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        {/* Giá trị mặc định là chế độ SÁNG; script bên dưới đổi nó khi cần. */}
        <meta name="theme-color" content={LIGHT_SURFACE} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
