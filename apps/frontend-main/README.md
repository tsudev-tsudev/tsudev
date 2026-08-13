# frontend-main

Next.js 15 + React 19, cổng **3000**. App **duy nhất** của tsudev: trang chủ,
dự án & bản quyền, blog, docs, con dấu tín nhiệm và khu quản trị.

```bash
npm --workspace apps/frontend-main run dev
```

Dựng cả stack: `npm run dev:local` ở gốc — xem [../../docs/development.md](../../docs/development.md).

## Trang

| Nhánh                           | Nội dung                                        |
| ------------------------------- | ----------------------------------------------- |
| `/`                             | trang chủ                                       |
| `/projects`, `/projects/<slug>` | dự án, giấy phép, trạng thái bản quyền          |
| `/blog`, `/docs`                | bài viết và tài liệu (content-service)          |
| `/trust`                        | con dấu tín nhiệm — công khai + cổng khách hàng |
| `/trust/org/<id>`               | hồ sơ uy tín tổ chức — công khai                |
| `/admin`                        | cổng vào: `/admin/trust`, `/admin/projects`     |
| `/rules`, `/terms`, `/privacy`  | trang tĩnh                                      |

## Route proxy

Trình duyệt **không** gọi thẳng cổng service. Mọi lời gọi đi qua
`pages/api/<domain>/[...path].js`:

| Route                  | Chuyển tiếp tới |
| ---------------------- | --------------- |
| `/api/content/admin/*` | content-service |
| `/api/storage/*`       | storage-service |
| `/api/trust/*`         | trust-service   |
| `/api/trust/jwks`      | trust-service   |

Đọc công khai (blog, docs, dự án, danh bạ dấu) **không** đi qua proxy — nó chạy
trong `getServerSideProps`, phía server, nên không có CORS để vướng. Proxy chỉ
cần cho đường ghi và đường cần danh tính.

Thêm endpoint service mới mà quên mở rộng proxy ⇒ trình duyệt chặn CORS.

## Riêng của app này

- Đường deploy Cloudflare Workers qua `@opennextjs/cloudflare`
  (`wrangler.jsonc`, `open-next.config.ts`) — app duy nhất có. Xem
  [../../docs/deployment.md](../../docs/deployment.md).
- `transpilePackages: ['@tsudev/ui', 'next-auth']`.
- `.env.local` được **sinh tự động**, đừng sửa tay.
