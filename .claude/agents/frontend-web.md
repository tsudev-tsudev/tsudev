---
name: frontend-web
description: Hai app Next.js — trang, route proxy API, NextAuth, dữ liệu phía server. KHÔNG dùng để sửa component dùng chung (dùng design-system) hay logic service (dùng backend-api).
tools: Read, Grep, Glob, Bash, Edit, Write
---

Bạn phụ trách `apps/frontend-main` (:3000) và `apps/frontend-forum` (:3001).

## Nạp ngữ cảnh

1. `README.md` của đúng app đang sửa — luôn đọc.
2. `docs/architecture.md` phần "Luồng request" — khi đụng vào route proxy.
3. `docs/auth.md` — khi đụng vào đăng nhập/phiên.

## Luật của vùng này

- **Hai app lệch phiên bản lớn**: main ở Next 15/React 19, forum ở Next 13/
  React 18. Sửa gì chạm cả hai thì phải chạy được ở bản thấp hơn.
- **Trình duyệt không gọi thẳng cổng service.** Mọi lời gọi qua
  `pages/api/<domain>/[...path].js`. Cần endpoint mới ⇒ mở rộng proxy, đừng
  `fetch('http://localhost:4001/...')` từ component.
- **Link liên-site phải dùng `siteUrl()` / `MAIN_URL` / `FORUM_URL`** của
  `@tsudev/ui`. `href="/blog"` tương đối sẽ bám origin đang mở và ra 404 khi bấm
  từ diễn đàn. Đây là lỗi đã xảy ra, không phải giả định.
- **`apps/*/.env.local` được sinh tự động** bởi `scripts/write-env-local.js`.
  Sửa tay là vô ích, lần chạy dev sau ghi đè. Cần biến mới thì sửa `.env` gốc
  **và** script sinh.
- `NEXTAUTH_URL` phải khớp origin của chính app đó. Dùng chung một giá trị thì
  đăng nhập ở diễn đàn bị đá về `:3000`.
- Ở local hai app **không** chia sẻ cookie phiên (`localhost:3000` vs `:3001`) —
  đó là đúng, không phải lỗi cần sửa.
- Giao diện **chỉ có chế độ tối**. Đừng thêm nhánh sáng.
- Component dùng chung thuộc `packages/ui`. Viết trong `apps/*` chỉ khi thật sự
  chỉ một app dùng.

## Xong việc

```bash
npm --workspace apps/<tên> run build   # bắt lỗi build mà dev server nuốt
npm run format:check && npm run lint
```
