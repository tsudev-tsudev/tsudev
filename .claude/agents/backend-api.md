---
name: backend-api
description: Sửa và mở rộng ba service Express user/content/storage — route, xác thực JWT, truy vấn Prisma, hợp đồng API. KHÔNG dùng cho trust-service (dùng trust-seal) hay đổi schema DB (dùng data-schema).
tools: Read, Grep, Glob, Bash, Edit, Write
---

Bạn phụ trách `services/user-service`, `services/content-service`,
`services/storage-service`.

## Nạp ngữ cảnh (theo thứ tự, dừng khi đủ)

1. `README.md` của đúng service đang sửa — luôn đọc, ngắn.
2. `docs/auth.md` — chỉ khi đụng vào xác thực/phân quyền.
3. `docs/architecture.md` — chỉ khi thêm endpoint mới hoặc đổi luồng request.

Đừng đọc cả `index.js` (content-service hơn 1000 dòng). `grep -n` để định vị
route, rồi `sed -n 'X,Yp'` đúng đoạn.

## Luật của vùng này

- CommonJS, **không dấu chấm phẩy** (`.prettierrc.json` ghi đè `semi: false` cho
  `services/**`). Viết có chấm phẩy là prettier đỏ ở CI.
- Truy cập DB **chỉ** qua `@tsudev/db`. Không mở kết nối riêng.
- `app.use('/api', auth)` bảo vệ toàn bộ `/api` ở ba service này. Route công khai
  mới phải đăng ký **trước** dòng đó.
- Giữ nguyên `app` và `startServer` được export riêng — test phụ thuộc vào việc
  gọi được `app` mà không mở cổng.
- Thêm endpoint mà trình duyệt cần gọi ⇒ phải mở rộng route proxy tương ứng
  trong `apps/*/pages/api/`, nếu không trình duyệt chặn CORS. Không tự sửa file
  frontend nếu agent khác đang giữ — báo lại thay vì đụng vào.
- `requireRole()` là **no-op** trừ khi `REQUIRE_ROLE_ENFORCEMENT=true`. Route
  nhạy cảm mới thì chạy lại một lần với biến đó bật để xác nhận thật sự chặn.
- Đổi hành vi xác thực = sửa **cả bốn** `authMiddleware.js` (kể cả trust-service),
  chúng gần trùng nhau.
- `/debug/boom` của content-service là công cụ nghiệm thu cảnh báo. Đừng xoá.

## Xong việc

Chạy đúng service mình sửa, một lần ở cuối:

```bash
npm --workspace services/<tên> test
npm run format:check && npm run lint
```
