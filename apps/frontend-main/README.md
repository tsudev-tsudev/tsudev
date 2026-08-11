# frontend-main

Next.js 15 + React 19, cổng **3000**. Trang chủ, blog, docs, hồ sơ thành viên,
tin nhắn, chợ, con dấu tín nhiệm và khu quản trị.

```bash
npm --workspace apps/frontend-main run dev
```

Dựng cả stack: `npm run dev:local` ở gốc — xem [../../docs/development.md](../../docs/development.md).

## Trang

| Nhánh                          | Nội dung                                        |
| ------------------------------ | ----------------------------------------------- |
| `/`, `/products`               | trang chủ, giới thiệu sản phẩm                  |
| `/blog`, `/docs`               | bài viết và tài liệu (content-service)          |
| `/members`, `/profile`         | hồ sơ thành viên, uy tín (user-service)         |
| `/messages`                    | tin nhắn riêng                                  |
| `/market`                      | chợ có ký quỹ (đăng bán, đơn hàng, hoàn tiền)   |
| `/trust`                       | con dấu tín nhiệm — công khai + cổng khách hàng |
| `/admin`                       | quản trị, kiểm duyệt, thẩm định hồ sơ trust     |
| `/rules`, `/terms`, `/privacy` | trang tĩnh                                      |

## Route proxy

Trình duyệt **không** gọi thẳng cổng service. Mọi lời gọi đi qua
`pages/api/<domain>/[...path].js`:

| Route             | Chuyển tiếp tới |
| ----------------- | --------------- |
| `/api/mod/*`      | content-service |
| `/api/msg/*`      | content-service |
| `/api/market/*`   | content-service |
| `/api/trust/*`    | trust-service   |
| `/api/trust/jwks` | trust-service   |

Thêm endpoint service mới mà quên mở rộng proxy ⇒ trình duyệt chặn CORS.

## Riêng của app này

- Đường deploy Cloudflare Workers qua `@opennextjs/cloudflare`
  (`wrangler.jsonc`, `open-next.config.ts`) — app duy nhất có. Xem
  [../../docs/deployment.md](../../docs/deployment.md).
- `transpilePackages: ['@tsudev/ui', 'next-auth']`.
- `.env.local` được **sinh tự động**, đừng sửa tay.
