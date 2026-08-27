/** @type {import('next').NextConfig} */

// CSP KHÔNG đặt ở đây. Nó cần NONCE mỗi request (để Cloudflare Bot Fight Mode gắn
// vào script JSD nó chèn ở edge), mà `headers()` của next.config là TĨNH. CSP ép
// thật nằm ở `proxy.ts` (băm THEME_SCRIPT + nonce mỗi request). Xem chú thích
// ở đầu proxy.ts. Ở đây chỉ giữ các header bảo mật TĨNH (không phụ thuộc request).

const nextConfig = {
  reactStrictMode: true,

  // `jose` và `@panva/hkdf` (đường ký/giải mã JWT của next-auth) khai `exports` có
  // ĐIỀU KIỆN: `workerd`/`worker`/`browser` trỏ `dist/browser` (jose) và `dist/web`
  // (hkdf), còn `require`/`import` trỏ `dist/node`. Bộ dò phụ thuộc của Next chạy
  // dưới điều kiện NODE nên chỉ chép `dist/node`; nhưng `opennextjs-cloudflare` gói
  // lại bằng esbuild dưới điều kiện WORKERD, và ở đó chỉ có `dist/browser` là hợp lệ.
  // Thiếu nhánh đó, esbuild báo "Could not resolve jose" - gói NẰM ĐÚNG CHỖ, chỉ là
  // nhánh điều kiện được yêu cầu chưa được chép sang.
  //
  // ⚠️ Đây là lớp hỏng chỉ lộ ở bước gói cho Cloudflare, KHÔNG lộ ở `next build`:
  // `npm run build` xanh trơn tru trong khi bản deploy được thì không dựng nổi.
  outputFileTracingIncludes: {
    '**': ['../../node_modules/jose/dist/browser/**', '../../node_modules/@panva/hkdf/dist/web/**'],
  },

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
          // CSP (Content-Security-Policy) đặt ở `proxy.ts` chứ không ở đây -
          // nó cần nonce mỗi request. Xem chú thích đầu proxy.ts.
        ],
      },
    ];
  },
  // next-auth hoisted ở root node_modules - nếu để Next externalize nó, require()
  // runtime có thể lấy nhầm một bản React khác thay vì react 19 (2 bản React cùng
  // lúc -> useState trả null). Ép transpile để nó đi qua đúng một bản.
  //
  // ⚠️ KHÔNG dựng lại `webpack(config)` alias react/react-dom bằng đường TUYỆT ĐỐI
  // ở đây. Nó có từ thời `packages/ui` giữ react 18 trong devDependencies, và dưới
  // next@16 nó KHÔNG bắt hết - chính nó là nguồn của React error #31 lúc prerender
  // `/admin` ({$$typeof, type, key, ref, props} = chữ ký hai bản React song song).
  // Cách đúng đã áp: dedup về MỘT bản react 19 cho toàn workspace (packages/ui nâng
  // devDeps react 18.3.1 -> 19.2.8 kèm Storybook 7.6 -> 8.6.18, vì SB7 peer react^18
  // chặn react 19), và `next-auth` nằm ở devDependencies GỐC chứ không ở packages/ui -
  // hai bản next-auth là hai SessionContext, `useSession()` trả undefined lúc prerender.
  // Kiểm khi đụng lại: `find . -path '*/node_modules/react/package.json'` phải ra
  // ĐÚNG một dòng ngoài `.open-next/`.
  transpilePackages: ['@tsudev/ui', 'next-auth'],
};

module.exports = nextConfig;

// Không gọi initOpenNextCloudflareForDev() ở đây - nó dựng proxy wrangler
// dev cho Cloudflare bindings (R2/KV) mà app này chưa dùng trực tiếp, và
// từng treo cứng `next dev` cục bộ (server "Starting..." không bao giờ
// xong). Cần preview đúng runtime Cloudflare thì dùng `npm run preview`
// (opennextjs-cloudflare build && opennextjs-cloudflare preview) thay vì
// `next dev`.
