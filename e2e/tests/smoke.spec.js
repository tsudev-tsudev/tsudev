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
    // Phải NEO vào chính biểu mẫu đăng nhập. Từ 26/08/2026 (SEARCH-HEADER) ô tìm
    // kiếm ở header là <form> THẬT và mang một nút gửi `sr-only` - nút đó nằm
    // TRƯỚC nút của trang trong DOM, nên `button[type="submit"]` trần khớp 2 phần
    // tử và Playwright bấm nhầm cái ở header (bị icon kính lúp che ⇒ treo 60s).
    page.click('form:has(input[name="identifier"]) button[type="submit"]'),
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

// Con dấu chạy ở CHẾ ĐỘ MỜI. Ba khẳng định dưới đây là toàn bộ hợp đồng nhìn
// thấy được của Phần A (docs/refactor-trust-invite-access.md), và cả ba đều hỏng
// ÂM THẦM: gác hụt thì trang vẫn 200 với đầy dữ liệu, gác quá tay thì người có
// mã mời bị đá ra mà không có lỗi nào ở máy chủ.
test('con dấu: khách chưa đăng nhập chỉ thấy trang mời, không thấy dữ liệu', async ({ page }) => {
  await page.goto(`${MAIN}/trust`, { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle(/[Cc]on dấu/);
  await expect(page.getByText('cấp theo lời mời')).toBeVisible();
  // Rút khỏi chỉ mục: thẻ phải có mặt ở ĐÚNG nhánh mà bot nhìn thấy, tức nhánh
  // chưa đăng nhập - bot không bao giờ có phiên.
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  // Mọi trang còn lại chuyển hướng về đăng nhập, KHÔNG phải 200 kèm nội dung.
  for (const path of ['/trust/verify', '/trust/directory', '/trust/apply']) {
    await page.goto(`${MAIN}${path}`, { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/login');
  }
});

test('con dấu: đăng nhập rồi nhưng chưa có mã mời vẫn không vào được', async ({ page }) => {
  // "Đã đăng nhập" không còn đủ - phải đạt VIP. Đây là điểm dễ sai nhất vì cổng
  // cũ chỉ đòi có phiên.
  //
  // Đăng ký MỘT tài khoản mới thay vì dùng `alice`: invite.spec.js nâng alice
  // lên VIP khi nó chạy, và hai tệp spec không có thứ tự đảm bảo. Một test chỉ
  // xanh khi tệp khác chưa chạy là một test nói dối.
  const user = `e2e-member-${Date.now()}`;
  const reg = await page.request.post(`${MAIN}/api/identity/register`, {
    data: {
      username: user,
      email: `${user}@example.com`,
      password: DEV_PASSWORD,
    },
  });
  expect(reg.status()).toBeLessThan(400);

  await signIn(page, user);
  await page.goto(`${MAIN}/trust/directory`, { waitUntil: 'networkidle' });
  expect(new URL(page.url()).pathname).toBe('/trust');
  await expect(page.getByText('cấp theo lời mời')).toBeVisible();
});

test('con dấu: tài khoản VIP thấy nội dung thật', async ({ page }) => {
  // bob là VIP - bậc mà mã mời cấp.
  await signIn(page, 'bob');
  await page.goto(`${MAIN}/trust`, { waitUntil: 'networkidle' });
  await expect(page.locator('a[href^="/trust/programs/"]').first()).toBeVisible();

  await page.goto(`${MAIN}/trust/verify`, { waitUntil: 'networkidle' });
  await expect(page.locator('h1').first()).toBeVisible();
});

test('sitemap không còn liệt kê trang nào của con dấu', async ({ page }) => {
  const res = await page.request.get(`${MAIN}/sitemap.xml`);
  expect(res.status()).toBe(200);
  const xml = await res.text();
  // '/trust/' chứ không phải '/trust': dự án `tsudev-trust-seal` có chữ trust
  // trong slug và vẫn phải nằm trong sitemap.
  expect(xml).not.toContain('/trust/');
  expect(xml).not.toContain('/trust<');
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
  // Cần VIP: danh bạ nằm sau cổng chế độ mời từ 18/08/2026.
  await signIn(page, 'bob');
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
