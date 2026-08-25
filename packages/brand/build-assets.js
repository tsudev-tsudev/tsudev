#!/usr/bin/env node
'use strict';
/**
 * Sinh toàn bộ tài nguyên thương hiệu cho web từ các file gốc trong `source/`.
 *
 *   node packages/brand/build-assets.js
 *
 * Yêu cầu: `sharp` (không nằm trong dependency của repo - cài tạm khi cần:
 * `npm i --no-save sharp`). Kết quả đã được commit sẵn nên chỉ cần chạy lại
 * script này khi thay ảnh gốc.
 *
 * Đầu ra được ghi vào `public/` của MỌI app trong APPS bên dưới.
 */

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Thiếu `sharp`. Chạy: npm i --no-save sharp');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(__dirname, 'source');
const APPS = ['apps/frontend-main'].map((a) => path.join(ROOT, a, 'public'));

// Số biến thể avatar mặc định + góc xoay hue (độ) so với ảnh gốc (xanh dương).
const AVATAR_VARIANTS = [
  { name: 'default-01', hue: 0 }, // xanh dương (gốc)
  { name: 'default-02', hue: -40 }, // xanh ngọc
  { name: 'default-03', hue: -90 }, // xanh lá
  { name: 'default-04', hue: 45 }, // tím
  { name: 'default-05', hue: 95 }, // hồng sen
  { name: 'default-06', hue: 155 }, // hổ phách
];
// Tông xanh gốc của thương hiệu; các biến thể lệch hue so với mốc này.
const BASE_HUE = 213;

// Hai mức chi tiết cho quả cầu lưới. Ở 32-40px, 3 kinh + 5 vĩ bị rối nét, nên
// bản `sm` rút còn 2 kinh + 3 vĩ và tăng bề dày nét tương đối để vẫn rõ.
// `Avatar.jsx` chọn bộ nào theo prop `size` (ngưỡng AVATAR_SMALL_MAX).
const DETAIL = {
  lg: {
    dir: 'avatars',
    size: 256,
    meridians: [0, 32, 58],
    latitudes: [-52, -26, 0, 26, 52],
    nodesEq: 8,
    nodesOther: 6,
    strokeScale: 1,
  },
  sm: {
    dir: 'avatars/sm',
    size: 128,
    meridians: [0, 50],
    latitudes: [-32, 0, 32],
    nodesEq: 6,
    nodesOther: 4,
    strokeScale: 1.45,
  },
};

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

/**
 * Avatar mặc định: quả cầu lưới phát sáng, VẼ BẰNG VECTOR.
 *
 * Vì sao không cắt từ `source/avatar.png`: ảnh đó có dòng chữ "tsudev_" đè lên
 * vùng xích đạo của quả cầu, nên phần lưới nằm dưới chữ đã mất hẳn dữ liệu.
 * Mọi cách vá (lấp từ bản xoay, nội suy) đều để lại vệt rõ. Dựng lại bằng vector
 * cho hình sạch tuyệt đối ở mọi kích thước, file nhỏ, và đổi màu chính xác theo
 * từng biến thể thay vì xoay hue gần đúng.
 */
function networkGlobeSvg({ hue = 210, size = 256, detail = DETAIL.lg } = {}) {
  const S = size;
  const c = S / 2;
  const R = S * 0.345;
  const { meridians: MERIDIANS, latitudes: LATITUDES, nodesEq, nodesOther, strokeScale } = detail;
  const hsl = (h, s, l, a = 1) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`;
  const arc = hsl(hue, 72, 58);
  const arcDim = hsl(hue, 65, 44);
  const nodeHot = hsl(hue, 95, 88);

  // Kinh tuyến: hình chiếu trực giao của kinh tuyến lên mặt cầu là ellipse có
  // bán trục ngang R*cos(λ), bán trục dọc R.
  const meridians = MERIDIANS.map((deg) => {
    const rx = Math.max(1.2, R * Math.cos((deg * Math.PI) / 180));
    return `<ellipse cx="${c}" cy="${c}" rx="${rx.toFixed(1)}" ry="${R.toFixed(1)}"/>`;
  }).join('');

  // Vĩ tuyến: ellipse dẹt, tâm dịch theo R*sin(φ).
  const latitudes = LATITUDES.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const rx = R * Math.cos(rad);
    const ry = Math.max(1.1, rx * 0.28);
    const cy = c - R * Math.sin(rad) * 0.92;
    return `<ellipse cx="${c}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/>`;
  }).join('');

  // Nút mạng đặt trên các vĩ tuyến, cỡ và độ sáng thay đổi theo một chuỗi tất
  // định (không dùng random để mỗi lần build ra kết quả giống hệt).
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const nodes = [];
  for (const deg of LATITUDES) {
    const rad = (deg * Math.PI) / 180;
    const rx = R * Math.cos(rad);
    const ry = Math.max(1.1, rx * 0.28);
    const cy = c - R * Math.sin(rad) * 0.92;
    const n = deg === 0 ? nodesEq : nodesOther;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2 + rnd() * 0.25;
      const x = c + rx * Math.cos(t);
      const y = cy + ry * Math.sin(t);
      const r = (rnd() * 1.7 + 1.5) * (S / 256) * strokeScale;
      const hot = rnd() > 0.62;
      nodes.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${
          hot ? nodeHot : arc
        }"/>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="disc" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="${hsl(hue, 42, 12)}"/>
      <stop offset="70%" stop-color="${hsl(hue, 38, 7)}"/>
      <stop offset="100%" stop-color="${hsl(hue, 30, 4)}"/>
    </radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${(S / 90).toFixed(2)}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="${c}" cy="${c}" r="${c}" fill="url(#disc)"/>
  <g filter="url(#glow)">
    <g fill="none" stroke="${arcDim}" stroke-width="${((S / 170) * strokeScale).toFixed(
    2
  )}" opacity="0.85">${meridians}${latitudes}</g>
    <circle cx="${c}" cy="${c}" r="${R.toFixed(1)}" fill="none" stroke="${arc}" stroke-width="${(
    (S / 140) *
    strokeScale
  ).toFixed(2)}"/>
    <g>${nodes.join('')}</g>
  </g>
</svg>`;
}

/** Ghi cùng một buffer vào cùng đường dẫn tương đối của mọi app. */
function emit(relPath, buf) {
  for (const pub of APPS) {
    const out = path.join(pub, relPath);
    ensureDir(path.dirname(out));
    fs.writeFileSync(out, buf);
  }
  console.log(`  ${relPath.padEnd(34)} ${(buf.length / 1024).toFixed(1)} kB`);
}

/**
 * Xoá nền bằng flood fill 4 hướng xuất phát từ toàn bộ viền ảnh.
 *
 * Ưu điểm so với cách "biến mọi pixel gần trắng thành trong suốt": chỉ vùng nền
 * NỐI LIỀN với viền mới bị xoá, nên các mảng trắng nằm bên trong logo (chữ TSU,
 * nét sáng của bộ não, highlight trên cánh) được giữ nguyên.
 *
 * Biên được làm mềm: pixel trong vùng nền có màu càng lệch khỏi màu nền thì alpha
 * càng cao, nhờ vậy không còn viền răng cưa hay quầng sáng quanh logo.
 */
async function removeBackground(inputPath, { inner = 40, outer = 58 } = {}) {
  const img = sharp(inputPath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  // Màu nền = trung vị của các pixel viền.
  const samples = [];
  for (let x = 0; x < W; x += 7) {
    samples.push([x, 0], [x, H - 1]);
  }
  for (let y = 0; y < H; y += 7) {
    samples.push([0, y], [W - 1, y]);
  }
  const med = (arr) => arr.sort((a, b) => a - b)[arr.length >> 1];
  const bg = [0, 1, 2].map((ch) => med(samples.map(([x, y]) => data[(y * W + x) * C + ch])));

  const dist = (i) => {
    const dr = data[i] - bg[0];
    const dg = data[i + 1] - bg[1];
    const db = data[i + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  // Flood fill lặp (dùng stack thay đệ quy để không tràn ngăn xếp với ảnh lớn).
  const inRegion = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    if (inRegion[p]) return;
    if (dist(p * C) > outer) return;
    inRegion[p] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  // Gán alpha: trong vùng nền -> chuyển dần từ trong suốt sang đục theo độ lệch màu.
  let removed = 0;
  for (let p = 0; p < W * H; p++) {
    if (!inRegion[p]) continue;
    const d = dist(p * C);
    let a;
    if (d <= inner) a = 0;
    else if (d >= outer) a = 255;
    else a = Math.round(((d - inner) / (outer - inner)) * 255);
    data[p * C + 3] = a;
    if (a === 0) removed++;
  }

  const pct = ((removed / (W * H)) * 100).toFixed(1);
  console.log(
    `  nền #${bg.map((v) => v.toString(16).padStart(2, '0')).join('')} - xoá ${pct}% pixel`
  );

  // trim() cắt bỏ viền trong suốt thừa quanh nội dung.
  return sharp(data, { raw: { width: W, height: H, channels: C } })
    .png()
    .toBuffer();
}

/** Tìm dải hàng trong suốt lớn nhất ở giữa ảnh để tách biểu tượng khỏi chữ. */
async function splitMarkFromWordmark(pngBuf) {
  const { data, info } = await sharp(pngBuf).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const rowOpaque = new Int32Array(H);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) if (data[(y * W + x) * C + 3] > 24) n++;
    rowOpaque[y] = n;
  }
  // Bỏ qua 25% trên và 15% dưới, tìm khoảng trống dài nhất ở giữa.
  const lo = Math.floor(H * 0.25);
  const hi = Math.floor(H * 0.85);
  let best = null;
  let runStart = -1;
  for (let y = lo; y <= hi; y++) {
    const empty = rowOpaque[y] <= Math.max(2, W * 0.002);
    if (empty && runStart < 0) runStart = y;
    if ((!empty || y === hi) && runStart >= 0) {
      const len = y - runStart;
      if (!best || len > best.len) best = { start: runStart, len };
      runStart = -1;
    }
  }
  if (best && best.len >= 6) return best.start + Math.floor(best.len / 2);

  // Quầng sáng của logo khiến hiếm khi có dải hàng trống hẳn - lùi về cách chắc
  // chắn hơn: chọn hàng có ít pixel đục nhất trong dải giữa.
  let minY = lo;
  for (let y = lo; y <= hi; y++) if (rowOpaque[y] < rowOpaque[minY]) minY = y;
  const median = [...rowOpaque].sort((a, b) => a - b)[H >> 1];
  return rowOpaque[minY] < median * 0.1 ? minY : null;
}

/**
 * Dải chữ (wordmark) là hình phẳng, không có quầng sáng, nên có thể dọn bằng
 * ngưỡng màu toàn cục. Nhờ vậy lòng các chữ kín như "d"/"e" - vùng nền bị bao
 * kín mà flood fill từ viền không với tới - cũng trở thành trong suốt.
 */
async function clearEnclosedInBand(pngBuf, fromY, { inner = 40, outer = 58 } = {}) {
  const { data, info } = await sharp(pngBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const samples = [];
  for (let x = 0; x < W; x += 7) samples.push([x, 0], [x, H - 1]);
  const med = (arr) => arr.sort((a, b) => a - b)[arr.length >> 1];
  const bg = [0, 1, 2].map((ch) => med(samples.map(([x, y]) => data[(y * W + x) * C + ch])));

  for (let y = fromY; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      if (data[i + 3] === 0) continue;
      const dr = data[i] - bg[0];
      const dg = data[i + 1] - bg[1];
      const db = data[i + 2] - bg[2];
      const d = Math.sqrt(dr * dr + dg * dg + db * db);
      if (d <= inner) data[i + 3] = 0;
      else if (d < outer)
        data[i + 3] = Math.min(data[i + 3], Math.round(((d - inner) / (outer - inner)) * 255));
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: C } })
    .png()
    .toBuffer();
}

/** PNG nén bảng màu - logo là hình đồ hoạ nên giảm được rất nhiều dung lượng. */
const pngOpts = { palette: true, quality: 90, effort: 10, compressionLevel: 9 };

/**
 * Đổi mực chữ navy sang màu sáng để dùng trên nền tối.
 *
 * Chỉ áp cho dải chữ (từ `fromY` xuống), nên hình con cú không bị đụng tới - nó
 * vốn đủ tương phản trên cả nền sáng lẫn nền tối.
 *
 * Phân biệt mực navy với chữ cam bằng hiệu `b - r`: navy `#11355A` cho +73, cam
 * `#FE7B2E` cho -208. Pixel ở giữa hai vùng (viền khử răng cưa giữa hai màu chữ)
 * được pha theo tỉ lệ, nên không sinh ra viền tối quanh chữ cam. Alpha giữ
 * nguyên - chính nó mới là thứ mang hình dạng nét chữ.
 */
async function inkToLight(pngBuf, fromY, target = [255, 255, 255]) {
  const { data, info } = await sharp(pngBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  let touched = 0;
  for (let y = fromY; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      if (data[i + 3] === 0) continue;
      const t = Math.max(0, Math.min(1, (data[i + 2] - data[i]) / 40));
      if (t === 0) continue;
      for (let ch = 0; ch < 3; ch++) {
        data[i + ch] = Math.round(data[i + ch] * (1 - t) + target[ch] * t);
      }
      touched++;
    }
  }
  const hex = target.map((v) => v.toString(16).padStart(2, '0')).join('');
  console.log(`  đổi mực ${touched} pixel sang #${hex}`);

  return sharp(data, { raw: { width: W, height: H, channels: C } })
    .png()
    .toBuffer();
}

/** Dựng file .ico thật (container nhiều độ phân giải, dữ liệu PNG bên trong). */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach((e, i) => {
    const b = i * 16;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, b + 0);
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, b + 1);
    dir.writeUInt8(0, b + 2); // số màu bảng
    dir.writeUInt8(0, b + 3); // reserved
    dir.writeUInt16LE(1, b + 4); // planes
    dir.writeUInt16LE(32, b + 6); // bits per pixel
    dir.writeUInt32LE(e.data.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += e.data.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.data)]);
}

async function main() {
  for (const pub of APPS) ensureDir(pub);

  console.log('\n[1/5] Logo - xoá nền');
  const logoTransparent = await removeBackground(path.join(SRC, 'logo.jpeg'));
  let logoTrimmed = await sharp(logoTransparent).trim().png().toBuffer();

  const splitY = await splitMarkFromWordmark(logoTrimmed);
  if (splitY) {
    logoTrimmed = await clearEnclosedInBand(logoTrimmed, splitY);
    console.log(`  tách biểu tượng/chữ tại y=${splitY}, đã dọn lòng chữ ở dải chữ`);
  } else {
    console.log('  (không tách được biểu tượng/chữ)');
  }

  const meta = await sharp(logoTrimmed).metadata();
  emit(
    'brand/logo-full.png',
    await sharp(logoTrimmed)
      .resize({ width: 768, withoutEnlargement: true })
      .png(pngOpts)
      .toBuffer()
  );

  if (splitY) {
    emit(
      'brand/logo-mark.png',
      await sharp(logoTrimmed)
        .extract({ left: 0, top: 0, width: meta.width, height: splitY })
        .trim()
        .resize({ width: 512, withoutEnlargement: true })
        .png(pngOpts)
        .toBuffer()
    );

    emit(
      'brand/logo-wordmark.png',
      await sharp(logoTrimmed)
        .extract({ left: 0, top: splitY, width: meta.width, height: meta.height - splitY })
        .trim()
        .resize({ width: 640, withoutEnlargement: true })
        .png(pngOpts)
        .toBuffer()
    );

    // Bản cho nền tối: chữ navy #11355A chỉ đạt 1.38:1 trên nền Tối, không đọc
    // được. Đổi sang trắng thì lên 17.28:1. Chữ cam giữ nguyên - nó đã đạt
    // 6.66:1 trên cùng nền đó. Quy tắc: .standards/docs/BRAND_ASSETS.md mục 4.
    const logoDark = await inkToLight(logoTrimmed, splitY);

    emit(
      'brand/logo-full-dark.png',
      await sharp(logoDark).resize({ width: 768, withoutEnlargement: true }).png(pngOpts).toBuffer()
    );

    emit(
      'brand/logo-wordmark-dark.png',
      await sharp(logoDark)
        .extract({ left: 0, top: splitY, width: meta.width, height: meta.height - splitY })
        .trim()
        .resize({ width: 640, withoutEnlargement: true })
        .png(pngOpts)
        .toBuffer()
    );
  }

  console.log('\n[2/5] Avatar mặc định - quả cầu lưới, 6 tông × 2 mức chi tiết');
  for (const d of [DETAIL.lg, DETAIL.sm]) {
    for (const v of AVATAR_VARIANTS) {
      const svg = networkGlobeSvg({ hue: BASE_HUE + v.hue, size: d.size, detail: d });
      emit(
        `${d.dir}/${v.name}.webp`,
        await sharp(Buffer.from(svg)).webp({ quality: 88, effort: 6 }).toBuffer()
      );
    }
  }

  console.log('\n[3/5] Favicon - xoá nền trắng, sinh mọi cỡ từ bản 512');
  // Bộ favicon gốc bị nung sẵn nền trắng (0% pixel trong suốt). Tách nền trên
  // bản 512 rồi thu nhỏ xuống các cỡ còn lại: hạ cỡ từ ảnh ĐÃ có alpha cho biên
  // mượt, tốt hơn nhiều so với tách nền trực tiếp trên ảnh 16px.
  const favSrc = path.join(SRC, 'favicons');
  const iconMaster = await removeBackground(path.join(favSrc, 'android-chrome-512x512.png'));

  const iconAt = (size) =>
    sharp(iconMaster)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();

  // Nền đặc cho những icon mà HỆ ĐIỀU HÀNH tự tô nền nếu ta để trong suốt.
  // #eef4fb là `--bg-base` chế độ Sáng - trùng `background_color` của manifest bên
  // dưới, nên màn hình chờ PWA không nháy đổi màu. Chọn nó thay vì trắng tinh vì
  // nền của chính bộ nguồn là #f7fbfc (gần trắng, hơi ngả xanh): đặt dấu hiệu lên
  // nền cùng họ thì tương quan màu giữ nguyên như bản gốc, còn 17% pixel sáng ở
  // vành ngoài dấu hiệu vẫn phân biệt được.
  const SOLID_BG = { r: 0xee, g: 0xf4, b: 0xfb, alpha: 1 };

  // Nén bảng màu cho những bản KHÔNG phải icon hiển thị chính: các lớp trong
  // .ico và hai bản maskable. Đo trên chính bộ này: 182 kB -> 54 kB cho .ico
  // (giảm 70%), đổi lại sai lệch màu trung bình 2.4/255 (~1%) trên vùng NHÌN
  // THẤY được và alpha gần như không đổi (0.2-0.5/255).
  //
  // Đo sai lệch đó phải BỎ vùng trong suốt ra: tính cả vùng alpha=0 thì con số
  // vọt lên 21-30/255 và trông y như mất chất lượng nặng, trong khi giá trị RGB
  // dưới alpha=0 không hiển thị ở đâu cả.
  const PNG_SMALL = { compressionLevel: 9, palette: true, quality: 90, effort: 10 };

  // `removeAlpha()` sau `flatten()` không phải thừa: nó hạ PNG xuống color type 2
  // (RGB không alpha), nhờ đó "nền đặc" trở thành thứ cổng kiểm ĐỌC ĐƯỢC từ header
  // ảnh (`scripts/check-brand-assets.js`) thay vì phải giải mã từng pixel - mà
  // giải mã pixel thì cổng kiểm sẽ cần sharp, và job CI đó không cài dependency.
  const iconOnSolid = (size) =>
    sharp(iconMaster)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .flatten({ background: SOLID_BG })
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();

  // Bản maskable: Android cắt icon theo hình dạng của máy (tròn, squircle, giọt
  // nước...) nên phần ngoài rìa CÓ THỂ bị xén. Đặc tả maskable dành 40% đường
  // kính giữa làm vùng an toàn; ta thu dấu hiệu về 80% cạnh rồi đệm nền đặc ra
  // xung quanh. Dùng bản thường làm maskable là cách icon bị xén mất viền.
  const iconMaskable = async (size) => {
    const inner = Math.round(size * 0.8);
    const pad = Math.round((size - inner) / 2);
    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: SOLID_BG,
      },
    })
      .composite([{ input: await iconAt(inner), top: pad, left: pad }])
      .flatten({ background: SOLID_BG })
      .removeAlpha()
      .png(PNG_SMALL)
      .toBuffer();
  };

  emit('android-chrome-512x512.png', await iconAt(512));
  emit('android-chrome-192x192.png', await iconAt(192));
  emit('android-chrome-maskable-512x512.png', await iconMaskable(512));
  emit('android-chrome-maskable-192x192.png', await iconMaskable(192));
  // apple-touch-icon `MUST` có nền ĐẶC (BRAND_ASSETS.md mục 12.1): iOS không tôn
  // trọng alpha ở đây mà tô ĐEN vào chỗ trong suốt, nên bản có alpha ra một dấu
  // hiệu nổi trên nền đen giữa màn hình chủ sáng màu.
  emit('apple-touch-icon.png', await iconOnSolid(180));
  emit('favicon-96x96.png', await iconAt(96));
  emit('favicon-32x32.png', await iconAt(32));
  emit('favicon-16x16.png', await iconAt(16));

  // File .ico gốc trong bộ nguồn thực chất là PNG đổi đuôi - dựng lại ICO thật.
  // Bảy lớp theo BRAND_ASSETS.md mục 7 (`MUST`). Mục 6 của cùng tài liệu chỉ liệt
  // kê 16/32/48 - đó là bảng KÍCH THƯỚC TỐI THIỂU, và bộ bảy lớp thoả luôn nó.
  const icoSmall = (size) =>
    sharp(iconMaster)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png(PNG_SMALL)
      .toBuffer();

  const icoEntries = [];
  for (const size of [16, 24, 32, 48, 64, 128, 256])
    icoEntries.push({ size, data: await icoSmall(size) });
  emit('favicon.ico', buildIco(icoEntries));

  console.log('\n[4/5] Web app manifest');
  const manifest = {
    name: 'tsudev - Dự án, bản quyền và con dấu tín nhiệm',
    short_name: 'tsudev',
    description: 'Website dự án cá nhân: dự án & bản quyền, blog, tài liệu, con dấu tín nhiệm.',
    start_url: '/',
    display: 'standalone',
    // Chế độ SÁNG là mặc định của site, nên màu khởi động của PWA phải là
    // `--bg-base` của chế độ Sáng. Đặt lệch thì màn hình chờ chuyển màu sang
    // trang - một cú nháy, ở đúng khoảnh khắc đầu tiên người dùng nhìn.
    //
    // Đây là bản sao THỨ TƯ của màu đó (ba bản kia: tokens.css, _document.tsx,
    // ThemeToggle.tsx) và nó đã từng trôi lệch thật: đợt đổi sang bảng màu quy
    // ước v1.0.0, ba bản kia lên #eef4fb còn bản này ở lại #eef3fa - lệch một
    // đơn vị ở hai kênh, không ai nhìn ra, và chỉ hiện trên màn hình chờ PWA.
    // Nay `apps/frontend-main/test/themeTokens.test.ts` canh cả bản này.
    theme_color: '#eef4fb',
    background_color: '#eef4fb',
    // `purpose` phải khai TÁCH BẠCH: bản thường ('any') và bản maskable là hai
    // ảnh khác nhau. Gộp thành 'any maskable' trên MỘT ảnh là cách Android vừa
    // dùng nó nguyên khung vừa xén nó theo hình dạng máy - một trong hai lần
    // chắc chắn sai.
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/android-chrome-maskable-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/android-chrome-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
  emit('site.webmanifest', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));

  // Ảnh xem trước khi chia sẻ link (Facebook, X, Zalo, Telegram, Slack...).
  // 1200×630 là tỉ lệ các nền tảng đó cắt theo; logo gốc là ảnh DỌC nên nếu
  // đưa thẳng vào thẻ og:image thì bị cắt cụt hai đầu. Vì vậy dựng riêng.
  console.log('\n[5/5] Ảnh Open Graph 1200×630');
  const OG_W = 1200;
  const OG_H = 630;
  // Nền CỐ Ý dùng bảng màu TỐI, không bám theo --surface (nay là màu sáng).
  // Ảnh xem trước được các nền tảng chia sẻ cache lại và hiển thị giống nhau cho
  // mọi người - nó không thể đi theo lựa chọn sáng/tối của từng người đọc, nên
  // nó là một hằng thương hiệu.
  const ogBackdrop = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#121212"/><stop offset="100%" stop-color="#000000"/>
        </linearGradient>
      </defs>
      <rect width="${OG_W}" height="${OG_H}" fill="url(#bg)"/>
      <rect x="0" y="${OG_H - 6}" width="${OG_W}" height="6" fill="#2bd0b8"/>
      <text x="${OG_W / 2}" y="${OG_H - 96}" text-anchor="middle"
            font-family="DejaVu Sans, Verdana, sans-serif" font-size="30" fill="#8a8a8a">
        Dự án &amp; bản quyền · Blog · Tài liệu · Con dấu tín nhiệm
      </text>
      <text x="${OG_W / 2}" y="${OG_H - 50}" text-anchor="middle"
            font-family="DejaVu Sans, Verdana, sans-serif" font-size="24" fill="#2bd0b8">
        tsudev.com
      </text>
    </svg>`
  );
  const ogLogo = await sharp(logoTrimmed)
    .resize({ height: 340, fit: 'inside', withoutEnlargement: false })
    .png(pngOpts)
    .toBuffer();
  const ogLogoMeta = await sharp(ogLogo).metadata();
  emit(
    'og-image.png',
    await sharp(ogBackdrop)
      .composite([
        {
          input: ogLogo,
          left: Math.round((OG_W - ogLogoMeta.width) / 2),
          top: 70,
        },
      ])
      .png(pngOpts)
      .toBuffer()
  );

  console.log('\nXong. Đầu ra:');
  for (const pub of APPS) console.log('  ' + path.relative(ROOT, pub));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
