# user-service

Express, cổng **4000**. Hồ sơ thành viên, uy tín, xếp hạng.

```bash
npm --workspace services/user-service run dev    # nodemon
npm --workspace services/user-service test
```

## Endpoint

| Method | Đường dẫn              |
| ------ | ---------------------- |
| GET    | `/health`              |
| GET    | `/api/users`           |
| GET    | `/api/users/:username` |

`/health` đăng ký **trước** `app.use('/api', auth)` — route công khai mới cũng
phải đặt trước dòng đó.

## Quy ước

- CommonJS, **không dấu chấm phẩy** (`.prettierrc.json` ghi đè `semi: false` cho
  `services/**`).
- Truy cập DB qua `@tsudev/db` (Prisma). Không có DB riêng — dùng chung schema
  với các service khác.
- Xác thực: JWT Keycloak qua JWKS, bypass bằng `AUTH_DEV_BYPASS` khi dev. Xem
  [../../docs/auth.md](../../docs/auth.md).
- Export `app` và `startServer` riêng để test không phải mở cổng.
