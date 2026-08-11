const { test, expect } = require('@playwright/test');
const { loadTopology, publicUrl } = require('../../scripts/topology/load');

// LƯỚI AN TOÀN giai đoạn 0 — bản trình duyệt.
//
// Kiểm điều mà bản HTTP (scripts/check-session-sharing.js) không kiểm được:
// người dùng bấm đúng liên kết "Diễn đàn" trong SiteHeader thì có sang đúng
// origin của forum và còn phiên hay không. Đây là chỗ `siteUrl()` dễ sai nhất —
// href tương đối sẽ bám origin đang mở và ra 404, mà lỗi đó vô hình ở tầng HTTP.
//
// Cả hai bản đều phải xanh TRƯỚC khi đổi hình trạng mạng ở giai đoạn 3.

const topo = loadTopology();
const MAIN = process.env.E2E_MAIN_URL || publicUrl(topo, 'main');
const FORUM = process.env.E2E_FORUM_URL || publicUrl(topo, 'forum');

test('phiên đăng nhập ở main còn hiệu lực khi sang forum', async ({ page }) => {
  // Provider `e2e-dev` chỉ có khi E2E_BYPASS_KEYCLOAK=1 (mặc định của .env dev).
  await page.goto(`${MAIN}/api/auth/signin/e2e-dev`, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', process.env.E2E_USER || 'tsudev');
  await page.fill('input[name="password"]', process.env.E2E_PASS || 'devpass');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  await page.goto(MAIN, { waitUntil: 'networkidle' });
  await expect(page.locator('header button:has-text("Đăng xuất")')).toBeVisible({ timeout: 10000 });

  // Bấm đúng liên kết của menu, không goto thẳng — mục đích là kiểm chính cái
  // href mà siteUrl() dựng ra.
  const forumLink = page.locator('header nav a', { hasText: 'Diễn đàn' }).first();
  await expect(forumLink).toHaveAttribute('href', new RegExp(`^${escapeRe(FORUM)}`));
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), forumLink.click()]);

  expect(page.url()).toContain(new URL(FORUM).host);

  // Khẳng định chính: forum nhận ra cùng phiên đó.
  await expect(page.locator('header button:has-text("Đăng xuất")')).toBeVisible({ timeout: 10000 });
});

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
