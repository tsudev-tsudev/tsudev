const { test, expect } = require('@playwright/test');
const path = require('path');
const { loadTopology, publicUrl } = require('../../scripts/topology/load');

// Cần full stack (MinIO + storage-service) - chạy qua docker-compose, không nằm
// trong CI. Xem project `full-stack` trong playwright.config.js.
//
// Tên cũ là `sso-upload`: nó đăng nhập qua một nhà cung cấp danh tính ngoài,
// rồi rơi về provider `e2e-dev` với mật khẩu `devpass` khi bên đó không sẵn
// sàng. Cả hai đường đó đã bị gỡ. Nay nó đi qua ĐÚNG trang /login mà người dùng
// thật đi.
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'tsudev-dev-2026!';

test('đăng nhập rồi tải tệp lên qua storage-service', async ({ page }) => {
  const base = process.env.E2E_BASE_URL || publicUrl(loadTopology(), 'main');

  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="identifier"]', process.env.E2E_USER || 'tsudev');
  await page.fill('input[name="password"]', DEV_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    // Phải NEO vào chính biểu mẫu đăng nhập. Từ 26/08/2026 (SEARCH-HEADER) ô tìm
    // kiếm ở header là <form> THẬT và mang một nút gửi `sr-only` - nút đó nằm
    // TRƯỚC nút của trang trong DOM, nên `button[type="submit"]` trần khớp 2 phần
    // tử và Playwright bấm nhầm cái ở header (bị icon kính lúp che ⇒ treo 60s).
    page.click('form:has(input[name="identifier"]) button[type="submit"]'),
  ]);

  // Khẳng định phiên có thật trước khi thử tải lên: thiếu bước này thì lỗi
  // "chưa đăng nhập" hiện ra dưới dạng "tải lên hỏng", và chẩn đoán đi sai
  // hướng ngay từ đầu.
  await page.goto(base, { waitUntil: 'networkidle' });
  await expect(page.locator('header button:has-text("Đăng xuất")')).toBeVisible({ timeout: 10000 });

  const filePath = path.resolve(__dirname, '../test-files/sample.txt');
  await page.locator('input[type=file]').setInputFiles(filePath);

  const [dialog] = await Promise.all([
    page.waitForEvent('dialog', { timeout: 20000 }),
    page.click('button:has-text("Upload")'),
  ]);
  expect(dialog.message()).toContain('Upload complete');
  await dialog.accept();
});
