# sso-auth

**Không phải app Node.** Thư mục này chỉ chứa cấu hình Keycloak (Identity
Provider) cho hệ thống SSO. Không có `package.json`, không có gì để `npm run`.

## Nội dung

| File                              | Dùng ở đâu                                                |
| --------------------------------- | --------------------------------------------------------- |
| `keycloak/realm-export.json`      | local dev — `docker compose up keycloak` tự import        |
| `keycloak/realm-export.prod.json` | production — `docker/keycloak.Dockerfile` nướng vào image |

Realm dev định nghĩa client public `tsudev-frontend` và user `devuser` /
`devpass`.

## Chạy Keycloak local

```bash
docker compose up keycloak   # :8080
```

Rồi khớp `.env` với realm: `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`,
`KEYCLOAK_CLIENT_SECRET`.

**Việc thường ngày không cần Keycloak.** `.env` đặt sẵn `E2E_BYPASS_KEYCLOAK=1`
nên đăng nhập bằng bất kỳ username + `devpass`. Chỉ dựng Keycloak khi thật sự
cần kiểm thử luồng OIDC. Chi tiết: [../../docs/auth.md](../../docs/auth.md).

## Production

- Client phải là **confidential**, có secret thật, bắt buộc HTTPS.
- Chạy trên Render với Keycloak 21.1.1 đã build sẵn, giới hạn heap JVM để vừa
  512MB. Đây là chỗ đã trả giá bằng bốn lần sửa liên tiếp — đọc phần Keycloak
  trong [../../docs/deployment.md](../../docs/deployment.md) trước khi đụng vào
  `docker/keycloak.Dockerfile`.
