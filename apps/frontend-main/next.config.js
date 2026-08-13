/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // JWKS phải nằm đúng đường chuẩn /.well-known/ để bên thứ ba tìm thấy theo
  // quy ước; nội dung do trust-service sinh từ khoá ký nên không thể là file tĩnh.
  async rewrites() {
    return [{ source: '/.well-known/tsudev-trust-jwks.json', destination: '/api/trust/jwks' }];
  },
  // next-auth hoisted ở root node_modules, nơi vẫn còn react 18 — nếu để Next
  // externalize nó, require() runtime sẽ lấy nhầm bản 18 thay vì react 19 local
  // của app này (2 bản React cùng lúc -> useState trả null). Ép transpile để nó
  // đi qua webpack alias bên dưới.
  //
  // Ghim react 18 ở root package.json vốn tồn tại VÌ frontend-forum. App đó đã
  // bị gỡ, nên về lý thuyết ghim này bỏ được — nhưng Storybook của packages/ui
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

// Không gọi initOpenNextCloudflareForDev() ở đây — nó dựng proxy wrangler
// dev cho Cloudflare bindings (R2/KV) mà app này chưa dùng trực tiếp, và
// từng treo cứng `next dev` cục bộ (server "Starting..." không bao giờ
// xong). Cần preview đúng runtime Cloudflare thì dùng `npm run preview`
// (opennextjs-cloudflare build && opennextjs-cloudflare preview) thay vì
// `next dev`.
