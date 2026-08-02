# UI/UX Specification — tsudev

Tài liệu này mô tả chi tiết thiết kế giao diện, sitemap, design system, component catalog và lộ trình triển khai để nâng cấp giao diện hiện tại (ví dụ hiển thị đơn giản như trong ảnh đính kèm) thành một sản phẩm chuyên nghiệp, nhất quán và dễ mở rộng.

---

## 1. Tóm tắt nhanh — Tại sao giao diện hiện tại quá đơn giản

- Hiện trạng codebase chứa nhiều scaffold/placeholder (Next.js mặc định) nhưng thiếu Design System và styles toàn cục (Tailwind/Globals).
- Không có `packages/ui` hoặc thư viện component chung nên mỗi `apps/*` đều dùng styles cục bộ hoặc không có styles.
- Chưa có token theme, logo/brand assets, hoặc Storybook để phát triển components độc lập.
- Các trang front-end có thể chưa tích hợp CSS (ví dụ chưa chạy Tailwind build), hoặc `_app.js` không bọc `ThemeProvider` -> dẫn đến giao diện thô.

Kết luận: giao diện đơn giản là do thiếu hệ thống UI chung, thiếu styles toàn cục và thiếu thành phần được tái sử dụng.

---

## 2. Mục tiêu

- Xây dựng `packages/ui` (Design System) chứa tokens, ThemeProvider, các component cơ bản và Storybook.
- Chuẩn hoá layout (Header/Footer), global CSS (Tailwind hoặc CSS variables) và thực thi UI nhất quán trên `apps/*`.
- Cung cấp các component for upload/presign, markdown/article rendering, forum composer, avatar, badges, và controls.
- Đảm bảo responsive, performance và WCAG AA accessibility.

---

## 3. Sitemap (gợi ý chi tiết)

- Main Site (`frontend-main`)
  - `/` Home
  - `/about`
  - `/upload` (Upload widget)
  - `/search`
- Blog (`blog`) hoặc `/blog`
  - `/blog` listing
  - `/blog/[slug]` article
- Forum (`frontend-forum`)
  - `/forum` threads
  - `/forum/[id]` thread view
- Docs / Archive (`docs`)
  - `/docs` index
  - `/docs/[path]` doc page
- User
  - `/user/[username]` profile
  - `/settings`
- Admin
  - `/admin/users`
  - `/admin/moderation`

---

## 4. Design System (packages/ui)

### 4.1 Tokens

- Colors, spacing, border-radius, typography scale, shadows, z-index scale.
- Lưu dưới dạng JS/JSON export để sử dụng bởi React (ThemeProvider) và Tailwind (custom config).

### 4.2 Typography

- Font: Inter (Google) — heading scale và body scale.

### 4.3 Theme

- Light + Dark mode (CSS variables + ThemeProvider)
- Provide utility hooks: `useTheme()`, `toggleTheme()`.

### 4.4 Component Basics (skeleton)

- `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Toggle`, `Avatar`, `Badge`, `Card`, `Modal`, `Toast`, `UploadDropzone`, `Progress`.
- `Layout`: `Header`, `Footer`, `Main`, `Sidebar`, `Container`.

### 4.5 Storybook

- Storybook root trong `packages/ui/.storybook`.
- Các stories cho mỗi component để facilitate visual-review và visual regression.

---

## 5. Page-level UX (một số trang mẫu)

### Header

- Logo (link /), global search, sign-in/profile dropdown, mobile menu.

### Home

- Hero with CTA, features grid, latest posts, featured projects.

### Upload

- Drag-and-drop zone, file type / size validation, client-side preview, progress bar.
- Use presign flow: client requests `/api/presign` (authenticated) and uploads to CDN/S3.

### Blog/Article

- Markdown rendered, share buttons, author box, related content, comments (embedded forum or API-driven comments).

### Forum Thread

- Composer with markdown preview and attachments, thread list with filters and pagination.

---

## 6. Accessibility (WCAG)

- Semantic HTML, role attributes for widgets, keyboard navigation, focus-visible styles.
- Color contrast >= 4.5:1 for body text; test with axe/Lighthouse.
- Aria labels for forms and complex components.

---

## 7. Performance & SEO

- Use Next.js `getStaticProps`/`getServerSideProps` for article pages.
- Optimize images (Next/Image or CDN resizing), lazy-load offscreen content.
- Critical CSS and defer non-critical; prefer Tailwind JIT to reduce CSS size.

---

## 8. Visual assets & branding

- Provide `assets/logo/*` variants and favicons.
- OG image template generator for articles (server-side render or build-time image generation).

---

## 9. Implementation roadmap (phased)

Phase 0 — Foundation (week 1):

- Initialize `packages/ui` with `package.json`, `src/theme.js`, `src/index.js`, `Button`, `Header`, `Footer`.
- Add Storybook and a minimal config.
- Add Tailwind (or CSS variables) and wire into `apps/frontend-main`.

Phase 1 — Core pages (week 2–3):

- Implement Home, Blog listing, Article template, Upload widget.
- Add Upload client that calls `storage-service` presign.

Phase 2 — Forum & Rich features (week 4–6):

- Thread composer, moderation UI, admin pages, user settings.
- QA accessibility, performance tuning, SEO.

---

## 10. Quick scaffolding commands (gợi ý)

Use these locally to scaffold `packages/ui` and Storybook quickly:

```bash
# From repo root
cd packages
mkdir ui && cd ui
npm init -y
npm install react react-dom
# Add dev deps
npm install -D storybook@latest @storybook/react tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Add a minimal `src/index.js` exporting components and `src/theme.js` for tokens.

---

## 11. Mapping công việc cụ thể vào codebase (ví dụ tasks)

- Tạo `packages/ui` skeleton.
- Add `Header`/`Footer` và wire vào `apps/frontend-main/pages/_app.js`.
- Thêm Tailwind hoặc ThemeProvider và global CSS.
- Implement `UploadDropzone` + client presign logic using existing `storage-service`.
- Add Storybook job to CI to catch visual regressions.

---

## 12. Next steps tôi có thể làm ngay

- A: Tạo PR chứa `packages/ui` skeleton (ThemeProvider + Button + Header) + Storybook config.
- B: Hoặc chỉ tạo file tài liệu `docs/ui-ux-spec.md` (đã tạo) và chờ bạn quyết định.

Nếu bạn muốn, tôi khởi tạo PR/skeleton ngay — cho biết bạn muốn `A` hay `B` hoặc sửa đổi trước khi tôi scaffold code.
