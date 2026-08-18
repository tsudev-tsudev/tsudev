# @tsudev/types

Kiểu và hằng dùng chung giữa các service và app.

Không có bước build - `src/index.js` được import trực tiếp. Package nội bộ, không
publish; vì thế Docker build phải lấy context là **gốc repo**, xem
[../../docs/deployment.md](../../docs/deployment.md).

Thêm kiểu ở đây khi nó được **từ hai nơi trở lên** dùng tới. Dùng một chỗ thì để
tại chỗ đó.
