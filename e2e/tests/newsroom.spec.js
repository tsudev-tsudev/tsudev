// Toà soạn Agent AI - bề mặt phải đóng với người không phải quản trị viên.
//
// Đây là loại lỗi chỉ lộ ra khi bấm thật: cả bốn cổng kiểm tự động đều xanh khi
// một trang quản trị lỡ mở ra công khai. Trang này còn nặng hơn /admin/projects
// vì nó có nút treo agent và nút duyệt đăng - tức là ghi được vào nội dung
// công khai của site.
const { test, expect } = require('@playwright/test');

test.describe('Toà soạn Agent AI', () => {
  test('khách vãng lai không thấy bảng điều khiển', async ({ page }) => {
    await page.goto('/admin/newsroom');
    // Trang hiện lời mời đăng nhập, KHÔNG hiện sàn làm việc.
    await expect(page.getByRole('button', { name: /Đăng nhập/i })).toBeVisible();
    await expect(page.getByText('Sàn làm việc')).toHaveCount(0);
  });

  test('API trạng thái từ chối khi chưa đăng nhập', async ({ request }) => {
    const res = await request.get('/api/newsroom/state');
    expect(res.status()).toBe(401);
  });

  test('nhịp đập KHÔNG mở qua proxy trình duyệt', async ({ request }) => {
    // /api/newsroom/tick cố ý không nằm trong danh sách trắng của proxy: nó là
    // máy gọi máy. Mở nó ra là cho bất kỳ ai đã đăng nhập ép toà soạn đốt sạch
    // hạn mức Neuron trong vài phút.
    const res = await request.post('/api/newsroom/tick', { data: {} });
    expect([401, 404]).toContain(res.status());
  });

  test('trang không được lập chỉ mục', async ({ page }) => {
    await page.goto('/admin/newsroom');
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('noindex');
  });
});
