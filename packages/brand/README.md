# @tsudev/brand — tài nguyên thương hiệu

Nơi lưu **nguồn duy nhất** của logo, avatar mặc định và favicon. Mọi file phục vụ
web trong `apps/*/public/` đều được **sinh tự động** từ thư mục này — đừng sửa
trực tiếp trong `public/`, vì lần chạy lại script sẽ ghi đè.

## Cấu trúc

```
packages/brand/
  source/                     ← ảnh gốc, độ phân giải cao (sửa ở đây)
    logo.jpeg                 2048×2048, nền trắng
    avatar.png                1490×1490, avatar thương hiệu
    favicons/                 bộ favicon do RealFaviconGenerator xuất
    favicons.zip              bản lưu trữ gốc của bộ favicon
  build-assets.js             script sinh tài nguyên
```

## Cập nhật tài nguyên

```bash
npm i --no-save sharp                    # sharp không nằm trong dependency của repo
node packages/brand/build-assets.js
```

Script ghi đồng thời vào `public/` của **cả hai** app (`frontend-main`,
`frontend-forum`). Muốn thêm app, bổ sung vào mảng `APPS` trong script.

### Đầu ra

| File                                                            | Nguồn                        | Ghi chú                                         |
| --------------------------------------------------------------- | ---------------------------- | ----------------------------------------------- |
| `brand/logo-full.png`                                           | `logo.jpeg`                  | logo đầy đủ, nền trong suốt                     |
| `brand/logo-mark.png`                                           | `logo.jpeg`                  | chỉ biểu tượng cú — dùng ở `SiteHeader`         |
| `brand/logo-wordmark.png`                                       | `logo.jpeg`                  | chỉ phần chữ                                    |
| `avatars/default-0N.webp`                                       | vẽ bằng vector trong script  | 6 tông, 256×256, 3 kinh + 5 vĩ                  |
| `avatars/sm/default-0N.webp`                                    | vẽ bằng vector trong script  | 6 tông, 128×128, 2 kinh + 3 vĩ                  |
| `favicon.ico`                                                   | `android-chrome-512x512.png` | ICO thật, 3 độ phân giải 16/32/48               |
| `favicon-*.png`, `apple-touch-icon.png`, `android-chrome-*.png` | `android-chrome-512x512.png` | đã xoá nền trắng                                |
| `site.webmanifest`                                              | script                       | `theme_color` khớp `--surface` trong tokens.css |

## Vài quyết định kỹ thuật

**Xoá nền logo.** Dùng flood fill 4 hướng từ viền ảnh, không dùng kiểu "biến mọi
pixel gần trắng thành trong suốt". Lý do: cách sau sẽ đục thủng các mảng sáng
_bên trong_ logo (chữ TSU, nét bộ não, highlight trên cánh). Ngưỡng
`inner=40 / outer=58` là kết quả dò thực nghiệm: thấp hơn thì còn quầng xám
quanh cú trên nền đen, cao hơn thì flood fill lách qua vùng quầng sáng và ăn lẹm
viền bộ não.

**Lòng chữ kín.** Flood fill từ viền không với tới vùng nền bị bao kín (lòng chữ
"d", "e"). Phần chữ là hình phẳng không có quầng sáng nên được dọn thêm bằng
ngưỡng màu toàn cục, chỉ áp dụng cho dải chữ bên dưới.

**Avatar vẽ bằng vector.** `source/avatar.png` có dòng chữ "tsudev\_" đè lên vùng
xích đạo của quả cầu lưới, nên phần lưới nằm dưới chữ đã mất hẳn dữ liệu — mọi
cách vá (lấp từ bản xoay 90°, nội suy theo hàng) đều để lại vệt rõ. Vì vậy quả
cầu được dựng lại bằng SVG ngay trong script: sạch tuyệt đối ở mọi kích thước,
file dưới 11 kB, và đổi màu chính xác theo từng biến thể thay vì xoay hue gần
đúng. Ảnh gốc vẫn giữ trong `source/` để tham chiếu thiết kế.

`packages/ui/src/components/Avatar.jsx` gán biến thể theo hàm băm FNV-1a của tên
đăng nhập: ổn định theo từng tài khoản nhưng phân bố đều.

**Hai mức chi tiết.** Ở 32–40px — cỡ chiếm gần hết số lần dùng — bản đầy đủ
3 kinh + 5 vĩ bị rối nét. Bộ `avatars/sm/` rút còn 2 kinh + 3 vĩ, ít nút hơn và
tăng bề dày nét tương đối (`strokeScale`) để vẫn rõ khi thu nhỏ; file nhẹ hơn
khoảng 60%. `Avatar.jsx` tự chọn bộ theo prop `size`, ngưỡng 48px (`SMALL_MAX`).
Chỉ trang hồ sơ thành viên (80px) và ô người bán ở chợ (64px) dùng bản đầy đủ.

**Xoá nền favicon.** Bộ gốc bị nung sẵn nền trắng (0% pixel trong suốt). Script
tách nền trên bản 512 rồi thu nhỏ xuống các cỡ còn lại — hạ cỡ từ ảnh đã có alpha
cho biên mượt hơn nhiều so với tách nền trực tiếp trên ảnh 16px.

**favicon.ico.** File `.ico` trong bộ gốc thực chất là PNG đổi đuôi (không phải
container ICO). Script dựng lại ICO thật chứa 3 độ phân giải, nên bộ gốc đã được
lược bỏ file đó để tránh nhầm lẫn — bản lưu trữ đầy đủ vẫn nằm trong
`favicons.zip`.
