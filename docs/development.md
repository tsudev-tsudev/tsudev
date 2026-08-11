# Chạy local

Chỉ localhost. Không cần Docker, không cần `sudo`.

## Lần đầu

```bash
npm install        # cài workspace + tự cài git hook qua husky (prepare)
cp .env.example .env
npm run dev:full   # dựng DB + generate + migrate + seed + chạy 6 tiến trình
```

`dev:full` là đường chạy chuẩn. Nó gọi lần lượt: `db:up` → `db:generate` →
`db:migrate` → `db:seed` → `dev:local`.

## Những lần sau

```bash
npm run dev:local   # DB đã có sẵn, chỉ chạy app
```

## Cổng

Nguồn sự thật là **`config/topology.json`**, không phải bảng dưới đây. Đổi cổng
ở đó rồi `npm run topology:gen`; `npm run topology:check` chặn hardcode mọc lại.

Chỉ **một** cổng công khai — phần còn lại nghe loopback và không cần gõ tay:

| Địa chỉ                            | Tiến trình      | Cổng nội bộ |
| ---------------------------------- | --------------- | ----------- |
| http://tsudev.localhost:8080       | frontend-main   | 3000        |
| http://forum.tsudev.localhost:8080 | frontend-forum  | 3001        |
| http://auth.tsudev.localhost:8080  | Keycloak        | 4100        |
| http://cdn.tsudev.localhost:8080   | MinIO           | 9000        |
| _(chỉ SSR/BFF gọi)_                | user-service    | 4000        |
| _(chỉ SSR/BFF gọi)_                | content-service | 4001        |
| _(chỉ SSR/BFF gọi)_                | storage-service | 4002        |
| _(chỉ SSR/BFF gọi)_                | trust-service   | 4003        |
| _(chỉ service gọi)_                | PostgreSQL      | 5433        |

`*.localhost` phân giải sẵn về loopback — **không** phải sửa `/etc/hosts`. Trên
nhiều máy nó ra `::1` (IPv6), nên dev-proxy bind dual-stack và luôn gọi upstream
bằng `127.0.0.1` tường minh.

Đường lui khi proxy hỏng: `DEV_PROXY=0 npm run dev:local` → quay lại gõ thẳng
cổng của từng app như trước giai đoạn 3.

Cổng bận: `fuser -k 8080/tcp 3000/tcp 3001/tcp 4000/tcp 4001/tcp 4002/tcp 4003/tcp`.
**Đừng** `fuser -k 5433/tcp` — dừng DB bằng `pg_ctl` (xem dưới).

## PostgreSQL user-space

`npm run db:up` chạy `scripts/start-db.sh`: khởi tạo cluster tại
`~/.tsudev/pgdata` (đổi bằng `TSUDEV_PGDATA`), cổng 5433 (`TSUDEV_PGPORT`), tạo
user/DB `tsudev`. Lệnh idempotent — chạy lại bao nhiêu lần cũng được.

```bash
pg_ctl -D ~/.tsudev/pgdata stop      # dừng
psql -h localhost -p 5433 -U tsudev  # nối vào
npm run db:reset                     # xoá sạch + migrate + seed lại
```

Không cài Postgres hệ thống: script tự dò binary trong
`/usr/lib/postgresql/*/bin`.

## Đăng nhập khi dev

`.env` đặt sẵn `E2E_BYPASS_KEYCLOAK=1` ⇒ NextAuth thêm provider credentials
**chỉ dùng cho dev**: bất kỳ username nào + mật khẩu `devpass` (đổi bằng
`E2E_PASS`). Không cần Keycloak.

Tài khoản đã seed:

| Username | Vai trò | Dùng để thử                          |
| -------- | ------- | ------------------------------------ |
| `tsudev` | ADMIN   | `/admin`, `/admin/trust`, kiểm duyệt |
| `alice`  | MEMBER  | luồng thành viên thường              |
| `bob`    | VIP     | quyền theo hạng                      |

Gọi API trực tiếp (không qua trình duyệt) thì dùng `AUTH_DEV_BYPASS` — xem
[auth.md](auth.md).

## Biến môi trường

- `.env` ở gốc là **nguồn duy nhất**. Sửa ở đây.
- `apps/*/.env.local` được **sinh tự động** bởi `scripts/write-env-local.js` —
  đừng sửa tay, lần chạy dev kế tiếp sẽ ghi đè. Sinh lại thủ công:
  `npm run env:local`.
- Mỗi app nhận `NEXTAUTH_URL` riêng suy ra từ `NEXT_PUBLIC_MAIN_URL` /
  `NEXT_PUBLIC_FORUM_URL`. Dùng chung một giá trị thì đăng nhập ở diễn đàn sẽ bị
  đá về origin của trang chính.
- `NEXT_PUBLIC_MAIN_URL` / `NEXT_PUBLIC_FORUM_URL` cũng là gốc để `SiteHeader`/
  `SiteFooter` dựng link tuyệt đối. Thiếu chúng thì bấm "Blog" từ diễn đàn ra 404.

## Chạy từng phần

```bash
npm run dev:services    # chỉ 4 service
npm run dev:frontends   # chỉ 2 app Next (tự chạy env:local trước)
npm --workspace services/content-service run dev   # đúng một service
npm --workspace packages/ui run storybook          # Storybook design system
```

Service dùng `nodemon` (khởi động lại khi đổi `src/`), app Next dùng Fast
Refresh.

## Cổng kiểm tra trước khi commit

```bash
npm run format:check
npm run lint
npm --workspace services/<tên> test    # service nào sửa thì chạy service đó
```

`lint-staged` trong hook `pre-commit` đã tự chạy `prettier --write` +
`eslint --fix` trên file đã stage.

## Docker (tuỳ chọn)

`docker-compose.yml` ở gốc dựng full stack gồm Keycloak, MinIO, Redis. Chỉ cần
khi kiểm thử luồng SSO thật hoặc presign trực tiếp lên MinIO; công việc thường
ngày không cần. Chạy riêng hạ tầng:

```bash
docker compose up keycloak minio redis
```
