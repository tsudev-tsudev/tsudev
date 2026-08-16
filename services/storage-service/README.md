# storage-service

Express, cổng **4002**. Cấp URL presign cho S3/R2, upload phía server, liệt kê
file.

```bash
npm --workspace services/storage-service run dev
npm --workspace services/storage-service test
```

## Endpoint

| Method | Đường dẫn      | Ghi chú                                          |
| ------ | -------------- | ------------------------------------------------ |
| GET    | `/health`      | công khai                                        |
| GET    | `/api/presign` | trả URL presign, cần vai trò `MEMBER` trở lên    |
| POST   | `/api/upload`  | upload phía server, cần vai trò `MEMBER` trở lên |
| GET    | `/api/files`   | liệt kê                                          |

## Hai đường upload

PUT thẳng từ trình duyệt lên S3/R2 là đường **thật** (production). Nhưng nó hay
hỏng khi host của trình duyệt khác host trong container: chữ ký được ký cho một
hostname, trình duyệt phân giải sang hostname khác. Vì vậy có đường dự phòng
`/api/upload` chạy phía server, và CI dùng nó mặc định.

`E2E_FORCE_FALLBACK=1` ép dùng đường dự phòng. Chi tiết:
[../../docs/testing.md](../../docs/testing.md).

## Biến môi trường

`S3_ENDPOINT` (nội bộ) và `S3_PUBLIC_ENDPOINT` (public qua CDN) là **hai biến
khác nhau**. Đặt thiếu `S3_PUBLIC_ENDPOINT` thì URL presign trả cho trình duyệt
trỏ vào host nội bộ và tải hỏng ngoài production.

Còn lại: `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.
