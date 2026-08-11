#!/usr/bin/env node
'use strict';
// LƯỚI AN TOÀN cho việc tái cấu trúc cổng/tên miền (giai đoạn 0).
//
// Khẳng định một điều duy nhất, và là điều dễ gãy nhất khi đổi hình trạng mạng:
//
//   Cookie phiên do frontend-main phát ra phải được frontend-forum chấp nhận,
//   và trả về CÙNG một người dùng.
//
// Vì sao không dùng Playwright: thứ đang gặp rủi ro là phạm vi cookie + secret
// dùng chung giữa hai origin, không phải giao diện. Kiểm ở tầng HTTP thì chạy
// được ngay, không cần trình duyệt, không thêm phụ thuộc, và chẩn đoán rõ hơn
// nhiều so với một assertion trên DOM. Bản Playwright (thao tác click thật trên
// menu) nằm ở e2e/tests/cross-origin-session.spec.js.
//
// Chạy: node scripts/check-session-sharing.js
// Yêu cầu: cả hai frontend đang chạy và E2E_BYPASS_KEYCLOAK=1 (mặc định của .env).

const { loadTopology, publicUrl } = require('./topology/load');

const topo = loadTopology();
const MAIN = process.env.CHECK_MAIN_URL || publicUrl(topo, 'main');
const FORUM = process.env.CHECK_FORUM_URL || publicUrl(topo, 'forum');
const USER = process.env.E2E_USER || 'tsudev';
const PASS = process.env.E2E_PASS || 'devpass';

// Cookie jar tối giản: chỉ cần tên=giá trị, bỏ qua thuộc tính. Đủ vì ta chủ
// động quyết định gửi cookie nào sang origin nào — đó chính là phép thử.
function collectCookies(res, jar) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  raw.forEach((line) => {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) return;
    jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  });
  return jar;
}

const cookieHeader = (jar) =>
  Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

function fail(msg, detail) {
  console.error(`\n✗ ${msg}`);
  if (detail) console.error(`  ${detail}`);
  process.exit(1);
}

async function signInAtMain() {
  const jar = {};

  const csrfRes = await fetch(`${MAIN}/api/auth/csrf`).catch((e) => {
    fail(`Không gọi được ${MAIN} — frontend-main có đang chạy không?`, e.message);
  });
  collectCookies(csrfRes, jar);
  const { csrfToken } = await csrfRes.json();
  if (!csrfToken) fail('Không lấy được csrfToken từ frontend-main');

  // Provider `e2e-dev` chỉ tồn tại khi E2E_BYPASS_KEYCLOAK=1. Thiếu nó thì
  // next-auth trả 404/redirect chứ không báo lỗi rõ ràng — bắt riêng ở dưới.
  const loginRes = await fetch(`${MAIN}/api/auth/callback/e2e-dev`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(jar) },
    body: new URLSearchParams({ csrfToken, username: USER, password: PASS, json: 'true' }),
  });
  collectCookies(loginRes, jar);

  const sessionCookie = Object.keys(jar).find((k) => k.endsWith('session-token'));
  if (!sessionCookie) {
    fail(
      'Đăng nhập ở frontend-main không phát ra cookie phiên',
      `HTTP ${loginRes.status}. Kiểm tra E2E_BYPASS_KEYCLOAK=1 và E2E_PASS.`
    );
  }
  return { jar, sessionCookie };
}

async function whoAmI(base, jar, label) {
  const res = await fetch(`${base}/api/auth/session`, {
    headers: { Cookie: cookieHeader(jar) },
  }).catch((e) => fail(`Không gọi được ${base} (${label})`, e.message));
  const body = await res.json().catch(() => ({}));
  return body && body.user ? body.user.name || body.user.email : null;
}

async function main() {
  console.log(`main : ${MAIN}`);
  console.log(`forum: ${FORUM}\n`);

  const { jar, sessionCookie } = await signInAtMain();
  console.log(`✓ đăng nhập ở main, cookie phiên: ${sessionCookie}`);

  const atMain = await whoAmI(MAIN, jar, 'main');
  if (!atMain) fail('main không nhận ra phiên vừa tạo');
  console.log(`✓ main nhận ra phiên: ${atMain}`);

  // Phép thử thật: mang đúng cookie đó sang origin của forum.
  const atForum = await whoAmI(FORUM, jar, 'forum');
  if (!atForum) {
    fail(
      'forum KHÔNG chấp nhận cookie phiên của main',
      'Phiên không chia sẻ được giữa hai origin. Kiểm tra NEXTAUTH_SECRET dùng chung ' +
        'và NEXTAUTH_COOKIE_DOMAIN (sau giai đoạn 3 phải là .tsudev.localhost).'
    );
  }
  if (atForum !== atMain) {
    fail('forum nhận ra phiên nhưng là NGƯỜI DÙNG KHÁC', `main=${atMain} forum=${atForum}`);
  }
  console.log(`✓ forum nhận ra CÙNG phiên: ${atForum}`);

  console.log('\n✓ Phiên chia sẻ được giữa hai origin.');
}

main().catch((err) => {
  fail('lỗi ngoài dự kiến', err && (err.stack || err.message));
});
