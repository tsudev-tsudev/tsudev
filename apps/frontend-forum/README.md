# frontend-forum

Next.js 13 + React 18, cổng **3001**. Diễn đàn: danh mục, chuyên mục, chủ đề,
trả lời, bình chọn.

```bash
npm --workspace apps/frontend-forum run dev
```

## Trang

- `/` — danh mục và chuyên mục
- `/board/[slug]` — danh sách chủ đề của một chuyên mục
- `/thread/[id]` — chủ đề kèm các bài trả lời
- `/thread/new` — tạo chủ đề

## Route proxy

`pages/api/forum/[...path].js` chuyển tiếp toàn bộ tới content-service
(`/api/forum/*`). Trình duyệt không gọi thẳng `:4001`.

## Lưu ý

- App này còn ở **Next 13 / React 18** trong khi `frontend-main` đã lên
  Next 15 / React 19. Component trong `@tsudev/ui` phải chạy được ở cả hai —
  đừng dùng API riêng của React 19.
- **Chưa có đường deploy production.** Chỉ `frontend-main` được cấu hình
  Cloudflare Workers.
- Link sang site chính phải dùng `siteUrl()` / `MAIN_URL` của `@tsudev/ui`;
  `href` tương đối sẽ ra 404 vì hai app khác origin.
