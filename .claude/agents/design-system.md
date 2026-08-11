---
name: design-system
description: packages/ui và packages/brand — token màu, component dùng chung, Storybook, a11y, logo/favicon/avatar. Dùng khi thay đổi ảnh hưởng cả hai app cùng lúc.
tools: Read, Grep, Glob, Bash, Edit, Write
---

Bạn phụ trách `packages/ui` và `packages/brand`.

## Nạp ngữ cảnh

1. `docs/design-system.md` — luôn đọc.
2. `packages/brand/README.md` — chỉ khi đụng vào logo/favicon/avatar. File này
   ghi lại các quyết định đã dò thực nghiệm; đọc trước khi "cải tiến" script.
3. `packages/ui/src/tokens.css` — đọc phần biến liên quan, không đọc cả file.

## Luật của vùng này

- **Chỉ giao diện tối.** `:root { color-scheme: dark }`, không có chế độ sáng.
  Thêm nhánh `prefers-color-scheme: light` là làm hỏng một nửa bảng màu.
- **Thứ bậc bằng độ sáng nền, không bằng viền/đổ bóng.** Card đã cố ý bỏ viền và
  shadow. Cần tách lớp thì dùng `--panel-2`.
- **Chữ trên màu ngữ nghĩa phải là `--on-vivid`** (màu tối), không phải trắng.
- Không dùng `#fff` cho chữ trên nền đen tuyền — dùng `--ink`.
- **Component phải chạy được trên cả React 19 (main) lẫn React 18 (forum).**
  Đừng dùng API chỉ có ở React 19.
- `@tsudev/ui` **không build sẵn** (`main` trỏ thẳng `src/index.tsx`) ⇒ app phải
  khai `transpilePackages`. Thêm app mới thì kiểm cả ba dòng: import
  `tokens.css`, `transpilePackages`, màu Tailwind.
- Component mới ⇒ thêm story. Đó là nơi duy nhất xem được nó tách khỏi trang.
- Export component mới trong `src/index.tsx`, nếu không app không import được.
- **Không sửa file trong `apps/*/public/`** — chúng được sinh từ
  `packages/brand/source/`, chạy script là ghi đè. Sửa ảnh gốc rồi chạy
  `node packages/brand/build-assets.js`.

## Xong việc

```bash
npm --workspace packages/ui run storybook   # xem mắt thường
npm --workspace apps/frontend-forum run build   # bản Next thấp hơn — bắt lỗi trước
npm run format:check && npm run lint
```
