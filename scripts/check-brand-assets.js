#!/usr/bin/env node
// Cổng kiểm tài sản nhận diện - BRAND_ASSETS.md mục 12.2 (bộ quy ước v3.0.0).
//
// Vì sao cần cổng này: thiếu favicon thì trang VẪN CHẠY, CI vẫn xanh, và thứ duy
// nhất đổi là tab trình duyệt trống - không ai thấy cho tới khi có người nhìn vào
// tab. Bộ quy ước gọi bộ tài sản này là "điều kiện phát hành", nên nó phải chặn
// được ở CI chứ không nằm trong danh sách kiểm bằng mắt.
//
// Bản trong quy ước chỉ kiểm SỰ TỒN TẠI của bốn file. Bản này kiểm thêm HÌNH
// DẠNG, vì cách hỏng thật hay gặp không phải là mất file mà là file sai: một PNG
// 256 đổi đuôi thành .ico (mục 7 cấm đích danh), một icon maskable dùng lại bản
// thường nên bị xén mất viền, một apple-touch-icon còn alpha nên iOS tô nền đen.
//
// Thuần Node, KHÔNG dùng dependency: job "Kiểm quy ước" chạy trước `npm ci`, nên
// mọi thứ ở đây đọc thẳng byte của PNG/ICO.

'use strict';

const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'apps', 'frontend-main', 'public');

const problems = [];
const fail = (msg) => problems.push(msg);

function read(rel) {
  const p = path.join(PUB, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

// PNG: 8 byte chữ ký, rồi chunk IHDR (dài 13) - rộng, cao, bit depth, color type.
// color type 2 = RGB (không alpha) · 6 = RGBA · 3 = bảng màu · 0/4 = xám.
function pngInfo(buf) {
  if (!buf || buf.length < 33) return null;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) return null;
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25],
  };
}

function checkPng(rel, { width, height, opaque = false }) {
  const info = pngInfo(read(rel));
  if (!info) return fail(`${rel}: thiếu, hoặc không phải PNG hợp lệ`);
  if (info.width !== width || info.height !== height)
    fail(`${rel}: cỡ ${info.width}x${info.height}, chuẩn đòi ${width}x${height}`);
  // colorType 6 = RGBA, 4 = xám+alpha. Cả hai nghĩa là ảnh MANG kênh alpha.
  if (opaque && (info.colorType === 6 || info.colorType === 4))
    fail(`${rel}: còn kênh alpha, chuẩn đòi nền ĐẶC (iOS/Android tự tô nền vào chỗ trong suốt)`);
}

// ICO: 6 byte header (reserved, type=1, số ảnh) rồi mỗi ảnh 16 byte mục lục.
// Byte cỡ bằng 0 nghĩa là 256.
function icoSizes(buf) {
  if (!buf || buf.length < 6) return null;
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const n = buf.readUInt16LE(4);
  if (!n || buf.length < 6 + n * 16) return null;
  return Array.from({ length: n }, (_, i) => buf[6 + i * 16] || 256);
}

// --- 1. favicon.ico nhiều lớp (BRAND_ASSETS mục 7: MUST 16/24/32/48/64/128/256).
// Mục 6 của cùng tài liệu chỉ liệt kê 16/32/48 - đó là bảng KÍCH THƯỚC TỐI THIỂU
// và bộ bảy lớp thoả luôn nó, nên không có mâu thuẫn khi thi hành.
const REQUIRED_ICO = [16, 24, 32, 48, 64, 128, 256];
const sizes = icoSizes(read('favicon.ico'));
if (!sizes) {
  fail('favicon.ico: thiếu, hoặc không phải file ICO thật (mục 7 cấm PNG đổi đuôi)');
} else {
  const missing = REQUIRED_ICO.filter((s) => !sizes.includes(s));
  if (missing.length)
    fail(`favicon.ico: thiếu lớp ${missing.join('/')} (đang có ${sizes.join('/')})`);
}

// --- 2. Bộ PNG bắt buộc cho web (BRAND_ASSETS mục 12.1).
checkPng('favicon-96x96.png', { width: 96, height: 96 });
checkPng('favicon-32x32.png', { width: 32, height: 32 });
checkPng('favicon-16x16.png', { width: 16, height: 16 });
checkPng('apple-touch-icon.png', { width: 180, height: 180, opaque: true });
checkPng('og-image.png', { width: 1200, height: 630 });

// --- 3. Icon PWA: bản thường VÀ bản maskable, mỗi cỡ một ảnh riêng.
checkPng('android-chrome-192x192.png', { width: 192, height: 192 });
checkPng('android-chrome-512x512.png', { width: 512, height: 512 });
checkPng('android-chrome-maskable-192x192.png', { width: 192, height: 192, opaque: true });
checkPng('android-chrome-maskable-512x512.png', { width: 512, height: 512, opaque: true });

// --- 4. Manifest phải KHAI hai loại icon đó, và khai tách bạch.
const manifestRaw = read('site.webmanifest');
if (!manifestRaw) {
  fail('site.webmanifest: thiếu');
} else {
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw.toString('utf8'));
  } catch (e) {
    fail(`site.webmanifest: JSON không hợp lệ (${e.message})`);
  }
  if (manifest) {
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    const has = (purpose, size) =>
      icons.some((i) => (i.purpose || 'any').split(/\s+/).includes(purpose) && i.sizes === size);
    for (const size of ['192x192', '512x512']) {
      if (!has('any', size)) fail(`site.webmanifest: thiếu icon purpose="any" cỡ ${size}`);
      if (!has('maskable', size))
        fail(`site.webmanifest: thiếu icon purpose="maskable" cỡ ${size}`);
    }
    // Gộp 'any maskable' trên MỘT ảnh nghĩa là Android vừa dùng nó nguyên khung,
    // vừa xén nó theo hình dạng máy - một trong hai lần chắc chắn sai.
    for (const i of icons) {
      const p = (i.purpose || 'any').split(/\s+/);
      if (p.includes('any') && p.includes('maskable'))
        fail(`site.webmanifest: ${i.src} khai gộp "any maskable"; phải tách thành hai ảnh`);
    }
    for (const i of icons) {
      if (!read(i.src.replace(/^\//, '')))
        fail(`site.webmanifest: khai ${i.src} nhưng file không có trong public/`);
    }
  }
}

if (problems.length) {
  console.error('\nCổng kiểm tài sản nhận diện: KHÔNG ĐẠT\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    '\nSửa ở packages/brand/source/ rồi chạy `node packages/brand/build-assets.js`.' +
      '\nKHÔNG cắt tay từng cỡ (BRAND_ASSETS.md mục 7).\n'
  );
  process.exit(1);
}

console.log('Cổng kiểm tài sản nhận diện: ĐẠT (favicon 7 lớp · bộ PNG · PWA any+maskable).');
