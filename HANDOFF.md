# Phiếu bàn giao - tsudev

> **Trạng thái tạm.** Xong hết §1 thì **xoá file này** và xoá dòng trỏ tới nó ở
> đầu `CLAUDE.md`. Để lâu nó thành tầng tài liệu thứ hai nói khác `docs/`.
>
> Nguồn sự thật về vận hành là [`docs/deployment.md`](docs/deployment.md), về
> hạn mức miễn phí là [`docs/free-tier.md`](docs/free-tier.md), về xác thực là
> [`docs/auth.md`](docs/auth.md), về giao diện là
> [`docs/design-system.md`](docs/design-system.md). Phiếu này chỉ liệt kê **việc
> còn dở** và **những gì đã trả giá để học**, không lặp lại `docs/`.
>
> Phiên 6 (19/08/2026) đã gộp bốn lớp bàn giao cũ (phiên 3, 4, 5 và mục "phát
> hành 16/08") thành §0. Chúng mô tả công việc nay đã phát hành xong; giữ nguyên
> chỉ tạo mâu thuẫn với hiện trạng.

## ✅ Bắt đầu từ đâu

> **Phiên 9 (20/08/2026) đã PHÁT HÀNH.** Nhánh `refactor/giao-dien-quy-uoc-v1`
> đã gộp vào `main` qua PR #36 (`12987d0`), backend Render dựng lại từ `main`,
> frontend đã lên Cloudflare Workers (version `d59853a7`). Chi tiết và những gì
> còn lại: [`logs/handover/20260820-05`](logs/handover/20260820-05_phat-hanh-phien-9.md).
> Hàng đợi việc ở [`logs/STATE.md`](logs/STATE.md), không còn ở §1 phiếu này.

**Không còn việc chặn nào. Production chạy đủ và chi phí bằng 0.** Đo cuối phiên 6
(19/08/2026); phiên 7 không phát hành nên các con số dưới đây vẫn đúng:

| Vùng     | Trạng thái                                                     |
| -------- | -------------------------------------------------------------- |
| Nội dung | `/blog` 3 bài · `/docs` 2 mục · `/projects` 4 dự án            |
| Xác thực | mọi đường ghi chạy: sửa hồ sơ, đổi mật khẩu, upload, ghi admin |
| Con dấu  | chế độ mời: khách → `/login`, đã đăng nhập chưa VIP → `/trust` |
| Toà soạn | đang sản xuất - 11 bản sửa, hàng đợi ổn định ở trần 12         |
| Chi phí  | 2.041 Neuron/ngày trên trần 8.000 · Render ~589/750 giờ        |
| Keycloak | sạch hoàn toàn - mã, tài liệu, schema, cột DB, secret hạ tầng  |

Nghiệm thu **đếm nội dung, không đếm mã 200** - lý do ở §0.7.

### Việc còn lại, theo thứ tự đề nghị

Không việc nào chặn việc nào. Ba việc đầu cần MẮT NGƯỜI hoặc QUYẾT ĐỊNH của chủ
dự án, nên phiên mới đọc xong nên hỏi trước khi tự chọn.

1. **§1.5 - rà giao diện bằng MẮT.** Việc lớn nhất còn lại và chưa ai làm. Nay có
   thêm ba thứ mới chưa từng được nhìn: trang mời `/trust`, `/settings/profile`,
   và điều hướng đã đổi (tên người dùng thành liên kết, menu di động thêm 2 mục).
2. **§1.7 ảnh đại diện** - chủ dự án chốt một trong ba đường. Bảng đánh đổi đã
   ghi sẵn; đề nghị là dùng chữ cái đầu (component `Avatar` đã có), 0 hạ tầng.
3. **§1.10 dọn service Render trùng** - 10 phút ở dashboard, cần tay chủ dự án.
4. **§1.4 CSP** - cần mở site thao tác thật vài phút rồi đọc Console. Đọc kỹ ghi
   chú về script nội tuyến chống nháy màu trước khi bật.
5. **§1.3 npm audit** - phải là đợt `next@16` riêng có test đầy đủ. `npm audit fix`
   KHÔNG chạy được (vướng nợ react đã đăng ký ở §2).
6. **§1.7 đợt B** (đổi email, xem/thu hồi phiên, xoá tài khoản) · **§1.8**.

### Hai việc nhỏ nên làm khi tiện

- **Xoay `CF_AI_TOKEN`** - token hiện tại đã đi qua một kênh chat. Quy trình
  ở [`docs/deployment.md`](docs/deployment.md) §Biến môi trường; chỉ nằm ở Render
  nên không có cửa sổ hỏng.
- **Xoá `backup/production-env-2026-08-16.txt`** nếu còn. Bản 19/08 đã đủ 21 biến
  và tự nhất quán; giữ bản cũ chỉ tạo lại đúng sự nhầm lẫn đã gây sự cố.

⚠️ **Ba thứ mất là không sinh lại được**: `TRUST_SIGNING_KEY` ·
`TOTP_ENCRYPTION_KEY` · (`INTERNAL_IDENTITY_SECRET` sinh lại được nhưng phải đổi
ĐỒNG THỜI ở Render và Cloudflare). Sao lưu ra một chỗ thứ hai ngoài máy này.

---

## Đang chạy

`https://tsudev.com` đã lên sóng.

| Thành phần       | Ở đâu                   | Ghi chú                                                 |
| ---------------- | ----------------------- | ------------------------------------------------------- |
| `frontend-main`  | Cloudflare Workers      | `tsudev.com` + `www.tsudev.com`                         |
| `tsudev-backend` | Render **singapore**    | gộp content + storage + trust + identity + **newsroom** |
| PostgreSQL       | Neon **ap-southeast-1** | DB `neondb`                                             |

Biến môi trường/secret production: **`backup/production-env-2026-08-16.txt`**
(đã gitignore VÀ dockerignore, không commit).

Ba thứ mất là không sinh lại được:

- `TRUST_SIGNING_KEY` - mất là chứng chỉ đã cấp không xác minh nổi.
- `TOTP_ENCRYPTION_KEY` - mất là mọi thiết bị 2FA đang dùng hỏng.
- `INTERNAL_IDENTITY_SECRET` - sinh lại được, nhưng phải đổi ĐỒNG THỜI ở
  Cloudflare Workers và Render; lệch nhau là mọi đường ghi trả 401.

---

---

## 0. Nhật ký phiên 11 (21/08/2026) - gộp #37, mở PR #38

Phiên **rất ngắn, một luồng**: nhận việc kế trong hàng đợi STATE.md và phát hiện
đầu vào đã đổi.

- **PR #37 đã được chủ dự án MERGED** vào `main` (`a8cfde9`) từ phiên trước - task
  🔴 "gộp #37" xong sẵn, Render tự dựng lại backend.
- **Mở PR #38** cho `chore/storybook-chay-duoc` (Storybook chạy được · gỡ
  `@tsudev/utils` · hai gói đẩy ngược · docs). Vì #37 đã ở `main`, diff so với
  `origin/main` **đã sạch sẵn** - chỉ 5 commit riêng, không lẫn file newsroom của
  #37 - nên **không rebase**, tránh rủi ro đụng `HANDOFF.md` mà #37 cũng sửa.
  Cổng chung xanh (lint · typecheck · topology · tokens); `format:check` chỉ kêu
  `.claude/settings.local.json` (local, không được git theo dõi). MERGEABLE;
  `UNSTABLE` do GitHub Actions đỏ vì tài khoản, không chặn. **Chưa gộp được** -
  `gh pr merge` bị chính sách phân quyền phiên chặn, y như #37.

Sau khi mở #38, **hàng đợi việc agent làm được đã cạn**: mọi mục còn lại cần MẮT
NGƯỜI hoặc thao tác/QUYẾT ĐỊNH của chủ dự án (bấm Merge #38, bấm nút hồi sinh,
sửa billing GitHub, gửi hai gói đẩy ngược, xoay `NEWSROOM_TICK_TOKEN`, rà giao
diện). Chi tiết: phiếu [`20260820-06`](logs/handover/20260820-06_ket-phien-10.md)
§6.

Một bẫy đo lường lặp lại họ §0.7: **"việc kế trong hàng đợi" có thể đã đổi trạng
thái từ ngoài phiên.** Hàng đợi ghi "#37 chưa gộp", nhưng `gh pr view 37` cho
MERGED - kiểm hiện trạng git/PR TRƯỚC khi bắt tay rẻ hơn nhiều so với rebase nhầm
lên một base đã lỗi thời.

---

## 0.05 Nhật ký phiên 10 (20/08/2026) - sổ Neuron, Storybook, dọn hai món nợ

Phiên **nhiều luồng nhỏ**, đi hết phần hàng đợi mà agent làm được; chi tiết đầy
đủ ở phiếu [`20260820-06`](logs/handover/20260820-06_ket-phien-10.md). Bốn cụm:

- **Sổ Neuron đếm đủ cả khi lượt chạy hỏng** - chi phí nay ghi tại ranh giới nhà
  cung cấp vào sổ theo ngữ cảnh (`AsyncLocalStorage`), `withRun()` đọc ở cả hai
  nhánh try/catch. Đường trả chi phí cũ qua `return` bị bỏ hẳn. Bài học thành
  mục thứ 16 của §0.7. PR #37 đã mở, **chưa gộp được** - chính sách phân quyền
  của phiên chặn lệnh gộp, y như phiên 8.
- **Storybook chạy được lần đầu** - hàng đợi ghi "npm i là xong", thực tế là
  BỐN tầng hỏng im lặng chồng nhau (gói CLI thiếu · glob extglob dùng dấu phẩy
  khớp 0/9 file · `@tsudev/types` CJS qua `/@fs` làm mọi khung story rỗng ·
  `next-auth` đòi `process` + `SessionProvider`). Nghiệm thu đếm hành vi:
  36/36 lượt (12 story × 3 chế độ) vẽ ra nội dung, 0 lỗi console. Đóng luôn món
  nợ ghim `react@18` ở root - nay nằm ở devDependencies của `packages/ui`.
- **Gỡ `@tsudev/utils`** (một hàm, không ai dùng) theo quyết định chủ dự án.
- **Hai gói đẩy ngược lên repo quy ước trung tâm** đã soạn xong, chờ gửi:
  `docs/token-upstream-proposal.md` · `docs/structure-upstream-proposal.md`.
  Điểm lệch cấu trúc monorepo ghi vào `docs/architecture.md`.

Ba bẫy đo lường của phiên (chi tiết phiếu 20260820-06 §5): "lệnh chạy xong" ≠
"công cụ chạy được" · hai server cùng cổng thì phép đo bắn vào cái cũ · tự viết
lại công thức tương phản mà quên `srgbToLinear` một kênh vẫn ra bảng số trông
hợp lý. Và `pkill -f` với mẫu khớp chính dòng lệnh đang chạy sẽ tự giết nó.

---

## 0.1 Nhật ký phiên 9 (20/08/2026) - phát hành, và một phép đo suýt nói dối

Phiên **ngắn, một luồng**: chạy cổng kiểm tay rồi đi hết chuỗi phát hành ba bước
mà phiên 8 bị chặn.

### Cổng kiểm tay - vì GitHub Actions vẫn chết

Cả 5 job của PR #36 vẫn đỏ trong 2 giây vì tài khoản (`recent account payments
have failed`), chưa ai sửa billing. Nên cổng kiểm duy nhất là local, và lần này
chạy **đủ cả năm hạng mục CI**, gồm cả cổng WASM mà phiên 8 chưa đo:

| Hạng mục CI             | Đo ở local                                                |
| ----------------------- | --------------------------------------------------------- |
| Lint & format           | `format:check` + `lint` xanh                              |
| Build frontends         | `typecheck` + `next build` sạch                           |
| Migrate & test services | 26 · 13 · 57 · 61 · 42 · bundle 14 · ui 199 · frontend 29 |
| WASM con dấu            | `cargo test --release` 9 test · `.wasm` **khớp** mã nguồn |
| E2E                     | **20/20** (`--workers=1`)                                 |

Cộng `topology:check` (52 literal cổng) và `tokens:check` (3 chế độ).

Hai bẫy vận hành của phiếu 20260820-04 đều được kiểm chứ không bỏ qua: cổng
4001-4005/3000/8080 trống trước khi dựng stack (không có tiến trình mồ côi), và
e2e chạy tuần tự chứ không song song.

### Chuỗi phát hành

1. `gh pr merge 36 --merge` → `12987d0` trên `main`.
2. Render dựng lại backend. **Xác nhận Live phải hỏi dashboard** - lý do ở mục
   mới trong §0.7.
3. `npm --workspace apps/frontend-main run deploy` (qua `scripts/deploy-frontend.js`).

Nghiệm thu sau deploy, **đếm hành vi chứ không đếm mã 200**:

- `curl https://tsudev.com/api/auth/providers` → **chỉ** `credentials` và
  `passkey`. Không có provider dev nào lọt vào bản dựng.
- `https://www.tsudev.com/` → **308** về apex. Bản vá chuẩn hoá URL đã sống trên
  production, không chỉ trong test.
- `npm run newsroom:check` → tick **202**, `AgentRun` 160 → **165**. Toà soạn
  chạy thật trên mã mới.

### `NEWSROOM_TICK_TOKEN` nằm trong `vars` của frontend Worker - và đã được gỡ

`wrangler deploy` cảnh báo config remote khác local, trong đó có
`NEWSROOM_TICK_TOKEN` chỉ tồn tại ở **remote**. Deploy ghi đè remote bằng local,
nên biến đó đã bị gỡ khỏi frontend Worker.

Đó là **đúng**, không phải hỏng. Token ấy thuộc về hai nơi: Render (service kiểm
nó) và Worker cron `tsudev-newsroom-cron` (dạng `secret_text` - đã kiểm chứng
còn nguyên bằng `wrangler secret list`). Frontend Worker không dùng tới nó: proxy
`pages/api/newsroom/[...path].ts` cố ý **không** mở đường `tick` ra trình duyệt.
Một secret đặt ở nơi không dùng tới chỉ mở rộng vùng thiệt hại - cùng lý do phiên
8 không đặt `GEMINI_API_KEY` lên Cloudflare.

⚠️ Nhưng cảnh báo đó **in nguyên giá trị token ra terminal**. Nó không vào git
(`backup/` đã trong `.gitignore`), song đã nằm trong scrollback. Xoay token thì
phải đổi **đồng thời** ở Render và `npm run cron:secret` - lệch nhau là mỗi nhịp
giờ trả 401 và toà soạn đứng yên mà không có gì đỏ lên.

## 0.2 Nhật ký phiên 7 (20/08/2026) - tái cấu trúc giao diện theo bộ quy ước v1.0.0

Phiên **một luồng việc duy nhất**, không phát hành: đưa toàn bộ giao diện về bộ
quy ước dùng chung `tsudev-conventions v1.0.0`. **82 file, 3 cụm commit trên
nhánh `refactor/giao-dien-quy-uoc-v1`, chưa push.** Chi tiết đầy đủ ở phiếu
[`logs/handover/20260820-01`](logs/handover/20260820-01_tai-cau-truc-giao-dien.md);
việc còn lại ở phiếu
[`logs/handover/20260820-02`](logs/handover/20260820-02_viec-con-lai-sau-giao-dien.md).

### Bộ quy ước đã vào repo

`AGENTS.md` (gộp hai nguồn thành phần A/B), `docs/DESIGN_SYSTEM.md`,
`docs/PROJECT_STRUCTURE.md`, `docs/templates/HANDOVER.md`, `tokens/`, `logs/`,
`CHANGELOG.md`. **Kể từ nay `logs/STATE.md` là hàng đợi việc và `logs/LOCKS.md`
là khoá file** - phiếu này không còn là nơi duy nhất để tra việc còn dở.

### Ba thay đổi lớn

1. **Chuỗi token có một nguồn duy nhất.** `tokens/design-tokens.json` →
   `scripts/sync-tokens.js` → `packages/ui/src/tokens.css` (ARTIFACT, đừng sửa
   tay). `npm run tokens:check` đã vào CI.
2. **Ba chế độ Sáng / Ấm / Tối**, chọn bằng `data-theme`. `ThemeToggle` thành menu
   bốn lựa chọn - thêm "Theo hệ thống".
3. **Đổi tên toàn bộ token** (~615 chỗ, 48 file): `--surface`→`--bg-base`,
   `--ink`→`--text-primary`, `--error`→`--danger`… Bản đồ đầy đủ ở
   [`docs/design-system.md`](docs/design-system.md).

### Sáu lỗi thật, xếp theo mức im lặng

| #   | Lỗi                                                            | Vì sao không ai thấy                                                        |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `.gitignore` nuốt trọn `logs/` bằng mẫu `logs`                 | Phiếu bàn giao viết xong **không bao giờ commit được**, không có gì báo lỗi |
| 2   | Bảng màu **của chính bộ quy ước** không đạt WCAG ở 2 token     | `text-muted` 3.69-4.58:1, `border-strong` 1.65-2.49:1 - phải đo mới biết    |
| 3   | Thang chữ mặc định Tailwind lọt qua **41 chỗ**                 | `fontSize` khai trong `extend` nên hai thang sống song song                 |
| 4   | `site.webmanifest` trôi lệch màu nền (`#eef3fa` vs `#eef4fb`)  | Bản sao **thứ tư**, chỉ hiện ở màn hình chờ PWA                             |
| 5   | `::placeholder` mang `#9ca3af` cắm cứng của preflight Tailwind | Giống nhau ở cả ba chế độ, không đi qua token                               |
| 6   | `toLocaleDateString('vi-VN')` bỏ số 0 đầu → `5/8/2026`         | Sai §4, và chỉ lộ ra khi ngày rơi vào mùng 1-9                              |

Cả sáu đã sửa. Lỗi #2 không sửa được tại chỗ (khối `color` bất khả xâm phạm) nên
tsudev-web ghi đè trong `extensions.tsudev-web` - **cần đẩy ngược lên repo token
trung tâm**, vì mọi repo khác trong hệ sinh thái đang mang cùng khiếm khuyết.

### Ba bẫy đã trả giá để học - xem §0.7 để dùng lại

- **Tailwind quét NGUYÊN VĂN file, kể cả chú thích.** Comment viết "đừng dùng
  `text-[1.05rem]`" làm chính class đó được sinh ra CSS thật.
- **`color(srgb 1 1 1 / 0.88)` không cùng thang với `rgb()`** - kênh màu 0..1 chứ
  không phải 0..255. Bộ đo tương phản tự viết đọc sai đã cho ra 18 "lỗi" ở header
  qua **ba lần chạy liên tiếp**, toàn bộ là ảo. Nền TRONG SUỐT phải được trộn lên
  thứ nằm sau nó trước khi đo.
- **Hai cổng kiểm có thể đá nhau vĩnh viễn.** `format:check` đòi sửa `tokens.css`
  theo kiểu prettier, `tokens:check` thấy khác bản sinh ra nên đòi chạy lại
  `tokens:sync`; chạy cái này thì cái kia đỏ. Lời giải: cho **bộ sinh** chạy đầu
  ra qua chính prettier của repo.

### Nghiệm thu

12 trang × 3 chế độ (36 ảnh, đã đăng nhập ADMIN) → **0 vấn đề tương phản**.
E2E **20/20**. `tokens:check` · `format:check` · `lint` · `typecheck` ·
`topology:check` · ui 199 · frontend-main 29 - xanh hết. Bản dựng production
không còn cỡ chữ hay mã màu nào ngoài token.

⚠️ E2E lần đầu 6 đỏ, **không cái nào là hồi quy giao diện**: 5 cái là timeout biên
dịch nguội (load average ~6.4 trên máy 4 nhân), 1 cái là `invite.spec.js` **không
lặp lại được** - khiếm khuyết sẵn có, xem hàng đợi `logs/STATE.md`. Chạy e2e ở đây
thì đừng chạy song song thứ gì khác.

---

## 0.5 Nhật ký phiên 6 (19/08/2026)

Phiên dài nhất tới nay: **20 PR (#15-#34)**, năm lần phát hành thật, và **sáu lỗi
production** - trong đó **năm cái đã chạy im lặng từ trước khi phiên bắt đầu**.
Công việc của phiên không gây ra chúng; nó chỉ làm chúng lộ ra.

### Sáu lỗi, xếp theo mức độ

| #   | Lỗi                                                  | Triệu chứng nó tạo ra                                               |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | `getToken()` tìm sai tên cookie **trên HTTPS**       | MỌI đường ghi đã xác thực trả 401; `/trust/*` đá cả VIP về `/login` |
| 2   | Neon thiếu 6 migration                               | toàn bộ nội dung site trống, **mà mọi trang vẫn trả 200**           |
| 3   | `INTERNAL_IDENTITY_SECRET` chưa bao giờ đặt ở Render | mọi đường ghi đã xác thực trả 503                                   |
| 4   | Writer nhận JSON có xuống dòng thô                   | toà soạn chạy, tiêu Neuron, **không bài nào ra đời**                |
| 5   | `/settings/security` không có liên kết nào           | trang dựng để 2FA khỏi thành mã chết thì chính nó là mã chết        |
| 6   | `--with-deps` của Playwright kéo 21 MB phông qua apt | CI treo **bốn lần**, mỗi lần có thể đốt 18% hạn mức tháng           |

Điểm chung, và là thứ đáng mang sang phiên sau: **cả sáu đều im lặng**, mỗi cái
theo một kiểu khác nhau. Không cái nào làm gì đỏ lên. Đó là lý do §0.7 dài thêm
bốn mục trong phiên này.

### Đã phát hành

| Việc                                  | Ghi chú                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| Con dấu về chế độ mời (§1.9, 3/3 đợt) | gộp + phát hành                                             |
| Gỡ Keycloak                           | **hoàn toàn** - mã, tài liệu, schema, cột DB, secret sống   |
| Xoá cột `User.keycloakId` (§1.6)      | trọn ba bước, kể cả migration lên Neon                      |
| Worker frontend                       | hai lần: đợt 2+3, rồi bản vá cookie                         |
| Worker cron giữ ấm (§1.1)             | deploy, kèm khung nghỉ đêm 01:00-06:00 giờ VN               |
| Trang tài khoản (§1.7 đợt A)          | trừ ảnh đại diện                                            |
| Toà soạn Agent AI                     | seed + bật + vá Writer + áp lực ngược hàng đợi              |
| CI                                    | thôi chạy trùng · trần thời gian · cache · bỏ `--with-deps` |
| Dọn dẹp                               | Redis chết · 5 phụ thuộc thừa · 2 thư mục rác               |

### Nghiệm thu trên production

Xác thực và gác, đo bằng **tài khoản dùng-một-lần** đi đúng luồng người dùng
thật (đã xoá sau khi xong; bảng `User` còn đúng 1 dòng thật):

| Thao tác                     | Trước     | Sau                           |
| ---------------------------- | --------- | ----------------------------- |
| đọc hồ sơ                    | 401       | **200** kèm dữ liệu thật      |
| đổi tên hiển thị             | 401       | **200**, tên đã đổi           |
| đổi mật khẩu SAI             | 401 mơ hồ | **401 `invalid_credentials`** |
| đổi mật khẩu ĐÚNG            | 401       | **200**, `sessionVersion` 0→1 |
| MEMBER mở `/trust/directory` | → /login  | **→ /trust**                  |
| khách mở `/trust/directory`  | → /login  | → /login (đúng)               |

Toà soạn, sáu nhịp liên tiếp sau khi lắp áp lực ngược:

```
ý tưởng chờ: 23 → 21 → 17 → 13 → 8 → 11 → 12     scan.skipped: 0 1 2 3 4 4 4
```

Xuống dưới trần thì quét TỰ BẬT LẠI. Hàng đợi dao động quanh trần thay vì lớn
một chiều, và bản sửa vẫn tăng đều - van chặn đúng chỗ mà không chặn nhầm Writer.

Còn lại: `/trust/redeem` **200** (trước 404) · `sitemap.xml` **0 dòng** `/trust/`
· `/api/auth/providers` chỉ `credentials, passkey` · `noindex` có ở nhánh **khách
vãng lai** của cả bốn trang riêng tư.

### Hai lỗi thao tác của tôi, ghi để phiên sau khỏi lặp

- **Chồng nhánh nhầm hai lần**: tạo nhánh mới khi đang đứng trên một nhánh chưa
  gộp, nên bản squash sau nuốt luôn công việc của PR trước (#31 và #33 phải đóng
  vì nội dung đã vào `main` qua PR khác). Không mất gì, nhưng để lại hai PR thừa.
  **Cách tránh: luôn `git checkout main` trước khi `git checkout -b`.**
- **Suýt giao một script nghiệm thu nói dối**: bản đầu của `newsroom:check` ghi
  "202 = toà soạn đã bật", trong khi `tick` trả 202 NGAY rồi mới chạy nền - 202
  chỉ chứng minh token khớp. Đã sửa thành đếm `AgentRun` trước/sau.

### Số đo cuối phiên

- **296 test** trên **tám** workspace (auth 61 · bundle 14 · content 26 ·
  newsroom 34 · storage 13 · trust 57 · ui 68 · frontend-main 23).
- Bốn cổng gốc xanh · `main` = `81a174c` · một nhánh cục bộ duy nhất.
- E2E trên CI nay **4 phút 43 giây**, nhanh hơn cả trước khi có sự cố treo.

---

## 0.7 Kỹ thuật đã trả giá để học - dùng lại được

Mười lăm thứ, ghi lại để khỏi học lần nữa. Mỗi mục là một lỗi đã thật sự xảy ra.

### Van chi phí đọc SỔ CỦA TA, còn hạn mức thì nhà cung cấp đếm bằng sổ CỦA HỌ

Toà soạn có `NEWSROOM_DAILY_NEURON_BUDGET=8000` để chặn trước hạn mức 10.000
Neuron/ngày của Cloudflare. Van ấy cộng `AgentRun.neuronsUsed` - con số do CHÍNH
TA ước lượng từ một bảng quy đổi. Ngày 20/08/2026 Cloudflare trả
`"you have used up your daily free allocation of 10,000 neurons"` trong khi sổ
của ta mới ghi vài trăm. Van không bao giờ đóng, nên **mọi** nhịp còn lại trong
ngày đâm vào đúng bức tường đó.

Hai sổ lệch nhau là chuyện bình thường, không phải bug hiếm: sổ của ta chỉ cộng
các lượt THÀNH CÔNG của một service, sổ của họ tính cả tài khoản - mọi model,
mọi lượt gọi, kể cả lượt hỏng giữa chừng sau khi mô hình đã sinh xong chữ.

Rút ra: **ước lượng phía mình là van phụ; lời của chính nhà cung cấp là sổ
chính.** Khi nhà cung cấp nói "hết", hãy ghi lại lời đó và tin nó cho tới mốc
reset - và ghi vào DB chứ không vào biến nhớ, vì tiến trình bị restart bất cứ
lúc nào còn thứ cần nhớ là một sự kiện của NGÀY.

### Hết hạn mức KHÔNG phải lỗi, và trộn hai thứ đó thì hàng đợi tự sát

Cùng sự cố trên, phần đắt hơn: dispatcher xử lý "cạn hạn mức" y như "lỗi thật" -
sự kiện bị tính một lần thử hỏng, ba lần thì `DEAD` vĩnh viễn. Nhịp chạy mỗi
giờ, nên một ngày cạn Neuron giết sạch mọi bản nháp đang chờ, vì một lý do sẽ tự
hết lúc 00:00 UTC. Kèm theo là hai chỗ đổ oan: `NewsroomSource.lastError` bị dán
chuỗi lỗi của Cloudflare (người đọc đi sửa nguồn RSS hoàn toàn lành), và nhật ký
đầy 19 dòng `budget.exhausted` giống hệt nhau mỗi ngày, đẩy trôi những dòng đáng
đọc ra khỏi 80 dòng mà bảng điều khiển lấy về.

Rút ra: mọi hàng đợi có retry phải phân biệt **hoãn** với **thất bại**. Hoãn thì
trả việc về `PENDING` và **hoàn lại** lần thử đã tính. Và sửa nguyên nhân không
tự chữa cho người đã ốm - phải có đường hồi sinh riêng cho những việc đã chết
trước bản vá (`reviveQuotaCasualties`, chỉ nhận diện theo dấu vết lỗi hạn mức,
để lỗi thật vẫn nằm yên mà còn có người nhìn thấy).

### Công cụ ĐO có thể sai, và nó sai theo kiểu trông rất giống lỗi thật

Bộ đo tương phản tự viết ở phiên 7 báo 18 lỗi ở header qua **ba lần chạy liên
tiếp**. Không lỗi nào có thật. Ba nguyên nhân chồng lên nhau, và cả ba đều cho ra
những con số _hợp lý_ (1.15:1, 2.55:1) chứ không phải giá trị vô nghĩa - đó là lý
do nó qua mặt được ba vòng:

1. Nền **trong suốt** bị coi là đặc. `--glow` là `rgba(37,99,235,0.14)`; lấy
   nguyên `[37,99,235]` ra một mảng xanh bão hoà thay vì xanh rất nhạt trên nền trắng.
2. Alpha đọc thành `88` thay vì `0.88` khi chuỗi là `color-mix(… 88%, transparent)`.
3. **`color(srgb 1 1 1 / 0.88)` không cùng thang với `rgb()`** - kênh màu 0..1 chứ
   không phải 0..255, nên "1 1 1" thành gần như đen.

Quy tắc rút ra: **khi số đo bất thường tập trung vào MỘT thành phần và biến mất ở
một chế độ, hãy nghi công cụ trước khi nghi mã.** Ở đây chế độ Tối sạch trơn còn
Sáng/Ấm đầy lỗi - chính sự bất đối xứng đó là bằng chứng, vì header dựng giống hệt
nhau ở cả ba chế độ. Cách xác minh rẻ nhất: `getComputedStyle` đúng một phần tử
rồi in ra chuỗi thô, thay vì đọc thêm một vòng báo cáo.

### Tailwind quét NGUYÊN VĂN file, kể cả chú thích

Chú thích viết `text-[1.05rem]` để giải thích **đừng dùng** giá trị đó đã làm
chính class đó được sinh ra trong CSS production. Bộ quét không phân tích cú pháp,
nó tìm chuỗi. Đừng viết một class bị cấm ra trong comment - mô tả nó bằng lời.

Cùng họ với bẫy này: `fontSize` khai trong `extend` **không thay thế** thang mặc
định của Tailwind, nó cộng thêm. Hậu quả ở phiên 7: 41 chỗ dùng `text-xl`…`text-6xl`
lấy giá trị cắm cứng của Tailwind trong khi cả dự án tưởng đang dùng token. Muốn
một thang token là thang DUY NHẤT thì phải **ghi đè**, để class ngoài bảng không
sinh ra CSS và lộ ra ngay.

### Hai cổng kiểm có thể đá nhau vĩnh viễn

`format:check` đòi sửa `packages/ui/src/tokens.css` theo kiểu prettier;
`tokens:check` thấy nó khác bản sinh ra nên đòi chạy `tokens:sync`. Chạy cái nào
thì cái kia đỏ, mãi mãi. Lời giải không phải là loại bỏ một cổng, mà là cho **bộ
sinh** chạy đầu ra qua chính prettier của repo - artifact sinh ra đã ở dạng chuẩn
thì hai cổng đồng ý với nhau.

Nguyên tắc chung: mỗi khi thêm một artifact được sinh ra vào repo, hỏi ngay
_"cổng định dạng có đụng nó không?"_ trước khi hỏi _"cổng nào canh nó?"_.

### Một tiến trình TREO không để lại log - và trần thời gian là thứ tạo ra log

Job E2E của CI treo **bốn lần**. Cả bốn đều không có một dòng log test nào, nên
nhìn qua ai cũng nghĩ bộ test chậm. Hai kỹ thuật gỡ ra:

**1. Job đang treo thì hỏi TRẠNG THÁI TỪNG BƯỚC, đừng đợi log.** GitHub chỉ trả
log khi job kết thúc, nhưng API trạng thái trả lời ngay:

```bash
gh api /repos/<owner>/<repo>/actions/jobs/<id> -q '.steps[] | "\(.status)  \(.name)"'
```

Kết quả chỉ thẳng vào bước đang `in_progress` - ở đây là `npx playwright install`,
không phải bộ test. Đó là lần đầu biết mình đang tìm sai chỗ.

**2. Trần thời gian không chỉ chặn thiệt hại, nó SINH RA bằng chứng.** Lắp
`timeout-minutes: 10` khiến job kết thúc thay vì treo ⇒ lần đầu tiên có log để
đọc ⇒ log nói thẳng nguyên nhân:

```
Get:4 fonts-tlwg-loma-otf  107 kB   ← 6 phút cho 107 KB
```

`--with-deps` kéo 21 MB phông CJK/Thái qua mirror Ubuntu. Bộ smoke khẳng định
trên DOM chứ không so pixel nên chúng vô dụng ở đây. Bỏ đi: E2E còn **4 phút 43**.

Hệ quả tổng quát: **mọi bước phụ thuộc mạng ngoài phải có trần**. Trần mặc định
của GitHub là 360 phút - một job treo tiêu 18% hạn mức tháng của repo private mà
không sinh kết quả nào.

### Lỗi CHỈ tồn tại trên HTTPS thì không bộ test nào ở đây bắt được

Cookie phiên khai tường minh trong `[...nextauth].ts` (bắt buộc, để đặt được
`domain`) nên nó KHÔNG mang tiền tố `__Secure-`, còn `getToken()` thì đi theo
quy ước của next-auth và tự thêm tiền tố đó khi `NEXTAUTH_URL` là https:

| Môi trường   | Cookie thật được đặt      | Tên `getToken` đi tìm              | Kết quả  |
| ------------ | ------------------------- | ---------------------------------- | -------- |
| dev (http)   | `next-auth.session-token` | `next-auth.session-token`          | khớp     |
| prod (https) | `next-auth.session-token` | `__Secure-next-auth.session-token` | **null** |

Hậu quả: **mọi đường ghi đã xác thực trên production trả 401** trong nhiều ngày -
upload, ghi nội dung admin, toà soạn, mọi route tài khoản - và các trang
`/trust/*` đá cả VIP về `/login`. Không lỗi nào được ném, không log nào đỏ.

Hai điều rút ra, dùng được cho mọi lỗi cùng họ:

1. **Dev và E2E chạy `http://localhost`.** Mọi thứ phân nhánh theo `https` -
   tiền tố cookie, `secure`, `SameSite=None`, HSTS, CSP `upgrade-insecure-requests` -
   đều KHÔNG được kiểm ở đây. 20 test E2E xanh trong khi production hỏng hoàn toàn.
2. **Vì thế phải canh bằng test quét NGUỒN, không phải quét hành vi.**
   `apps/frontend-main/test/sessionCookie.test.ts` đỏ khi có chỗ gọi thẳng
   `getToken`, khi cấu hình NextAuth viết lại chuỗi tên thay vì dùng hằng chung,
   hoặc khi tên cookie mọc tiền tố. Hình dạng của mã là thứ duy nhất kiểm được
   khi hành vi chỉ sai ở một môi trường không tái hiện được.

### Tái hiện lỗi production bằng một tài khoản dùng-một-lần

Khi triệu chứng chỉ xảy ra với người đã đăng nhập mà bạn không có mật khẩu của
ai, đừng đoán từ xa. Đường đăng ký là công khai:

```bash
curl -sX POST https://tsudev.com/api/identity/register -H 'content-type: application/json' \
  -d '{"username":"chan-doan-...","email":"...@tsudev.local","password":"..."}'
# rồi lấy csrf → POST /api/auth/callback/credentials với cookie jar của curl
# rồi gọi đúng endpoint đang hỏng bằng cookie đó
```

Đó là cách sự cố cookie ở trên được tìm ra trong vài phút, sau khi đoán mò không
ra. **Nhớ xoá tài khoản khỏi Neon sau khi xong** - đã xoá, còn đúng 1 tài khoản
thật trong bảng.

### Mã 200 KHÔNG chứng minh trang có nội dung

Phép nghiệm thu cho một trang nội dung phải đếm **thứ bên trong trang**, không
phải mã trạng thái của nó. `lib/api.ts` nuốt mọi lỗi thành `[]`, nên backend 500
hay 401 đều cho ra một trang **200 rỗng** - trông y hệt "chưa có bài nào".

Đã xảy ra ở quy mô tệ nhất có thể: site trống suốt từ 18/08 tới 19/08 trong khi
mọi bảng nghiệm thu đều xanh, vì tất cả đều đo mã HTTP. Phép kiểm đúng:

```bash
curl -s https://tsudev.com/blog | grep -c 'href="/blog/'   # phải > 0
```

Hệ quả cho các đợt sau: mỗi lần phát hành, đo **một truy vấn đi tới tận
database** chứ không chỉ `/health` - `/health` của backend-bundle trả JSON tĩnh
và không đụng Prisma, nên nó xanh kể cả khi DB lệch schema hoàn toàn.

### Dấu hiệu "bản mới đã lên sóng" phải là thứ THAY ĐỔI giữa hai bản

`/health` của backend không đổi giữa các lần phát hành, nên nó chỉ nói "còn
sống", không nói "đã mới". Chọn một trường thật sự khác nhau:

- Đợt gỡ tín dụng: `/api/trust/programs` - mã cũ trả `feeCredits`, mã mới không.
  Chờ nó biến mất (mất ~80 giây) rồi mới chạy migration `DROP`.
- Đợt thêm auth-service: `/health` trả `bundled` có `identity` hay chưa.

Chạy bước phá huỷ trước khi có dấu hiệu này là tự tạo cửa sổ hỏng.

### ⚠️ Đừng truyền DATABASE_URL thật vào `--shadow-database-url`

`prisma migrate diff --shadow-database-url "$DATABASE_URL"` dùng DB đó theo cách
**PHÁ HUỶ** - nó xoá bảng `_prisma_migrations`, và lần `migrate deploy` sau đó
chết với `P3005`. Đã xảy ra với DB dev (dựng lại được bằng `migrate reset`);
nếu lỡ tay trỏ vào production thì hậu quả khác hẳn.

`prisma migrate dev --create-only` từ chối chạy khi không có TTY nếu thay đổi
làm **mất dữ liệu** (`DROP COLUMN`) - đó là lý do phải dùng `migrate diff`. Cách
an toàn: so hai TỆP schema (`--from-schema-datamodel` cũ lấy từ git,
`--to-schema-datamodel` mới), không cần DB nào cả.

### Grep theo TỪ KHOÁ trên cả cây, đừng grep trong danh sách tệp đoán trước

Khảo sát cho đợt gỡ tín dụng đếm "3 trang frontend" vì chỉ quét ba tệp đã biết
tên. Thực tế là 4 - `trust/portal.tsx` lọt lưới. Hai đợt còn lại của §1.9 khảo
sát theo đúng kiểu đó, nên rất dễ lặp lại.

### Tệp test mới phải có `export {}`, và `tsc -b` sẽ GIẤU chuyện đó ở máy dev

Tệp test không có `import`/`export` nào thì TypeScript coi là **script toàn cục**,
nên `request`, `prisma`, `app`, `post`, `clean`… ở top-level đụng tên với đúng
những biến đó trong tệp test khác ⇒ `TS6200`, và cả suite không chạy nổi.

Cái đắt không phải lỗi mà là **nó không lộ ra ở máy dev**: `tsc -b` dựng tăng
dần, bỏ qua tệp chưa đổi, nên `npm --workspace … test` xanh ở local rồi đỏ ở CI
(nơi build sạch). Đã tốn một vòng CI đúng theo đường này.

Hai cách dùng lại được:

- Thêm `export {}` vào mọi tệp test dùng `require()` ở top-level.
- Nghi ngờ thì xoá `*.tsbuildinfo` rồi chạy lại - đó là cách tái hiện điều kiện
  của CI ở máy mình:
  `find . -name "*.tsbuildinfo" -not -path "./node_modules/*" -delete`

### `wrangler.jsonc` KHÔNG được `topology:gen` sinh ra

Thêm service vào `config/topology.json` **không** kéo theo biến cho Worker. Quên
là biến rơi về `http://localhost:<port>` và Worker gọi vào chính nó. Đã xảy ra
với `AUTH_SERVICE_URL` (đăng nhập hỏng hoàn toàn, trong khi
`/api/auth/providers` vẫn trả đúng nên nhìn qua tưởng xong).

`topology:check` nay canh tệp đó - nhưng nó chỉ kiểm SỰ CÓ MẶT, không kiểm giá
trị. Giá trị vẫn phải điền tay.

---

### Cổng chặn đứng TRƯỚC bảng route thì 404 không còn phân biệt được bản dựng

20/08/2026, sau khi gộp PR #36, cần biết Render đã dựng xong mã mới chưa.
`/health` vô dụng - bản cũ cũng trả 200. Nên chọn một dấu hiệu trông rất chắc:
route `POST /api/newsroom/admin/events/revive` **chỉ có ở bản mới**, vậy còn
404 là còn mã cũ, hết 404 là đã sang bản mới.

Sáu phút sau khi gộp, nó trả **401**. Đọc theo giả thiết trên thì "đã Live" -
và con số ấy sẽ đi thẳng vào phiếu nghiệm thu.

Nó sai. Đường bịa ra `POST /api/newsroom/admin/khong-ton-tai-xyz` cũng trả 401,
vì middleware xác thực của nhánh `/api/newsroom/admin/` chạy **trước** bảng
định tuyến: chưa đăng nhập thì không bao giờ tới được chỗ Express quyết định
route có tồn tại hay không. Cả hai bản dựng trả cùng một mã, cho mọi đường con.

Quy tắc rút ra: **một phép đo "route mới đã có chưa" chỉ có giá trị khi đường
đó nằm NGOÀI mọi cổng chặn** - hoặc khi đã đo kèm một đường đối chứng chắc chắn
không tồn tại. Đối chứng tốn đúng một lệnh `curl` và nó là thứ duy nhất phân
biệt được "tín hiệu" với "mọi thứ đều trả như vậy".

Cùng họ với "công cụ ĐO có thể sai theo kiểu trông y hệt lỗi thật" ở trên, nhưng
ngược chiều: ở đây phép đo sai theo kiểu trông y hệt **thành công**. Chiều này
nguy hơn - không ai đi điều tra một kết quả tốt.

Cùng phiên, cùng cái bẫy, lần thứ hai: để chứng minh bản sửa frontend đã lên,
grep chuỗi tiếng Việt trong chunk JS production trả **0** - kể cả chuỗi vốn có ở
CẢ HAI bản. Bundle của Next escape các ký tự **Latin-1** (`đã` → `đ\xe3`,
`nhà` → `nh\xe0`) nhưng giữ nguyên ký tự ngoài Latin-1 (`ừ`, `ồ`, `ạ`), nên grep
một câu tiếng Việt đầy đủ **luôn trượt**. Đọc số 0 đó thành "deploy hỏng" là sai
hoàn toàn. Thứ cứu được lần này vẫn là **đường đối chứng**: một chuỗi chắc chắn
phải có mà cũng trả 0 thì lỗi nằm ở phép đo, không ở thứ đang đo.

Backend repo này hiện **không có** bề mặt công khai nào phân biệt hai bản dựng.
Tới khi có (một `/health` mang commit SHA chẳng hạn), câu "Render đã Live chưa"
phải hỏi dashboard Render, không suy ra từ mã HTTP.

---

### Sổ đo phải ghi ở NƠI PHÁT SINH, không ở đường `return`

`withRun()` của toà soạn ghi `neuronsUsed` từ giá trị agent **trả về**. Nghe hợp
lý cho tới khi nhìn xem agent hỏng ở đâu: ba trong bốn agent `throw` **ngay sau**
lượt gọi mô hình - JSON parse hỏng, bài quá ngắn, phán quyết không đọc được.
Neuron đã tiêu thật, nhưng đường `return` không bao giờ chạy, nên `AgentRun` ghi
**0**. Sổ đếm thiếu đúng ở nhánh hay xảy ra nhất, và van ngân sách hằng ngày đọc
chính cái sổ đó - tức nó mù nhất vào đúng ngày mô hình trả lời tệ nhất.

Quy tắc: **đo tại ranh giới nơi chi phí phát sinh** (chỗ nhà cung cấp trả lời),
không tại chỗ kết quả về đích. Hai chỗ đó chỉ trùng nhau khi không có gì hỏng.

Cách làm ở đây: một sổ chi phí đặt trong `AsyncLocalStorage` (`withCostLedger`
trong `services/newsroom-service/src/llm/index.ts`). `complete()` cộng vào sổ
ngay khi có phản hồi; `withRun()` đọc sổ ở **cả hai** nhánh try/catch. Chọn
ngữ cảnh thay vì truyền tay qua bốn hàm agent vì truyền tay thì agent thứ năm
viết sau này quên truyền là sổ thủng lại, im lặng - còn ngữ cảnh thì mọi lượt
gọi đều được đếm, sâu bao nhiêu tầng cũng vậy.

Kèm theo: bỏ hẳn đường trả chi phí cũ (`AgentCost` trong `agents.ts`) thay vì để
song song. Hai sổ cùng đếm một thứ là cách chúng lệch nhau mà không ai biết -
cùng họ với bài học "phân quyền chỉ có MỘT nguồn" ở `CLAUDE.md`.

Canh bằng `services/newsroom-service/test/costLedger.test.ts`: bốn test hành vi
(ném lỗi sau lượt gọi vẫn giữ chi phí · cộng dồn nhiều lượt · ghi việc chuyển
dự phòng · gọi ngoài lượt chạy không nổ) và ba test quét nguồn khoá hình dạng
`withRun()`.

---

---

## 0.8 Bài học: "đặt mật khẩu thành công mà production vẫn rỗng"

Đã kiểm trực tiếp trên Neon: `tsudev` có `passwordHash`, `lastLoginAt` =
2026-08-17T13:33:18Z. Chủ dự án đã đặt mật khẩu và đăng nhập thành công.

`emailVerifiedAt` vẫn rỗng - không chặn gì, nhưng luồng "quên mật khẩu" sẽ xác
minh luôn nếu chạy qua nó một lần.

### Bài học giữ lại (đây là lý do mục này không bị xoá hẳn)

Sự cố gốc: `set-password.js` nạp `DATABASE_URL` từ `.env` ở gốc repo (trỏ DB
dev) và **không in ra đang ghi vào đâu**, nên nó báo "thành công" trong khi
production vẫn rỗng.

Hai dấu hiệu chẩn đoán, dùng lại được cho mọi sự cố đăng nhập:

- **`failedLoginCount` vẫn 0** sau nhiều lần thử ⇒ đang rơi vào nhánh "tài khoản
  không có mật khẩu", KHÔNG phải nhánh sai mật khẩu. Nhánh đó không gọi
  `noteAccountFailure()`.
- Thông điệp trên màn hình **cố ý không phân biệt** ba trường hợp (không có tài
  khoản / sai mật khẩu / chưa đặt mật khẩu) để chống dò tài khoản. Đừng chẩn
  đoán từ nó.

Script nay in host của database trước khi ghi, và nhận mật khẩu qua stdin
(heredoc) nên dấu nháy đơn trong mật khẩu không làm hỏng lệnh. Cách chạy nhắm
production: `docs/auth.md` §5.

---

## 1. Việc còn dở

### 1.1 ~~Dựng bộ ping giữ ấm~~ - ✅ XONG 19/08

`infrastructure/newsroom-cron` đã được deploy 19/08 với cả hai nhịp:

```
Deployed tsudev-newsroom-cron triggers
  schedule: */5 0-17,23 * * *
  schedule: 7 0-17,23 * * *
```

Trước đó nó **chưa bao giờ được deploy** - `wrangler deployments list` trả
`This Worker does not exist on your account`. Bản trước của phiếu này ghi "có thể
đã xong"; đó là suy đoán và nó sai. Ghi lại vì đây là kiểu sai dễ lặp: một mục
được đánh dấu "có thể xong" rồi không ai đo lại.

⚠️ Nhịp giữ ấm **không dùng** `NEWSROOM_TICK_TOKEN` (chỉ đọc `BACKEND_URL`), nên
mục này xong độc lập với việc toà soạn có chạy hay không.

Kể từ 19/08 cả hai nhịp **nghỉ 01:00-06:00 giờ VN** (viết trong cron là giờ UTC
`0-17,23`) để hạ mức tiêu Render từ 744 xuống ~589 trên 750 giờ. Chi tiết và
bảng đánh đổi: [`docs/free-tier.md`](docs/free-tier.md).

**Đừng dùng GitHub Actions cron.** Repo private, mỗi lần chạy tính tối thiểu 1
phút ⇒ ~8.600 phút/tháng, vượt xa hạn mức 2.000.

### 1.2 ~~Giới hạn tần suất~~ - ✅ XONG 16/08

- Đường đăng nhập: hai trục (theo IP qua bảng `LoginAttempt`, theo tài khoản qua
  `failedLoginCount`/`lockedUntil`) trong `services/auth-service/src/throttle.ts`.
- Nhánh công khai của con dấu: `services/trust-service/src/rateLimit.ts`, cửa sổ
  trượt trong bộ nhớ tiến trình.

⚠️ **Bộ đếm của trust-service nằm trong RAM và giả định ĐÚNG MỘT tiến trình.**
Giả định đó đúng hôm nay (`backend-bundle` là một tiến trình) và **vỡ** nếu chạy
nhiều bản - lúc đó ngưỡng thực tế nhân lên theo số bản. Chú thích đầu tệp ghi rõ.

### 1.3 `npm audit` - 🟠 CHƯA LÀM, và phần "dễ" hoá ra KHÔNG chạy được

Đo lại 19/08/2026 (con số cũ "7 lỗ, 4 cao" đã lạc hậu):

| Phạm vi                     | Số lỗ                                   |
| --------------------------- | --------------------------------------- |
| Toàn bộ                     | **37** (1 thấp, 18 vừa, 17 cao, 1 nguy) |
| `--omit=dev` (thật sự ship) | **7** (3 vừa, 4 cao)                    |

Chênh lệch 30 lỗ nằm ở Storybook - **không nằm trong CI và không được ship**
(nợ đã đăng ký ở §2). Đừng để con số 37 kéo phiên đi sai hướng.

Bảy lỗ thật đều là **`sharp` kế thừa CVE của libvips qua `next`**; sửa cần nâng
lên `next@16` - breaking. Phải là **đợt riêng có test đầy đủ**, đừng nhét vào
commit khác.

⚠️ **`npm audit fix` (không `--force`) KHÔNG chạy được.** Nó chết ở xung đột peer
dependency - đúng khoản nợ `react@18.3.1` ghim ở gốc cho Storybook so với React
19 ở app (§2). Bản trước của mục này ghi "`qs` qua `express` thì `npm audit fix`
xử lý được"; điều đó **không còn đúng**. Ép bằng `--force` hay `--legacy-peer-deps`
là đổi cây phụ thuộc một cách mù, đừng làm ngoài một đợt riêng.

### 1.4 Bật CSP thật - 🟡 CHƯA LÀM

CSP đang ở **`Content-Security-Policy-Report-Only`, CÓ CHỦ ĐÍCH**, không phải
quên. Trình duyệt PUT thẳng lên endpoint R2 bằng URL presign, mà host đó đến từ
biến môi trường chứ không biết được lúc build - bật chặn mù là upload chết **mà
không có lỗi nào phía máy chủ**.

Cách bật: mở site, thao tác thật vài phút (đăng nhập, xem blog, **upload một
tệp**, **đăng ký một passkey**), xem Console. Không có dòng "Report Only" nào thì
đổi tên key trong `apps/frontend-main/next.config.js` thành
`Content-Security-Policy`.

> Đợt này thêm một script NỘI TUYẾN trong `pages/_document.tsx` (chống nháy màu).
> CSP thật sẽ chặn nó trừ khi có `'unsafe-inline'` hoặc một nonce. Xử lý trước
> khi bật, nếu không mọi lần tải trang đều nháy trắng ở chế độ tối.

### 1.5 Kiểm giao diện bằng MẮT - 🟠 CHƯA LÀM

Đợt tái cấu trúc giao diện được canh bằng cổng tương phản tự động
(`packages/ui/test/contrast.test.ts`, 68 phép kiểm) và E2E, nhưng **chưa ai nhìn
thấy nó bằng mắt**. Cổng đó chứng minh màu đủ tương phản; nó không chứng minh bố
cục đẹp hay khoảng cách hợp lý.

Cần rà tay ở cả hai chế độ, ưu tiên: trang chủ · `/blog/[slug]` (mục lục mới) ·
`/login` · `/settings/security` · `/admin/projects` · `/trust`.

### 1.6 ~~Xoá cột `User.keycloakId`~~ - ✅ XONG HẲN 19/08/2026

Cả ba bước đã chạy đúng thứ tự: gỡ khỏi schema → phát hành mã (Render + Worker)
→ `migrate deploy` lên Neon. Cột không còn ở cả mã lẫn database.

Bằng chứng cho thấy thứ tự đó là thật chứ không phải nghi thức: **268 test xanh
trên schema CÒN cột, rồi 252 test xanh trên schema ĐÃ XOÁ cột**. Mã mới sống
được với cả hai, nên cửa sổ giữa hai bước không có trạng thái nào hỏng.

Đây cũng là lần đầu quy trình "xoá cột" được chạy trọn vẹn ở dự án này. Lần sau
xoá cột khác thì lặp lại đúng ba bước; đảo lại là trang trống, không phải trang
lỗi.

### 1.7 Trang quản lý tài khoản - 🟢 ĐỢT A XONG 19/08 (trừ ảnh đại diện) · đợt B chưa làm

Đây là khoảng trống lớn nhất còn lại về mặt sản phẩm, không phải một chi tiết
thiếu. `/settings/security` chỉ có 2FA và passkey - nó được dựng để hai cơ chế
đó không thành mã chết, chứ không phải để quản lý tài khoản.

#### Hiện trạng đã đo

**Không có route nào cho phép người dùng sửa hồ sơ của chính mình.** Mọi
`prisma.user.update` trong repo chỉ thuộc bốn nhóm, không nhóm nào do người dùng
chủ động gọi:

| Nơi                     | Sửa gì                                      |
| ----------------------- | ------------------------------------------- |
| `auth-service`          | `emailVerifiedAt`, `passwordHash` (đặt lại) |
| `auth-service/throttle` | bộ đếm sai / `lockedUntil` / `lastLoginAt`  |
| `trust-service`         | trừ `credits` khi nộp đơn cấp dấu           |

Hệ quả trên ba cột đang tồn tại trong schema:

- **`displayName`** - đặt một lần lúc đăng ký (hoặc mặc định bằng username), sau
  đó KHÔNG có đường nào đổi. Nó lại là thứ hiển thị công khai dưới mỗi bài viết
  (`authorCard` của content-service).
- **`avatarUrl`** - chỉ xuất hiện trong khai báo kiểu và trong `authorCard`.
  Không có gì GHI vào nó.
- **`bio`** - grep toàn bộ `services/`, `apps/`, `packages/`: không nơi nào đọc.
  Cột chết, chỉ được `seed.js` điền một lần.

Cũng không có `/admin/users` - quản trị chỉ có dự án và con dấu.

#### Vì sao thành ra thế

Site vốn dùng Keycloak, nơi bảng `User` được `resolveUser()` tự tạo ÂM THẦM từ
token - không ai "có tài khoản" theo nghĩa sản phẩm, chỉ có một dòng dữ liệu để
gắn quyền. Không có đăng ký thì cũng không có gì để quản lý.

Khái niệm tài khoản chỉ thành thật ở đợt vừa rồi, khi thêm đăng ký/mật khẩu/2FA/
passkey. Trang quản lý tài khoản là hệ quả trực tiếp của thay đổi đó nhưng nằm
ngoài phạm vi được giao, nên không được dựng.

#### Cần làm gì

**Đợt A - ✅ XONG 19/08/2026, trừ ảnh đại diện.**

| Mảnh                                 | Trạng thái                                                |
| ------------------------------------ | --------------------------------------------------------- |
| `/settings/profile`                  | ✅ `displayName` + `bio`                                  |
| `POST /api/identity/password/change` | ✅ đòi mật khẩu hiện tại, tăng `sessionVersion`           |
| Ảnh đại diện                         | 🟠 **CHƯA - cần chủ dự án quyết một việc, xem ngay dưới** |

Ba route mới ở auth-service (`profile/get`, `profile/update`, `password/change`),
đều gắn `auth` theo nhánh và đi qua proxy CÓ PHIÊN
`pages/api/account/[...path].ts`. 11 test mới trong
`services/auth-service/test/profile.test.ts` khoá bốn thứ:

- `profile/update` chỉ chạm ĐÚNG hai cột - có test gửi kèm `role: 'ADMIN'`,
  `username`, `email` và khẳng định chúng không đổi. Một route "sửa hồ sơ" nhận
  nguyên `req.body` là đường tự cấp ADMIN bằng một dòng JSON, và nó vẫn trả 200.
- Sai mật khẩu hiện tại ⇒ 401 và mật khẩu KHÔNG đổi.
- Đổi mật khẩu ⇒ `sessionVersion` tăng, và **phiên mang số cũ bị từ chối ngay
  sau đó** - đây mới là thứ làm cho việc đổi mật khẩu LẤY LẠI được tài khoản.
- Tài khoản chỉ có passkey ⇒ 409 `no_password_set` nói rõ, không phải 401 mơ hồ.
  Trả 401 ở đó là đẩy người dùng vào đúng kiểu bế tắc của §0.5.

Số mới của `sessionVersion` được TRẢ VỀ cho client để nó gọi `update()` của
`useSession`. Thiếu bước đó thì chính người vừa đổi mật khẩu thành công bị đăng
xuất ngay lập tức, và trông y hệt như thao tác đã hỏng.

⚠️ **Tiện tay phát hiện: `/settings/security` là TRANG CHẾT.** Nó không được
nhắc tới ở bất kỳ đâu trong giao diện - chỉ vào được bằng cách gõ URL. Tức là
trang được dựng để 2FA và passkey không thành mã chết thì chính nó lại mắc đúng
số phận đó. Đã sửa: tên người dùng ở `SiteHeader` nay là liên kết tới
`/settings/profile`, và menu di động có thêm hai mục (trên màn hình hẹp tên người
dùng bị ẩn, nên đó là lối vào duy nhất).

#### ⚠️ Ảnh đại diện - một quyết định phải chốt TRƯỚC khi viết mã

Nghe như "nối presign có sẵn vào là xong", nhưng không phải, và cái vướng không
nằm ở tầng tải lên:

**Bucket R2 là bucket RIÊNG TƯ.** `CLAUDE.md` cảnh báo đừng đặt
`S3_PUBLIC_ENDPOINT` thành `cdn.tsudev.com` vì làm thế biến bucket thành công
khai. Nhưng ảnh đại diện phải đọc được CÔNG KHAI - nó hiện dưới mỗi bài viết,
nơi người xem không có phiên nào. URL presign thì HẾT HẠN, nên lưu một URL
presign vào `User.avatarUrl` là hẹn ngày ảnh hỏng hàng loạt.

Ba đường đi, phải chọn một:

| Cách                                                        | Được                                    | Mất                                                                      |
| ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| Bucket/tiền tố `avatars/` để đọc công khai                  | đơn giản nhất, ảnh là URL vĩnh viễn     | phải tách bucket hoặc bật public read - đụng đúng cảnh báo ở `CLAUDE.md` |
| Route proxy `/api/avatar/<username>` ký presign GET rồi 302 | bucket vẫn riêng tư hoàn toàn           | mỗi lượt xem ảnh là một lượt gọi Worker, ăn vào hạn mức 100.000/ngày     |
| Không có ảnh tải lên, dùng chữ cái đầu (`Avatar` đã có)     | 0 hạ tầng, 0 chi phí, 0 bề mặt tấn công | không cá nhân hoá được                                                   |

Với một site dự án cá nhân lưu lượng thưa và mục tiêu chi phí bằng 0, **đề nghị
cách 3 trước mắt** - component `Avatar` của `@tsudev/ui` đã dựng sẵn hình chữ cái
đầu. Cách 1 để dành cho lúc thật sự cần.

**Đợt B** chạm vào chiếm tài khoản và nghĩa vụ ở `/privacy`, làm riêng có test
đầy đủ:

| Mảnh              | Cạm bẫy                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Đổi email         | phải xác minh địa chỉ MỚI trước khi thay. Thay trước rồi mới gửi thư xác minh là đường chiếm tài khoản: kẻ chiếm phiên đổi email sang của mình rồi dùng "quên mật khẩu". |
| Xem/thu hồi phiên | cơ chế đã có (`sessionVersion`), chỉ thiếu giao diện                                                                                                                     |
| Xoá tài khoản     | `Post.authorId` và `FileObject.ownerId` đều `onDelete: SetNull` nên xoá được mà không mất nội dung. Nhớ xoá kèm passkey/TOTP/mã dự phòng - `onDelete: Cascade` đã lo.    |

#### Thứ tự

§0.5 đã xong nên không còn chặn. Nhưng đây là loại tính năng **chỉ lộ lỗi khi
bấm thật**, nên nghiệm thu phải là đăng nhập vào production rồi thao tác, không
phải chỉ chạy test.

### 1.8 Cân nhắc: đường chẩn đoán cho tài khoản không có mật khẩu - 🟡

Thông điệp đăng nhập cố ý không phân biệt "không có tài khoản" / "sai mật khẩu"
/ "tài khoản chưa đặt mật khẩu". Đúng về chống dò tài khoản, nhưng §0.5 cho thấy
nó làm chính chủ tài khoản mắc kẹt và mất nhiều lượt mới chẩn đoán ra.

KHÔNG sửa bằng cách nới thông điệp ra - đó là đánh đổi sai. Hai hướng an toàn:

- Ghi log ở auth-service khi rơi vào nhánh `!user.passwordHash` (có username),
  để người vận hành đọc được mà người ngoài thì không.
- Trang `/login` thêm gợi ý trung tính kiểu "Tài khoản mới hoặc chưa từng đặt
  mật khẩu? Dùng Quên mật khẩu." - không tiết lộ gì về một tài khoản cụ thể.

---

### 1.9 ~~Đưa Con dấu về chế độ mời + gỡ tín dụng~~ - ✅ XONG 3/3 ĐỢT, đã gộp hết

| Đợt                  | Trạng thái                                        |
| -------------------- | ------------------------------------------------- |
| 1 - gỡ tín dụng      | ✅ phát hành 17/08                                |
| 2 - mã mời           | ✅ gộp (PR #12); backend đã chạy, **Worker chưa** |
| 3 - gác bề mặt + SEO | ✅ gộp (PR #15); backend đã chạy, **Worker chưa** |

Cả hai đợt sau nay lên cùng một lượt deploy Worker - xem "Bắt đầu từ đâu" việc 2,
và **sửa `INTERNAL_IDENTITY_SECRET` trước đã**.

Kế hoạch đầy đủ: [`docs/refactor-trust-invite-access.md`](docs/refactor-trust-invite-access.md).

Hai thứ rút ra từ đợt 3, đã ghi vào chỗ đúng của nó nên không lặp lại ở đây:

- Bề mặt Con dấu phải sửa ĐỒNG THỜI ở **bốn** chỗ, không phải ba - chỗ thứ tư
  (`services/backend-bundle/test/routing.test.ts`) nằm ở workspace khác nên đã
  lọt lưới đúng một lần. Gotcha ở `CLAUDE.md` đã cập nhật.
- Khi hai cổng chặn khác nhau cùng trả một mã trạng thái thì **mã trạng thái
  thôi không còn là dấu hiệu**. Test định tuyến của backend-bundle nay phân biệt
  bằng thân phản hồi.

Điểm phải quyết lại TRONG TƯƠNG LAI: khi cấp chứng chỉ đầu tiên cho khách hàng
THẬT, phải trả lời "khách vãng lai bấm vào huy hiệu thì thấy gì".
`TRUST_ISSUER` được ký vào chứng chỉ nên URL xác minh là cố định vĩnh viễn.
Serial hiện có dạng tuần tự `TSU-CR-2026-000123` - nếu sau này chọn hình
"URL-năng-lực" thì phải đổi cách sinh serial TRƯỚC lần cấp đầu.

Hệ quả đã ghi nhận: **SEO không còn đến từ Con dấu.** Mục tiêu "đạt tiêu chí SEO"
phải do blog · tài liệu · dự án gánh.

### 1.10 Dọn service Render trùng `tsudev-backend-rqkz` - 🟠 CHƯA LÀM

Mỗi lần deploy, hộp thư nhận `deploy failed for tsudev-backend-rqkz`. **Đó không
phải sự cố production** - nó là một service THỨ HAI chưa bao giờ khởi động nổi vì
không có secret nào, nên nó chết ngay lúc nạp module ở
`services/trust-service/src/signing.ts`. Chưa bao giờ chạy ⇒ **không tiêu giờ
instance**, nên nó không phải nguồn rủi ro ngân sách - chỉ là rác.

⚠️ **Thứ tự khi dọn: xoá Blueprint instance TRƯỚC, rồi mới xoá service.** Xoá mỗi
service mà để blueprint lại thì lần push sau nó dựng lại y nguyên. Và sau khi gỡ
blueprint phải xác nhận `tsudev-backend` còn bật Auto-Deploy - nếu đường deploy
tự động lâu nay do blueprint kéo thì gỡ xong sẽ thành "đã gộp PR rồi mà
production vẫn chạy mã cũ".

⚠️ **Đừng chẩn đoán bằng DNS.** Phiên 4 kết luận service "vẫn tồn tại trong tài
khoản" vì tên miền còn phân giải - **lập luận đó sai**: `*.onrender.com` là
wildcard nên MỌI tên đều phân giải, kể cả tên chưa ai đăng ký. Header
`x-render-routing: no-server` cũng không phân biệt được "đã xoá" với "tồn tại mà
không khởi động nổi". Chỉ dashboard mới trả lời được.

✅ `tsudev-sso` (service danh tính của bản thiết kế cũ) **đã được xác nhận không
còn tồn tại** trên Render - chủ dự án kiểm dashboard 19/08/2026. Nó từng là
khoản chi lớn nhất của ngân sách giờ instance.

---

## 2. Nợ có đăng ký, KHÔNG phải việc cần làm

- **Storybook không nằm trong CI** và root còn ghim `react@18.3.1` cho nó. App
  thật chạy React 19. Đợt này thêm prop `inputRef` cho `Input` thay vì dựa vào
  `ref` đi lọt qua `...props` - chính vì khoảng cách đó.
- **`documents-tsudev.md` là ĐẶC TẢ, không phải hiện trạng.** Mã nguồn là hiện
  trạng. §2.2 của nó đã được cập nhật 19/08 để ghi nhánh xác thực ĐÃ CHỌN (tự
  xây), nhưng phần còn lại vẫn là đích đến chứ không phải mô tả cái đang chạy.
