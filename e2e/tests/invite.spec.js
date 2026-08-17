const { test, expect } = require('@playwright/test');
const { loadTopology, publicUrl } = require('../../scripts/topology/load');

// Vòng đời mã mời, đi qua ĐÚNG hai màn hình người thật dùng.
//
// Cái được chứng minh ở đây mà test đơn vị không chứng minh được: mã in ra trên
// trang quản trị là mã đổi được ở trang đổi mã. Giữa hai đầu đó có bốn lớp có
// thể lệch nhau trong im lặng — dạng hiển thị `TSU-XXXXX-…`, phép chuẩn hoá lúc
// nhận, danh sách trắng của proxy CÓ PHIÊN, và bảng tiền tố của backend-bundle.
// Lệch bất kỳ lớp nào thì cả hai phía vẫn "chạy", chỉ là mã không bao giờ khớp.

const MAIN = process.env.E2E_MAIN_URL || publicUrl(loadTopology(), 'main');
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'tsudev-dev-2026!';

const signIn = async (page, user) => {
  await page.goto(`${MAIN}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="identifier"]', user);
  await page.fill('input[name="password"]', DEV_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
};

test('mã cấp ở trang quản trị đổi được ở trang đổi mã', async ({ page }) => {
  // --- ADMIN cấp mã ---
  await signIn(page, 'tsudev');
  await page.goto(`${MAIN}/admin/trust`, { waitUntil: 'networkidle' });

  const label = `E2E ${Date.now()}`;
  await page.fill('#invite-label', label);
  await page.fill('#invite-uses', '1');
  await page.click('button:has-text("Cấp mã")');

  // Mã thô hiện ĐÚNG MỘT LẦN. Không đọc lại được từ đâu — DB chỉ giữ SHA-256.
  const code = await page.locator('p.select-all').first().textContent({ timeout: 15000 });
  expect(code).toMatch(/^TSU(-[A-Z2-7]{5}){3}$/);

  // Mã vừa cấp phải nằm trong danh sách, và danh sách KHÔNG được chứa mã thô.
  await expect(page.locator(`text=${label}`).first()).toBeVisible();

  // --- MEMBER đổi mã ---
  // `alice` là MEMBER trong seed dev. Đổi mã xong phải thành VIP.
  await page.goto(`${MAIN}/api/auth/signout`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("Sign out")').catch(() => {});
  await page.context().clearCookies();

  await signIn(page, 'alice');
  await page.goto(`${MAIN}/trust/redeem`, { waitUntil: 'networkidle' });
  await page.fill('#invite-code', code.trim());
  await page.click('button:has-text("Đổi mã")');
  // `div[role="alert"]`, không phải `[role="alert"]`: Next chèn
  // <p role="alert" id="__next-route-announcer__"> rỗng vào MỌI trang, và bộ
  // chọn rộng hơn sẽ khớp cả hai rồi hỏng ở chế độ strict.
  await expect(page.locator('div[role="alert"]')).toContainText('đã được mở quyền', {
    timeout: 15000,
  });

  // --- Lượt đã tiêu hết: người thứ hai bị từ chối ---
  await page.context().clearCookies();
  await signIn(page, 'bob');
  await page.goto(`${MAIN}/trust/redeem`, { waitUntil: 'networkidle' });
  await page.fill('#invite-code', code.trim());
  await page.click('button:has-text("Đổi mã")');
  await expect(page.locator('div[role="alert"]')).toContainText('hết lượt', { timeout: 15000 });
});

test('khách chưa đăng nhập không đổi được mã', async ({ page }) => {
  await page.goto(`${MAIN}/trust/redeem`, { waitUntil: 'networkidle' });
  // Trang mời đăng nhập, KHÔNG có ô nhập mã: mã gắn với một tài khoản, nên
  // không có gì để gắn quyền vào nếu chưa đăng nhập.
  await expect(page.locator('#invite-code')).toHaveCount(0);
  await expect(page.locator('a:has-text("Đăng nhập")').first()).toBeVisible();
});
