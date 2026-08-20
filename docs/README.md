# Tài liệu tsudev - mục lục định tuyến

Đọc **chọn lọc** theo vùng công việc. Không nạp cả thư mục: mỗi file thừa là
token trả tiền mà không dùng đến.

| Đang làm việc ở đâu                              | Đọc file nào                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| Mới vào repo, cần bản đồ tổng thể                | [architecture.md](architecture.md)                                 |
| Dựng môi trường, chạy local, gỡ lỗi khởi động    | [development.md](development.md)                                   |
| Địa chỉ nào là chính tắc, hình dạng đường dẫn    | [url-convention.md](url-convention.md)                             |
| Đăng nhập, mật khẩu, 2FA, passkey, RBAC          | [auth.md](auth.md)                                                 |
| Viết/chạy test, E2E presign–upload               | [testing.md](testing.md)                                           |
| **Quy tắc** giao diện (hệ sinh thái, KHÔNG SỬA)  | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)                               |
| Repo này hiện thực quy tắc đó bằng file nào      | [design-system.md](design-system.md)                               |
| Cấu trúc thư mục chuẩn (hệ sinh thái, KHÔNG SỬA) | [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)                       |
| Hai mã màu chuẩn không đạt WCAG, gói đẩy ngược   | [token-upstream-proposal.md](token-upstream-proposal.md)           |
| Đưa lên production, biến môi trường, CI          | [deployment.md](deployment.md)                                     |
| Hạn mức gói miễn phí, van chi phí                | [free-tier.md](free-tier.md)                                       |
| Con dấu tín nhiệm (trust-service)                | [trust-seal.md](trust-seal.md)                                     |
| Vì sao repo mất Diễn đàn/Chợ/Tin nhắn            | [refactor-personal-site.md](refactor-personal-site.md)             |
| Vì sao chỉ còn một cổng vào ở dev                | [refactor-network-topology.md](refactor-network-topology.md)       |
| Kế hoạch: Con dấu về chế độ mời, gỡ tín dụng     | [refactor-trust-invite-access.md](refactor-trust-invite-access.md) |
| Kế hoạch: Toà soạn Agent AI (Newsroom)           | [refactor-newsroom-agents.md](refactor-newsroom-agents.md)         |
| Logo, favicon, avatar                            | [../packages/brand/README.md](../packages/brand/README.md)         |
| Hạ tầng Cloudflare/giám sát (kế hoạch)           | [../infrastructure/README.md](../infrastructure/README.md)         |

## Hai tài liệu viết HOA là quy ước dùng chung

`DESIGN_SYSTEM.md` và `PROJECT_STRUCTURE.md` (cùng `tokens/` và `AGENTS.md`) đến
từ bộ quy ước v1.0.0 dùng chung cho mọi repo trong hệ sinh thái tsudev. Chúng
**bất khả xâm phạm**: chỉ đọc-hiểu-tuân thủ, không sửa trừ khi chủ dự án yêu cầu
trực tiếp - và có sửa thì phải sửa ở repo token trung tâm rồi đồng bộ xuống.
Chúng nằm trong `.prettierignore` để bản ở đây không lệch bản gốc.

Quy tắc phân biệt: file viết HOA = quy tắc chung cho cả hệ sinh thái; file viết
thường = hiện trạng của riêng repo này. Khi hai bên nói khác nhau, file viết
thường phải ghi rõ mâu thuẫn và cách hoà giải, đừng im lặng đi đường riêng.

## Đặc tả gốc

[`documents-tsudev.md`](../documents-tsudev.md) ở thư mục gốc là **đặc tả kỹ
thuật (TSD)** do chủ dự án ban hành - tài liệu **yêu cầu**, không phải mô tả
hiện trạng. Khi TSD và mã nguồn mâu thuẫn, mã nguồn là hiện trạng còn TSD là
đích đến; chênh lệch đáng kể được ghi ngay trong file đó.

## Quy ước của thư mục này

- Mỗi file trả lời **một** câu hỏi vận hành, đặt tên theo câu hỏi đó.
- Viết hiện trạng đã kiểm chứng. Ý tưởng/lộ trình thuộc về `documents-tsudev.md`
  hoặc issue, không nằm ở đây.
- Không lưu nhật ký hội thoại, báo cáo "tôi vừa làm gì", hay danh sách
  "bước tiếp theo tôi có thể làm". Tài liệu là trạng thái, không phải biên bản.
