# content-service

Express, cổng **4001**. Nội dung của website: blog, tài liệu, và mục dự án &
bản quyền.

```bash
npm --workspace services/content-service run dev
npm --workspace services/content-service test
```

## Nhóm endpoint

| Tiền tố                   | Nội dung                                       |
| ------------------------- | ---------------------------------------------- |
| `/api/posts`, `/api/docs` | bài viết blog và tài liệu - công khai, chỉ đọc |
| `/api/projects`           | danh sách/chi tiết dự án - công khai, chỉ đọc  |
| `/api/admin/projects`     | tạo/sửa/xoá dự án - **chỉ ADMIN**              |
| `/health`                 | công khai                                      |
| `/debug/boom`             | ném 500 có chủ đích - chỉ bật ngoài production |

`app.use('/api', auth)` gắn xác thực cho **toàn bộ** `/api`. Route công khai
phải đăng ký trước dòng đó.

## Lưu ý

- **Đọc mở, ghi đóng.** `/api/posts`, `/api/docs`, `/api/projects` là nội dung
  công khai và KHÔNG có cổng vai trò - bản trước gắn `requireRole('content:read')`
  lên `/api/posts`, thứ chỉ vô hại vì cổng đó là no-op. Đường ghi nằm dưới
  `/api/admin` và kiểm vai trò **lưu trong DB** qua `requireAdmin`. Thêm đường
  ghi mới phải theo đúng khuôn đó, không thì cửa để ngỏ.
- **`copyrightStatus=REGISTERED` bắt buộc có `copyrightNo`.** PATCH kiểm trên
  giá trị SAU khi ghép, không phải trên phần thân request - gửi mỗi
  `copyrightStatus` vẫn phải thoả. Đây là khẳng định pháp lý, không để trống
  được.
- `/debug/boom` là công cụ nghiệm thu đường cảnh báo (§6.3 của TSD): gọi nó →
  500 → cảnh báo Telegram/email phải tới trong 30 giây. Đừng xoá.
- CommonJS, không dấu chấm phẩy. DB qua `@tsudev/db`.
