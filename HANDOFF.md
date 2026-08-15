# Phiếu bàn giao — sau đợt đưa `tsudev.com` lên sóng (16/08/2026)

> **Trạng thái tạm.** Xong hết §1 thì **xoá file này** và xoá dòng trỏ tới nó ở
> đầu `CLAUDE.md`. Để lâu nó thành tầng tài liệu thứ hai nói khác `docs/`.
>
> Nguồn sự thật về vận hành là [`docs/deployment.md`](docs/deployment.md). Phiếu
> này chỉ liệt kê **việc còn dở**, không lặp lại kiến thức đã nằm trong `docs/`.

## Đang chạy

`https://tsudev.com` **đã lên sóng và nghiệm thu xong**: nội dung, SEO, con dấu,
đăng nhập Keycloak đều chạy. `main` sạch, CI xanh.

| Thành phần       | Ở đâu                   | Ghi chú                              |
| ---------------- | ----------------------- | ------------------------------------ |
| `frontend-main`  | Cloudflare Workers      | `tsudev.com` + `www.tsudev.com`      |
| `tsudev-backend` | Render **singapore**    | gộp content+storage+trust            |
| `tsudev-sso`     | Render **singapore**    | `auth.tsudev.com`                    |
| PostgreSQL       | Neon **ap-southeast-1** | DB `neondb` (app) + `keycloak` (SSO) |

Biến môi trường/secret production: **`backup/production-env-2026-08-16.txt`**
(đã gitignore, không commit). Mất `TRUST_SIGNING_KEY` là chứng chỉ đã cấp không
xác minh nổi — thứ duy nhất trong phiếu đó không sinh lại được.

---

## 0. ĐANG CÓ AGENT KHÁC LÀM SONG SONG — đọc trước khi gõ phím

Một agent khác đang **tái cấu trúc JavaScript sang TypeScript và Rust**. Việc đó
**chưa commit**, nằm trong cây làm việc, trên nhánh `feat/typescript-migration`.

**Không chạm vào các file sau** — chúng thuộc đợt đó:

```
tsconfig.json  tsconfig.base.json  packages/utils/tsconfig.json
package.json (script "typecheck")  .gitignore (*.tsbuildinfo)
.github/workflows/ci.yml (bước "Kiểm kiểu (TypeScript)")
```

Tình trạng lúc bàn giao: `npm run typecheck` chạy sạch, nhưng solution file mới
nối đúng `packages/utils`. Cái bẫy của kiểu cấu hình này: thêm workspace mà quên
thêm một dòng vào `references` thì workspace ấy **không được kiểm kiểu và không
có gì báo lỗi**.

⚠️ **Chỉ có MỘT cây làm việc.** Quyền sở hữu đường dẫn trong `AGENTS.md` tránh
được việc hai agent sửa cùng một file, **không** tránh được xung đột git khi
dùng chung cây. Trước khi commit: xem `git status` và `git branch` — đầu phiên
16/08 đã có một commit tài liệu rơi nhầm sang `feat/typescript-migration` vì
không kiểm nhánh trước. Đừng dùng `git add -A`; stage đúng file của mình.

## 1. Việc còn dở — tất cả nằm NGOÀI repo

### 1.1 Xoá 3 service ở tài khoản Render **CŨ** — 🔴 làm trước

`tsudev-content`, `tsudev-storage`, `tsudev-trust` (Oregon) **vẫn đang chạy**.
Chúng **không nằm trong tài khoản Render hiện tại** — API key của tài khoản mới
không thấy chúng, phải đăng nhập tài khoản cũ.

Vì sao gấp, dù không tiêu giờ chạy của tài khoản mới:

- Chúng nối vào **đúng DB Neon đang chạy production**.
- `tsudev-trust` cũ dùng **khoá ký khác** (`tsu-2026-08-13e2a3`; bản đang chạy là
  `tsu-2026-08-efdb94`). Chứng chỉ cấp qua nó ký bằng khoá không có trong vòng
  khoá của bản mới ⇒ `tsudev.com/trust` **không xác minh nổi**, không báo lỗi.
- Chúng chạy **mã cũ** trên dữ liệu production.

Tính tới 16/08/2026 **chưa có thiệt hại**: 0 chứng chỉ, 0 đơn, 0 tổ chức. Kiểm
lại trước khi làm gì:

```bash
DATABASE_URL='<Neon>' node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();Promise.all([p.trustCertificate.count(),p.sealApplication.count()]).then(r=>{console.log('cert/app =',r);process.exit()})"
```

Nếu mất quyền vào tài khoản cũ: đường thay thế là **xoay mật khẩu Neon**, mô tả
ở `docs/deployment.md`.

### 1.2 Thu hồi Render API key — 🔴

Key `rnd_DdZ4…` đã được dùng trong phiên 16/08 và **nằm trong lịch sử hội thoại
đó**. Nó có quyền xoá mọi service trong workspace.
Render → Account Settings → API Keys → xoá.

### 1.3 Dựng bộ ping giữ ấm — 🟠

Thiết kế dựa trên "giữ ấm **đúng một** service" (free tier: 750 giờ
instance/tháng cho **cả tài khoản**; một service chạy liên tục tiêu 720 giờ).
Cần ping `https://tsudev-backend.onrender.com/health` mỗi **5 phút**.

**Đừng dùng GitHub Actions cron.** Repo private, mỗi lần chạy tính tối thiểu 1
phút ⇒ 5 phút/lần là ~8.600 phút/tháng, vượt xa hạn mức 2.000. Dùng UptimeRobot
free hoặc Better Stack free — nằm ngoài, không tốn gì.

`tsudev-sso` **phải được ngủ**. Giữ ấm cả hai là vỡ ngân sách và Render dừng hết.

---

## 2. Có thể làm, không gấp

- **`toi-uu-seo-nextjs`** (bài blog) viết "App Router mang lại Server Components
  và metadata API", trong khi site chạy **Pages Router**. Không sai — đó là lời
  khuyên chung, không khẳng định gì về tsudev — nhưng viết lại thành bài mô tả
  đúng thứ đã dựng ở đây (sitemap/robots/canonical/OG/RSS trên Pages Router) thì
  vừa thật vừa có giá trị hơn cho một trang portfolio.
  Nội dung bài nằm trong **DB**; `seed.js` dùng `upsert` với `update: {}` nên sửa
  seed **không** đổi bản ghi đang chạy. Phải sửa cả hai, và giữ cho khớp nhau.
- **Địa chỉ pháp lý** trong `lib/legal.js` chỉ tới cấp tỉnh (`An Giang, Việt
Nam`). Hợp lệ về hình thức, nhưng Nghị định 147/2024 hướng tới đầu mối xác
  định được. Thêm huyện/xã hay không là đánh đổi giữa tuân thủ và quyền riêng
  tư — **quyết định của chủ dự án**, đừng tự thêm.
- **Nợ có đăng ký, chưa trả** (đã ghi trong `CLAUDE.md`, nhắc để không quên):
  `REQUIRE_ROLE_ENFORCEMENT` vẫn không bật được (realm khai `roles: {}`);
  root `package.json` còn ghim `react@18.3.1` cho Storybook, mà Storybook không
  nằm trong CI.

---

## 3. Nghiệm thu nhanh — chạy sau mọi thay đổi production

```bash
# 1. Bản dựng KHÔNG nhiễm giá trị dev. Thấy "e2e-dev" là ai cũng đăng nhập
#    được vào tài khoản ADMIN bằng mật khẩu devpass. Đã từng xảy ra thật.
curl -s https://tsudev.com/api/auth/providers      # phải CHỈ có "keycloak"

# 2. Nội dung thật sự tới được trình duyệt (không phải trang trống).
curl -s https://tsudev.com/projects | grep -c "tsudev Platform"   # 1
curl -s https://tsudev.com/sitemap.xml | grep -c "<loc>"          # 23

# 3. Endpoint công khai của con dấu không bị cổng chặn nuốt.
curl -s -o /dev/null -w "%{http_code}\n" https://tsudev.com/api/trust/programs   # 200

# 4. Không còn di sản diễn đàn/chợ/tin nhắn lọt ra trang công khai.
for p in / /blog /docs /projects /trust /terms /privacy /rules; do
  curl -s "https://tsudev.com$p" | sed 's/<[^>]*>//g' \
   | grep -oE "diễn đàn|hệ sinh thái|/api/users|tin nhắn" | sort -u
done   # không ra gì là đúng
```

**Deploy frontend luôn qua `npm --workspace apps/frontend-main run deploy`**,
đừng gọi thẳng `opennextjs-cloudflare` — lý do ở `docs/deployment.md`.
