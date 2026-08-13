# Con dấu tín nhiệm — vận hành

tsudev đóng vai cơ quan cấp dấu: website bên thứ ba nộp hồ sơ, tsudev thẩm định
rồi cấp một chứng chỉ đã ký, và họ nhúng huy hiệu lên trang của mình. Ai cũng
kiểm chứng được huy hiệu đó tại `/trust/verify/<serial>`.

Tài liệu này dành cho người vận hành. Kiến trúc và luồng nghiệp vụ nằm trong mã
nguồn (`services/trust-service/src/*`), phần đầu mỗi tệp giải thích các quyết
định thiết kế.

## Bốn mặt của hệ thống

| Mặt                         | Đường dẫn                                    | Ai dùng                        |
| --------------------------- | -------------------------------------------- | ------------------------------ |
| Giới thiệu & chương trình   | `/trust`, `/trust/programs/<slug>`           | công khai                      |
| Nộp hồ sơ & cổng khách hàng | `/trust/apply`, `/trust/portal`              | người dùng đã đăng nhập        |
| Quản trị & thẩm định        | `/admin/trust`                               | MODERATOR trở lên              |
| Xác thực & thư mục          | `/trust/verify/<serial>`, `/trust/directory` | công khai, không cần đăng nhập |
| Hồ sơ uy tín tổ chức        | `/trust/org/<id>`                            | công khai, không cần đăng nhập |

Service chạy ở `:4003`. Trình duyệt **không bao giờ** gọi thẳng cổng này — mọi
thứ đi qua proxy `/api/trust/*` của `frontend-main`, nên mã nhúng của khách chỉ
trỏ tới một domain duy nhất và hạ tầng bên trong đổi được mà không phiền họ.

## Khoá ký và cách xoay khoá

Chứng chỉ được ký Ed25519, phát hành dạng JWS compact. Khoá công khai công bố ở
`/.well-known/tsudev-trust-jwks.json` để bên thứ ba tự xác minh **offline** —
không cần tin API của tsudev.

```bash
node services/trust-service/scripts/genkey.js
```

Lệnh này in ra `TRUST_SIGNING_KEY` (PEM PKCS#8 đã base64 hoá) và
`TRUST_SIGNING_KEY_ID`. Production thiếu `TRUST_SIGNING_KEY` thì service **từ
chối khởi động** — cố ý, để không bao giờ có chuyện chạy thật bằng khoá dev.

### Quy trình xoay khoá

1. Sinh khoá mới bằng lệnh trên.
2. Lấy dòng `kid:<base64 PEM công khai>` mà lệnh in ra **cho khoá cũ**, thêm vào
   `TRUST_SIGNING_KEYS_RETIRED` (nhiều mục ngăn nhau bằng dấu phẩy).
3. Đặt khoá mới vào `TRUST_SIGNING_KEY` / `TRUST_SIGNING_KEY_ID`.
4. Khởi động lại service, kiểm `GET /health` → `verifyKeys` phải chứa **cả hai**.

> Bỏ bước 2 thì mọi chứng chỉ đã cấp lập tức hiện "không có khoá công khai" trên
> trang xác thực. Chứng chỉ sống hàng năm; khoá thì có thể phải thay gấp. Vòng
> khoá tồn tại chính vì hai chu kỳ đó không trùng nhau.

Ở môi trường không phải production, `kid=dev-insecure` luôn nằm trong vòng xác
minh để chứng chỉ cũ trong DB dev không báo hỏng oan sau khi lập trình viên đặt
khoá thật. Production không bao giờ nạp khoá này.

## `TRUST_ISSUER` — đặt đúng trước lần cấp đầu tiên

Giá trị này được **ký vào** payload chứng chỉ và dựng nên URL trong mã nhúng.
Đổi nó sau khi đã cấp chứng chỉ thì chứng chỉ cũ vẫn mang URL cũ, vì payload đã
ký rồi. Đặt đúng domain thật trước khi cấp chứng chỉ đầu tiên.

## Giám sát tên miền

Con dấu không phải cấp một lần rồi thôi: chủ site có thể gỡ bản ghi xác minh,
bán tên miền, hoặc để nó hết hạn — huy hiệu vẫn hiện, người dùng vẫn tin. Service
tự kiểm lại định kỳ.

| Biến                           | Mặc định | Ý nghĩa                                          |
| ------------------------------ | -------- | ------------------------------------------------ |
| `TRUST_RECHECK_ENABLED`        | `true`   | bật bộ hẹn giờ trong tiến trình                  |
| `TRUST_RECHECK_INTERVAL_MIN`   | `360`    | chu kỳ chạy (phút)                               |
| `TRUST_RECHECK_STALE_MIN`      | `1440`   | chứng chỉ cũ hơn ngần này mới bị kiểm lại        |
| `TRUST_RECHECK_BATCH`          | `25`     | số chứng chỉ mỗi lượt                            |
| `TRUST_RECHECK_GRACE_FAILURES` | `3`      | số lần trượt **liên tiếp** trước khi tự đình chỉ |

Ba luật cứng, đều là luật "không làm gì":

- **Một lần trượt không hạ dấu.** DNS chập chờn, site bảo trì, mạng của chính
  tsudev lỗi — đều làm kiểm tra trượt mà chủ site không có lỗi gì.
- **Tự đình chỉ, không tự thu hồi.** Đình chỉ đảo ngược được; thu hồi thì không.
  Máy chỉ được làm việc đảo ngược được.
- **Chỉ tự khôi phục thứ chính mình đã đình chỉ.** Kiểm duyệt viên đình chỉ vì lý
  do nội dung thì domain vẫn xác minh tốt; nếu máy thấy "kiểm đạt" rồi bật lại là
  nó vừa lật quyết định của con người. Nguồn phân biệt là nhật ký kiểm toán.

**Chạy nhiều bản service** thì đặt `TRUST_RECHECK_ENABLED=false` và gọi
`POST /api/trust/admin/recheck` từ một cron bên ngoài — bộ hẹn giờ nằm trong tiến
trình, không có khoá phân tán, nên mọi bản sẽ cùng kiểm một tập chứng chỉ.

Kiểm duyệt viên chạy tay được ở `/admin/trust`. Nút bấm dùng **đúng** đường code
với bộ hẹn giờ, kể cả phần ân hạn và tự đình chỉ.

## Dữ liệu

- `npm run db:seed` — dữ liệu tham chiếu: bốn chương trình cấp dấu. Chạy được ở
  mọi môi trường.
- `node services/trust-service/scripts/seed-demo.js [--reset]` — tổ chức, tên
  miền và chứng chỉ **giả** để xem giao diện. Cố ý tách khỏi seed chính: nhét vào
  đó thì một ngày nào đó thư mục công khai ở production sẽ liệt kê những website
  không tồn tại. `--reset` từ chối chạy khi `NODE_ENV=production`.

Chứng chỉ demo được ký bằng đúng khoá của service, nên trang xác thực kiểm chữ
ký thật chứ không phải kiểm một chuỗi bịa.

## Kiểm thử

```bash
npm --workspace services/trust-service test
```

`test/signing.test.js` giữ hợp đồng xoay khoá; `test/recheck.test.js` giữ ba luật
giám sát ở trên. Cả hai chạy không cần DB.
