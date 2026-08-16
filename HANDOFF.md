# Phiếu bàn giao — sau đợt chuyển TypeScript/Rust và siết bảo mật (16/08/2026)

> **Trạng thái tạm.** Xong hết §1 thì **xoá file này** và xoá dòng trỏ tới nó ở
> đầu `CLAUDE.md`. Để lâu nó thành tầng tài liệu thứ hai nói khác `docs/`.
>
> Nguồn sự thật về vận hành là [`docs/deployment.md`](docs/deployment.md), về
> xác thực/phân quyền là [`docs/auth.md`](docs/auth.md). Phiếu này chỉ liệt kê
> **việc còn dở**, không lặp lại kiến thức đã nằm trong `docs/` hay `CLAUDE.md`.

## Đang chạy

`https://tsudev.com` đã lên sóng và nghiệm thu xong.

| Thành phần       | Ở đâu                   | Ghi chú                              |
| ---------------- | ----------------------- | ------------------------------------ |
| `frontend-main`  | Cloudflare Workers      | `tsudev.com` + `www.tsudev.com`      |
| `tsudev-backend` | Render **singapore**    | gộp content+storage+trust            |
| `tsudev-sso`     | Render **singapore**    | `auth.tsudev.com`                    |
| PostgreSQL       | Neon **ap-southeast-1** | DB `neondb` (app) + `keycloak` (SSO) |

Biến môi trường/secret production: **`backup/production-env-2026-08-16.txt`**
(đã gitignore VÀ dockerignore, không commit). Mất `TRUST_SIGNING_KEY` là chứng
chỉ đã cấp không xác minh nổi — thứ duy nhất trong phiếu đó không sinh lại được.

---

## 0. VIỆC ĐẦU TIÊN CỦA PHIÊN MỚI — 10 commit chưa đẩy

Nhánh **`feat/typescript-migration`** đứng trước `main` **10 commit** và **chưa
có trên remote**. Cây làm việc sạch, cả bốn cổng xanh, 78 test JS + 9 test Rust.

```
74c496a fix(security)!  vá chuỗi XSS → chiếm tài khoản, siết lớp phòng thủ
13e5cdf chore(gitignore) chặn mặc định, mở lại đúng ba tệp công khai
ddbc3b3 chore(config)    gỡ dấu vết bốn biến phân quyền không còn được đọc
11d29c1 feat(trust)!     ký Ed25519 bằng Rust → WebAssembly
a886f7b docs             cập nhật CLAUDE.md theo hiện trạng
5752345 feat(auth)!      một nguồn sự thật cho phân quyền, fail closed
1be1d75 refactor(app)    apps/frontend-main sang TypeScript
4c54680 refactor(services)! bốn service sang .ts, chạy từ dist/
432c7c4 refactor(packages)! packages/{types,ui,db} sang TypeScript
307e74d chore(ts)        nền tsconfig + cổng kiểm kiểu trong CI
```

**Năm commit mang dấu `!`.** Đọc kỹ phần BREAKING trong từng thông điệp trước
khi phát hành — đây không phải một đợt đổi tên tệp.

### Trước khi push

```bash
npm run typecheck && npm run format:check && npm run lint && npm run topology:check
for s in content-service storage-service trust-service backend-bundle; do
  npm --workspace services/$s test || break
done
npm --workspace apps/frontend-main test
(cd packages/trust-crypto && cargo test --release)
```

`.husky/pre-push` chạy `topology:check` **trước** cả cờ `ALLOW_MAIN_FORCE`, nên
không đẩy được gì lên remote cho tới khi nó xanh — kể cả commit tài liệu không
liên quan. Bài học giữ lại: **đổi tên tệp có literal cổng trong đó thì phải cập
nhật `config/topology.allow` theo.**

### Bốn thứ đổi ở đường phát hành

1. `render.yaml` → `dockerCommand: node services/backend-bundle/dist/index.js`.
   Blueprint được chọn lúc tạo service nên **sẽ tự áp dụng** — nhưng chỉ khi
   service còn nối với blueprint. Sau lần deploy đầu, **xem log khởi động**:
   thấy `src/` là service đã tách khỏi blueprint, phải sửa tay.
2. `docker/backend-service.Dockerfile` — thêm `COPY package-lock.json`, đổi sang
   `npm ci`, thêm `RUN npm run build:services`, và `USER node`.
3. `.dockerignore` phải cho `package-lock.json` gốc vào image, nếu không `npm ci`
   chết ngay bước đầu.
4. `packages/trust-crypto/pkg/trust_crypto.wasm` là **artifact được commit**.
   Image không có Rust để dựng lại.

### Nghiệm thu sau deploy

Chạy §3 bên dưới, **cộng thêm bốn dòng mới của đợt này**:

```bash
# Cookie phiên phải httpOnly. Trước đợt này nó KHÔNG có — đọc được bằng JS.
curl -si https://tsudev.com/api/auth/signin | grep -i 'set-cookie' | grep -qi httponly && echo OK

# Header bảo mật đã lên.
curl -sI https://tsudev.com/ | grep -iE 'x-content-type-options|x-frame-options|strict-transport'

# Đường ký WASM lên đúng: kid phải là khoá đang chạy.
curl -s https://tsudev.com/.well-known/tsudev-trust-jwks.json | grep -o '"kid":"[^"]*"'

# Lỗi 500 không còn kèm chi tiết nội bộ (chỉ kiểm khi có route lỗi thật).
```

---

## 1. Việc còn dở

### 1.1 ~~Xoá 3 service Render cũ~~ — ✅ XONG 16/08

Chủ dự án xác nhận đã xoá. Vòng khoá con dấu nay nhất quán; `tsu-2026-08-13e2a3`
không còn tiến trình nào dùng.

### 1.2 ~~Thu hồi Render API key~~ — ✅ XONG 16/08

### 1.3 Dựng bộ ping giữ ấm — 🟠 CHƯA LÀM

Free tier cấp 750 giờ instance/tháng cho **cả tài khoản**; một service chạy liên
tục tiêu 720 giờ. Nên chỉ giữ ấm **đúng một** service, và đó phải là
`tsudev-backend`. Ping `https://tsudev-backend.onrender.com/health` mỗi 5 phút.

**Đừng dùng GitHub Actions cron.** Repo private, mỗi lần chạy tính tối thiểu 1
phút ⇒ ~8.600 phút/tháng, vượt xa hạn mức 2.000. Dùng UptimeRobot free hoặc
Better Stack free.

`tsudev-sso` **phải được ngủ**. Giữ ấm cả hai là vỡ ngân sách.

### 1.4 Giới hạn tần suất — 🟠 nợ bảo mật lớn nhất còn lại

**Không có rate limit ở bất kỳ đâu trong repo.** Nặng nhất ở hai chỗ:

- `/api/trust/*` công khai (programs, verify, directory, seal SVG) — không cần
  token, và huy hiệu SVG được trình duyệt của khách trên site bên thứ ba gọi.
- Đường đăng nhập qua Keycloak.

Cần quyết định chính sách trước khi cài: giới hạn theo IP hay theo phiên, ngưỡng
bao nhiêu, và lưu bộ đếm ở đâu (tiến trình gộp chỉ có một bản nên bộ nhớ trong
là đủ — nhưng ghi rõ giả định đó, vì nó vỡ nếu sau này chạy nhiều bản).

### 1.5 `npm audit`: 7 lỗ, 4 mức cao — 🟠

`sharp` kế thừa CVE của libvips qua `next`; sửa cần nâng lên `next@16` —
breaking. Phải là **đợt riêng có test đầy đủ**, đừng nhét vào commit khác.
`qs` qua `express` thì `npm audit fix` xử lý được, không breaking.

### 1.6 Bật CSP thật — 🟡

CSP đang ở **`Content-Security-Policy-Report-Only`, CÓ CHỦ ĐÍCH**, không phải
quên. Trình duyệt PUT thẳng lên endpoint R2 bằng URL presign, mà host đó đến từ
biến môi trường chứ không biết được lúc build — bật chặn mù là upload chết **mà
không có lỗi nào phía máy chủ**.

Cách bật: mở site, thao tác thật vài phút (đăng nhập, xem blog, **upload một
tệp**), xem Console. Không có dòng "Report Only" nào thì đổi tên key trong
`apps/frontend-main/next.config.js` thành `Content-Security-Policy`.

### 1.7 SSRF: khe TOCTOU ở `domainVerify` — 🟡

`assertPublicHost()` phân giải DNS rồi kiểm IP nội bộ, nhưng giữa lúc kiểm và
lúc `fetch` vẫn còn khe (DNS rebinding). Chặn triệt để cần ghim IP đã kiểm vào
tầng socket. Chú thích trong mã đã ghi sẵn từ trước.

---

## 2. Có thể làm, không gấp

- **`toi-uu-seo-nextjs`** (bài blog) viết "App Router mang lại Server Components
  và metadata API", trong khi site chạy **Pages Router**. Không sai — đó là lời
  khuyên chung — nhưng viết lại thành bài mô tả đúng thứ đã dựng ở đây
  (sitemap/robots/canonical/OG/RSS trên Pages Router) thì vừa thật vừa có giá
  trị hơn. Nội dung bài nằm trong **DB**; `seed.js` dùng `upsert` với
  `update: {}` nên sửa seed **không** đổi bản ghi đang chạy. Phải sửa cả hai.
- **Địa chỉ pháp lý** trong `lib/legal.ts` chỉ tới cấp tỉnh (`An Giang, Việt
Nam`). Hợp lệ về hình thức, nhưng Nghị định 147/2024 hướng tới đầu mối xác
  định được. Thêm huyện/xã hay không là đánh đổi giữa tuân thủ và quyền riêng
  tư — **quyết định của chủ dự án**, đừng tự thêm.
- **Nợ có đăng ký, chưa trả:** root `package.json` còn ghim `react@18.3.1` cho
  Storybook, mà Storybook không nằm trong CI. Việc dọn: chuyển react/react-dom
  xuống devDependencies của `packages/ui` rồi kiểm `build-storybook`.
- **Tiêu chí cấp dấu "Có CSP…" trong `seed.js`** — tsudev nay đã đạt phần lớn
  (nosniff, Referrer-Policy, X-Frame-Options, HSTS), còn CSP thì đang Report-Only.
  Khi bật CSP thật thì site mới thực sự đạt tiêu chí nó đang đi cấp cho người khác.

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

---

## 4. Ba cái bẫy của đợt vừa rồi — đọc trước khi sửa vùng liên quan

Phần bền vững đã vào `CLAUDE.md`. Ba cái dưới đây đặc thù cho đợt này:

1. **Sửa `packages/trust-crypto/src/lib.rs` ⇒ phải chạy
   `npm --workspace packages/trust-crypto run build:wasm` rồi commit lại
   `pkg/trust_crypto.wasm`.** Quên là job "WASM con dấu" của CI đỏ vì artifact
   không khớp nguồn. Cần `rustup` + target `wasm32-unknown-unknown` ở máy dev —
   chỉ để sửa mảnh đó, mọi thứ còn lại không cần Rust.

2. **Đụng khối `cookies` trong `[...nextauth].ts` thì giữ `httpOnly: true`.**
   next-auth gộp cấu hình cookie NÔNG ở cấp tên cookie, nên khai `sessionToken`
   là thay thế TRỌN GÓI mặc định — kể cả `httpOnly`. Bỏ nó ra là cookie phiên
   đọc được bằng JavaScript, và mọi lỗ XSS thành chiếm tài khoản. Đây chính là
   lỗi vừa được vá, và nó tái phát rất dễ.

3. **`renderMarkdown` trong `apps/frontend-main/lib/md.ts` là RANH GIỚI BẢO
   MẬT** — đầu ra đi thẳng vào `dangerouslySetInnerHTML` ở ba trang. Sửa nó thì
   `apps/frontend-main/test/md.test.ts` phải xanh. Đừng nới danh sách trắng giao
   thức của `safeHref` mà không hiểu vì sao nó là danh sách trắng.
