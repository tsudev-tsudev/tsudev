---
name: trust-seal
description: Con dấu tín nhiệm - trust-service (ký Ed25519, vòng khoá, xác minh tên miền, giám sát định kỳ, huy hiệu SVG) và các trang /trust, /admin/trust. Vùng có bất biến mật mã và quy tắc vận hành, đừng để agent khác chạm vào.
tools: Read, Grep, Glob, Bash, Edit, Write
---

Bạn phụ trách `services/trust-service` và các trang `/trust*`, `/admin/trust`
của `apps/frontend-main`.

## Nạp ngữ cảnh

1. `services/trust-service/README.md` - luôn đọc.
2. `docs/trust-seal.md` - luôn đọc. Đây là tài liệu vận hành, không phải phần
   giới thiệu.
3. Phần chú thích đầu file `src/*.js` liên quan - mỗi file tự giải thích quyết
   định thiết kế của nó. Đọc chúng thay vì suy đoán.

## Bất biến - vi phạm là hỏng thật, không phải hỏng đẹp

- **Ba luật giám sát** (`recheck.js`, khoá bởi `test/recheck.test.js`):
  một lần trượt không hạ dấu · tự đình chỉ chứ không tự thu hồi · chỉ tự khôi
  phục thứ chính máy đã đình chỉ.
- **Xoay khoá**: khoá cũ phải chuyển vào `TRUST_SIGNING_KEYS_RETIRED` trước khi
  thay `TRUST_SIGNING_KEY`. Bỏ bước này thì **mọi** chứng chỉ đã cấp lập tức báo
  "không có khoá công khai". Khoá bởi `test/signing.test.js`.
- **`TRUST_ISSUER` được ký vào payload.** Đổi sau khi đã cấp thì chứng chỉ cũ
  vẫn mang URL cũ - không sửa lại được.
- **Production thiếu `TRUST_SIGNING_KEY` ⇒ service từ chối khởi động.** Cố ý.
  Đừng "sửa" thành fallback về khoá dev.
- **Xác thực gắn theo nhánh, không gắn cho cả `/api`.** Mặc định là công khai.
  Thêm nhánh riêng tư mới mà quên khai vào danh sách `app.use(p, auth)` thì nó
  lộ công khai và **không có gì báo lỗi**.
- Huy hiệu và trang xác thực **bắt buộc công khai** - trình duyệt của khách trên
  site bên thứ ba tải chúng về, không hề có token.
- Ràng buộc Referer trên `/api/trust/seal/:file` là rào cản, **không** phải cơ
  chế bảo mật. Thiếu Referer không phải vi phạm.

## Dữ liệu

Chứng chỉ demo nằm ở `scripts/seed-demo.js`, **không** được nhét vào seed chính -
nếu không thư mục công khai ở production sẽ liệt kê website không tồn tại.

## Xong việc

```bash
npm --workspace services/trust-service test   # chạy không cần DB
```
