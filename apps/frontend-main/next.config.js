/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // JWKS phải nằm đúng đường chuẩn /.well-known/ để bên thứ ba tìm thấy theo
  // quy ước; nội dung do trust-service sinh từ khoá ký nên không thể là file tĩnh.
  async rewrites() {
    return [{ source: '/.well-known/tsudev-trust-jwks.json', destination: '/api/trust/jwks' }];
  },

  // Header bảo mật cho MỌI phản hồi.
  //
  // Trước đây site không đặt một header nào trong nhóm này - trong khi
  // packages/db/prisma/seed.js lại khai "Có CSP, X-Content-Type-Options,
  // Referrer-Policy" làm TIÊU CHÍ cấp con dấu tín nhiệm. Tức là tsudev đi cấp dấu
  // cho tiêu chí mà chính nó trượt.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Chặn trình duyệt tự đoán kiểu nội dung - biến một tệp tải lên thành
          // HTML thực thi được là cách cũ nhất để leo từ upload lên XSS.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Không rò đường dẫn đầy đủ sang site khác. Trang xác minh chứng chỉ
          // hay được mở từ site của khách, và URL của nó chứa số serial.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Mã nhúng huy hiệu dùng <a> + <img>, KHÔNG dùng iframe - nên chặn
          // đóng khung không phá vỡ tính năng nào, mà dập được clickjacking.
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          // Cloudflare thường tự thêm, nhưng đặt ở đây thì nó đúng kể cả khi đổi
          // nhà cung cấp. 2 năm + preload là mức khuyến nghị hiện hành.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // ---------------------------------------------------------------
          // CSP ở chế độ CHỈ BÁO CÁO, có chủ đích. KHÔNG phải quên bật.
          //
          // Bật chặn thật mà chưa đo được là rủi ro hỏng thầm lặng: trình duyệt
          // PUT thẳng lên endpoint R2 bằng URL presign, và host đó đến từ biến
          // môi trường chứ không biết được lúc build - CSP thiếu nó thì upload
          // chết mà không có lỗi phía máy chủ.
          //
          // Cách bật: mở site, xem Console vài phút thao tác thật (đăng nhập,
          // xem blog, upload một tệp). Không có dòng "Report Only" nào thì đổi
          // tên key dưới đây thành 'Content-Security-Policy'.
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              // 'unsafe-inline' là bắt buộc với Pages Router: Next nhúng script
              // bootstrap nội tuyến và không có nonce nếu chưa có middleware.
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  // next-auth hoisted ở root node_modules, nơi vẫn còn react 18 - nếu để Next
  // externalize nó, require() runtime sẽ lấy nhầm bản 18 thay vì react 19 local
  // của app này (2 bản React cùng lúc -> useState trả null). Ép transpile để nó
  // đi qua webpack alias bên dưới.
  //
  // Ghim react 18 ở root package.json vốn tồn tại VÌ frontend-forum. App đó đã
  // bị gỡ, nên về lý thuyết ghim này bỏ được - nhưng Storybook của packages/ui
  // khai react là peerDependency và đang lấy từ root, mà Storybook không nằm
  // trong CI. Gỡ mù là hỏng âm thầm. Việc dọn: chuyển react/react-dom xuống
  // devDependencies của packages/ui rồi kiểm `build-storybook`.
  transpilePackages: ['@tsudev/ui', 'next-auth'],
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = Object.assign({}, config.resolve.alias, {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    });
    return config;
  },
};

module.exports = nextConfig;

// Không gọi initOpenNextCloudflareForDev() ở đây - nó dựng proxy wrangler
// dev cho Cloudflare bindings (R2/KV) mà app này chưa dùng trực tiếp, và
// từng treo cứng `next dev` cục bộ (server "Starting..." không bao giờ
// xong). Cần preview đúng runtime Cloudflare thì dùng `npm run preview`
// (opennextjs-cloudflare build && opennextjs-cloudflare preview) thay vì
// `next dev`.
