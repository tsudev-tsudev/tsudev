# Hệ thống giao diện

Nguồn duy nhất: `packages/ui` (`@tsudev/ui`). Cả hai app Next đều dùng nó. Viết
component riêng trong `apps/*` chỉ được phép khi nó thật sự chỉ dùng ở một app.

## Token

`packages/ui/src/tokens.css` khai báo toàn bộ biến CSS. **Chỉ giao diện tối** —
không có chế độ sáng, `:root { color-scheme: dark }`. Đừng thêm nhánh
`prefers-color-scheme: light`; hệ màu được dựng cho nền đen tuyền và một nửa
bảng màu sẽ hỏng.

Nhóm biến chính:

| Nhóm        | Biến                                                                        |
| ----------- | --------------------------------------------------------------------------- |
| Bề mặt      | `--surface` (#000) < `--panel` < `--panel-2`, `--border`, `--border-strong` |
| Chữ         | `--ink`, `--ink-soft`, `--muted`                                            |
| Thương hiệu | `--primary`, `--primary-ink`, `--primary-contrast`, `--accent`              |
| Ngữ nghĩa   | `--success`, `--warning`, `--error`, `--on-vivid`                           |
| Hoạ tiết    | `--grid-line`, `--glow`                                                     |
| Chữ & hình  | `--font-sans`, `--font-mono`, `--radius-sm/md/lg`                           |

Hai luật dễ vi phạm:

- **Thứ bậc do độ sáng nền, không do viền/đổ bóng.** Card đã bỏ viền và shadow.
  Thêm `border`/`box-shadow` vào card là đi ngược hệ thống — dùng `--panel-2`.
- **Chữ đặt trên màu ngữ nghĩa phải là màu tối** (`--on-vivid`), không phải
  trắng. Các màu đó cố ý sáng để nổi trên nền đen; chữ trắng lên trên là không
  đạt tương phản.

Không dùng trắng tinh (`#fff`) cho chữ trên nền đen tuyền — dùng `--ink` (#ededed)
để giảm loé.

## Cách app nạp

```
apps/*/styles/globals.css   →  @import '../../../packages/ui/src/tokens.css'
apps/*/next.config.js       →  transpilePackages: ['@tsudev/ui']
apps/*/tailwind.config.js   →  màu Tailwind trỏ vào các biến CSS trên
```

`@tsudev/ui` **không** được build sẵn (`main` trỏ thẳng `src/index.tsx`) — vì
thế `transpilePackages` là bắt buộc. Thêm app mới thì phải khai cả ba dòng trên,
thiếu một dòng là giao diện thô hoặc build đỏ.

## Component

Export từ `packages/ui/src/index.tsx`:

`SiteHeader` · `SiteFooter` · `Layout` (mặc định) · `Container` · `Button` ·
`Input` · `Card` · `Modal` · `Toast` · `Badge` · `Avatar` · `Logo` ·
`SectionHeading` · `Stat` · `Article` · `ThreadRow` · `Upload`

Kèm `MAIN_URL` — gốc tuyệt đối cho canonical/OG. Điều hướng trong site dùng
href tương đối: tsudev chỉ còn MỘT origin.

### Ràng buộc khi viết component

- Component chỉ còn phải chạy trên Next 15 / React 19. Ràng buộc "cả React 18"
  đã nghỉ hưu cùng `frontend-forum`. Root `package.json` **vẫn** ghim
  `react@18.3.1` cho Storybook — nợ đã ghi, xem `next.config.js`.
- Điều hướng trong site dùng href tương đối. `MAIN_URL` chỉ dành cho URL tuyệt
  đối thật sự cần (canonical, OG, mã nhúng huy hiệu cho bên thứ ba).
- `Avatar` chọn biến thể theo băm FNV-1a của username và **tự đổi bộ ảnh theo
  `size`** (ngưỡng 48px). Đừng ép đường dẫn ảnh bằng tay — chi tiết ở
  [../packages/brand/README.md](../packages/brand/README.md).

## Storybook

```bash
npm --workspace packages/ui run storybook       # :6006
npm --workspace packages/ui run build-storybook
```

Đã có story cho: Article, Button, Card, Header, Input, Layout, Modal, Toast,
Upload. Thêm component mới thì thêm story — đó là nơi duy nhất xem được component
tách khỏi trang.

## Khả năng truy cập

Mức nền: WCAG AA. `tokens.css` đã có `.skip-link` (dùng viền thương hiệu thay vì
đổ bóng, vì bóng đen không tách lớp được trên nền đen tuyền).

Khi thêm component: dùng HTML ngữ nghĩa, giữ điều hướng bằng bàn phím, có
`:focus-visible` rõ ràng, gắn nhãn cho mọi input, quản lý focus khi mở modal.

## Ảnh & thương hiệu

Logo, favicon, avatar mặc định được **sinh tự động** từ `packages/brand/source/`.
Đừng sửa file trong `apps/*/public/` — lần chạy script sau sẽ ghi đè. Quy trình:
[../packages/brand/README.md](../packages/brand/README.md).
