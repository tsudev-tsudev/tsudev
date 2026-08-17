# trust-service

Express, cổng **4003**. Con dấu tín nhiệm: nhận hồ sơ, thẩm định, ký chứng chỉ,
phát huy hiệu, xác thực công khai, giám sát tên miền định kỳ.

```bash
npm --workspace services/trust-service run dev
npm --workspace services/trust-service test
```

**Vận hành (xoay khoá, giám sát, seed demo):**
[../../docs/trust-seal.md](../../docs/trust-seal.md) - đọc trước khi đụng vào
service này.

## Cấu trúc

| File                | Trách nhiệm                          |
| ------------------- | ------------------------------------ |
| `index.js`          | route + HTTP                         |
| `signing.js`        | ký/xác minh Ed25519, vòng khoá, JWKS |
| `certificates.js`   | vòng đời chứng chỉ                   |
| `domainVerify.js`   | xác minh quyền sở hữu tên miền       |
| `recheck.js`        | bộ hẹn giờ giám sát định kỳ          |
| `badge.js`          | sinh SVG huy hiệu                    |
| `authMiddleware.js` | xác thực JWT                         |

Đầu mỗi file giải thích các quyết định thiết kế. Đọc chúng, đừng suy đoán.

## Xác thực gắn khác các service kia

Service này **không** gắn `auth` cho cả `/api`. Chỉ các nhánh cần danh tính mới
gắn: `/api/trust/orgs`, `/api/trust/domains`, `/api/trust/applications`,
`/api/trust/certificates`, `/api/trust/admin`.

Mặc định là **công khai**, cố ý: huy hiệu, trang xác thực, thư mục và danh sách
chương trình được trình duyệt của khách trên site bên thứ ba tải về, không hề có
token nào đi kèm.

⚠️ Thêm nhánh riêng tư mới mà quên bổ sung vào danh sách đó thì nó lộ công khai
và **không có gì báo lỗi**.

## Ba luật cứng (test khoá lại, đừng phá)

1. **Một lần kiểm trượt không hạ dấu.** DNS chập chờn hay site bảo trì không
   phải lỗi của chủ site - phải trượt liên tiếp `TRUST_RECHECK_GRACE_FAILURES`
   lần.
2. **Tự đình chỉ, không tự thu hồi.** Đình chỉ đảo ngược được, thu hồi thì không.
   Máy chỉ được làm việc đảo ngược được.
3. **Chỉ tự khôi phục thứ chính mình đã đình chỉ.** Kiểm duyệt viên đình chỉ vì
   lý do nội dung thì máy không được bật lại - đó là lật quyết định của con
   người. Nguồn phân biệt là nhật ký kiểm toán.

`test/recheck.test.js` giữ ba luật này, `test/signing.test.js` giữ hợp đồng xoay
khoá. Cả hai chạy không cần DB.

## Hai biến "một lần rồi thôi"

- **`TRUST_SIGNING_KEY` thiếu ở production ⇒ service từ chối khởi động.** Cố ý,
  để không bao giờ chạy thật bằng khoá dev.
- **`TRUST_ISSUER` được ký vào payload chứng chỉ.** Đổi sau khi đã cấp thì chứng
  chỉ cũ vẫn mang URL cũ. Đặt đúng domain thật trước lần cấp đầu tiên.
