#!/usr/bin/env node
'use strict';
// In URL công khai ở production của một node, lấy từ config/topology.json.
//
// Tồn tại vì một cái bẫy cụ thể: Next xếp `.env.local` CAO HƠN `.env.production`,
// mà `apps/*/.env.local` lại được sinh tự động mỗi lần chạy dev và trỏ về
// tsudev.localhost. Lệnh deploy chạy TRÊN MÁY DEV — nên nếu chỉ dựa vào
// `.env.production` thì bản deploy thật sẽ nướng tsudev.localhost vào thẻ
// canonical, ảnh OG và sitemap. Không có gì báo lỗi; chỉ là Google gộp nhầm
// URL và ảnh xem trước link chết.
//
// Biến đặt sẵn trong shell thì Next KHÔNG ghi đè — nên script deploy truyền
// giá trị này vào môi trường là cách duy nhất chắc chắn thắng .env.local.
//
//   node scripts/topology/prod-url.js main   →  https://tsudev.com

const { loadTopology, prodUrl } = require('./load');

const id = process.argv[2];
if (!id) {
  console.error('Dùng: node scripts/topology/prod-url.js <node-id>');
  process.exit(1);
}
process.stdout.write(prodUrl(loadTopology(), id));
