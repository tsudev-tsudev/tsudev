# tsudev-conventions - Bộ quy ước giao diện & vận hành toàn hệ sinh thái (v1.0.0)

Giải nén/copy toàn bộ vào gốc repo. Thứ tự đọc:

1. **AGENTS.md** - quy ước bắt buộc cho lập trình viên & agent AI (đọc đầu MỌI phiên, có sẵn câu lệnh khởi động phiên).
2. **docs/DESIGN_SYSTEM.md** - hệ màu 3 chế độ (Light/Warm/Dark), typography, component, bo góc, versioning.
3. **docs/PROJECT_STRUCTURE.md** - cây thư mục chuẩn + quy tắc đặt tên.
4. **tokens/design-tokens.json** - nguồn giá trị duy nhất; **tokens/tokens.css** - bản CSS cho Web/Electron.
5. **.gitignore** - chuẩn tối thiểu + quy tắc bổ sung liên tục.
6. **logs/** - STATE.md (hàng đợi task), LOCKS.md (khóa file), handover/ (phiếu bàn giao theo mẫu docs/templates/HANDOVER.md).

Nguyên tắc cốt lõi: chỉ dùng token, không hard-code giao diện; ngày hiển thị dạng số DD/MM/YYYY; ưu tiên dịch vụ miễn phí + region Singapore/Nhật Bản; các file quy ước là bất khả xâm phạm.
