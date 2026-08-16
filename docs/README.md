# Tài liệu tsudev — mục lục định tuyến

Đọc **chọn lọc** theo vùng công việc. Không nạp cả thư mục: mỗi file thừa là
token trả tiền mà không dùng đến.

| Đang làm việc ở đâu                           | Đọc file nào                                                       |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Mới vào repo, cần bản đồ tổng thể             | [architecture.md](architecture.md)                                 |
| Dựng môi trường, chạy local, gỡ lỗi khởi động | [development.md](development.md)                                   |
| Đăng nhập, mật khẩu, 2FA, passkey, RBAC       | [auth.md](auth.md)                                                 |
| Viết/chạy test, E2E presign–upload            | [testing.md](testing.md)                                           |
| Sửa giao diện, component, token màu           | [design-system.md](design-system.md)                               |
| Đưa lên production, biến môi trường, CI       | [deployment.md](deployment.md)                                     |
| Con dấu tín nhiệm (trust-service)             | [trust-seal.md](trust-seal.md)                                     |
| Vì sao repo mất Diễn đàn/Chợ/Tin nhắn         | [refactor-personal-site.md](refactor-personal-site.md)             |
| Vì sao chỉ còn một cổng vào ở dev             | [refactor-network-topology.md](refactor-network-topology.md)       |
| Kế hoạch: Con dấu về chế độ mời, gỡ tín dụng  | [refactor-trust-invite-access.md](refactor-trust-invite-access.md) |
| Logo, favicon, avatar                         | [../packages/brand/README.md](../packages/brand/README.md)         |
| Hạ tầng Cloudflare/giám sát (kế hoạch)        | [../infrastructure/README.md](../infrastructure/README.md)         |

## Đặc tả gốc

[`documents-tsudev.md`](../documents-tsudev.md) ở thư mục gốc là **đặc tả kỹ
thuật (TSD)** do chủ dự án ban hành — tài liệu **yêu cầu**, không phải mô tả
hiện trạng. Khi TSD và mã nguồn mâu thuẫn, mã nguồn là hiện trạng còn TSD là
đích đến; chênh lệch đáng kể được ghi ngay trong file đó.

## Quy ước của thư mục này

- Mỗi file trả lời **một** câu hỏi vận hành, đặt tên theo câu hỏi đó.
- Viết hiện trạng đã kiểm chứng. Ý tưởng/lộ trình thuộc về `documents-tsudev.md`
  hoặc issue, không nằm ở đây.
- Không lưu nhật ký hội thoại, báo cáo "tôi vừa làm gì", hay danh sách
  "bước tiếp theo tôi có thể làm". Tài liệu là trạng thái, không phải biên bản.
