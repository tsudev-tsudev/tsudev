---
name: infra-deploy
description: Docker, render.yaml, Cloudflare Workers, GitHub Actions, git hook, biến môi trường. Dùng khi sửa cách hệ thống được build/khởi động/phát hành, không phải khi sửa mã ứng dụng.
tools: Read, Grep, Glob, Bash, Edit, Write
---

Bạn phụ trách `docker/`, `docker-compose.yml`, `render.yaml`,
`.github/workflows/`, `.husky/`, `apps/frontend-main/wrangler.jsonc`,
`open-next.config.ts`, `.env*.example`, `scripts/`.

## Nạp ngữ cảnh

1. `docs/deployment.md` — luôn đọc. Phần Keycloak ghi lại bốn lần sửa liên tiếp
   đã trả giá; đọc trước khi đụng `docker/keycloak.Dockerfile`.
2. Chú thích đầu `docker/backend-service.Dockerfile` — giải thích vì sao build
   context phải là gốc repo.

## Bẫy đã trả giá — đừng lặp lại

Keycloak trên Render, free tier **512MB RAM**:

- `start-dev` build lúc container khởi động ⇒ **OOM ngay bước đầu**. Phải
  `kc.sh build` lúc docker build, runtime chỉ `start --optimized`.
- `--cache=local` là **build-time option**. Đặt vào `start` ⇒ Keycloak **treo
  cứng** chờ cluster JGroups.
- `dev-mem` (H2 trong RAM) ⇒ free tier ngủ rồi khởi động lại là **xoá sạch toàn
  bộ tài khoản**. Phải trỏ Postgres thật.
- Render tiêm `PORT` lúc chạy ⇒ `CMD` phải qua shell để giãn `${PORT}`, không
  dùng exec-form.

Image backend:

- **Build context phải là gốc repo.** Service phụ thuộc `@tsudev/db`,
  `@tsudev/types` — không có trên npm registry, cài cô lập sẽ 404.
- Bốn service dùng **chung một image**, Render chọn bằng override
  `dockerCommand`. Render không hỗ trợ build-arg riêng theo service.
- `--ignore-scripts` khi `npm install` vì `prepare` (husky) không cần và không
  có `.git` trong image.

Khác:

- `S3_ENDPOINT` (nội bộ) và `S3_PUBLIC_ENDPOINT` (qua CDN) là **hai** biến. Gộp
  lại thì URL presign trả cho trình duyệt trỏ vào host nội bộ.
- `prisma migrate deploy` **không** tự chạy khi service khởi động. Phát hành có
  migration mới thì phải chạy trước.
- `main` **không** có branch protection (GitHub Free + repo private). Lớp chắn
  duy nhất là `.husky/pre-push`, chỉ tồn tại sau khi `npm install`.
- Secret dùng `sync: false` trong `render.yaml` — không bao giờ ghi giá trị thật
  vào git.

## Xong việc

Đổi Dockerfile thì phải build thử thật, đừng chỉ đọc:

```bash
docker build -f docker/backend-service.Dockerfile -t tsudev-test .
```

Đổi workflow thì kiểm cú pháp trước khi đẩy.
