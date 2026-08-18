# Chạy local

Chỉ localhost. Không cần Docker, không cần `sudo`.

## Lần đầu

```bash
npm install        # cài workspace + tự cài git hook qua husky (prepare)
cp .env.example .env
npm run dev:full   # dựng DB + generate + migrate + seed + chạy 6 tiến trình
```

`dev:full` là đường chạy chuẩn. Nó gọi lần lượt: `db:up` → `minio:up` →
`db:generate` → `db:migrate` → `db:seed` → `dev:local`.

## Những lần sau

```bash
npm run dev:local   # DB đã có sẵn, chỉ chạy app
```

## Cổng

Nguồn sự thật là **`config/topology.json`**, không phải bảng dưới đây. Đổi cổng
ở đó rồi `npm run topology:gen`; `npm run topology:check` chặn hardcode mọc lại.

Chỉ **một** cổng công khai - phần còn lại nghe loopback và không cần gõ tay:

| Địa chỉ                          | Tiến trình      | Cổng nội bộ |
| -------------------------------- | --------------- | ----------- |
| http://tsudev.localhost:8080     | frontend-main   | 3000        |
| http://cdn.tsudev.localhost:8080 | MinIO           | 9000        |
| _(chỉ SSR/BFF gọi)_              | content-service | 4001        |
| _(chỉ SSR/BFF gọi)_              | storage-service | 4002        |
| _(chỉ SSR/BFF gọi)_              | trust-service   | 4003        |
| _(chỉ service gọi)_              | PostgreSQL      | 5433        |

`*.localhost` phân giải sẵn về loopback - **không** phải sửa `/etc/hosts`. Trên
nhiều máy nó ra `::1` (IPv6), nên dev-proxy bind dual-stack và luôn gọi upstream
bằng `127.0.0.1` tường minh.

### Chỉ có MỘT địa chỉ để gõ: `http://tsudev.localhost:8080`

Mọi địa chỉ khác đều tự đưa bạn về đó. Không phải để cho gọn - mà vì gõ sai
host từng làm **đăng nhập hỏng trong im lặng**:

| Bạn gõ                  | Chuyện gì xảy ra                                          |
| ----------------------- | --------------------------------------------------------- |
| `tsudev.localhost:8080` | địa chỉ chuẩn, mọi thứ chạy                               |
| `localhost:8080`        | dev-proxy trả 302 về địa chỉ chuẩn (giữ nguyên đường dẫn) |
| `localhost:3000`        | middleware của Next trả 307 về địa chỉ chuẩn              |
| host lạ trên :8080      | 404 kèm danh sách địa chỉ hợp lệ                          |

**Vì sao host lại quan trọng đến thế.** Cookie phiên được phát kèm
`Domain=.tsudev.localhost` (biến `NEXTAUTH_COOKIE_DOMAIN`, do topology sinh ra ở
chế độ proxy). Vào bằng `localhost:3000` thì đăng nhập vẫn trả **HTTP 200** -
mật khẩu được kiểm đúng, token phiên được ký xong - nhưng trình duyệt **vứt
cookie đi** vì host không nằm trong domain đó. Phiên vì thế không tồn tại, giao
diện vẫn hiện nút "Đăng nhập", và không có một dòng lỗi nào ở đâu cả. Đó là
thành công giả, dạng hỏng tốn thời gian nhất để chẩn.

Chuyển hướng chỉ kích hoạt khi cookie **bị giới hạn theo domain** mà host lại
nằm ngoài domain đó - tức đúng lúc và chỉ lúc cookie sẽ bị vứt. Nhờ vậy
`DEV_PROXY=0` không bị ảnh hưởng: ở chế độ đó `NEXTAUTH_COOKIE_DOMAIN` rỗng nên
không có gì để chuyển hướng.

⚠️ Cùng cơ chế này còn một cái bẫy **chưa xử lý ở production**: bản xem trước
trên `*.workers.dev` cũng nằm ngoài `.tsudev.com`, nên đăng nhập ở đó sẽ hỏng
đúng kiểu im lặng như vậy. Không chuyển hướng được (đưa bản xem trước về
production là sai), nên nếu dùng preview thì phải biết trước điều này.

Đường lui khi proxy hỏng: `DEV_PROXY=0 npm run dev:local` → quay lại gõ thẳng
cổng của từng app như trước giai đoạn 3.

Cổng bận: `fuser -k 8080/tcp 3000/tcp 4001/tcp 4002/tcp 4003/tcp`.
**Đừng** `fuser -k 5433/tcp` - dừng DB bằng `pg_ctl` (xem dưới).

## PostgreSQL user-space

`npm run db:up` chạy `scripts/start-db.sh`: khởi tạo cluster tại
`~/.tsudev/pgdata` (đổi bằng `TSUDEV_PGDATA`), cổng 5433 (`TSUDEV_PGPORT`), tạo
user/DB `tsudev`. Lệnh idempotent - chạy lại bao nhiêu lần cũng được.

```bash
pg_ctl -D ~/.tsudev/pgdata stop      # dừng
psql -h localhost -p 5433 -U tsudev  # nối vào
npm run db:reset                     # xoá sạch + migrate + seed lại
```

Không cài Postgres hệ thống: script tự dò binary trong
`/usr/lib/postgresql/*/bin`.

## MinIO user-space

`npm run minio:up` chạy `scripts/start-minio.sh`: bật MinIO tại
`~/.tsudev/minio-data` (đổi bằng `TSUDEV_MINIO_DATA`), cổng lấy từ
`config/topology.json`, rồi tạo bucket `tsudev` nếu chưa có. Idempotent như
`db:up`.

Binary nằm ở `~/.tsudev/bin/minio` (đổi bằng `TSUDEV_MINIO_BIN`), **không** cài
qua npm và **không** commit vào repo. Máy mới thì tải về:

```bash
mkdir -p ~/.tsudev/bin
curl -fSL -o ~/.tsudev/bin/minio https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x ~/.tsudev/bin/minio
```

```bash
pkill -f 'minio server'              # dừng
tail -f ~/.tsudev/minio.log          # log
```

MinIO chỉ tồn tại để đường ký URL presign có thứ để nói chuyện khi bấm thử
upload ở local - **production dùng Cloudflare R2**, MinIO không được deploy đi
đâu cả. Test cũng không cần nó: `storage-service` stub sẵn presign khi
`NODE_ENV=test`. Hệ quả là MinIO chết thì chỉ upload hỏng, mọi thứ khác vẫn
chạy - và CI vẫn xanh, nên đừng trông vào CI để biết nó hỏng.

⚠️ MinIO chấp nhận một số chữ ký mà R2 từ chối, nên "upload chạy ở local" chưa
chứng minh được nó chạy ở production. Đây là lý do `S3_PUBLIC_ENDPOINT` không
bao giờ được trỏ vào tên miền tuỳ chỉnh của R2 - xem `docs/deployment.md`.

## Đăng nhập khi dev

Ba tài khoản dev do `npm run db:seed:dev` đặt: `tsudev` (ADMIN), `alice`
(MEMBER), `bob` (VIP) - mật khẩu `tsudev-dev-2026!` (đổi bằng
`DEV_SEED_PASSWORD`).

Chúng là hash Argon2id THẬT trong DB và đi qua đúng luồng đăng nhập của
production. Không còn provider dev nào nhận "bất kỳ username nào": một đường
đăng nhập mà độ an toàn phụ thuộc vào việc một biến môi trường không được đặt là
một đường đăng nhập đang chờ tới lượt hỏng.

Tài khoản đã seed:

| Username | Vai trò | Dùng để thử                                 |
| -------- | ------- | ------------------------------------------- |
| `tsudev` | ADMIN   | `/admin`, `/admin/trust`, `/admin/projects` |
| `alice`  | MEMBER  | luồng người dùng thường                     |
| `bob`    | VIP     | quyền theo hạng                             |

Gọi API trực tiếp (không qua trình duyệt) thì tự ký một khẳng định danh tính bằng `@tsudev/identity-token` - xem
[auth.md](auth.md).

## Biến môi trường

- `.env` ở gốc là **nguồn duy nhất**. Sửa ở đây.
- `apps/*/.env.local` được **sinh tự động** bởi `scripts/write-env-local.js` -
  đừng sửa tay, lần chạy dev kế tiếp sẽ ghi đè. Sinh lại thủ công:
  `npm run env:local`.
- `NEXTAUTH_URL` suy ra từ `NEXT_PUBLIC_MAIN_URL`. Đặt sai gốc thì sau khi đăng
  nhập bị đá về origin khác và mất phiên.

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

`docker-compose.yml` ở gốc dựng full stack gồm MinIO, Redis. Từ khi có
`npm run minio:up` thì **không cần Docker cho MinIO nữa**; phần compose còn lại
chỉ dùng khi kiểm thử Redis. Chạy riêng hạ tầng:

```bash
docker compose up redis
```
