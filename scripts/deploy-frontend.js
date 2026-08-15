#!/usr/bin/env node
'use strict';
// Dựng và phát hành frontend-main lên Cloudflare Workers.
//
// TỒN TẠI VÌ MỘT LỖ HỔNG THẬT, đã xảy ra trên production ngày 16/08/2026:
//
// `apps/frontend-main/.env.local` là BẢN SAO NGUYÊN VĂN của `.env` gốc (do
// scripts/write-env-local.js sinh ra), gồm E2E_BYPASS_KEYCLOAK=1,
// AUTH_DEV_BYPASS=true, NEXTAUTH_SECRET=change-me-secret, KEYCLOAK_CLIENT_SECRET
// =dev-secret và cả khoá ký dev. Next xếp `.env.local` CAO HƠN `.env.production`,
// còn lệnh deploy thì chạy trên máy dev — nên mọi giá trị dev bị nướng vào bản
// production. Hậu quả đã đo được: NextAuth bật provider `e2e-dev`, tức là BẤT KỲ
// AI cũng đăng nhập được vào tài khoản ADMIN bằng mật khẩu `devpass`.
//
// Chặn từng biến một là trò đuổi bắt: mỗi biến dev mới thêm vào `.env` lại là
// một lỗ mới, và không có gì báo lỗi. Nên ở đây làm điều dứt khoát: DỜI
// `.env.local` RA KHỎI ĐƯỜNG trong suốt lúc dựng, rồi trả lại.
//
// Biến môi trường production đến từ hai nguồn, cả hai đều không phải file này:
//   - NEXT_PUBLIC_* (nội suy lúc build) ← apps/frontend-main/.env.production
//   - biến/secret lúc chạy            ← wrangler.jsonc `vars` + `wrangler secret`

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadTopology, prodUrl } = require('./topology/load');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'apps', 'frontend-main');
const ENV_LOCAL = path.join(APP, '.env.local');
const STASHED = path.join(APP, '.env.local.deploy-stash');

const action = process.argv[2] || 'deploy';
if (!['deploy', 'preview', 'upload'].includes(action)) {
  console.error(`Không biết hành động "${action}". Dùng: deploy | preview | upload`);
  process.exit(1);
}

// Lần chạy trước bị giết cứng có thể để lại file dời dở. Trả lại TRƯỚC khi làm gì
// khác, nếu không máy dev im lặng mất .env.local.
if (fs.existsSync(STASHED) && !fs.existsSync(ENV_LOCAL)) {
  fs.renameSync(STASHED, ENV_LOCAL);
  console.log('↩ trả lại .env.local còn sót từ lần chạy trước');
}

let stashed = false;
function restore() {
  if (stashed && fs.existsSync(STASHED)) {
    fs.renameSync(STASHED, ENV_LOCAL);
    stashed = false;
    console.log('↩ đã trả lại .env.local');
  }
}
process.on('exit', restore);
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((s) => process.on(s, () => process.exit(130)));

try {
  if (fs.existsSync(ENV_LOCAL)) {
    fs.renameSync(ENV_LOCAL, STASHED);
    stashed = true;
    console.log('⇢ tạm dời .env.local ra khỏi bản dựng production');
  }

  const mainUrl = prodUrl(loadTopology(), 'main');
  console.log(`⇢ NEXT_PUBLIC_MAIN_URL=${mainUrl}`);

  const env = {
    ...process.env,
    NEXT_PUBLIC_MAIN_URL: mainUrl,
    // Đai an toàn thứ hai, phòng khi shell của người chạy có sẵn các biến này.
    // Chuỗi rỗng KHÁC với không đặt: mã kiểm `=== '1'` / `=== 'true'` nên rỗng
    // là tắt, và biến đã có trong môi trường thì dotenv/Next không ghi đè.
    E2E_BYPASS_KEYCLOAK: '',
    AUTH_DEV_BYPASS: '',
  };

  execSync(`npx opennextjs-cloudflare build && npx opennextjs-cloudflare ${action}`, {
    cwd: APP,
    stdio: 'inherit',
    env,
  });
} finally {
  restore();
}
