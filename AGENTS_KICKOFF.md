Bạn là AI Agent trên codebase ubndxanuicamnoibo (hệ thống điều hành công việc UBND xã Núi Cấm — monorepo Express backend + React frontend, CHỈ localhost), MÔI TRƯỜNG NHIỀU AGENT SONG SONG: mỗi terminal Claude là một agent (agent-1, agent-2, agent-3). BẠN LÀ agent-\_\_\_.

TOÀN BỘ QUY TẮC CHUẨN nằm ở **CLAUDE.md** — Claude Code đã tự nạp + cache vào đầu phiên này (stack, lệnh chuẩn, gotcha cứng, điều phối đa agent, và CHIẾN LƯỢC PHIÊN 4 mục: context window / chế độ chạy Standard / cổng an toàn git / session-refresh). HÃY ĐỌC-HIỂU-TUÂN THỦ CLAUDE.md trong suốt phiên. File kickoff này chỉ nêu BƯỚC KHỞI ĐỘNG.

TRƯỚC KHI CHẠM VÀO BẤT CỨ FILE NÀO, chạy đúng 3 lệnh sau (từ thư mục gốc) để nắm hiện trạng, rồi BÁO LẠI TÔI:

1. ./agents.sh
   → "bảng trạng thái sống": **LOCKS** = agent nào ĐANG khoá/sửa file gì ngay lúc này; **Lưu ý** = cảnh báo còn hiệu lực. (Không có ./agents.sh thì đọc AGENTS_BOARD.md — cùng nội dung.)
2. git log --oneline -15
   → việc ĐÃ HOÀN THÀNH. Chi tiết 1 file: `git log --oneline -- <file>`; xem 1 commit: `git show <hash>`.
3. git status --short
   → việc ĐANG DANG DỞ (chưa commit).
   Tra một quyết định/gotcha cũ: `grep "<từ khoá>" AGENTS_LOG.md` (ĐỪNG đọc cả file; lịch sử xa hơn ở AGENTS_LOG_ARCHIVE_*.md nếu có).

Sau 3 lệnh trên, BÁO TÔI ngắn gọn:
• Việc đã HOÀN THÀNH gần đây (từ git log).
• Việc đang DANG DỞ / file đang bị KHOÁ và do agent nào (LOCKS + git status).
• Cảnh báo/rủi ro đang hiệu lực cần lưu ý.
• Bạn định làm gì tiếp, sẽ claim (khoá) file nào, và cần đọc THÊM tài liệu tĩnh nào cho đúng vùng task (chọn từ mục "Tài liệu tĩnh cốt lõi" trong CLAUDE.md — chỉ nạp phần liên quan, KHÔNG nạp tất cả).
Chỉ bắt tay chỉnh sửa sau khi tôi xác nhận.

QUY TẮC VẬN HÀNH TRONG PHIÊN (nhắc nhanh — chi tiết ở CLAUDE.md):
• Context: đọc có mục tiêu (grep trước, đọc sau); không đọc node_modules/build/dist/coverage/uploads/logs; KHÔNG sửa CLAUDE.md hay tài liệu kiến trúc giữa phiên (bust cache) — dồn về cuối phiên.
• Claim file trước khi sửa (`./agents.sh lock …`); không đụng file agent khác đang khoá; không `git add -A`.
• Chế độ: CHỈ Standard cho mọi tác vụ — KHÔNG gợi ý, KHÔNG bật `/fast`. Tiết kiệm bằng cách làm: gộp lệnh độc lập vào một lượt, grep định vị trước rồi mới đọc đúng đoạn, sửa hàng loạt bằng script (dry-run rồi apply), chạy cổng kiểm tra một lần ở cuối cụm.
• XÁC NHẬN với tôi trước mọi `git push`/deploy; chỉ commit khi tôi yêu cầu; trước commit: build shared-types → `npm run type-check` + `npm run lint` sạch.
• Kết thúc task thành công: `./agents.sh cleanup` dọn rác (log/zip/tar/__pycache__/.venv) → unlock file → gợi ý tôi ĐÓNG terminal, mở phiên mới. Không kéo hội thoại qua nhiều ngày; tri thức cần giữ → `./agents.sh log`/`note`.
