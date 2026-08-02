/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // JWKS phải nằm đúng đường chuẩn /.well-known/ để bên thứ ba tìm thấy theo
  // quy ước; nội dung do trust-service sinh từ khoá ký nên không thể là file tĩnh.
  async rewrites() {
    return [{ source: '/.well-known/tsudev-trust-jwks.json', destination: '/api/trust/jwks' }];
  },
  // next-auth hoisted ở root node_modules dùng chung với react 18 của
  // frontend-forum — nếu để Next externalize nó, require() runtime của nó sẽ
  // lấy nhầm bản react 18 thay vì react 19 local của app này (2 bản React
  // khác nhau cùng lúc -> useState trả null). Ép transpile để nó đi qua
  // webpack alias react/react-dom bên dưới.
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

// Không gọi initOpenNextCloudflareForDev() ở đây — nó dựng proxy wrangler
// dev cho Cloudflare bindings (R2/KV) mà app này chưa dùng trực tiếp, và
// từng treo cứng `next dev` cục bộ (server "Starting..." không bao giờ
// xong). Cần preview đúng runtime Cloudflare thì dùng `npm run preview`
// (opennextjs-cloudflare build && opennextjs-cloudflare preview) thay vì
// `next dev`.
