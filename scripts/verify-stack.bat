@echo off
REM Lối vào Windows cho scripts/verify-stack.js (bản thật, đọc cổng từ
REM config/topology.json). Trước đây tệp này còn một nhánh dự phòng gọi thẳng
REM `docker compose logs` với danh sách service đoán trước - danh sách đó đã mục
REM (kể tên hai service không còn tồn tại) nên nó chỉ tạo báo cáo rỗng và làm
REM người chạy tưởng stack hỏng. Muốn xem log thì `docker compose logs` trực
REM tiếp, đừng bảo trì bản sao thứ hai của danh sách service.
SETLOCAL
cd /d %~dp0\..
node "%~dp0\verify-stack.js"
echo Ket qua nam trong verify-output\
