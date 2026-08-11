# @tsudev/db

Nguồn dữ liệu duy nhất của cả hệ thống: schema Prisma, migration, seed. Bốn
service dùng **chung** một database và một schema — đây là microservice về mặt
tiến trình, không phải về mặt dữ liệu.

```bash
npm run db:generate   # sinh lại Prisma client — BẮT BUỘC sau khi đổi schema
npm run db:migrate    # prisma migrate deploy
npm run db:seed
npm run db:reset      # xoá sạch + migrate + seed (chỉ dùng ở local)
npm --workspace packages/db run studio
```

Các lệnh trên chạy từ **gốc repo**.

## Luật bất biến của migration

Migration đã áp dụng **không được sửa**, kể cả một dòng comment. Sửa làm lệch
checksum ⇒ `prisma migrate deploy` dừng ⇒ CI đỏ ở bước migrate và production
không boot. Cần đổi thì tạo migration mới.

Migration hiện có: `init` → `moderation` → `messaging_marketplace` →
`trust_seal`.

## Đổi schema

1. Sửa `prisma/schema.prisma`.
2. `npx prisma migrate dev --name <mô-tả-ngắn>` (ở `packages/db`).
3. `npm run db:generate` ở gốc.

Bỏ bước 3 là job **build frontends** trong CI đỏ, dù chẳng đụng gì tới frontend.

## Vai trò

`enum Role`: `GUEST` · `MEMBER` · `VIP` · `MODERATOR` · `ADMIN`, mặc định
`MEMBER`. Đây là vai trò **ứng dụng**, khác với vai trò trong token Keycloak —
xem [../../docs/auth.md](../../docs/auth.md).

## Seed

`prisma/seed.js` tạo dữ liệu tham chiếu và ba tài khoản dev: `tsudev` (ADMIN),
`alice` (MEMBER), `bob` (VIP). Chạy được ở mọi môi trường.

Dữ liệu **giả** để xem giao diện trust nằm riêng ở
`services/trust-service/scripts/seed-demo.js` — cố ý tách ra, nhét vào seed
chính thì một ngày nào đó thư mục công khai ở production sẽ liệt kê những
website không tồn tại.
