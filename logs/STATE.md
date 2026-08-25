# STATE.md - Trạng thái project (agent đọc đầu phiên, cập nhật cuối phiên)

> **Phiên 24 bắt đầu ở đây** (cập nhật cuối phiên 23): đọc
> [`handover/20260824-02`](handover/20260824-02_ket-phien-23.md). **CHƯƠNG TRÌNH
> EDITOR NÂNG CẤP ĐÃ PHÁT HÀNH backend+DB** (chủ dự án trao quyền tự chạy + cấp Neon
> creds). Đã làm: `prisma migrate deploy 20260824043047` trên Neon prod (status "up to
> date") · gộp **PR #68 (editor) + #69 (QU-STD-2)** vào `main` (`7f3b622`, squash) →
> Render tự deploy backend · `search:reindex` 35 bài prod · nghiệm thu prod XANH
> (homepage 200 có nội dung, /blog liệt kê bài thật, /api/auth/providers sạch không rò
> dev). **CÒN ĐÚNG 1 BƯỚC = deploy frontend Cloudflare**:
> `node scripts/deploy-frontend.js deploy` - **classifier CHẶN**, chủ dự án phải tự chạy
> (gõ `!node scripts/deploy-frontend.js deploy` để mình nghiệm thu ngay). Tới khi chạy,
> UI mới (`/author` editor, `/search`, cover/references/tag-chip) CHƯA hiện; backend+DB
> đã sẵn và **tương thích ngược** (frontend cũ + backend mới chạy chung được, mọi thay
> đổi additive). Nghiệm thu sau deploy: `curl /api/auth/providers` CHỈ credentials·
> passkey·github·google (đai chống rò config dev). Tuỳ chọn: `PEXELS_API_KEY` ở Render
> (ảnh bìa agent) + kiểm `S3_PUBLIC_ENDPOINT` prod cho GET công khai (ảnh/video nhúng).
> **QU-STD-2 XONG** (đã merge). **QU-STD-4 KHÔNG làm - là BẪY** (`.env.production` commit
> CHỦ ĐÍCH cho tái lập CI/máy khác; xem memory `qu-std-4-env-production-bay` + handover
> §5). QU-STD-1/3 cần mắt người (đổi màu phá vỡ).
>
> **Phiên 23 bắt đầu ở đây** (cập nhật cuối phiên 22): đọc
> [`handover/20260824-01`](handover/20260824-01_pha1-editor-nang-cap.md) (§6 ghi kết
> quả Pha 2-7). **CHƯƠNG TRÌNH EDITOR NÂNG CẤP 7 PHA ĐÃ XONG TOÀN BỘ** (chủ dự án
> trao quyền tự quyết chạy thẳng). Sửa bài đã đăng đầy đủ (nội dung/tiêu đề/thời
> gian) + lên lịch + xem trước + ảnh bìa/SEO + media ảnh-video (upload + render an
> toàn) + Nguồn tham khảo {label,url} + tìm/lọc theo tag (chuẩn SEARCH_AND_FILTER
> GĐ1-3: không dấu, debounce, highlight ánh xạ ngược, ARIA, facet, /search) + agent
> AI tự chèn ảnh bìa. **Mọi cổng XANH**: typecheck·lint·format·topology·tokens;
> test content 60 · storage 15 · newsroom 49 · bundle 15 · frontend 40. **CHƯA
> commit, CHƯA phát hành** - chờ chủ dự án review + phát hành. Phát hành CẦN:
> `prisma migrate deploy` migration `20260824043047` trên Neon + (tuỳ chọn)
> `PEXELS_API_KEY` ở Render cho ảnh agent + `npm run search:reindex` backfill bài
> cũ trên prod. Chi tiết ở §6 phiếu 20260824-01.
>
> **Phiên 21 bắt đầu ở đây** (cập nhật cuối phiên 20): đọc
> [`handover/20260822-07`](handover/20260822-07_ket-phien-20.md). **HÀNG ĐỢI CẠN
> việc agent làm được** - mọi mục còn lại chờ chủ dự án (C1 gated-prod, Phase 0
> DevTools CSP) hoặc upstream (B1). Phiên 20: xác nhận B1 vẫn CHẶN
> (`@opennextjs/cloudflare` vẫn 1.20.2); dọn nhánh stale (xóa 4, còn 2 nhánh
> `docs/ket-phien-15` + `fix/phase-a-ssrf-ratelimit` cần `git branch -D` - đã ở
> trong main, an toàn, classifier chặn force-delete); xác minh main XANH toàn bộ
> (lint·typecheck·topology·tokens). **Bẫy đã gỡ**: typecheck từng đỏ ở trust-service
> do Prisma client cũ sau đợt install nhánh next16 - `npm run db:generate` là hết
> (main KHÔNG đỏ thật). Prod SẴN SÀNG, không CVE reachable.
>
> **Phiên 20 bắt đầu ở đây** (cập nhật cuối phiên 19): đọc
> [`handover/20260822-06`](handover/20260822-06_ket-phien-19.md). **PR #60 (Phase
> A) ĐÃ MERGED + phát hành** (`f994ed4`, CI 6/6 xanh; backend live -
> `/api/trust/verify/<rác>` → 401 JSON sạch). **B1 next@16: phiên 19 làm tới cùng,
> giải xong 4/5 blocker nhưng CHẶN CỨNG ở `@opennextjs/cloudflare@1.20.2` (không
> bundle được next@16), đã REVERT** - cây ở next@15, chờ opennextjs > 1.20.2
> (memory `nang-cap-next16-express5` giữ lời giải 4 blocker). **C1** gated-prod;
> **Phase 0**: đăng nhập GitHub thật ✅ đã xác nhận prod (phiên 19), còn 1 mục mắt
> người (DevTools Console sạch CSP). Không còn việc agent làm được mà không cần
> chủ dự án hoặc bản opennextjs mới.

> **🎉 CHƯƠNG TRÌNH EDITOR NÂNG CẤP ĐÃ LIVE ĐỦ BA TẦNG (25/08/2026, phiên 24).**
> Chủ dự án chạy `node scripts/deploy-frontend.js deploy` → exit 0, **Version
> `2c9dd20c`**, `.env.local` được dời khỏi bản dựng rồi trả lại. Nghiệm thu prod
> XANH: providers sạch (credentials·github·google·passkey) · `/search` 404→**200** ·
> tìm KHÔNG DẤU chạy thật (`bao mat`=`bảo mật`=7, `tuong tac`=`tương tác`=3) · chặn
> min-2 · facet tag · tag chip + `/blog?tag=` lọc đúng · `/author` 200 · homepage
> và `/blog` 200 KÈM nội dung · canonical/OG = `tsudev.com`, 0 chuỗi `localhost`.
> **CHƯA nghiệm thu được vì thiếu DỮ LIỆU (không phải mã hỏng)**: vùng "Nguồn tham
> khảo" (quét 12 bài, 0 bài có `references` thật) và ảnh bìa riêng (0 bài có
> `coverImageUrl` - `PEXELS_API_KEY` chưa đặt ở Render). Đóng bằng cách đặt
> `PEXELS_API_KEY` rồi chờ agent ra bài mới, hoặc đăng 1 bài qua `/author`.
> Chi tiết + **hai lần công cụ đo tự sinh lỗi giả**: phiếu
> [`20260825-01`](handover/20260825-01_ket-phien-24.md) §7.
>
> **Phiên 24 (25/08/2026)**: đóng hai đề xuất đẩy ngược - `.standards/` **v2.8.0
> đã nhận NGUYÊN VĂN cả hai** (Issue #1/#2 ở `tsudev-standards` đã close). **Hệ quả
> đo được, đổi bản chất QU-STD-1**: giá trị `extensions.tsudev-web` ghi đè cục bộ
> TRÙNG KHÍT khối `color` chuẩn mới ⇒ di trú token **KHÔNG đổi pixel nào** ở
> `text-muted`/`border-control`; nhãn "thay đổi PHÁ VỠ" có từ thời `.standards/`
> v1.0.0 và nay hết đúng. Sửa kèm 2 link CHẾT trong `docs/README.md` mà QU-STD-2
> bỏ sót. **Frontend Cloudflare VẪN CHƯA deploy** (`/search` prod = 404).

## Hàng đợi task (làm từ trên xuống)

**Đợt khắc phục triệt để - chi tiết + tiêu chí xong ở [`handover/20260822-03`](handover/20260822-03_ke-hoach-khac-phuc-triet-de.md). Thứ tự: A2 → A1 → A3 → B1 → C1.**

- [x] **🟠 A2. npm audit non-breaking** - ✅ ĐIỀU TRA XONG 22/08 (phiên 17):
      **KHÔNG có bản vá non-breaking**. express@4.22.1 ghim `qs ~6.14.0`, loại trừ
      qs 6.15.2 vá lỗi ⇒ override bị npm từ chối. Lỗi qs (GHSA-q8mj-m7cp-5q26) ở
      `qs.stringify` mà mã ta KHÔNG dùng (grep sạch cả `qs.stringify` lẫn
      `encodeValuesOnly`) ⇒ **không với tới được**. 3 moderate này gộp vào B1
      (nâng express@5 cùng next@16). 4 high vẫn là sharp → B1.
- [x] **🔴 A1. SSRF `domainVerify` vá triệt để** - ✅ XONG 22/08 (phiên 17). Thay
      `fetch(redirect:'follow')` bằng `node:https` + `guardedLookup` (kiểm mọi IP,
      GHIM IP đã kiểm vào socket qua option `lookup` - đóng TOCTOU) + `safeGet`
      theo redirect THỦ CÔNG tối đa 3 chặng, chỉ https, mỗi chặng qua guardedLookup
      (đóng redirect-SSRF), từ chối hạ cấp http. Zero-dep (không undici). Test
      `domainVerify.test.ts` **30** (isPrivateAddress đủ dải metadata/loopback/
      CGNAT/IPv6-mapped · guardedLookup chặn nội bộ+đa-bản-ghi · safeGet chặn
      http-downgrade+vòng lặp). trust-service **87/87**; lint/prettier/typecheck
      sạch. CHƯA phát hành (chờ deploy backend Render - gộp với A3).
- [x] **🟠 A3. Rate limit content + storage QUA module dùng chung** - ✅ XONG
      22/08 (phiên 17). Trích `createRateLimit`+`callerIp` thành `@tsudev/ratelimit`
      (reference ở 3 tsconfig; Dockerfile đã COPY packages/). content+storage gắn
      limiter `/api` MIỄN TRỪ lưu lượng mang `x-internal-token` đúng (BFF không
      chuyển IP client xuống, giới hạn không miễn trừ sẽ gộp cả site một xô); chỉ
      lưu lượng trực tiếp bị giới hạn theo IP thật. Ngưỡng env-chỉnh-được: content
      300, storage 120/phút. trust **87** · content **46** · storage **15**; cổng
      chung sạch. CHƯA phát hành (Render tự dựng khi merge - xem phiếu 03 §3).
- [ ] **🟡 B1. Đợt nâng cấp dependency major** (`infra-deploy` + `frontend-web`) -
      **🚧 PHIÊN 19 LÀM TỚI CÙNG → CHẶN CỨNG UPSTREAM, ĐÃ REVERT.** `next build
--webpack` với next@16 CHẠY XANH sau khi giải XONG 4 blocker (Turbopack→webpack ·
      React #31 dedup react19+Storybook8 · next-auth single-context · npm dedupe giữ
      lockfile). NHƯNG `@opennextjs/cloudflare@1.20.2` (bản MỚI NHẤT) **KHÔNG bundle
      được next@16** - `opennextjs-cloudflare build` chết 55 lỗi esbuild resolve
      next-server internals (cả 16.2.12 lẫn 16.3.2). Prod chạy Workers qua opennextjs
      ⇒ **không deploy được** ⇒ B1 bất khả cho tới khi opennextjs > 1.20.2 hỗ trợ
      next@16. Bằng chứng + lời giải 4 blocker: memory `nang-cap-next16-express5` +
      handover phiên 19. **Điều kiện thử lại**: `npm view @opennextjs/cloudflare
version` > 1.20.2. Prod hiện KHÔNG có CVE reachable nên KHÔNG chặn. Đo cũ phiên 18: sharp
      KHÔNG reachable prod (chỉ vào qua next/miniflare, Workers không chạy binary
      native); `next@16.3.2` clear TOÀN BỘ CVE high/critical prod
      (`npm audit --omit=dev` → còn 3 moderate qs non-reachable). NHƯNG next@16 là migration
      breaking nhiều mặt: Turbopack mặc định (alias tuyệt đối không nhận) · React
      #31 dual-copy khi prerender /admin · Sentry edge-runtime · middleware→proxy.
      Cần debug chuyên sâu + e2e 20/20 + mắt người + nghiệm thu prod. express@5
      (6 service breaking) không đáng vì qs non-reachable. Chi tiết: memory
      `nang-cap-next16-express5` + handover phiên 18. **Prod hiện KHÔNG có CVE
      reachable** - đợt này là dọn audit + vá loạt CVE next@15, không phải chặn.
- [ ] **⚪ C1. (tuỳ chọn) Siết CSP** (`frontend-web`) - bỏ style-src unsafe-inline +
      thu hẹp connect-src. **Đánh giá phiên 18: cả hai phần chỉ nghiệm thu được
      trên prod HTTPS** (bài học #2), style-src unsafe-inline "khó bỏ" (Next/Tailwind
      chèn style nội tuyến), connect-src cần đúng host R2 presign (ở secret). Ship
      mù = rủi ro vỡ style/upload IM LẶNG. Để lại như bước gated-prod của chủ dự án.
- [x] **⚪ Phase 0 (rẻ) - CODE XONG 22/08 (phiên 18).** Rà nốt 7/9 lỗi TS-migrate
      (#3-#9) bằng grep: TẤT CẢ đã vá (#3 basis enum, #4 certCard guard, #5/#6
      instanceof, #7 qStr+Array.isArray, #8 routeParam, #9 `|| 'Khác'`). Đóng memory
      `loi-that-typescript-bat-duoc` (giữ làm tham chiếu lịch sử). Mắt người:
      **đăng nhập GitHub thật ✅ chủ dự án xác nhận CHẠY trên prod (22/08, phiên 19)** - auto-link OAuth hoạt động. CÒN 1 mục: DevTools prod /admin,/login Console
      sạch dòng CSP vi phạm.

### Đã hoàn thành trước đợt này (giữ tham chiếu)

- [x] **🔴 BƯỚC 3: bấm nút "Hồi sinh việc đã dừng"** - ✅ chủ dự án đã bấm
      (21/08). Nghiệm thu `npm run newsroom:check`: AgentRun **220 → 224** (+4 lượt).
      Toà soạn chạy thật.

- [x] **🔴 GitHub Actions không chạy được - ĐÃ KHẮC PHỤC 21/08 (phiên 13).**
      Nguyên nhân: repo Private + GitHub Free 2.000 phút/tháng, tài khoản vướng
      thanh toán ⇒ mọi job fail 4s (không chạy dòng nào). **Cách sửa: chuyển repo
      `tsudev` sang PUBLIC** (Actions miễn phí không giới hạn phút cho repo công
      khai). Nghiệm thu: chạy lại run `32473196835` → 5/5 job **success** (Lint ·
      E2E smoke · Build frontends · Migrate & test · WASM). Trước khi Public đã
      quét secret cả tree lẫn 164 commit history: sạch (chi tiết phiếu phiên 13).

- [x] **🔴 GỘP PR #37** - ✅ chủ dự án đã MERGED (`a8cfde9`, 20/08). Render tự dựng lại backend.
- [x] **🟠 GỘP PR #38** - ✅ chủ dự án đã MERGED (`a8248a4`, 21/08). Local về
      `main`, nhánh đã xóa.
- [x] **🟠 Gửi hai gói đẩy ngược lên repo quy ước trung tâm** - ✅ 21/08 (phiên 13).
      Repo `tsudev-tsudev/tsudev-standards` đã tạo + bootstrap (10 file, `91038af`);
      hai gói mở thành Issue: [#1](https://github.com/tsudev-tsudev/tsudev-standards/issues/1)
      (token WCAG) · [#2](https://github.com/tsudev-tsudev/tsudev-standards/issues/2)
      (cấu trúc monorepo). Chờ QUYẾT ĐỊNH ở repo trung tâm.
- [x] **🟠 Xoay `NEWSROOM_TICK_TOKEN`** - ✅ HOÀN THÀNH 21/08 (phiên 12). Token cũ
      `mB50…` (lộ scrollback phiên 9) đã vô hiệu. Đổi đồng thời cả ba chỗ (Render
      `tsudev-backend`, Worker `tsudev-newsroom-cron`, backup). Nghiệm thu: curl
      Render 202, `newsroom:check` AgentRun 237 → 240. **Bài học**: base64 có `=`/`-`/`_`
      hay bị form web cắt khi dán → dùng `openssl rand -hex 32` (không ký tự đặc biệt).
- [x] **🟠 PHÁT HÀNH hệ AUTHOR/OWNER + đổi tên nhân sự** - ✅ HOÀN THÀNH 21/08
      (phiên 14), chủ dự án chạy. Migration `20260821200000_add_author_owner_roles`
      áp trên Neon (enum có AUTHOR/OWNER); `seed-newsroom.js` prod (4 agent đổi
      tên); SQL nâng `tsudev`→OWNER; frontend deploy Cloudflare
      (`/api/auth/providers` chỉ credentials+passkey); backend Render **Live**.
      **Hotfix kèm theo (PR #42, `e759dce`)**: nâng OWNER làm lộ regression -
      `auth-service requireAdmin` so `role === 'ADMIN'` bằng đúng nên OWNER bị 403
      ở mã mời Con dấu. Đã đổi sang `hasAtLeastRole`. CÒN LẠI: nghiệm thu RBAC
      bằng mắt (dưới đây).
- [x] **🟠 Hoàn thiện kiến trúc TÀI KHOẢN/ĐĂNG NHẬP - đợt 1: Xác minh email +
      Đổi email an toàn** - ✅ CODE-COMPLETE 21/08 (phiên 15). Chi tiết ở mục "Đã
      hoàn thành" dưới. Cổng chung sạch; auth 85 · content 44 · bundle 15. **ĐÃ
      PHÁT HÀNH prod 22/08** (xem record trên cùng mục Đã hoàn thành). Quyết định chủ dự án: **chặn mềm
      ân hạn 7 ngày**; sau ân hạn chưa xác minh thì chặn **đăng bài (AUTHOR ghi
      Post) + nâng vai trò tự phục vụ (mã mời)** - KHÔNG đụng Con dấu (giữ ngoài
      vùng trust-seal). Chuỗi: `@tsudev/types` (helper `emailUsable`, ân hạn 7d) →
      `packages/db` (enum `EMAIL_CHANGE` + cột `AuthToken.newEmail` + migration;
      seed `tsudev`→verified) → `auth-service` (`verify/resend`, `email/change`,
      `confirm-email-change` + cổng `emailUsable` ở `invite/redeem`) →
      `content-service` (cổng ở 3 route ghi Post) → frontend (profile: trạng thái/
      đếm ngược/gửi lại/đổi email; trang confirm; mở 2 proxy allowlist; accounts
      hiện ân hạn) → qa-test. Hạ tầng xác minh CƠ BẢN đã có sẵn (verify-email,
      AuthToken, mailer Resend) - đợt này BỔ SUNG chứ không dựng lại.
- [x] **🟠 Kiến trúc TÀI KHOẢN - đợt 2: Nhật ký bảo mật (audit log)** - ✅
      CODE-COMPLETE 21/08 (phiên 15). Chi tiết ở mục "Đã hoàn thành" dưới. Cổng
      chung sạch; auth **91** · bundle 15. **ĐÃ PHÁT HÀNH prod 22/08**. Quyết
      định chủ dự án: ghi ĐẦY ĐỦ (gồm IP + User-Agent), làm CẢ
      HAI bề mặt (user "Hoạt động gần đây" + console OWNER xuyên tài khoản). **Tách
      model `SecurityEvent` RIÊNG** (không đổ vào `TrustAuditLog` vì trust-service
      dùng nặng + console `/api/trust/admin/audit` sẽ ngập nếu chứa mọi lượt đăng
      nhập). Sự kiện admin/vai trò (invite/useradmin) giữ nguyên ở TrustAuditLog.
      Chuỗi: `packages/db` (model + migration) → `auth-service` (helper `logSecurity` + ghi ở các điểm: login, đăng ký, đổi/đặt lại mật khẩu, xác minh/đổi email,
      bật/tắt 2FA, thêm/xoá passkey; 2 endpoint đọc: own + OWNER) → frontend
      (/settings/security mục "Hoạt động gần đây" + trang /admin/security + proxy)
      → qa-test. Prune 90 ngày.
- [x] **🟡 Nghiệm thu RBAC bằng MẮT NGƯỜI trên prod** - ✅ chủ dự án xác nhận hoàn
      thiện (22/08, phiên 16). Chi tiết ma trận bên dưới giữ để tham chiếu.
      tsudev (OWNER) tạo tài
      khoản thử từng vai trò qua `/admin/accounts` (mật khẩu tự đặt, xoá sau),
      đối chiếu ma trận: OWNER=mọi thứ · ADMIN=admin nhưng KHÔNG accounts ·
      MODERATOR/AUTHOR/VIP=Con dấu, không admin · MEMBER=không gì. **KHÔNG** bơm
      tài khoản dev (alice/bob, mật khẩu `tsudev-dev-2026!`) vào prod. Kiểm tsudev
      cấp/thu hồi mã mời Con dấu chạy (hết 403 sau khi `e759dce` Live).
- [x] **⚪ Trình soạn/đăng bài cho AUTHOR** - ✅ CODE-COMPLETE 21/08 (phiên 15).
      content-service có `/api/author/posts` (list·create·get·patch·delete) gác
      `requireAuthor` (đọc DB, fail closed), SCOPE cứng `authorId === me`; proxy
      `/api/content/author/*` + prefix `/api/author` trong backend-bundle; trang
      `/author` (editor list+form). Test `author.test.ts` 11 + routing +1. Còn:
      **(a)** ✅ link "Viết bài"→`/author` ở header (SiteHeader NAV, gác
      `needsAuthor` = `hasAtLeastRole(role,'AUTHOR')`, ẩn với người chưa đủ quyền - giấu link, KHÔNG phải cổng; hiện cả nav desktop lẫn di động) - HOÀN THÀNH
      21/08 (phiên 15), **PR #45 merged** (`12c67a6`); **(b)** phát hành prod
      (deploy) - CHƯA; **(c)** e2e tuỳ chọn.
- [x] **🟡 Rà giao diện bằng MẮT NGƯỜI** - ✅ chủ dự án xác nhận hoàn thiện (22/08,
      phiên 16). Công cụ: `npm --workspace packages/ui run storybook`, nút **Giao
      diện** đổi ba chế độ trên thanh công cụ.

- [ ] **QU-STD-1** Di trú `tokens/` sang `.standards/tokens/` (nguồn chân lý duy
      nhất). Hiện có **17 file mã nguồn** đọc token cục bộ. ⚠️ **ĐÁNH GIÁ LẠI
      25/08 (phiên 24) - KHÔNG còn phá vỡ về MÀU**: `.standards/` v2.8.0 đã nhận
      đề xuất token, nên khối `color` chuẩn nay mang đúng giá trị mà
      `extensions.tsudev-web` đang ghi đè (`text-muted` `#52627A`/`#5E5646`/`#9BB0C9` + `border-control` `#74899F`/`#8E8064`/`#6E88AE`, `border-strong` giữ nguyên).
      Đo: `diff` khối `color` local vs `.standards/` chỉ lệch đúng `text-muted`
      (bản local là v1.0.0 cũ, bị extensions đè trong cùng scope `:root` nên
      **không** hiệu lực) và khoảng trắng trong `rgba()`. Việc còn lại là **cơ khí**
      (repoint 17 file + gỡ ghi đè dư thừa + `tokens:sync`), rủi ro thấp hơn nhãn
      cũ nhiều. Vẫn nên chụp lại ảnh giao diện để nghiệm thu.
- [x] **QU-STD-2** ✅ XONG 24/08 (phiên 23). Xóa 3 bản sao v1.0.0 đã lỗi thời
      (`.standards/` là v2.0.0): `docs/DESIGN_SYSTEM.md`, `docs/PROJECT_STRUCTURE.md`,
      `docs/templates/HANDOVER.md` (+ thư mục `docs/templates/` rỗng). Repoint 12 tham
      chiếu SỐNG sang `.standards/docs/…` (comment ở packages/ui, apps/frontend-main,
      scripts, tokens/design-tokens.json format-block, AGENTS.md §B, CHANGELOG,
      docs/{design-system,architecture}.md); `.prettierignore` bỏ 3 dòng chết. GIỮ hồ
      sơ đóng băng (logs/handover, HANDOFF/STATE lịch sử) + `structure-upstream-proposal.md`
      (nêu tên v1.0.0 làm chủ đề đề xuất). Cổng: tokens·topology·format XANH.
- [ ] **QU-STD-3** Rà chỗ dùng `border-strong` cho viền nút phụ hoặc ô nhập, đổi sang `border-control` (`.standards/docs/DESIGN_SYSTEM.md` mục 1).
- [ ] **QU-STD-4** Chuyển `NEXT_PUBLIC_MAIN_URL` ra khỏi `apps/frontend-main/.env.production` (dùng ở 18 chỗ gồm `scripts/deploy-frontend.js`, `render.yaml`, `config/topology.json`), rồi xóa dòng miễn trừ trong `.standards-allow`. Miễn trừ **hết hạn 31/12/2026**.

## Đang thực hiện

| Task      | Agent | Bắt đầu |
| --------- | ----- | ------- |
| _(trống)_ |       |         |

## Đã hoàn thành (mới nhất trên cùng)

- 25/08/2026 - **PHÁT HÀNH frontend Cloudflare - chương trình editor nâng cấp LIVE
  đủ ba tầng** (phiên 24, chủ dự án chạy lệnh, agent nghiệm thu). Version
  **`2c9dd20c`**; `.env.local` dời khỏi bản dựng rồi trả lại. Nghiệm thu XANH toàn
  bộ (bảng đầy đủ ở phiếu [`20260825-01`](handover/20260825-01_ket-phien-24.md) §7).
  Điểm đáng nhớ: **tìm không dấu chạy thật trên prod** - `bao mat` cho đúng 7 kết quả
  như `bảo mật`, `tuong tac` đúng 3 như `tương tác`. Hai mục **chưa nghiệm thu được vì
  chưa có dữ liệu** (references + ảnh bìa), không phải mã hỏng. **Bài học mới, đã ghi
  vào phiếu**: nghiệm thu tính năng mới trên prod phải đọc PAYLOAD (`__NEXT_DATA__`/
  API), đừng `grep` chuỗi hiển thị - phiên này grep "Nguồn tham khảo" trúng 2 bài
  nhưng đó là VĂN BẢN THÂN BÀI do agent AI viết, còn `references` thật là `[]`; và
  một script đo dò sai tên khoá JSON (`items` thay vì `data`) suýt kết luận "search
  hỏng". Cùng loại bài học §0.7 #4, sai được theo CẢ HAI chiều.
- 25/08/2026 - **Đóng hai đề xuất đẩy ngược lên repo quy ước trung tâm** (phiên 24,
  `docs-curator`). Đối chiếu `.standards/` **v2.8.0** (`bf4ea54`): **cả hai đề xuất
  đã được nhận NGUYÊN VĂN**. (1) Token - `text-muted` = `#52627A`/`#5E5646`/`#9BB0C9`
  (khớp bảng A), `border-control` mới = `#74899F`/`#8E8064`/`#6E88AE` (khớp bảng B),
  `border-strong` **giữ nguyên** mã cũ và `DESIGN_SYSTEM.md` §1 nay tách vai trò
  trang trí vs vùng tương tác + ngưỡng 3:1 (WCAG 1.4.11). (2) Cấu trúc -
  `PROJECT_STRUCTURE.md` tách **§1 Hình trạng A** / **§2 Hình trạng B - monorepo**,
  còn thêm bảng phân biệt `services/` gốc repo (tiến trình độc lập) vs `src/services/`
  trong app - đúng chỗ dễ nhầm nhất mà đề xuất gốc chưa nêu. **Issue #1 + #2 ở
  `tsudev-tsudev/tsudev-standards` đã CLOSE** kèm bảng đối chiếu. Hai file
  `docs/*-upstream-proposal.md` GIỮ LẠI làm hồ sơ đo, đổi header sang "ĐÃ ĐƯỢC NHẬN".
  **Phát hiện kèm theo, đổi bản chất QU-STD-1**: ghi đè cục bộ nay TRÙNG KHÍT chuẩn
  ⇒ di trú không đổi pixel (chi tiết ở mục QU-STD-1). **Sửa 2 link CHẾT**:
  `docs/README.md` còn trỏ `DESIGN_SYSTEM.md`/`PROJECT_STRUCTURE.md` đã bị QU-STD-2
  xoá (bỏ sót vì lần đó chỉ repoint tham chiếu dạng text) → trỏ `.standards/docs/…`;
  §"Hai tài liệu viết HOA" viết lại (còn nói v1.0.0 + như thể file nằm trong `docs/`).
  `docs/architecture.md` §Điểm lệch: mục cây thư mục **hết lệch**, rút xuống một dòng
  khai báo Hình trạng B. Quét lại toàn bộ link trong `docs/README.md`: **0 link chết**.
  Cổng: format·tokens·topology XANH; 0 em/en-dash. **CÒN NỢ** (vùng `design-system`,
  không tự vượt biên): `$accessibility_gap` trong `tokens/design-tokens.json` vẫn ghi
  "bảng `color` chuẩn v1.0.0 KHÔNG đạt" - nay lỗi thời, nên viết lại khi làm QU-STD-1.
  `CLAUDE.md` mục Tài liệu cũng mô tả hai file là "gói đề xuất gửi ngược lên trung
  tâm" - sửa vào CUỐI phiên theo quy ước không bust cache.
- 24/08/2026 - **PHÁT HÀNH chương trình editor nâng cấp (backend+DB) + gộp 2 PR**
  (phiên 23, chủ dự án trao quyền tự chạy release + cấp Neon creds). (1) **Migration
  prod**: `prisma migrate deploy 20260824043047` trên Neon qua DIRECT_URL (datasource
  KHÔNG có `directUrl`, pooler không giữ được advisory lock → phải dùng URL non-pooled);
  status cuối "Database schema is up to date!". Additive/tương thích ngược. (2) **Merge**:
  PR #68 (editor Pha 1-7, kèm fix `export {}` cho `authoringEnhancements.test.ts` - CI
  bắt lỗi TS2451 global-collision mà local jest giấu) + PR #69 (QU-STD-2) squash vào
  `main` (`7f3b622`/`24e7805`) → Render autoDeploy backend (render.yaml KHÔNG khai
  `autoDeploy` ⇒ mặc định true). (3) **Reindex**: `search:reindex` prod = 35 bài
  backfill `search*Norm` (chạy sau `db:generate`; pooler URL OK cho query app).
  (4) **Nghiệm thu prod XANH**: homepage 200 có nội dung · /blog bài thật · providers
  sạch. **CÒN LẠI**: deploy frontend Cloudflare (classifier chặn agent - chủ dự án tự
  chạy `node scripts/deploy-frontend.js deploy`). Chi tiết + runbook: handover
  [`20260824-02`](handover/20260824-02_ket-phien-23.md).
- 24/08/2026 - **QU-STD-2: dọn bản sao quy ước trùng `.standards/`** (phiên 23, chủ
  dự án trao quyền tự chọn+chạy tới hoàn thành). `docs/DESIGN_SYSTEM.md` +
  `docs/PROJECT_STRUCTURE.md` cục bộ là **v1.0.0 lỗi thời**, `.standards/docs/` đã là
  **v2.0.0** (thêm `border-control`, bảng tương phản, hình trạng monorepo B). Xóa 3
  file trùng + repoint 12 tham chiếu sống → `.standards/docs/…` (chỉ comment/text, 0
  rủi ro runtime; `tokens.css` sinh lại qua `tokens:sync` sau khi sửa template trong
  `sync-tokens.js`). Cổng XANH: tokens·topology·format (chỉ cảnh báo
  `.claude/settings.local.json` gitignored). **Phát hiện phụ**: hai đề xuất đẩy ngược
  (`docs/{token,structure}-upstream-proposal.md`) DƯỜNG NHƯ đã được nhận vào v2.0.0
  của `.standards/` (border-control + hình trạng B đã có) - việc rà/đóng chúng thuộc
  docs-curator, NGOÀI phạm vi QU-STD-2. **Chưa commit** (chờ chủ dự án). QU-STD-3 phụ
  thuộc QU-STD-1 (token `border-control` chưa tồn tại tới khi QU-STD-1 xong).
- 24/08/2026 - **Chương trình editor nâng cấp: HOÀN TẤT Pha 2-7** (phiên 22, chủ
  dự án trao quyền tự quyết chạy thẳng). Kết quả đầy đủ ở [`handover/20260824-01`](handover/20260824-01_pha1-editor-nang-cap.md)
  §6. Tóm tắt:
  - **Pha 2 backend** (content-service): `readPostBody` nhận publishedAt/references/
    coverImageUrl/metaDescription (URL http/https-only chống XSS); MỌI đường ghi Post
    gọi `buildPostSearch`; đọc công khai thêm cổng lịch `publishedAt<=now()` + xếp
    theo publishedAt; endpoint `GET /api/posts/search` (đặt TRƯỚC `:slug`) chuẩn §7:
    q không dấu qua cột norm + trigram, ranking §5, facet tag, trần page_size 100;
    `/api/posts?tag=` lọc tag; script `search:reindex`.
  - **Pha 3 editor** (`/author`): sửa mọi trường + chọn thời gian đăng (datetime-local)
    - lên lịch (badge) + nguồn tham khảo nhiều dòng + ảnh bìa + SEO + đếm từ
      (viWordCount) + nút Xem trước (renderMarkdown chống XSS).
  - **Pha 4 công khai + search UI**: blog/[slug] render vùng "Nguồn tham khảo"
    (rel=noopener) + ảnh bìa + OG metaDescription + tag chip bấm được; blog index lọc
    `?tag=` + thanh chip; trang `/search` tương tác (debounce 350ms, AbortController,
    min 2 ký tự, highlight ánh xạ ngược `findMatchRanges`, ARIA combobox/listbox,
    keyboard ↑↓↵Esc, facet, sort, URL state, SSR ban đầu) + proxy `/api/search`.
  - **Pha 5 media**: `lib/md` render `![](url)` → `<img>`, đuôi video → `<video>`
    (src qua whitelist, alt escape - md.test 15/15 giữ nguyên); editor có nút tải
    ảnh/video + ảnh bìa lên object storage; storage presign/upload trả thêm
    `publicUrl` (từ S3_PUBLIC_ENDPOINT+bucket+key).
  - **Pha 6 agent AI**: newsroom `dispatcher` gọi `buildPostSearch` + đặt publishedAt
    - tự chọn ảnh bìa `pickCoverImage` (Pexels free-key, no-op nếu chưa cấu hình
      `PEXELS_API_KEY`) + ghi công tác giả ảnh vào references.
  - **Pha 7 test**: `authoringEnhancements.test.ts` (14): unit @tsudev/search (đ/Đ,
    NFC=NFD, wordcount, buildPostSearch, findMatchRanges) + write mọi trường + lịch
    ẩn/hiện + references validate 400 + search min-2/facet/page_size-cap + IDOR nháp
    không lọt search. **Rerun-safe** (chạy 2 lần).
  - **Cổng XANH toàn bộ**: typecheck·lint·format·topology·tokens; content 60 ·
    storage 15 · newsroom 49 · bundle 15 · frontend 40. **CHƯA commit/phát hành.**
- 24/08/2026 - **Pha 1 chương trình editor nâng cấp: nền dữ liệu + module search**
  (phiên 21). Chủ dự án chốt: publishedAt riêng · toàn bộ tính năng pro (lịch,
  preview, ảnh bìa/SEO, media ảnh/video, agent AI chèn ảnh) · references
  {label,url} · search đầy đủ chuẩn GĐ1-3. **Migration
  `20260824043047_upgrade_post_publishing_search`** (áp local + backfill
  `publishedAt=createdAt`): Post thêm `publishedAt, references Json, coverImageUrl,
metaDescription, searchTitleNorm, searchBodyNorm`; index `[published,publishedAt]`
  - GIN `tags` + 2 GIN trigram (`pg_trgm`/`unaccent`) trên cột chuẩn hoá; drift
    check **No difference**. **Package mới `@tsudev/search`** (dual Node+Workers,
    0-dep): `viRemoveDiacritics`/`viNormalizeText` (xử lý đ/Đ, §3.2) ·`viWordCount`·
    `stripToPlainText`·`buildPostSearch` (tính sẵn 2 cột lúc ghi). Đăng ký ở
    tsconfig gốc + services. Cổng: typecheck·lint·format·topology **xanh**; smoke-test
    6/6 (đ/Đ, NFC=NFD, không dấu, wordcount, strip md). **Quyết định**: KHÔNG đổi
    `published` boolean → enum; lịch suy ra `published=true`+publishedAt tương lai.
    **Chưa commit, chưa phát hành.** Kế tiếp Pha 2 (backend-api): `readPostBody` mở
    rộng + `buildPostSearch` khi ghi + đường đọc lọc `publishedAt<=now()` + endpoint
    `/api/posts?q=&tag=&sort=&page=` chuẩn §7 + `search:reindex` backfill 2 cột cho
    bài cũ.
- 24/08/2026 - **Dọn nhánh stale + xác minh main xanh** (phiên 20, chủ dự án trao
  quyền tự quyết). B1 vẫn chặn (opennextjs vẫn 1.20.2). Xóa 4 nhánh merged
  (`feat/next16-upgrade`, `docs/oauth-live`, `fix/nut-hoi-sinh-viec-da-dung`,
  `refactor/giao-dien-quy-uoc-v1`); **2 nhánh còn cần `git branch -D`**
  (`docs/ket-phien-15`, `fix/phase-a-ssrf-ratelimit` - đã ở main, classifier chặn
  force-delete). Cổng chung XANH: lint·typecheck·topology·tokens (format chỉ cảnh
  báo `.claude/settings.local.json` gitignored). **typecheck từng đỏ** ở
  trust-service (`Prisma.SealApplicationWhereInput`/`TrustCertificate` không
  export) do Prisma client cũ sau đợt install nhánh next16 → `npm run db:generate`
  hết đỏ; main KHÔNG đỏ thật. Không sửa mã, không khóa. Phiếu
  [`20260822-07`](handover/20260822-07_ket-phien-20.md).
- 22/08/2026 - **Đăng nhập GitHub thật trên prod ✅** (phiên 19, chủ dự án xác
  nhận). Auto-link OAuth chạy đúng - đóng 1/2 mục mắt người Phase 0. Còn lại:
  DevTools prod Console sạch dòng CSP vi phạm.
- 22/08/2026 - **Xác nhận PR #60 (Phase A) MERGED + phát hành** (phiên 19). Đầu
  phiên phát hiện PR #60 đã được chủ dự án gộp vào `origin/main` (`f994ed4`,
  07:40Z, CI 6/6 xanh) - local `main` còn cũ ở #59, đã fetch xác nhận. A1 (SSRF
  domainVerify) + A2 (audit → B1) + A3 (rate limit content/storage qua
  `@tsudev/ratelimit`) chính thức phát hành; Render tự dựng backend-bundle.
  **Nghiệm thu nhẹ**: `/api/trust/verify/<rác>` trả **401 JSON sạch** (auth-gated,
  phản hồi bình thường, không sập) = backend live. Flood 429 KHÔNG chạy trên prod
  (không nện 300+ lượt) - để chủ dự án đo có kiểm soát khi cần. **Hàng đợi cạn
  việc agent**: B1 (đợt migration riêng), C1 (gated-prod), Phase 0 (2 mục mắt
  người) đều chờ chủ dự án. Không sửa file mã, không khóa.
- 22/08/2026 - **B1 next@16: làm tới cùng, CHẶN CỨNG upstream, REVERT** (phiên 19,
  nhánh `feat/next16-upgrade`). Chủ dự án yêu cầu "làm mọi task". Giải XONG 4/5
  blocker: (1) Turbopack→`next build --webpack` (opennextjs tự theo qua buildCommand);
  (2) React #31 /admin prerender→dedup MỘT react 19 toàn workspace (packages/ui
  18→19 + **Storybook 7→8.6.18** vì SB7 peer react^18 chặn; gỡ webpack alias cũ);
  (3) next-auth split SessionContext (useSession undefined khi prerender)→một bản
  next-auth ở root (thêm root devDep + peer ở packages/ui, KHÔNG dev-dep packages/ui);
  (4) npm 10.9.8 rớt dep khi `rm package-lock.json`→giữ lock main, install tăng dần
  - `npm dedupe`. `next build --webpack` XANH (CI "Build frontends" sẽ qua). **Blocker
    #5 CHẶN CỨNG**: `@opennextjs/cloudflare@1.20.2` (bản mới nhất, không canary) KHÔNG
    bundle được next@16 - `opennextjs-cloudflare build` chết 55 lỗi esbuild resolve
    next-server internals (`.open-next/.../next-server.js` → `./node-environment`,
    `../shared/lib/utils`…), cả next@16.2.12 lẫn 16.3.2. Prod = Workers qua opennextjs
    ⇒ không deploy được ⇒ **B1 bất khả cho tới khi opennextjs hỗ trợ next@16**. Đã
    REVERT sạch về next@15 (cây = main, chỉ log khác; lockfile khớp main). Lời giải
    4 blocker ghi memory `nang-cap-next16-express5` để lần sau khỏi dò lại. **C1 KHÔNG
    làm** (chỉ nghiệm thu prod HTTPS được, ship mù = hỏng im lặng - giữ nguyên quyết
    định phiên 18). Phiếu [`20260822-06`](handover/20260822-06_ket-phien-19.md).
- 22/08/2026 - **Phase 0 (code) + đo B1 + đóng gói Phase A** (phiên 18). **Phase 0**:
  rà 7/9 lỗi TS-migrate còn lại (#3-#9) bằng grep - tất cả đã vá; đóng memory
  `loi-that-typescript-bat-duoc`. **B1 đo-rồi-revert**: next@16.3.2 clear toàn bộ
  CVE high/critical prod (`audit --omit=dev` → 3 moderate qs non-reachable) NHƯNG
  migration breaking nhiều mặt (Turbopack default · React #31 dual-copy prerender ·
  Sentry edge · middleware→proxy) - không ship, revert sạch về next@15; ghi memory
  `nang-cap-next16-express5`. Sharp/qs đều không reachable prod ⇒ **prod không có
  CVE reachable**; B1 để đợt riêng, express@5 không đáng. **C1 hoãn** (chỉ nghiệm
  thu prod HTTPS được). **Phase A đóng gói thành PR** (chủ dự án cho phép push);
  cổng chung sạch, test trust 87 · content 46 · storage 15. Phiếu
  [`20260822-05`](handover/20260822-05_ket-phien-18.md).
- 22/08/2026 - **Phase A đợt khắc phục triệt để: SSRF + rate limit** (phiên 17).
  A1 vá SSRF `domainVerify` (guarded lookup ghim IP + redirect thủ công, đóng cả
  TOCTOU lẫn lỗ redirect-SSRF mới phát hiện; 30 test). A2 điều tra npm audit:
  không có bản vá non-breaking, dời sang B1. A3 trích `@tsudev/ratelimit` (module
  dùng chung, chủ dự án chốt) + gắn content/storage với mô hình miễn-trừ-token
  (BFF không forward IP client). Cổng chung sạch; trust 87 · content 46 ·
  storage 15. **CHƯA phát hành, CHƯA commit** (để chủ dự án review). Phiếu
  [`20260822-04`](handover/20260822-04_ket-phien-17.md) + [`20260822-03`](handover/20260822-03_ke-hoach-khac-phuc-triet-de.md).
- 22/08/2026 - **Sửa CSP runtime: chặn inline script trên /admin,/login** (phiên 16).
  Chủ dự án soi DevTools prod thấy CSP chặn inline script ở /admin,/login. **ĐO**:
  mỗi trang prod có script inline #2 `window.__CF$cv$params...` (nạp
  `/cdn-cgi/challenge-platform/scripts/jsd/main.js`) - **Cloudflare Bot Fight Mode
  "JavaScript Detections"** chèn ở TẦNG EDGE, tham số đổi mỗi request nên **hash
  không phủ được** (không có trên local/`next start` - chỉ hiện prod). **Fix: CSP
  băm + NONCE**, chuyển về `middleware.ts` (nonce per-request). Băm phủ THEME_SCRIPT
  (chạy cả trang tĩnh); nonce phủ JSD (CF tự đọc nonce từ CSP response header và gắn
  - xác nhận qua tài liệu CF). KHÔNG luồn nonce vào Next/\_document (script Next là
    self/external) → né lỗi prerender tĩnh. `next.config.js` bỏ CSP (giữ header tĩnh
    khác). Test `csp.test.ts` (7): hash khớp nguồn (drift-guard) · nonce đổi mỗi
    request · beacon · không unsafe-inline · dev không CSP · redirect không CSP.
    **ĐÃ PHÁT HÀNH prod** (PR #57, Version `19422ca7`). Nghiệm thu prod: header có
    hash+nonce+beacon, 0 unsafe-inline; và **script JSD của CF nay MANG `nonce` KHỚP
    nonce trong CSP header** (vd /admin `ksgSYI08…` = `<script nonce="ksgSYI08…">`) -
    chính script trước bị chặn nay được nonce hợp lệ phủ, đúng như tài liệu CF. Lỗi
    hết ở tầng HTML/header. CÒN LẠI (mắt người): DevTools prod /admin,/login Console
    phải sạch dòng CSP vi phạm.
- 22/08/2026 - **PHÁT HÀNH prod: ép CSP (băm) + en-dash - LIVE** (phiên 16). PR #55
  CI 6/6 xanh → merged vào `main` (`b785994`) → deploy Cloudflare qua
  `scripts/deploy-frontend.js` (**Version `e000fe9b`**, `.env.local` được dời khỏi
  build rồi trả lại). **Nghiệm thu đo HÀNH VI trên prod** (`/` và `/trust`): CSP
  header **ép thật** (không Report-Only) = `script-src 'self'
'sha256-y2cjX…ZdXg=' https://static.cloudflareinsights.com`, băm khớp nguồn,
  allowlist beacon CF, **0 unsafe-inline** trong script-src; `/api/auth/providers`
  = credentials·passkey·github·google (không rò dev); homepage 200; 0 em-dash trên
  mọi trang. Beacon CF không thấy qua curl là bình thường (CF chỉ chèn cho trình
  duyệt thật). **CÒN LẠI (mắt người)**: mở DevTools prod, Console phải KHÔNG có
  dòng CSP vi phạm nào - runtime thật trên HTTPS mà curl không đo được.
- 22/08/2026 - **Allowlist beacon Cloudflare Web Analytics vào CSP** (phiên 16).
  Chủ dự án soi DevTools prod thấy cảnh báo CSP với `static.cloudflareinsights.com`
  - beacon do CF chèn ở TẦNG EDGE (sau khi rời Worker) nên không có trong HTML mà
    `next build` local sinh ra, mọi test ở máy này mù với nó (đúng loại "lỗi chỉ
    sống trên prod/HTTPS"). Thêm host vào `script-src` (đường POST beacon đã nằm
    trong `connect-src https:`). Test canh allowlist này.
- 22/08/2026 - **G - ÉP CSP THẬT (hết Report-Only)** (phiên 16, vùng frontend-web).
  Chủ dự án cho phép khởi động. **Dùng BĂM SHA-256 của THEME_SCRIPT, KHÔNG dùng
  nonce** - xem Quyết định bên dưới vì sao đổi hướng giữa chừng. `next.config.js`:
  `themeScriptHash()` đọc THEME_SCRIPT từ `_document.tsx` (một nguồn, không
  hardcode) → `Content-Security-Policy` ép thật `script-src 'self' 'sha256-…'`
  (bỏ `'unsafe-inline'`), CHỈ ở production (dev bỏ qua để HMR sống - `headers()`
  hoá tĩnh lúc build nên NODE_ENV tự tách). Giữ `style-src 'unsafe-inline'`
  (Next/Tailwind) + `connect-src https:` (presign R2). middleware.ts và
  \_document.tsx GIỮ NGUYÊN (đã thử nonce rồi revert). Test `csp.test.ts` (4): gọi
  thẳng `next.config.headers()`, đối chứng băm độc lập, canh dev-không-CSP.
  **Nghiệm thu RUNTIME** (`next build && next start`): trang tĩnh (/signup) lẫn
  động (/blog,/login,/trust) đều enforcing + băm khớp header + 0 nonce + 0
  unsafe-inline + đúng 1 inline script (THEME_SCRIPT, khớp băm); HTML không có
  script cross-origin / inline handler / `javascript:` → không vi phạm nào. Cổng
  chung sạch; frontend-main jest **36**. CHƯA phát hành (chờ deploy Cloudflare).
- 22/08/2026 - **Nghiệm thu RBAC + rà giao diện Storybook** - ✅ chủ dự án xác nhận
  hoàn thiện (phiên 16). Gộp PR #3 `tsudev-standards` cũng đã MERGED.
- 22/08/2026 - **Thống nhất en-dash `-` → hyphen `-`** (phiên 16). Chủ dự án quyết
  thống nhất luôn. Chuyển en-dash (U+2013) trên **16 file** (hầu hết khoảng số:
  `đợt 1-5`, `:4001-:4005`, `3-32 ký tự`, `14-15px`, `4000-4003`). **GIỮ 4 chỗ cố
  ý** (trích ký tự `-` để dạy luật): `AGENTS.md:74`, `CLAUDE.md:168`,
  `STATE.md:113`, `handover/20260822-01:59`. **AGENTS.md chỉ sửa dòng 212 (Phần
  B, khoảng số), giữ dòng 74 Phần A.** `docs/DESIGN_SYSTEM.md` KHÔNG đụng - BẤT
  KHẢ XÂM PHẠM (repo trung tâm); 4 en-dash typography còn lại ở đó (`400-480px`,
  `14-15px`…) là việc của repo `tsudev-standards` (đưa vào PR #3 nếu chủ dự án
  muốn). Nghiệm thu: typecheck·lint·format(file đã sửa)·tokens·topology sạch.
  Migration không đụng (bất biến). CHƯA phát hành prod (thay đổi text/comment,
  không đổi hành vi runtime).
- 22/08/2026 - **PHÁT HÀNH: gạch ngang (#52) + OAuth link-fix (#51) LIVE** (phiên
  15). Deploy frontend Cloudflare (Version `ea433300`) từ `main` sau khi gộp #52;
  backend Render tự dựng từ #51/#52. **Deploy SẠCH, không còn config-drift** vì 4
  OAuth secret giờ là encrypted secret (tách khỏi config) - chứng minh: providers
  vẫn `credentials·passkey·github·google` sau deploy (plaintext var trước đây bị
  xoá mỗi lần deploy, encrypted thì sống sót). OAuth link-fix live (frontend
  `resolveOAuthEmail` qua GitHub `/user/emails`; backend auto-link theo email đã
  verified). CÒN LẠI cho chủ dự án: thử lại đăng nhập GitHub (giờ liên kết vào
  đúng tài khoản Google sẵn có); gộp PR #3 ở repo `tsudev-standards`.
- 22/08/2026 - **Thống nhất gạch ngang: em-dash `-` → hyphen `-` toàn repo** (phiên
  15, nhánh `chore/dash-hyphen`). Thay **374 em-dash** trên **29 file** (perl UTF-8
  `s/\x{2014}/-/g`). **NGOẠI LỆ bắt buộc**: `packages/db/prisma/migrations/**` giữ
  nguyên 2 em-dash trong comment SQL - migration BẤT BIẾN, đổi comment lệch checksum
  → prod không boot. tokens/ đổi được vì em-dash nằm ở comment/extensions, không
  phải khối `color` mà `tokens:check` so. En-dash `-` (17 file, hầu hết khoảng số
  đúng typography) CHƯA đụng - chờ chủ dự án quyết. **Quy ước mới** thêm vào
  `AGENTS.md` §6 + `CLAUDE.md` (Quy ước code): chỉ dùng `-`, không em-dash. Đồng
  bộ lên repo trung tâm `tsudev-standards` (bên dưới). Nghiệm thu: JSON hợp lệ ·
  typecheck · lint · format · tokens · topology sạch; ui 199.
- 22/08/2026 - **PHÁT HÀNH OAuth GitHub/Google - LIVE** (phiên 15). Chủ dự án đặt
  4 giá trị làm **encrypted secret** (`wrangler secret put`, không phải plaintext
  var) + xoá var plaintext. Frontend đã deploy code #49 (Version 18:57Z). **Nghiệm
  thu hành vi**: `/api/auth/providers` = credentials·passkey·**github·google**;
  POST signin/github → `github.com/login/oauth/authorize` (scope `read:user
user:email`, redirect_uri `https://tsudev.com/api/auth/callback/github`); POST
  signin/google → `accounts.google.com/o/oauth2/v2/auth` (scope `openid email
profile`); client_id nạp đúng, secret KHÔNG lộ trong URL/providers. Còn lại:
  một lần đăng nhập OAuth THẬT để chạy callback + oauth/upsert (mắt người).
- 22/08/2026 - **Đăng nhập OAuth GitHub/Google (E)** (phiên 15, nhánh
  `feat/oauth-login`). Provider + nút /login + thông điệp `OAuthAccountNotLinked`
  đã có sẵn; đợt này dựng MẮT XÍCH còn thiếu: liên kết tài khoản.
  - **auth-service** `POST /api/identity/oauth/upsert` (INTERNAL, không auth
    middleware - người dùng chưa có danh tính): khoá liên kết là
    `(provider, providerAccountId)` KHÔNG phải email (chống chiếm TK). Chưa liên
    kết + email trống ⇒ 409 `oauth_no_email`; email đã thuộc user khác ⇒ 409
    `email_taken` (không tự gộp); else tạo User MEMBER + OAuthAccount, username
    sinh tự động duy nhất, emailVerifiedAt nếu bên thứ ba đã verify. Chống đua
    P2002. Không dùng migration (model `OAuthAccount` có sẵn).
  - **NextAuth** callback `signIn`: OAuth → gọi oauth/upsert → ghi danh tính
    chính tắc (username/role/sessionVersion) vào `user` để `jwt` đọc; thất bại ⇒
    `/login?error=OAuthAccountNotLinked`. Credentials/passkey đi thẳng.
  - Test `oauthLink.test.ts` (5). Nghiệm thu: typecheck·lint·format·topology·
    tokens sạch; auth **108** · bundle 15. **CHƯA phát hành**: cần chủ dự án đặt
    `GITHUB_CLIENT_ID/SECRET` + `GOOGLE_CLIENT_ID/SECRET` làm **Worker secret**
    (Cloudflare, KHÔNG phải Render - NextAuth chạy ở Worker) rồi deploy frontend.
    Redirect URI: `https://tsudev.com/api/auth/callback/{github,google}`.
- 22/08/2026 - **PHÁT HÀNH prod toàn bộ kiến trúc tài khoản (đợt 1-5)** (phiên 15).
  Chủ dự án chạy `prisma migrate deploy` trên Neon (migration đợt 1-5) + đặt
  `RESEND_API_KEY` trên Render. Frontend deploy Cloudflare qua
  `scripts/deploy-frontend.js` (Version `e2f67e96`, `.env.local` được dời khỏi
  build); backend Render tự dựng lại từ merge #46/#47. **Nghiệm thu đo HÀNH VI**:
  `/api/auth/providers` chỉ credentials+passkey · www→apex 308 · backend-bundle
  `/health` ok · confirm-email-change (đợt1) token rác→400 · account/security/events
  (đợt2)→401 · security/revoke-all (đợt3)→401 · account/deactivate+delete (đợt4)→401
  · trang /confirm-email-change render 200 có nội dung. Tất cả 5 đợt LIVE. CÒN LẠI:
  E (OAuth) + G (nonce CSP) chờ chủ dự án; nghiệm thu RBAC/giao diện bằng mắt người.
- 22/08/2026 - **Củng cố tài khoản (đợt 3-5 kiến trúc tài khoản)** (phiên 15,
  nhánh `feat/account-hardening`). E (OAuth) BỎ QUA đợt này (cần chủ dự án tạo
  OAuth app + secret); G (ép CSP) GIỮ Report-Only theo quyết định - chỉ rà soát.
  - **Đợt 3 (B+C, `cbfa254`)**: `POST security/revoke-all` tự đăng xuất mọi thiết
    bị (nút ở /settings/security + update() giữ tab). Thư cảnh báo `securityAlertHtml`:
    đăng nhập thiết bị/vị trí LẠ (IP chưa từng thấy), đổi mật khẩu, tắt 2FA, gỡ
    passkey, đổi vai trò. Fire-and-forget. Test sessionRevoke (2).
  - **Đợt 4 (D, `7c96d61`)**: vòng đời tài khoản. `User.deactivatedAt` +
    `deletionScheduledAt` + migration. `account/deactivate` (mềm, đăng nhập lại
    khôi phục); `account/delete` (hẹn xoá 30 ngày, đăng nhập trong hạn huỷ, quá
    hạn purge + login 401; OWNER 403). `handleLifecycleOnLogin` ở cả 2 đường
    login. Frontend "Vùng nguy hiểm" + badge /admin/accounts. Test accountLifecycle (5).
  - **Đợt 5 (F, `0038efb`)**: chặn mật khẩu rò rỉ HIBP k-anonymity (chỉ gửi 5 ký
    tự đầu SHA-1), FAIL-OPEN, fetcher tiêm được, test env không gọi mạng. Chặn ở
    4 điểm ghi mật khẩu + thông điệp frontend. Test breachCheck (5).
  - **G - rà soát CSP**: đã Report-Only có chủ đích. Blocker để ép: `script-src
'unsafe-inline'` (THEME_SCRIPT ở \_document + bootstrap Next) cần nonce qua
    middleware; `style-src 'unsafe-inline'` (Next/Tailwind) khó bỏ; `connect-src
https:` rộng nhưng cần cho presign R2. Không flip - cần một đợt nonce riêng.
  - Nghiệm thu: typecheck·lint·format·topology·tokens sạch; auth **103** ·
    content 44 · bundle 15. **ĐÃ phát hành prod 22/08** (record trên cùng).
- 21/08/2026 - **Nhật ký bảo mật (đợt 2 kiến trúc tài khoản)** (phiên 15, chuỗi
  `data-schema`→`auth-service`→`frontend-web`). **Model `SecurityEvent` RIÊNG**
  (tách khỏi `TrustAuditLog` vì trust-service dùng nặng + console Con dấu sẽ ngập
  nếu chứa mọi lượt đăng nhập) + migration `20260821163458_add_security_event`.
  Ghi ĐẦY ĐỦ IP + User-Agent.
  - **auth-service**: helper `logSecurity` (fire-and-forget, prune 90 ngày ngay ở
    đường ghi - Render free không có cron thường trực). Điểm ghi: `login`
    (mật khẩu + passkey), `account_created`, `email_verified`, `password_change`,
    `password_reset`, `email_change_request`, `email_changed`, `totp_enabled`,
    `totp_disabled`, `passkey_added`, `passkey_removed`, `role_changed`,
    `sessions_revoked`. Hành động admin ghi vào timeline của TARGET, `byAdmin`+
    `actorName`. Hai endpoint đọc: `security/events` (own, 50) và
    `useradmin/security` (OWNER, 200, xuyên tài khoản, kèm username).
  - **frontend**: component dùng chung `SecurityEventList` (nhãn loại sự kiện +
    rút gọn UA→"Trình duyệt · OS"); `/settings/security` thêm mục "Hoạt động gần
    đây"; trang mới `/admin/security` (OWNER-gated, bám phản hồi 401/403) + thẻ ở
    `/admin`; mở proxy allowlist (`security/events`, `useradmin/security`).
  - **Test**: `securityLog.test.ts` (6) - ghi kèm IP · phạm vi đọc own vs OWNER ·
    người thường 403 · hành động admin vào timeline target. Nghiệm thu:
    typecheck·lint·format·topology·tokens sạch; auth **91/91**, bundle **15/15**.
    CHƯA phát hành prod.
- 21/08/2026 - **Xác minh email + Đổi email an toàn (đợt 1 kiến trúc tài khoản)**
  (phiên 15, chuỗi xuyên vùng một phiên điều phối). Hạ tầng xác minh CƠ BẢN đã có
  sẵn (register→verify-email, AuthToken, mailer Resend) - đợt này BỔ SUNG:
  - **Chặn MỀM ân hạn 7 ngày**: helper thuần `emailUsable`/`emailGraceRemainingMs`
    - `EMAIL_VERIFY_GRACE_DAYS=7` ở `@tsudev/types` (một nguồn, ba nơi dùng). Chưa
      xác minh + quá 7 ngày ⇒ chặn **đăng bài** (content-service `requireVerifiedAuthor`
      ở POST/PATCH/DELETE `/api/author/posts`; đọc list/get VẪN mở) và **nâng vai
      trò tự phục vụ** (auth-service cổng ở `invite/redeem`, TRƯỚC khi xét mã). KHÔNG
      đụng Con dấu (ngoài vùng trust-seal, theo quyết định).
  - **Gửi lại xác minh**: `POST /api/identity/verify/resend` (auth), no-op nếu đã
    xác minh, cooldown 60s chống dội thư.
  - **Đổi email hai bước "xác minh trước, thay sau"**: `email/change` (auth, đòi
    mật khẩu; địa chỉ đã có chủ ⇒ phản hồi giống nhau chống dò, không phát token)
    → token `EMAIL_CHANGE` mang `newEmail`, gửi thư tới địa chỉ MỚI →
    `confirm-email-change` (công khai, token) đổi email + set verified + **tăng
    sessionVersion** (đá phiên) + báo địa chỉ CŨ. Xử lý địa chỉ bị chiếm giữa
    chừng ⇒ 409.
  - **Data**: enum `AuthTokenPurpose.EMAIL_CHANGE` + cột `AuthToken.newEmail` +
    migration `20260821160912_add_email_change_token` (áp sạch local); seed
    `tsudev`(OWNER)→`emailVerifiedAt` (dứt điểm "chưa xác minh" ở /admin/accounts).
  - **Frontend**: `/settings/profile` thêm mục "Email và xác minh" (badge trạng
    thái + đếm ngược ân hạn + nút gửi lại + form đổi email); trang
    `/confirm-email-change`; mở proxy allowlist (`verify/resend`,`email/change` ở
    account; `confirm-email-change` ở identity); `/admin/accounts` hiện "còn ân
    hạn/quá hạn".
  - **Test**: auth `emailChange.test.ts` (11) + content `emailVerifyGate.test.ts`
    (7). Nghiệm thu: typecheck·lint·format·topology·tokens sạch; auth **85/85**,
    content **44/44**, bundle **15/15**. **ĐÃ phát hành prod 22/08** (record trên cùng).
- 21/08/2026 - **Link "Viết bài"→`/author` ở header** (phiên 15, vùng
  design-system). `SiteHeader` NAV thêm mục gác `needsAuthor`; điều kiện hiện =
  `hasAtLeastRole(session.role,'AUTHOR')` (mirror `useCanSeeTrust`) - giấu link
  cho người chưa đủ quyền, KHÔNG phải cổng (cổng thật là `requireAuthor` của
  content-service). Hiện ở cả nav desktop và di động (cùng mảng `nav`). Nghiệm
  thu: typecheck·lint·format·tokens sạch; `packages/ui` 199/199. Đóng mục (a) của
  editor AUTHOR. **PR #45 đã MERGED vào `main`** (`12c67a6`, commit `79f9ad3`);
  nhánh đã xóa. CHƯA deploy prod (mục (b)).
- 21/08/2026 - **Editor AUTHOR (đăng/sửa bài của chính mình)** (phiên 15). Chuỗi
  `backend-api`→`frontend-web` (kèm chạm `backend-bundle`/test). content-service:
  5 route `/api/author/posts` gác `requireAuthor` (`hasAtLeastRole(role,'AUTHOR')`,
  đọc DB fail closed), MỌI truy vấn kẹp `authorId === me.id` → AUTHOR/ADMIN/OWNER
  đi đường này chỉ đụng bài của chính mình; bài của người khác trả **404** (không
  lộ tồn tại). `authorId`/`authoredByAgentId` do PHIÊN quyết định, không đọc từ
  body (test canh cướp tác giả). slugify tiếng Việt (bỏ dấu, đ→d). Xoá MỀM. Prefix
  mới `/api/author` thêm vào bảng backend-bundle + proxy `ALLOWED` + routing test
  (bằng chứng thân-401 tới đúng content). Frontend trang `/author` (list+form,
  gating bám phản hồi 403 của backend, noindex). Nghiệm thu: typecheck·lint·format·
  topology·tokens sạch; content-service **37/37** (chạy 2 lần, rerun-safe);
  backend-bundle **15/15**. CHƯA phát hành; link header là handoff design-system.
- 21/08/2026 - **PHÁT HÀNH prod hệ AUTHOR/OWNER + hotfix OWNER≥ADMIN** (phiên 14).
  Chủ dự án chạy chuỗi prod: migrate Neon (enum AUTHOR/OWNER) · seed-newsroom
  (đổi tên 4 agent) · SQL nâng tsudev→OWNER · deploy Cloudflare · backend Render
  Live. **Hotfix PR #42 (`e759dce`)**: `auth-service requireAdmin` dùng
  `hasAtLeastRole` thay cho so `=== 'ADMIN'` bằng đúng (OWNER trên ADMIN từng bị
  403 ở mã mời Con dấu). Kèm 2 chỗ trust UI `alreadyIn` → `hasAtLeastRole(role,'VIP')`
  và test regression. Cả #40/#41/#42 CI xanh, main `e759dce` xanh.
- 21/08/2026 - **Hệ vai trò AUTHOR/OWNER + trang quản lý tài khoản** (phiên 14).
  Chuỗi xuyên vùng trọn gói: (data) `packages/types` thang role thêm AUTHOR (trên
  VIP) và OWNER (trần), `enum Role` + migration `20260821200000_add_author_owner_roles`
  (áp sạch trên PG, `ALTER TYPE ADD VALUE`), seed nâng `tsudev`→OWNER; (auth-service)
  6 endpoint `/api/identity/useradmin/*` gác `requireOwner` (đọc DB, fail closed):
  list·create·update·role·revoke·delete - **OWNER không bao giờ cấp được qua dữ
  liệu** (ASSIGNABLE_ROLES bỏ OWNER/GUEST), không tự-hạ/tự-xoá, không đụng OWNER
  khác, passwordHash không lộ; (frontend) trang `/admin/accounts` OWNER-gated +
  proxy `useradmin/*` + thẻ owner-only ở `/admin`. Test mới `useradmin.test.ts`
  **12/12** canh bất biến leo thang. Nghiệm thu: typecheck·lint·format sạch;
  auth-service **73/73**; bundle 14/14; migration áp + seed verify trên DB thật
  (4 agent đổi tên, tsudev=OWNER). **CHƯA phát hành** (xem ops bên dưới).
- 21/08/2026 - **Đổi tên 4 nhân sự Toà soạn** (phiên 14): scout-01 "Thợ săn tin",
  writer-01 "Biên tập viên", editor-01 "Tổng biên tập", seo-01 "Chuyên viên
  Marketing" (chỉ `displayName`; title/prompt giữ nguyên theo quyết định chủ dự
  án). Nguồn: `seed-newsroom.js`, lan sang DB qua upsert.update - đã verify local.
- 21/08/2026 - **Đính chính `CLAUDE.md` visibility** (phiên 14). Dòng bản đồ
  `private` → `Public (từ 21/08/2026)`; và dòng branch-protection: lý do cũ
  "(repo private)" nay sai - Public thì GitHub Free CHO phép branch protection,
  chỉ là chưa bật; ghi rõ đó là năng lực chưa dùng, `.husky/pre-push` vẫn là lớp
  chắn duy nhất. Đóng mục còn lại của phiếu 13 §2.
- 21/08/2026 - **Repo chuyển PUBLIC → CI hồi sinh** (phiên 13). Chủ dự án chạy
  `gh repo edit … --visibility public`; nghiệm thu `visibility=PUBLIC`. Chạy lại
  run `32473196835` → **5/5 job xanh** (billing-block đã thông vì repo công khai
  được Actions miễn phí không giới hạn). Trước khi Public: quét secret tree +
  164 commit history = sạch (chỉ mẫu/placeholder/fixture; `mB50…` là tiền tố
  token đã xoay). **Đã tạo repo quy ước trung tâm** `tsudev-tsudev/tsudev-standards`
  (Private - không chạy workflow nên 0 phút Actions, không chạm giới hạn).
  Bootstrap 10 file (`91038af`): AGENTS.md Phần A · DESIGN_SYSTEM · PROJECT_STRUCTURE
  · template HANDOVER · tokens.css + khối token dùng chung · hai proposal → Issue #1/#2.
- 21/08/2026 - **Gộp PR #38 + hồi sinh toà soạn** (phiên 12). Chủ dự án MERGED #38
  (`a8248a4`); local về `main`, xóa nhánh. Chủ dự án bấm "Hồi sinh việc đã dừng";
  `newsroom:check` xác nhận AgentRun **220 → 224** (+4). Soạn quy trình xoay
  `NEWSROOM_TICK_TOKEN` cho chủ dự án. Phiếu: `logs/handover/20260821-02`.
- 21/08/2026 - **Mở PR #38** cho `chore/storybook-chay-duoc` (phiên 11). #37 đã
  được chủ dự án gộp vào `main` (`a8cfde9`) nên diff của #38 sạch, chỉ còn
  Storybook + gỡ `@tsudev/utils` + hai gói đẩy ngược + docs. Cổng chung xanh
  (lint · typecheck · topology · tokens); MERGEABLE. Chờ chủ dự án bấm Merge.
- 20/08/2026 - **Storybook chạy được lần đầu**: hàng đợi ghi "thiếu
  devDependencies, `npm i` là xong" - đó mới là tầng thứ nhất trong **bốn** tầng
  hỏng, ba tầng còn lại không làm lệnh nào thất bại (glob extglob dùng dấu phẩy ⇒
  khớp 0/9 file · `@tsudev/types` CommonJS qua `/@fs` ⇒ mọi khung story rỗng ·
  `next-auth` đòi `process` + `SessionProvider`). Nghiệm thu **36/36 lượt**
  (12 story × 3 chế độ) vẽ ra nội dung, 0 lỗi console, 0 ảnh 404. Đóng luôn món
  nợ ghim `react@18` ở root.
- 20/08/2026 - **Gỡ `@tsudev/utils`** (một hàm, không nơi nào dùng) và dòng
  `references` của nó trong `tsconfig.json` gốc.
- 20/08/2026 - **Hai gói đẩy ngược lên repo quy ước trung tâm đã soạn xong**:
  `docs/token-upstream-proposal.md` · `docs/structure-upstream-proposal.md`.
  Điểm lệch cấu trúc ghi vào `docs/architecture.md` thay vì để im lặng.
- 20/08/2026 - **Sổ Neuron đếm ĐỦ cả khi lượt chạy hỏng**: chi phí nay ghi tại
  ranh giới nhà cung cấp vào sổ theo ngữ cảnh (`withCostLedger`, AsyncLocalStorage),
  `withRun()` đọc sổ ở **cả hai** nhánh try/catch. Đường trả chi phí cũ
  (`AgentCost` trong `agents.ts`) đã bỏ hẳn - một sổ, không phải hai.
  Canh bằng `services/newsroom-service/test/costLedger.test.ts` (7 test, đã kiểm
  chứng đỏ trên mã cũ). Newsroom 42 → **49 xanh**; bundle 14; format/lint/typecheck sạch.
- 20/08/2026 - **PHÁT HÀNH phiên 9**: PR #36 gộp vào `main` (`12987d0`), Render dựng
  lại backend, frontend lên Cloudflare Workers (version `d59853a7`). Nghiệm thu
  **đếm hành vi**: `/api/auth/providers` chỉ `credentials`+`passkey` · `www` → 308
  apex · `newsroom:check` tick 202, `AgentRun` 160→165. Trước khi gộp: chạy tay đủ
  **năm** hạng mục CI gồm cả cổng WASM (9 test Rust, `.wasm` khớp mã nguồn) và e2e
  20/20. Phiếu: `logs/handover/20260820-05`.
- 20/08/2026 - **Kết phiên 8**. Phiếu: `logs/handover/20260820-04`. Ba đợt việc
  đã commit và push (PR #36, 5 commit): chuẩn hoá URL · van hạn mức LLM · e2e
  lặp lại được. Chặn ở khâu gộp + GitHub Actions không chạy được vì tài khoản.
- 20/08/2026 - **Bộ e2e lặp lại được**: seed dev nay đặt lại `User.role` (trước
  chỉ có ở nhánh `create` của upsert) và dọn tài khoản `e2e-*`. Chứng minh bằng
  vòng seed → 20/20 → seed → chạy lại invite vẫn xanh.
- 20/08/2026 - **Nghiệm thu phiên 8**: e2e **20/20** (tuần tự); test service
  213 xanh (content 26 · storage 13 · trust 57 · auth 61 · newsroom 42 ·
  bundle 14); `packages/ui` 199; frontend-main 29; `next build` sạch.
  PR #36 đã mở, **chưa gộp**.
- 20/08/2026 - **Van hạn mức LLM của Toà soạn**: cạn Neuron nay làm hệ **hoãn**
  chứ không **hỏng**. Ba khiếm khuyết chồng nhau đã sửa (van đọc sổ ước lượng của
  ta thay vì lời nhà cung cấp · không có trí nhớ giữa các nhịp · cạn hạn mức ăn
  hết 3 lần thử rồi giết bản nháp vĩnh viễn). Thêm nút hồi sinh cho bản nháp đã
  chết. Phiếu: `logs/handover/20260820-03`.
- 20/08/2026 - **Chuẩn hoá URL**: `www` → 308 về apex; `*.workers.dev` noindex;
  trang chủ thôi in cổng nội bộ; `topology:check` có khẳng định D chặn hồi quy;
  `docs/url-convention.md` là nguồn duy nhất trả lời "địa chỉ nào chính tắc".
- 20/08/2026 - **Nghiệm thu đợt giao diện**: rà máy 12 trang × 3 chế độ (36 ảnh,
  đã đăng nhập ADMIN) → **0 vấn đề tương phản**; e2e **20/20 xanh**; bản dựng
  production sạch, không còn cỡ chữ hay mã màu nào ngoài token. Bốn lỗi thật tìm
  thêm được và đã sửa: thang chữ mặc định Tailwind lọt qua 41 chỗ, `site.webmanifest`
  trôi lệch màu nền, `::placeholder` màu cắm cứng, hai chỗ chữ 11px.
- 20/08/2026 - **Tái cấu trúc toàn diện giao diện theo quy ước v1.0.0**.
  Phiếu bàn giao: `logs/handover/20260820-01_tai-cau-truc-giao-dien.md`
- 20/08/2026 - Cài bộ quy ước v1.0.0 vào repo: `logs/`, `docs/DESIGN_SYSTEM.md`,
  `docs/PROJECT_STRUCTURE.md`, `docs/templates/HANDOVER.md`, `tokens/`, `CHANGELOG.md`
- 19/08/2026 - Khởi tạo bộ quy ước v1.0.0

## Quyết định quan trọng

- 22/08/2026 - **CSP ép cho Pages Router prerender TĨNH phải dùng BĂM, không nonce.**
  Hướng đầu (nonce qua middleware) chạy đúng trên trang ĐỘNG nhưng vỡ trên trang
  TĨNH: HTML tĩnh sinh lúc build không mang được nonce của lượt tải, nên CSP ép
  chặn luôn THEME_SCRIPT ở đó (đo được: trang tĩnh 0/11 script có nonce). Thêm nữa
  `NextScript` của Next đọc nonce từ `this.props.nonce` mà `_document` render
  `<NextScript/>` không truyền, nên ngay cả trang động cũng chỉ 1 script có nonce.
  Băm SHA-256 cố định theo NỘI DUNG, đúng trên cả tĩnh lẫn động - hợp vì site chỉ
  có ĐÚNG MỘT inline script thực thi (THEME_SCRIPT); mọi thứ khác là `<script src>`
  cùng origin (`'self'`). Băm tính TỪ NGUỒN `_document.tsx` (không hardcode) để
  không trôi lệch. Quy tắc: nonce + prerender tĩnh là xung khắc; đo trang tĩnh
  TRƯỚC khi chọn nonce. Bài học kiểu "mã 200 vẫn trang trắng" - header có, chỉ
  script bị chặn.
- 22/08/2026 - **Secret OAuth (và mọi secret của Worker) là ENCRYPTED SECRET,
  KHÔNG phải `vars` plaintext.** Đặt CLIENT_SECRET làm biến `vars` (qua dashboard
  hay wrangler.jsonc) có HAI cái hỏng: (1) giá trị hiện plaintext ở dashboard/CLI
  và **in ra log lúc deploy** (đã lộ một lần, nên xoay lại là an toàn nhất); (2)
  `opennextjs-cloudflare deploy` ghi đè config remote bằng `wrangler.jsonc` local
  nên **var plaintext bị XOÁ mỗi lần deploy** - OAuth chết im lặng. `wrangler
secret put` mã hoá, không bao giờ hiện ra, và **sống sót qua mọi deploy** (secret
  tách khỏi config). Sửa config Worker bằng tay ở dashboard còn tạo drift khiến
  lần deploy kế tiếp cảnh báo "override remote". Quy tắc: secret → `wrangler secret
put`; đừng sờ vào config Worker qua dashboard.
- 21/08/2026 - **Thêm bậc vai trò TRÊN một bậc cũ phải rà MỌI cổng của bậc cũ.**
  Nâng tsudev ADMIN→OWNER tưởng thuần cộng, nhưng cổng nào kiểm `role === 'ADMIN'`
  BẰNG ĐÚNG (thay vì `hasAtLeastRole`) thì bậc mới cao hơn lại TRƯỢT. Ở đây đúng
  một chỗ (`auth-service requireAdmin`) khoá tsudev khỏi mã mời Con dấu, im lặng
  (trang vẫn dựng, chỉ 403 khi gọi). Triệu chứng trông như "mới nâng quyền mà lại
  mất quyền". Quy tắc: bậc trần chỉ an toàn khi mọi cổng đọc quyền theo THỨ BẬC.
- 21/08/2026 - **Đừng đẩy fix vào một PR đang có thể bị gộp đồng thời.** #40 bị
  gộp ở head `449b2f9` (bản còn lỗi) đúng lúc đẩy tiếp fix - GitHub trễ đồng bộ
  head PR nên fix `6fe6304`/`9707b3b` không vào PR, main đỏ. Phải mở #41 vá riêng.
  Quy tắc: sửa xong hẵng mở PR, hoặc chờ CI xanh hẳn rồi mới gộp; trước khi gộp,
  đối chiếu `git ls-remote` (branch) == `pulls/N .head.sha` (PR).
- 21/08/2026 - **"Tài khoản đăng bài" ≠ có bề mặt đăng bài.** Role AUTHOR ship
  được ngay (quản lý + phân quyền), nhưng content-service chưa có route ghi Post
  cho người, nên AUTHOR chưa đăng được gì - đây là follow-up, không phải lỗi RBAC.
  Ghi rõ để phiên sau không chẩn nhầm.
- 20/08/2026 - **"Lệnh chạy xong" không chứng minh công cụ chạy được.** Storybook
  lên server, `index.json` liệt kê đủ 12 story, `storybook build` xanh - mà cả 36
  lượt mở story đều RỖNG. Cùng họ với "mã 200 không chứng minh trang có nội dung":
  phép nghiệm thu phải đếm THỨ CÔNG CỤ SINH RA, không đếm việc nó khởi động.
- 20/08/2026 - **Điểm lệch bộ quy ước chung phải được GHI, kèm gói đẩy ngược.**
  File quy ước bất khả xâm phạm ⇒ repo con không sửa được ⇒ lệch là chuyện sẽ xảy
  ra. Lệch mà im lặng thì phiên sau tưởng là quên; lệch mà chỉ ghi chú thì lỗi
  gốc sống mãi ở trung tâm. Hai gói `docs/*-upstream-proposal.md` là đường ra.
- 20/08/2026 - **Sổ đo phải ghi ở NƠI PHÁT SINH, không ở đường `return`.** Chỗ
  kết quả về đích và chỗ chi phí phát sinh chỉ trùng nhau khi không có gì hỏng;
  agent hay hỏng NGAY SAU lượt gọi mô hình, nên sổ cũ đếm thiếu đúng ở nhánh hay
  xảy ra nhất. Đầy đủ: `HANDOFF.md` §0.7 (mục thứ 16).
- 20/08/2026 - **Điều kiện hiện một nút phải là điều kiện nút đó CHỮA, không phải
  triệu chứng đi kèm.** Nút "Hồi sinh việc đã dừng" từng lồng trong thẻ "hôm nay
  cạn hạn mức", nên nó biến mất đúng lúc cần: hạn mức reset xong mới là lúc đi dọn
  xác. Trang vẫn dựng, vẫn 200, chỉ thiếu một nút - không gì đỏ lên. Canh bằng test
  quét nguồn vì trang này không có test kết xuất.
- 20/08/2026 - **Phép đo "route mới đã có chưa" chỉ có giá trị khi đường đó nằm
  NGOÀI mọi cổng chặn**, hoặc khi đo kèm một đường đối chứng chắc chắn không tồn
  tại. Middleware xác thực chạy trước bảng định tuyến, nên 401 che mất 404 và hai
  bản dựng trả cùng một mã. Đây là phép đo sai theo kiểu trông y hệt **thành
  công** - chiều nguy hơn, vì không ai đi điều tra một kết quả tốt. Đầy đủ:
  `HANDOFF.md` §0.7 (mục thứ 15).
- 20/08/2026 - **"Render đã Live chưa" phải hỏi dashboard Render**, không suy ra
  từ mã HTTP: backend không có bề mặt công khai nào phân biệt hai bản dựng
  (`/health` không mang commit SHA).
- 20/08/2026 - **Ước lượng chi phí phía mình là van PHỤ; lời của nhà cung cấp là
  sổ CHÍNH.** Khi API báo cạn hạn mức thì ghi lại và tin tới mốc reset, ghi vào DB
  chứ không vào biến nhớ. Lý do đầy đủ: `HANDOFF.md` §0.7.
- 20/08/2026 - **Mọi hàng đợi có retry phải phân biệt HOÃN với THẤT BẠI.** Hoãn
  thì hoàn lại lần thử đã tính. Trộn hai thứ này là cách một ngày cạn hạn mức
  giết sạch hàng đợi.
- 20/08/2026 - **Giữ cổng dev 8080, KHÔNG hạ xuống 80.** Cổng < 1024 cần root;
  đổi lấy URL đẹp bằng việc chạy dev dưới quyền root là đánh đổi tồi.
  `docs/url-convention.md` §1.
- 20/08/2026 - **Mặc định vẫn là chế độ Sáng**, KHÔNG bám `prefers-color-scheme`.
  `DESIGN_SYSTEM.md` §1 và `CLAUDE.md` mâu thuẫn nhau ở điểm này; hoà giải bằng
  cách thêm lựa chọn thứ tư "Theo hệ thống" để người dùng tự bật. Lý do giữ mặc
  định Sáng: hai người mở cùng một link phải thấy cùng một trang.
- 20/08/2026 - **`fontSize` của Tailwind là GHI ĐÈ, không phải `extend`.** Với
  `extend`, thang mặc định của Tailwind sống song song với thang token và 41 chỗ
  trong app đã dùng nó mà không ai biết. Ghi đè thì class ngoài bảng không sinh ra
  CSS và lộ ra ngay khi nhìn. Ba bậc `display-*` cho hero nằm ở
  `extensions.tsudev-web.typography` vì thang §4 dừng ở 30px.
- 20/08/2026 - `tokens/design-tokens.json` là nguồn chân lý;
  `packages/ui/src/tokens.css` là bản SINH RA (`npm run tokens:sync`, CI canh bằng
  `npm run tokens:check`). `tokens/tokens.css` là bản chuẩn hệ sinh thái, script
  KHÔNG ghi đè - chỉ đối chiếu và báo lệch.
- 20/08/2026 - Đổi tên toàn bộ token sang tên quy ước (`--surface`→`--bg-base`,
  `--ink`→`--text-primary`, `--error`→`--danger`…), thay vì dựng lớp bí danh.
  Hai bộ tên song song chính là thứ quy ước sinh ra để dẹp.
- 20/08/2026 - Token riêng của repo (6 màu icon theo nhóm hành động, `accent`,
  cặp `-ink`/`-tint` cho badge, `border-control`, ba bậc `display-*`) sống ở khối
  `extensions.tsudev-web`, tách bạch khỏi khối `color` bất khả xâm phạm.
- 19/08/2026 - Dùng Inter làm font chuẩn; token là nguồn chân lý duy nhất; region
  ưu tiên Singapore → Nhật Bản.

## Phiếu bàn giao

| Mã                                                                  | Chủ đề                                                   | Trạng thái |
| ------------------------------------------------------------------- | -------------------------------------------------------- | ---------- |
| [20260822-05](handover/20260822-05_ket-phien-18.md)                 | Kết phiên 18 - Phase 0 + đo B1 + phát hành Phase A       | **MỞ**     |
| [20260822-04](handover/20260822-04_ket-phien-17.md)                 | Kết phiên 17 - Phase A (SSRF + rate limit) code-complete | HOÀN THÀNH |
| [20260822-03](handover/20260822-03_ke-hoach-khac-phuc-triet-de.md)  | Kế hoạch khắc phục triệt để (SSRF · rate limit · audit)  | **MỞ**     |
| [20260822-02](handover/20260822-02_ket-phien-16.md)                 | Kết phiên 16 - phát hành CSP + en-dash, prod sẵn sàng    | HOÀN THÀNH |
| [20260822-01](handover/20260822-01_ket-phien-15.md)                 | Kết phiên 15 - kiến trúc tài khoản + OAuth + gạch ngang  | HOÀN THÀNH |
| [20260821-04](handover/20260821-04_ket-phien-14.md)                 | Kết phiên 14 - AUTHOR/OWNER, trang tài khoản, phát hành  | HOÀN THÀNH |
| [20260821-03](handover/20260821-03_ket-phien-13.md)                 | Kết phiên 13 - repo Public, CI, repo quy ước             | HOÀN THÀNH |
| [20260821-02](handover/20260821-02_ket-phien-12.md)                 | Kết phiên 12 - gộp #38, hồi sinh toà soạn                | HOÀN THÀNH |
| [20260821-01](handover/20260821-01_ket-phien-11.md)                 | Kết phiên 11 - gộp #37, mở PR #38                        | HOÀN THÀNH |
| [20260820-06](handover/20260820-06_ket-phien-10.md)                 | Kết phiên 10 - sổ Neuron, Storybook, dọn nợ              | HOÀN THÀNH |
| [20260820-05](handover/20260820-05_phat-hanh-phien-9.md)            | Phát hành PR #36 lên production                          | HOÀN THÀNH |
| [20260820-04](handover/20260820-04_ket-phien-8.md)                  | Kết phiên 8 - chuỗi phát hành                            | HOÀN THÀNH |
| [20260820-03](handover/20260820-03_chuan-hoa-url-va-van-han-muc.md) | Chuẩn hoá URL + van hạn mức LLM                          | HOÀN THÀNH |
| [20260820-02](handover/20260820-02_viec-con-lai-sau-giao-dien.md)   | Việc còn lại sau đợt giao diện                           | HOÀN THÀNH |
| [20260820-01](handover/20260820-01_tai-cau-truc-giao-dien.md)       | Tái cấu trúc giao diện theo quy ước v1.0.0               | HOÀN THÀNH |

## Ghi chú vận hành

- **E2E ở máy này phải chạy `--workers=1`.** Chạy song song trên 4 nhân cho 18/20
  với hai lỗi RẢI RÁC (một ở `invite`, một ở `smoke` tài liệu); chạy lại từng cái
  một thì cả hai xanh, và cả bộ tuần tự thì 20/20. Đây là flake do tải, không phải
  hồi quy - nhưng nó trông y hệt hồi quy, nên đừng đọc kết quả chạy song song.
- Chạy e2e trên máy 4 nhân: **đừng chạy song song thứ gì khác**. Lần đầu bị 5 test
  đỏ vì timeout 60s trong lúc load average ~6.4 - `next dev` biên dịch nguội từng
  route. Chạy lại trên stack đã ấm (`E2E_NO_WEBSERVER=1`) thì 20/20 xanh.
