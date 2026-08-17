# Hệ thống giao diện

Nguồn duy nhất: `packages/ui` (`@tsudev/ui`). Cả hai app Next đều dùng nó. Viết
component riêng trong `apps/*` chỉ được phép khi nó thật sự chỉ dùng ở một app.

## Token

`packages/ui/src/tokens.css` khai báo toàn bộ biến CSS. **HAI chế độ, Sáng là
mặc định**: `:root` mang bảng màu sáng, `:root[data-theme='dark']` ghi đè.

**Không dùng `prefers-color-scheme`.** Lựa chọn hiển thị là một quyết định của
sản phẩm - một site đổi diện mạo theo cài đặt hệ điều hành thì hai người mở cùng
một đường link sẽ thấy hai thứ khác nhau mà không ai chọn gì cả. Người dùng bật
chế độ tối bằng nút trên header (`ThemeToggle`), lựa chọn ghi vào localStorage
và được áp **trước khi vẽ** bởi script nội tuyến trong `pages/_document.tsx`.
Script đó phải đồng bộ và nằm trong `<head>`; bất cứ thứ gì chạy sau lần vẽ đầu
đều cho ra một khung hình sáng trắng trước khi chuyển sang tối.

Nhóm biến chính:

| Nhóm        | Biến                                                                 |
| ----------- | -------------------------------------------------------------------- |
| Bề mặt      | `--surface` < `--panel` < `--panel-2`, `--border`, `--border-strong` |
| Chữ         | `--ink`, `--ink-soft`, `--muted`                                     |
| Thương hiệu | `--primary`, `--primary-ink`, `--primary-contrast`, `--accent`       |
| Ngữ nghĩa   | `--success`, `--warning`, `--error`, `--on-vivid`                    |
| Icon        | `--icon-nav/create/edit/danger/info/trust`                           |
| Hoạ tiết    | `--grid-line`, `--glow`                                              |
| Chữ & hình  | `--font-sans`, `--font-mono`, `--radius-sm/md/lg`                    |

### Cổng tương phản

`packages/ui/test/contrast.test.ts` đọc **thẳng** `tokens.css` và kiểm mọi cặp
chữ/nền ở CẢ HAI chế độ theo ngưỡng WCAG AA (4.5:1 cho chữ và icon mang thông
tin, 3:1 cho viền). Đổi một mã màu làm tụt xuống dưới ngưỡng là **CI đỏ**, không
phải một khiếu nại của người dùng vài tháng sau. Nó chạy trong job
`Migrate & test services`.

Hai chế độ nghĩa là mỗi cặp màu tồn tại hai lần, và một cặp đủ tương phản ở chế
độ tối hoàn toàn có thể không đủ ở chế độ sáng. Kiểm bằng mắt bắt được cái chói,
không bắt được cái vừa-đủ-trượt.

### Luật dễ vi phạm

- **Thứ bậc chủ yếu do độ sáng nền.** Card có thêm viền hairline vì ở chế độ
  sáng, card (trắng) trên nền trang (xanh rất nhạt) chênh nhau quá ít để mắt tự
  dựng ra cạnh. Ở chế độ tối viền gần như vô hình và thứ bậc vẫn do độ sáng nền
  đảm nhiệm. Đừng thêm `box-shadow` để tạo chiều sâu.
- **Chữ trên màu ngữ nghĩa luôn là `--on-vivid`**, đừng cắm cứng mã hex.
  `--on-vivid` là màu TỐI ở chế độ tối (các sắc ngữ nghĩa sáng) và màu TRẮNG ở
  chế độ sáng (các sắc ngữ nghĩa đậm) - một mã hex cắm cứng đúng ở một chế độ và
  gần như không đọc được ở chế độ kia.
- **Đừng khai lại bảng màu song song.** `tailwind.config.js` từng có một thang
  `primary` 50→900 cắm cứng bên cạnh bảng token; thang đó không đổi theo chế độ,
  nên `bg-primary-100` cho ra một mảng xanh nhạt chói giữa nền đen.

## Icon

`Icon` (`packages/ui/src/components/Icon.tsx`) - màu **đi theo chức năng**, gắn
cứng với tên icon và không cho truyền từ nơi gọi:

| Vai trò  | Màu        | Dùng cho                         |
| -------- | ---------- | -------------------------------- |
| `nav`    | xanh dương | điều hướng, liên kết, mở         |
| `create` | xanh lá    | tạo, thêm, tải lên               |
| `edit`   | hổ phách   | sửa, cấu hình                    |
| `danger` | đỏ         | xoá, thu hồi, huỷ                |
| `info`   | tím        | siêu dữ liệu, thời gian, số liệu |
| `trust`  | ngọc       | con dấu, xác minh, chữ ký        |

Khi mỗi trang tự chọn màu thì cùng một hành động "xoá" sẽ đỏ ở trang này và xám
ở trang kia, và người dùng mất khả năng đọc màu như một tín hiệu. Cần một sắc
khác nghĩa là cần một **chức năng** khác - thêm vào bảng, đừng ghi đè tại chỗ gọi.

Icon không có prop `label` sẽ bị `aria-hidden`: icon trang trí mà lọt vào cây
a11y sẽ được đọc thành một "graphic" vô nghĩa xen giữa câu chữ.

## Mục lục

`TableOfContents` dùng chung cho blog, tài liệu và ba trang pháp lý. Nó có nền
và viền riêng vì mục lục là **điều hướng**, không phải nội dung - không tách ra
khỏi thân bài bằng một bề mặt riêng thì ở chế độ sáng nó đọc như một danh sách
gạch đầu dòng nằm giữa bài.

Neo do `extractHeadings()` và `renderMarkdown()` sinh ra bằng **cùng một** bộ
tạo slug (`apps/frontend-main/lib/md.ts`). Hai bên tính riêng thì mục lục trỏ
tới những neo không tồn tại, và triệu chứng chỉ là "bấm vào không nhảy".

## Cách app nạp

```
apps/*/styles/globals.css   →  @import '../../../packages/ui/src/tokens.css'
apps/*/next.config.js       →  transpilePackages: ['@tsudev/ui']
apps/*/tailwind.config.js   →  màu Tailwind trỏ vào các biến CSS trên
```

`@tsudev/ui` **không** được build sẵn (`main` trỏ thẳng `src/index.tsx`) - vì
thế `transpilePackages` là bắt buộc. Thêm app mới thì phải khai cả ba dòng trên,
thiếu một dòng là giao diện thô hoặc build đỏ.

## Component

Export từ `packages/ui/src/index.tsx`:

`SiteHeader` · `SiteFooter` · `Layout` (mặc định) · `Container` · `Button` ·
`Input` · `Card` · `Modal` · `Toast` · `Badge` · `Avatar` · `Logo` ·
`SectionHeading` · `Stat` · `Article` · `ThreadRow` · `Upload`

Kèm `MAIN_URL` - gốc tuyệt đối cho canonical/OG. Điều hướng trong site dùng
href tương đối: tsudev chỉ còn MỘT origin.

### Ràng buộc khi viết component

- Component chỉ còn phải chạy trên Next 15 / React 19. Ràng buộc "cả React 18"
  đã nghỉ hưu cùng `frontend-forum`. Root `package.json` **vẫn** ghim
  `react@18.3.1` cho Storybook - nợ đã ghi, xem `next.config.js`.
- Điều hướng trong site dùng href tương đối. `MAIN_URL` chỉ dành cho URL tuyệt
  đối thật sự cần (canonical, OG, mã nhúng huy hiệu cho bên thứ ba).
- `Avatar` chọn biến thể theo băm FNV-1a của username và **tự đổi bộ ảnh theo
  `size`** (ngưỡng 48px). Đừng ép đường dẫn ảnh bằng tay - chi tiết ở
  [../packages/brand/README.md](../packages/brand/README.md).

## Storybook

```bash
npm --workspace packages/ui run storybook       # :6006
npm --workspace packages/ui run build-storybook
```

Đã có story cho: Article, Button, Card, Header, Input, Layout, Modal, Toast,
Upload. Thêm component mới thì thêm story - đó là nơi duy nhất xem được component
tách khỏi trang.

## Khả năng truy cập

Mức nền: WCAG AA. `tokens.css` đã có `.skip-link` (dùng viền thương hiệu thay vì
đổ bóng, vì bóng đen không tách lớp được trên nền đen tuyền).

Khi thêm component: dùng HTML ngữ nghĩa, giữ điều hướng bằng bàn phím, có
`:focus-visible` rõ ràng, gắn nhãn cho mọi input, quản lý focus khi mở modal.

## Ảnh & thương hiệu

Logo, favicon, avatar mặc định được **sinh tự động** từ `packages/brand/source/`.
Đừng sửa file trong `apps/*/public/` - lần chạy script sau sẽ ghi đè. Quy trình:
[../packages/brand/README.md](../packages/brand/README.md).
