# content-service

Express, cổng **4001**. Service lớn nhất: blog, tài liệu, diễn đàn, kiểm duyệt,
tin nhắn riêng, chợ có ký quỹ.

```bash
npm --workspace services/content-service run dev
npm --workspace services/content-service test
```

## Nhóm endpoint

| Tiền tố                   | Nội dung                                                      |
| ------------------------- | ------------------------------------------------------------- |
| `/api/posts`, `/api/docs` | bài viết blog và tài liệu                                     |
| `/api/forum/*`            | danh mục, chuyên mục, chủ đề, bài, phản ứng, báo cáo          |
| `/api/market/*`           | đăng bán, mua, đơn hàng, hoàn tiền, giải ngân, đánh giá       |
| `/api/messages/*`         | hội thoại riêng, đếm chưa đọc                                 |
| `/api/mod/*`              | hàng đợi kiểm duyệt, khoá/ghim chủ đề, cấm tài khoản, nhật ký |
| `/health`                 | công khai                                                     |
| `/debug/boom`             | ném 500 có chủ đích — chỉ bật ngoài production                |

`app.use('/api', auth)` gắn xác thực cho **toàn bộ** `/api`. Route công khai
phải đăng ký trước dòng đó.

## Lưu ý

- `/debug/boom` là công cụ nghiệm thu đường cảnh báo (§6.3 của TSD): gọi nó →
  500 → cảnh báo Telegram/email phải tới trong 30 giây. Đừng xoá.
- Luồng ký quỹ của chợ (`buy` → `release` / `refund`) thay đổi số dư — sửa thì
  phải rà cả ba đường.
- CommonJS, không dấu chấm phẩy. DB qua `@tsudev/db`.
