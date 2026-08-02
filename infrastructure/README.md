# Infrastructure & Deployment (tsudev)

Hạ tầng, giám sát và quy trình triển khai cho hệ sinh thái tsudev.

## Kiến trúc triển khai (mục tiêu)

```
Cloudflare (DNS *.tsudev.vn · CDN · WAF · Zero Trust)
        │
        ├─ tsudev.vn         → frontend-main   (Next.js, SSR)
        ├─ forum.tsudev.vn   → frontend-forum  (Next.js, SSR)
        └─ auth.tsudev.vn    → Keycloak (OIDC IdP)
                │  (API qua BFF/proxy)
                └─ services: user · content · storage
                        │
                        ├─ PostgreSQL (dữ liệu quan hệ)
                        ├─ Redis (session/cache/rate-limit)
                        └─ S3 / Cloudflare R2 (object storage) + CDN edge cache
```

## 1. Cloudflare (CDN, WAF, Zero Trust)

- **DNS + TLS**: tạo zone `tsudev.vn`, bản ghi cho `@`, `forum`, `auth`, `docs`; bật Universal SSL (wildcard `*.tsudev.vn`).
- **CDN cache**: Cache Rules cho asset tĩnh (PDF, ZIP, ảnh, SVG) — TTL dài ở edge để giảm ~90% egress. Kiểm chứng bằng header `cf-cache-status: HIT` (tiêu chí nghiệm thu §6.2).
- **R2**: dùng làm object storage tương thích S3. Đặt `S3_ENDPOINT` (nội bộ) và `S3_PUBLIC_ENDPOINT` (public qua CDN) để presigned URL trỏ về host công khai.
- **WAF**: bật managed ruleset + rate-limiting cho `/api/*` chống lạm dụng.
- **Zero Trust (Tunnels)**: expose admin dashboard & cổng DB nội bộ qua Cloudflare Tunnel thay vì mở port công khai.

## 2. Triển khai container

- Mỗi service/app đã có `Dockerfile`; `docker-compose.yml` ở gốc dựng full stack (Keycloak, Postgres, Redis, MinIO, services, frontends).
- Production: build image trong CI, push registry, deploy (compose trên VPS, hoặc k8s). Chạy `prisma migrate deploy` trước khi khởi động service (xem CI job `test`).
- Biến môi trường: xem `.env.production.example` ở gốc repo. **Không hardcode credential** (tiêu chí §6.4).

## 3. Giám sát & cảnh báo (§4)

- **Sentry**: đặt `SENTRY_DSN` → `packages/observability/initSentry` tự bật cho cả server & browser.
- **New Relic**: `newrelic.js` + `NEW_RELIC_LICENSE_KEY`.
- **Alerting**: `packages/observability/notify.js` gửi cảnh báo tới **Telegram** (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` → @nguyentrangtinhsu) và **email** (`ALERT_EMAIL_WEBHOOK` / `ALERT_EMAIL_TO=nguyentrangtinhsu@gmail.com`). Khi chưa cấu hình, hàm log "would send" (an toàn cho dev).
  - Kích hoạt bởi: error rate > 1%, downtime, exception (gọi từ error handler của service).
  - Kiểm thử nhanh: `GET /debug/boom` trên content-service → 500 → dispatch cảnh báo (tiêu chí §6.3).

## 4. Trạng thái

| Hạng mục                         | Trạng thái                                       |
| -------------------------------- | ------------------------------------------------ |
| Docker Compose full stack        | ✅ có sẵn                                        |
| Prisma migrate trong CI          | ✅                                               |
| Alerting utility + test endpoint | ✅ (cần token để gửi thật)                       |
| Sentry / New Relic hooks         | ✅ (cần DSN/key)                                 |
| Cloudflare CDN/WAF/R2/Zero Trust | 📋 quy trình (cần tài khoản Cloudflare + domain) |
| IaC (Terraform/Ansible)          | 📋 để bổ sung                                    |
