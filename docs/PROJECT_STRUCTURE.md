# CẤU TRÚC THƯ MỤC CHUẨN — mọi repo trong hệ sinh thái tuân theo

Mục tiêu: bất kỳ lập trình viên hoặc agent AI nào mở repo đều biết ngay file/biến/hàm nằm ở đâu.

```
<ten-project>/
├── AGENTS.md                  # Quy ước bắt buộc — agent đọc đầu mỗi phiên (KHÔNG SỬA)
├── README.md                  # Giới thiệu ngắn + cách chạy trong 5 phút
├── CHANGELOG.md               # Mỗi bản phát hành 1 dòng: 26.8.1901 — 19/08/2026 — nội dung
├── .gitignore                 # Chuẩn tối thiểu, bổ sung liên tục theo AGENTS.md mục 3
├── .env.example               # Mẫu biến môi trường (KHÔNG chứa giá trị thật)
│
├── docs/                      # Tài liệu (chỉ markdown)
│   ├── DESIGN_SYSTEM.md       # Quy ước giao diện (KHÔNG SỬA)
│   ├── PROJECT_STRUCTURE.md   # File này (KHÔNG SỬA)
│   ├── ARCHITECTURE.md        # Quyết định kiến trúc của riêng repo (ghi 1 lần, tham chiếu lại)
│   └── templates/HANDOVER.md  # Mẫu phiếu bàn giao
│
├── tokens/                    # Design tokens dùng chung (KHÔNG SỬA tay ngoài quy trình)
│   ├── design-tokens.json     # Nguồn chân lý duy nhất
│   └── tokens.css             # Bản CSS đồng bộ 1:1 cho Web/Electron
│
├── logs/                      # Trạng thái phối hợp giữa các agent (commit vào repo)
│   ├── STATE.md               # Hàng đợi task + đang làm + đã xong + quyết định
│   ├── LOCKS.md               # Danh sách file đang bị khóa: path | agent | thời điểm
│   └── handover/              # Phiếu bàn giao: YYYYMMDD-NN_<chu-de>.md
│
├── src/                       # TOÀN BỘ mã nguồn
│   ├── main/  hoặc  app/      # Điểm vào ứng dụng
│   ├── components/            # UI component tái sử dụng (mỗi component 1 thư mục)
│   ├── features/              # Mỗi tính năng 1 thư mục: ui + logic + test đi cùng nhau
│   ├── services/              # Gọi API, DB, hệ thống file
│   ├── utils/                 # Hàm thuần tái sử dụng (không side-effect)
│   ├── styles/                # Style toàn cục — chỉ import từ tokens/, cấm định nghĩa màu mới
│   └── types/  hoặc  models/  # Kiểu dữ liệu / model dùng chung
│
├── assets/                    # icon/, fonts/ (Inter + JetBrains Mono), images/
├── tests/                     # Test tích hợp (unit test đặt cạnh code trong features/)
├── scripts/                   # Script build/release/đồng bộ token (đặt tên động từ: build-win.ps1)
└── dist/  build/  release/    # Sản phẩm build — LUÔN nằm trong .gitignore
```

## Quy tắc đặt tên

- **Thư mục/file thường**: `kebab-case` (`user-profile/`, `date-format.ts`). File markdown quy ước: `UPPER_SNAKE.md`.
- **Biến/hàm**: `camelCase`, tên nói rõ việc (`formatDateVN()`, `loadTokens()`); hằng số `UPPER_SNAKE_CASE`; class/component `PascalCase`. C#/C++ theo chuẩn ngôn ngữ nhưng giữ nguyên ngữ nghĩa tên.
- **Mỗi file một trách nhiệm**; file > 400 dòng phải cân nhắc tách.
- Hàm dùng chung ≥ 2 nơi → chuyển vào `src/utils/` hoặc `src/services/`, không copy-paste.
- Import token: mọi giá trị màu/cỡ chữ/spacing đều truy ngược được về `tokens/design-tokens.json`.

## Repo trung tâm token

Bộ `tokens/` + `docs/DESIGN_SYSTEM.md` đặt tại một repo trung tâm (ví dụ `tsudev-design-tokens`), các project khác nhúng bằng git submodule/subtree hoặc script đồng bộ trong `scripts/`. Đổi 1 mã màu ở repo trung tâm → chạy đồng bộ → toàn hệ sinh thái cập nhật.
