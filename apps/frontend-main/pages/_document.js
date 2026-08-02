import { Html, Head, Main, NextScript } from 'next/document';

// Site chỉ có một giao diện (tối) — token nằm ở :root nên không cần
// script khởi tạo theme, cũng không còn nguy cơ nháy màu khi tải trang.
// Bộ favicon/manifest sinh từ packages/brand (xem packages/brand/README.md).
export default function Document() {
  return (
    <Html lang="vi">
      <Head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#000000" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
