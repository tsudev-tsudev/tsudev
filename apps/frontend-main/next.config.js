/** @type {import('next').NextConfig} */
const path = require('path');

// CSP KHÔNG đặt ở đây. Nó cần NONCE mỗi request (để Cloudflare Bot Fight Mode gắn
// vào script JSD nó chèn ở edge), mà `headers()` của next.config là TĨNH. CSP ép
// thật nằm ở `middleware.ts` (băm THEME_SCRIPT + nonce mỗi request). Xem chú thích
// ở đầu middleware.ts. Ở đây chỉ giữ các header bảo mật TĨNH (không phụ thuộc request).

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
          // CSP (Content-Security-Policy) đặt ở `middleware.ts` chứ không ở đây -
          // nó cần nonce mỗi request. Xem chú thích đầu middleware.ts.
        ],
      },
    ];
  },
  // next-auth hoisted ở root node_modules - nếu để Next externalize nó, require()
  // runtime có thể lấy nhầm một bản React khác thay vì react 19 local của app
  // này (2 bản React cùng lúc -> useState trả null). Ép transpile để nó đi qua
  // webpack alias bên dưới. Alias vẫn cần dù root đã sạch: `packages/ui` có
  // react 18 trong devDependencies của nó.
  //
  // Món nợ "ghim react 18 ở root" đã ĐÓNG (20/08/2026): bản 18 nay nằm ở
  // devDependencies của packages/ui, đúng nơi duy nhất cần nó là Storybook.
  // Kiểm khi đụng lại: `npm --workspace packages/ui run build-storybook` phải
  // ra đủ 12 story, và bản dev phải VẼ ra được chúng - xem docs/design-system.md
  // §Storybook.
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
