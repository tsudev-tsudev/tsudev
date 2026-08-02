/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // JWKS phải nằm đúng đường chuẩn /.well-known/ để bên thứ ba tìm thấy theo
  // quy ước; nội dung do trust-service sinh từ khoá ký nên không thể là file tĩnh.
  async rewrites() {
    return [{ source: '/.well-known/tsudev-trust-jwks.json', destination: '/api/trust/jwks' }];
  },
  transpilePackages: ['@tsudev/ui'],
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = Object.assign({}, config.resolve.alias, {
      react: path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
    });
    return config;
  },
};

module.exports = nextConfig;
