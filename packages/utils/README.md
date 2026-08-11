# @tsudev/utils

Hàm tiện ích dùng chung giữa các service và app.

Không có bước build, import trực tiếp từ `src/`. Package nội bộ, không publish.

Thêm hàm ở đây khi nó được **từ hai nơi trở lên** dùng tới. Dùng một chỗ thì để
tại chỗ đó.

> Ứng viên nên gom về đây: bốn bản `services/*/src/authMiddleware.js` hiện gần
> như trùng nhau, chỉ khác tiền tố log. Sửa hành vi xác thực đang phải sửa cả
> bốn chỗ.
