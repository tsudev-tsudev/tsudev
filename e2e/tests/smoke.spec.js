const { test, expect } = require('@playwright/test');
const { loadTopology, publicUrl } = require('../../scripts/topology/load');

// LƯỚI AN TOÀN cho việc chuyển thành website dự án cá nhân.
//
// Thay cho cross-origin-session.spec.js: khi chỉ còn MỘT app thì không còn
// "xuyên origin" để kiểm. Cái cần bảo vệ bây giờ là những trang được GIỮ LẠI
// vẫn sống sót qua đợt gỡ 32 route và 12 model.
//
// Test này phải xanh TRƯỚC khi gỡ bất cứ thứ gì, và xanh lại sau mỗi giai đoạn.
// Nó cố ý khẳng định NỘI DUNG THẬT (tiêu đề bài viết lấy từ DB), không chỉ
// "trang trả về 200" - trang rỗng vẫn trả 200.

const MAIN = process.env.E2E_MAIN_URL || publicUrl(loadTopology(), 'main');

// Đăng nhập bằng ĐÚNG luồng của người dùng thật - mật khẩu Argon2id trong DB,
// kiểm bởi auth-service. Không còn provider `e2e-dev` nhận mọi username với
// `devpass`. Tài khoản do `npm run db:seed:dev` đặt.
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'tsudev-dev-2026!';

const signIn = async (page, user = 'tsudev') => {
  // Qua chính trang /login của site, không phải trang mặc định của next-auth -
  // đó là màn hình người dùng thật nhìn thấy, nên đó là màn hình phải được kiểm.
  await page.goto(`${MAIN}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="identifier"]', user);
  await page.fill('input[name="password"]', DEV_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
};

test('trang chủ dựng được và mang thương hiệu tsudev', async ({ page }) => {
  await page.goto(MAIN, { waitUntil: 'networkidle' });
  await expect(page.locator('header')).toBeVisible();
  await expect(page).toHaveTitle(/tsudev/i);
});

test('blog: danh sách có bài thật và mở được bài chi tiết', async ({ page }) => {
  await page.goto(`${MAIN}/blog`, { waitUntil: 'networkidle' });
  // Nội dung từ content-service qua getServerSideProps. Rỗng = service chết
  // hoặc route /api/posts đã bị gỡ nhầm.
  const first = page.locator('a[href^="/blog/"]').first();
  await expect(first).toBeVisible();

  // Khẳng định ĐÚNG tiêu đề lấy từ DB, không phải "có một thẻ h1 nào đó" -
  // trang lỗi vẫn có h1. (Bài viết render markdown nên có nhiều h1, lấy cái đầu.)
  await page.goto(`${MAIN}/blog/welcome-to-tsudev`, { waitUntil: 'networkidle' });
  await expect(page.locator('h1').first()).toHaveText('Chào mừng đến với tsudev');
});

test('tài liệu: danh sách có mục thật và mở được trang chi tiết', async ({ page }) => {
  await page.goto(`${MAIN}/docs`, { waitUntil: 'networkidle' });
  await expect(page.locator('a[href^="/docs/"]').first()).toBeVisible();

  await page.goto(`${MAIN}/docs/getting-started`, { waitUntil: 'networkidle' });
  await expect(page.locator('h1').first()).toHaveText('Bắt đầu nhanh');
});

test('con dấu tín nhiệm: trang chính và trang xác minh dựng được', async ({ page }) => {
  await page.goto(`${MAIN}/trust`, { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle(/[Cc]on dấu/);

  await page.goto(`${MAIN}/trust/verify`, { waitUntil: 'networkidle' });
  await expect(page.locator('h1').first()).toBeVisible();
});

test('đăng nhập dev hoạt động', async ({ page }) => {
  await signIn(page);
  await page.goto(MAIN, { waitUntil: 'networkidle' });
  await expect(page.locator('header button:has-text("Đăng xuất")')).toBeVisible({ timeout: 10000 });
});

test('khu vực quản trị mở được sau khi đăng nhập bằng tsudev', async ({ page }) => {
  await signIn(page);
  await page.goto(`${MAIN}/admin`, { waitUntil: 'networkidle' });
  // Chưa đăng nhập thì trang hiện lời mời đăng nhập - thấy nút đó nghĩa là hỏng.
  await expect(page.locator('button:has-text("Đăng nhập")')).toHaveCount(0);
});

test('điều hướng chính không có link chết', async ({ page }) => {
  await page.goto(MAIN, { waitUntil: 'networkidle' });
  const hrefs = await page.locator('header nav a').evaluateAll((els) => els.map((e) => e.href));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const res = await page.request.get(href);
    expect(res.status(), `link chết trong điều hướng: ${href}`).toBeLessThan(400);
  }
});

test('dự án: danh sách có dự án thật và mở được trang chi tiết', async ({ page }) => {
  await page.goto(`${MAIN}/projects`, { waitUntil: 'networkidle' });
  const first = page.locator('a[href^="/projects/"]').first();
  await expect(first).toBeVisible();

  await page.goto(`${MAIN}/projects/tsudev-trust-seal`, { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toHaveText('Con dấu tín nhiệm tsudev');
  // Dự án này seed ở trạng thái REGISTERED - số giấy chứng nhận PHẢI hiện ra.
  // Đây là khẳng định trung tâm của mục bản quyền, không phải trang trí.
  await expect(page.getByText('TSD-2026-0001')).toBeVisible();
});

test('đường ghi dự án từ chối người chưa đăng nhập', async ({ page }) => {
  // BFF không được để lọt request ghi nào ra content-service khi không có phiên.
  // Hỏng chỗ này là bất kỳ ai cũng sửa được danh mục dự án.
  const res = await page.request.post(`${MAIN}/api/content/admin/projects`, {
    data: { slug: 'ke-gian', name: 'x', summary: 'x' },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(401);
});

test('quản trị dự án mở được và thấy danh sách', async ({ page }) => {
  await signIn(page);
  await page.goto(`${MAIN}/admin/projects`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Dự án & bản quyền' })).toBeVisible();
  await expect(page.getByText('tsudev-platform')).toBeVisible({ timeout: 10000 });
});

// PHỤ THUỘC DỮ LIỆU: cần `services/trust-service/scripts/seed-demo.js` đã chạy.
// `db:seed` chỉ tạo chương trình dấu, không tạo chứng chỉ nào - mà danh bạ chỉ
// hiện chứng chỉ ACTIVE còn hạn. Thiếu bước đó thì test này đỏ ở CI dù mã đúng
// (đã xảy ra một lần); xem bước seed trong .github/workflows/ci.yml.
test('hồ sơ uy tín tổ chức mở được từ danh bạ', async ({ page }) => {
  await page.goto(`${MAIN}/trust/directory`, { waitUntil: 'networkidle' });
  const orgLink = page.locator('a[href^="/trust/org/"]').first();
  await expect(orgLink).toBeVisible();
  await orgLink.click();
  await page.waitForLoadState('networkidle');

  // Bốn chỉ số thô là nội dung chính của hồ sơ - không phải một "điểm uy tín".
  await expect(page.getByText('Chứng chỉ hiệu lực')).toBeVisible();
  await expect(page.getByText('Vượt kiểm định kỳ')).toBeVisible();
  // "Tên miền đã xác minh" xuất hiện hai lần (nhãn chỉ số + tiêu đề khối bên
  // phải) nên phải chỉ đích danh, không dùng getByText trần.
  await expect(page.getByRole('heading', { name: 'Tên miền đã xác minh' })).toBeVisible();
});
