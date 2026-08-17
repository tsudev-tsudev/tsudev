# Kiểm thử

## Test đơn vị (service)

Mỗi service tự chạy test của mình — **không** có lệnh test ở gốc repo.

```bash
npm --workspace services/content-service test
npm --workspace services/storage-service test
npm --workspace services/trust-service test
```

Hiện có:

| File                                          | Giữ hợp đồng gì                       |
| --------------------------------------------- | ------------------------------------- |
| `content-service/test/auth.test.js`           | request không xác thực bị từ chối     |
| `storage-service/test/authMiddleware.test.js` | presign/upload đòi xác thực + vai trò |
| `trust-service/test/signing.test.js`          | vòng khoá ký, quy trình xoay khoá     |
| `trust-service/test/recheck.test.js`          | ba luật giám sát tên miền             |

Test service chạy **không cần DB** — đó là chủ đích, giữ chúng chạy được trong
CI mà không phải dựng Postgres. Cần chạm DB thì viết test tích hợp, đừng làm hỏng
tính chất này.

Mỗi service export `app` và `startServer` riêng để test `supertest` được mà
không phải mở cổng.

## Test đầu-cuối (Playwright)

```bash
npm --prefix e2e install
npx playwright install --with-deps chromium   # lần đầu
npm --prefix e2e test
```

URL lấy từ `config/topology.json` — không đặt tay. Playwright **tự dựng** hai
frontend và `dev-proxy` (mục `webServer`), nên không cần chạy `npm run dev:local`
trước; đang chạy sẵn thì nó dùng lại.

Hai project, tách theo thứ chúng cần:

| Lệnh                  | Project   | Cần gì               | Ở CI |
| --------------------- | --------- | -------------------- | ---- |
| `npm run e2e:session` | `session` | hai frontend + proxy | ✅   |
| `npm run e2e`         | cả hai    | + MinIO              | ❌   |

`session` là lưới an toàn của việc tái cấu trúc cổng/tên miền: đăng nhập ở main,
bấm link điều hướng, phải sang đúng trang và **còn phiên**. Bản không cần trình
duyệt: `node scripts/check-session-sharing.js`.

Kịch bản duy nhất hiện có: `e2e/tests/sso-upload.spec.js` — đăng nhập, presign,
upload.

## Presign + upload: hai đường và cách chọn

PUT thẳng từ trình duyệt lên MinIO bằng URL presign **hay hỏng** khi host của
trình duyệt và host trong container khác nhau: chữ ký được ký cho một hostname,
trình duyệt lại phân giải sang hostname khác.

| Đường                | Cách đi                                              | Dùng khi            |
| -------------------- | ---------------------------------------------------- | ------------------- |
| Trực tiếp (thật)     | client xin `/api/presign` → PUT thẳng lên S3/R2      | production          |
| Dự phòng phía server | client xin `/api/presign` → POST `/api/upload?key=…` | CI, máy dev, Docker |

`E2E_FORCE_FALLBACK=1` ép dùng đường dự phòng. Compose đặt sẵn `=1` cho
`e2e-runner`. Đây là mặc định của CI vì nó chạy ổn ở mọi môi trường.

Muốn nghiệm thu đường trực tiếp thì chạy runner **bên trong** mạng compose với
`E2E_FORCE_FALLBACK=0`, khi đó tên host giữa các container mới khớp:

```bash
docker compose up -d minio postgres redis content-service \
                     storage-service frontend-main
docker compose build e2e-runner
docker compose run --rm -e E2E_FORCE_FALLBACK=0 e2e-runner
```

Mã liên quan: `e2e/tests/upload.spec.js` (project `full-stack`), và
`services/storage-service/src/index.js` (`/api/presign`, `/api/upload`).

## Cổng CI

`.github/workflows/ci.yml` chạy ba job trên mọi PR và trên push vào
`main` / `feat/**`:

1. **Lint & format** — `npm run format:check` + `npm run lint`.
2. **Migrate & test services** — dựng Postgres 16, `db:generate`, `db:migrate`
   (`prisma migrate deploy`), rồi test cả ba service.
3. **Build frontends** — `db:generate` rồi build cả hai app Next.

Ba lỗi CI hay gặp và nguyên nhân thật:

- **Job build đỏ mà không đụng gì tới frontend** → đổi `schema.prisma` mà quên
  `npm run db:generate`, client Prisma sinh ra không khớp.
- **Job test đỏ ngay bước migrate** → đã sửa một file migration cũ. Migration đã
  áp dụng là bất biến; tạo migration mới thay vì sửa file cũ.
- **`format:check` đỏ mà máy mình sạch** → file nằm trong `.prettierignore` ở
  máy nhưng CI vẫn kiểm phần khác, hoặc quên chạy `npm run format`.

E2E chia làm hai project, và chỉ MỘT trong hai chạy trong CI:

| Project      | Tệp                               | Cần gì               | Trong CI           |
| ------------ | --------------------------------- | -------------------- | ------------------ |
| `app`        | `smoke.spec.js`, `invite.spec.js` | Postgres + 4 service | ✅ (job `e2e-app`) |
| `full-stack` | `upload.spec.js`                  | thêm MinIO           | ❌ chạy tay        |

Thêm tệp spec mới thì phải khai vào `testMatch` của một project — Playwright
**không** tự nhặt. Quên là spec đó im lặng không bao giờ chạy, và triệu chứng
duy nhất là số test không tăng.

Chạy `full-stack` bằng tay trước khi đụng vào luồng upload.
