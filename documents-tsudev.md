> **Đây là tài liệu YÊU CẦU, không phải mô tả hiện trạng.**
> Đặc tả kỹ thuật gốc do chủ dự án ban hành, giữ nguyên làm đích đến và căn cứ
> nghiệm thu. Khi tài liệu này và mã nguồn mâu thuẫn: **mã nguồn là hiện trạng,
> tài liệu này là đích đến**. Muốn biết hệ thống đang thực sự chạy ra sao, đọc
> [`docs/architecture.md`](docs/architecture.md) và [`README.md`](README.md).
>
> Chênh lệch đã biết tính đến 11/08/2026:
> - `services/api-gateway` (§5) **chưa tồn tại** - vai trò gateway hiện do route
>   proxy của Next đảm nhiệm.
> - Blog và kho tài liệu (§2.1) đang là nhánh `/blog`, `/docs` của `frontend-main`
>   chứ chưa tách thành subdomain riêng.
> - `packages/ui` (§7.5) **đã có** với 17 component + Storybook - phần "hiện trạng
>   là scaffold" ở §7 đã lỗi thời.
> - Đã bổ sung ngoài đặc tả gốc: `services/trust-service` (con dấu tín nhiệm),
>   chợ có ký quỹ, tin nhắn riêng.

# ---

**TÀI LIỆU ĐẶC TẢ KỸ THUẬT (TECHNICAL SPECIFICATIONS)**

**Dự án:** Hệ sinh thái Công nghệ tsudev

**Phiên bản tài liệu:** 1.0.0

**Chủ sở hữu dự án:** Nguyễn Trang Tình Sử

**Repo:** https://github.com/tsudev-tsudev/tsudev (private)

**Tài liệu tham chiếu thiết kế nội bộ:** `documents-tsudev.html`

## ---

**1\. TỔNG QUAN DỰ ÁN (PROJECT OVERVIEW)**

### **1.1. Định vị thương hiệu**

- **Tên thương hiệu:** Nguyễn Trang Tình Sử (tsudev)
- **Slogan:** "tsudev: Decoding the Future, One Commit at a Time." (tsudev: Giải mã tương lai qua từng dòng code).
- **Mô tả Meta/About:** "tsudev là hệ sinh thái công nghệ đa nền tảng, vận hành trên các tiêu chuẩn kỹ thuật toàn cầu. Tập trung vào việc chuẩn hóa tri thức thông qua kho tư liệu khổng lồ, diễn đàn thảo luận chuyên sâu và các giải pháp mã nguồn có tính ứng dụng cao, đồng hành cùng sự thành công của cộng đồng."

### **1.2. Mục tiêu hệ thống**

Xây dựng một hệ sinh thái web toàn diện dành cho Developer (chuyên trang cá nhân, blog kiến thức, diễn đàn kỹ thuật, kho lưu trữ mã nguồn/tài liệu, Product Showcase). Hệ thống phải đảm bảo tính mở rộng cao (Scalability), tính khả dụng cao (High Availability), và bảo mật cấp doanh nghiệp (Enterprise-grade Security). Codebase được chuẩn hoá phù hợp với mọi kích thước và độ phân giải màn hình của các thiết bị khác nhau như điện thoại, máy tính bảng, và máy tính để bàn (Responsive web design) giúp mang lại trải nghiệm người dùng trên mọi nền tảng giúp mang lại trải nghiệm người dùng tốt hơn.

## ---

**2\. KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)**

Hệ thống được thiết kế theo kiến trúc **Microservices** hoặc **Modular Monolith** (tùy thuộc vào quy mô team phát triển hiện tại), phân tách rõ ràng các service cốt lõi để tối ưu hóa quản lý tài nguyên.

### **2.1. Phân hệ Website (Sub-sites Topology)**

Từ đợt tái cấu trúc ở PR #9, tsudev là **một app duy nhất trên một origin**:
blog, tài liệu, dự án & bản quyền, con dấu tín nhiệm và trang quản trị đều là
nhánh đường dẫn của cùng một site, không còn tách thành sub-site riêng. Chỉ hai
thành phần cần origin riêng, vì chúng là hệ khác chứ không phải trang khác.

- **Main Site (dự án & bản quyền, blog, tài liệu, con dấu, quản trị):** tsudev.com
- **CDN / Object Storage công khai:** cdn.tsudev.com

### **2.2. Kiến trúc xác thực**

Đặc tả ban đầu để ngỏ hai nhánh: dựng một Auth Server độc lập, hoặc xây dựng Auth API riêng bằng JWT/Session cookie. **Đã chốt nhánh thứ hai** - xác thực do chính codebase quản lý, không có nhà cung cấp danh tính ngoài và không có origin `auth.*`. Một website dự án cá nhân không cần một hệ danh tính riêng để nuôi, mà hệ đó lại tiêu đúng phần hạn mức miễn phí mà site thật đang cần.

- **Phiên trình duyệt:** NextAuth, cookie HttpOnly ở cấp tên miền, không đẩy token ra JavaScript.
- **Mật khẩu:** Argon2id, chỉ `auth-service` chạm tới `passwordHash`.
- **Yếu tố thứ hai:** TOTP và passkey (WebAuthn).
- **Danh tính gửi xuống service:** khẳng định có chữ ký do BFF ký lại cho từng request, hạn dùng ngắn - người dùng không bao giờ giữ token này.
- **Phân quyền:** đọc cột `User.role` trong DB, fail closed. Không có biến môi trường nào bật/tắt được.

Hiện trạng chi tiết: `docs/auth.md`.

### **2.3. Giải pháp Lưu trữ đối tượng (Object Storage) & CDN**

Hệ thống xử lý khối lượng lớn tài liệu, mã nguồn và media assets:

- **Lưu trữ gốc (Origin Storage):** Phải sử dụng dịch vụ **S3-Compatible Object Storage** (khuyến nghị Cloudflare R2, AWS S3, hoặc tự host MinIO) để lưu trữ file. API của backend chỉ làm nhiệm vụ xác thực quyền tải/xem file, sau đó trả về Pre-signed URL cho client.
- **Mạng phân phối nội dung (CDN):** Route toàn bộ traffic tải file qua mạng lưới của **Cloudflare**. Thiết lập các quy tắc Page Rules / Cache Rules trên Cloudflare để edge-cache các file tĩnh (PDF, ZIP, Images, SVG assets) giúp giảm 90% chi phí egress bandwidth từ server gốc và tăng tốc độ tải file toàn cầu.

## ---

**3\. CÔNG NGHỆ & MÔI TRƯỜNG (TECH STACK)**

_(Tech stack đề xuất đảm bảo sự tương thích tối đa với quy trình CI/CD và môi trường Linux/Docker khắt khe)._

- **Frontend:** Next.js (React) hoặc Nuxt (Vue) phục vụ SSR (Server-Side Rendering) giúp tối ưu SEO tuyệt đối cho Blog và Tài liệu. TailwindCSS cho giao diện.
- **Backend:** Node.js (NestJS) hoặc Golang. Cung cấp RESTful API và GraphQL cho các client.
- **Database:** \* PostgreSQL (Cho dữ liệu quan hệ: User, Bài viết, Bình luận).
  - Redis (Cho Caching, Quản lý Session SSO, Rate Limiting).
- **Infrastructure & DevOps:**
  - **Containerization:** Toàn bộ service phải được đóng gói bằng **Docker** (có sẵn `docker-compose.yml` và Dockerfile ở thư mục gốc repo).
  - **CI/CD:** Tích hợp **GitHub Actions** cho quy trình tự động kiểm tra code (Linting), quét bảo mật (Secret scanning), build image và deploy.
    - **HTTPS** https://github.com/tsudev-tsudev/tsudev.git
    - **SSH** git@github.com:tsudev-tsudev/tsudev.git
    - **GitHub CLI** gh repo clone tsudev-tsudev/tsudev
  - **Security:** Quản lý truy cập nội bộ (Admin dashboard, Database port) thông qua Cloudflare Zero Trust (Tunnels).

## ---

**4\. GIÁM SÁT & CẢNH BÁO (MONITORING & ALERTING)**

Đây là yêu cầu bắt buộc để duy trì tư duy sản phẩm chất lượng cao, đảm bảo thời gian phản hồi sự cố (MTTR \- Mean Time To Recovery) là thấp nhất.

### **4.1. Hệ thống Monitoring**

- **Application Performance Monitoring (APM):** Tích hợp **New Relic** vào cả Backend và Frontend để theo dõi bottleneck của database, thời gian phản hồi API, và thông lượng hệ thống (Throughput).
- **Error Tracking:** Tích hợp SDK của **Sentry** trên toàn bộ các môi trường (Frontend/Backend). Bắt toàn bộ các Unhandled Exceptions, Promise Rejections, và lỗi UI/UX.

### **4.2. Quy trình Alerting (Cảnh báo thời gian thực)**

- **Điều kiện kích hoạt (Triggers):** \* Tỷ lệ lỗi (Error rate) \> 1%.
  - Downtime của bất kỳ service nào (Ping fail).
  - Phát hiện lỗi logic nghiêm trọng thông qua Sentry.
- **Kênh nhận cảnh báo (Routing):**
  - **Telegram:** Cấu hình Webhook từ Sentry và New Relic gửi trực tiếp payload báo lỗi (bao gồm stack trace và link chi tiết) về bot Telegram, forward tới tài khoản: **@nguyentrangtinhsu**.
  - **Email:** Gửi báo cáo tổng hợp và cảnh báo rớt mạng khẩn cấp về hộp thư: **devnguyentrangtinhsu@gmail.com**.

## ---

**5\. CẤU TRÚC REPOSITORY (CODEBASE STRUCTURE)**

Toàn bộ source code phải tuân thủ chuẩn Monorepo (hoặc Multi-repo quản lý qua submodule) với cấu trúc cơ bản như sau:

Plaintext

tsudev/  
├── .github/ \# Cấu hình GitHub Actions CI/CD workflows  
├── docs/ \# Bản sao tài liệu documents-tsudev.html và API Docs  
├── apps/  
│ ├── frontend-main/ \# Code UI Next.js/Nuxt cho trang chủ, blog, product  
│ ├── frontend-forum/ \# Code UI cho diễn đàn  
│ └── sso-auth/ \# Hệ thống giao diện/logic đăng nhập tập trung  
├── packages/ \# Shared libraries (UI components, utils, types chung)  
├── services/  
│ ├── api-gateway/ \# API Gateway / Nginx config  
│ ├── user-service/ \# Microservice quản lý User & Auth  
│ ├── content-service/ \# Microservice quản lý Blog, Forum post  
│ └── storage-service/ \# Microservice giao tiếp với Object Storage & Cloudflare  
├── infrastructure/ \# Terraform/Ansible scripts, Cloudflare config  
├── docker-compose.yml \# Dựng môi trường local cho team dev  
└── README.md \# Hướng dẫn setup dự án chi tiết

## ---

**6\. TIÊU CHUẨN NGHIỆM THU (ACCEPTANCE CRITERIA)**

1. **Xác thực:** Dev team phải demo được việc đăng nhập tại tsudev.com/login, sau đó có phiên làm việc hợp lệ và có quyền tải file private từ kho lưu trữ.
2. **Object Storage:** Khách truy cập tải một file tài liệu 100MB, header của trình duyệt phải hiển thị file được serve qua đường truyền của CDN (ví dụ cf-cache-status: HIT) chứ không tải trực tiếp từ băng thông của server backend.
3. **Alerting:** Tạo ra một lỗi "chủ động" trên backend (ví dụ: chia cho 0 hoặc gọi một API không tồn tại), hệ thống phải tự động đẩy thông báo báo lỗi chi tiết đến Telegram @nguyentrangtinhsu và email devnguyentrangtinhsu@gmail.com trong vòng 30 giây.
4. **Code Quality:** Không chứa hardcode credentials. Repo phải chạy được trên môi trường cục bộ bằng một lệnh khởi tạo duy nhất (`docker-compose up`, hoặc `npm run dev:full` - đường chạy không cần Docker).

---

**7. GIAO DIỆN NGƯỜI DÙNG (UI) & ĐẶC TẢ HIỂN THỊ**

Mục tiêu của phần này: xác định đầy đủ site, luồng người dùng và hệ thống thiết kế (design system) để biến giao diện hiện đang là "scaffold/placeholder" thành một giao diện chuyên nghiệp, nhất quán, thân thiện và dễ bảo trì.

7.1 Tổng quan và nguyên tắc thiết kế
- Thiết kế tôn trọng tính nhất quán (consistency), khả năng truy cập (a11y), và khả năng mở rộng (scalability).
- Ngôn ngữ chính: Tiếng Việt (vi-VN) - hỗ trợ song ngữ (vi / en) cho nội dung chính.
- Phong cách: hiện đại, tối giản, dễ đọc, trọng tâm nội dung (content-first).

7.2 Brand & Visual
- Logo/branding: sử dụng logo vector SVG, cung cấp biến thể màu sáng/tối.
- Bảng màu (Design tokens đề xuất):
  - Primary: #0066FF (button, links)
  - Accent: #00C2A8
  - Neutral 900 (text): #111827
  - Neutral 700: #374151
  - Neutral 300 (borders / muted): #D1D5DB
  - Background: #FFFFFF / dark: #0B1220
  - Success: #16A34A, Warning: #F59E0B, Error: #EF4444
- Phông chữ: `Inter` (Google Fonts) / fallback: system-ui, -apple-system, "Segoe UI"
- Iconography: Heroicons (outline + solid)

7.3 Layout & Grid
- Container max-width: 1200px (centered), horizontal padding 16px (mobile), 24-32px (desktop).
- Grid: 12 columns, responsive gutters (mobile 16px, desktop 24px).
- Breakpoints (Tailwind-like): `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.

7.4 Typography & Spacing
- Scale (example): H1 36px, H2 28px, H3 22px, Body 16px, Small 14px.
- Line-height: headings 1.1-1.25, body 1.5.
- Spacing scale (px): 4, 8, 12, 16, 24, 32, 40, 48.

7.5 Design System & Components (must live in `packages/ui`)
- Core tokens: colors, spacing, typography, radius, shadows.
- Atomic components to implement (priority order):
  1. `Button` (primary, secondary, ghost, icon, loading)
  2. `Link` (text, outlined)
  3. `Input` / `Textarea` / `Select` with validation states
  4. `Header` / `Topbar` (logo, global search, sign-in, nav)
  5. `Footer` (site links, legal, social)
  6. `Card` (content preview)
  7. `Article` layout (title, meta, content, toc, share)
  8. `ForumThread` components (post, reply, vote, pagination)
  9. `Profile` and `Settings` forms
 10. `Upload` component with drag/drop, progress bar, presign flow
 11. `Modal` / `Drawer`
 12. `Toast` / `Alert`
 13. `Skeleton` / loading placeholders
 14. `Table` / `List` components

7.6 Pages & Feature Map (site map)
- Root site (frontend-main):
  - Home / Landing (hero, highlights, recent posts, CTA)
  - About / Team / Contact
  - Blog / Articles index + article page
  - Docs / Guides index
  - Search (global search across posts/docs)
  - Upload page (authenticated)
  - Account / Profile / Settings
- Forum (frontend-forum):
  - Forum Index (categories)
  - Thread view (post + replies, commenting)
  - Create/Edit Thread
  - Moderation / Report flows
- SSO (sso-auth):
  - Sign In / Sign Up pages (redirect to/from apps)
  - Account linking and 2FA (optional)
- Admin (protected):
  - User management
  - Content moderation queue
  - Storage & upload logs

7.7 UX Patterns & Flows (critical)
- Auth flow: đăng nhập tại `/login` của chính site, phiên giữ trong cookie HttpOnly - không phơi token ra JS.
- Upload flow: client requests presigned URL from `storage-service`, uploads directly to S3/R2, then signals backend for post-processing and crawl/index.
- Content editing: Markdown editor with preview + image uploader + autosave draft.
- Empty/Loading/Error states: provide clear feedback (skeletons while loading, contextual empty-state illustration + action).

7.8 Accessibility (A11Y)
- WCAG AA baseline: color contrast, keyboard navigable, form labels, landmark roles.
- Provide `skip to content` link at top, meaningful alt text on images, aria-live for notifications, focus management for modals.

7.9 Internationalization (i18n)
- Support vi-VN and en-US via Next.js i18n routing or similar. All copy stored with translation keys.

7.10 Assets & Design deliverables
- Create a Figma file with:
  - Brand token page (colors, type, spacing)
  - Page templates: Home, Article, Forum Index, Thread, Upload, Profile, Admin
  - Component library page mirroring `packages/ui`.
- Provide exported SVG icons and optimized raster images (WebP) for hero/illustrations.

7.11 Implementation guidance (priority steps)
- Phase 1 (MVP UI - 1-2 sprints)
  1. Create `packages/ui` and implement tokens + Button/Input/Toast.
  2. Implement global layout: `Header`, `Footer`, `Container`.
  3. Implement `Home`, `Article`, `Forum Index`, `Thread` pages using content from `content-service`.
  4. Integrate SSO redirects and ensure sign-in state in header.
  5. Implement `Upload` page with presigned URL flow and progress bar.
- Phase 2 (Polish & QA)
  6. Accessibility fixes, cross-browser testing.
  7. Responsive refinements, skeletons, and performance optimization (image CDN, next/image).
  8. Design QA vs Figma and refine tokens.

7.12 Tech recommendations & libraries
- UI framework: Next.js (already present) + TailwindCSS for tokens + Radix UI / Headless UI for accessible primitives.
- Component testing: Storybook for UI development and visual review.
- Data fetching: `SWR` or `react-query` for caching / optimistic updates.
- Forms: `react-hook-form` + `yup` or Zod for validation.
- Icons: Heroicons, simple SVG sprite for brand icons.

7.13 Acceptance criteria (UI)
- The site must have consistent header/footer across pages and responsive behavior at defined breakpoints.
- Upload flow works end-to-end with visible progress and correct post-upload metadata.
- Forum thread view shows nested replies, author, timestamp, and allows posting when authenticated.
- No accessibility-critical violations (axe-core automated check pass).

7.14 Next steps (actionable)
- Design: Produce Figma file + export tokens (1 designer or dev-designer pair).
- Dev: Implement `packages/ui` tokens and basic components; wire layout into `apps/frontend-main`.
- QA: Run automated Lighthouse audits and accessibility tests.

---
