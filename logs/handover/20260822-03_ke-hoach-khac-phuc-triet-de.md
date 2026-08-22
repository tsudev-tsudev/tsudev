# PHIẾU BÀN GIAO - Kế hoạch khắc phục triệt để lỗi/nợ kỹ thuật còn tồn

- **Mã phiếu**: 20260822-03
- **Từ**: phiên 17 (22/08/2026) - **Đến**: các phiên/agent sau
- **Thời điểm**: 18:45 22/08/2026
- **Trạng thái**: MỞ

> Hàng đợi việc cho các phiên sau. Phase A (A1·A2·A3) đã XONG trong phiên 17
> nhưng CHƯA phát hành. Còn B1 (đợt major, cần chủ dự án mở) + C1 (tuỳ chọn) +
> Phase 0. Không mục nào chặn production. Hiện trạng đã ĐO trong mã (đính chính
> memory 16/08) ở §1.

## 1. Hiện trạng đã đo (đính chính memory cũ)

Memory `ra-soat-bao-mat` viết 16/08, TRƯỚC commit `2d7b51c`. Đo lại mã hôm nay:

- **Rate limit đăng nhập ĐÃ CÓ**: `auth-service/src/throttle.ts` hai trục - IP
  (`LoginAttempt`, 20 lần hỏng/15p) + khoá tài khoản (8 lần liên tiếp/15p).
- **Rate limit `/api/trust/*` ĐÃ CÓ**: 240 req/phút/IP ở `GATED_PREFIX`.
- **9 lỗi thời TS-migrate ĐÃ VÁ** (`loi-that-typescript-bat-duoc`): spot-check
  #1 (index.tsx) và #2 (`hasAtLeastRole`) đều fixed. Phase 0 rà nốt 7 cái còn lại.

## 2. Tiến độ + việc còn lại

### Phase A - ĐÃ XONG trong phiên 17 (chưa phát hành)

- [x] **A1. SSRF `domainVerify`** - thay `fetch(redirect:'follow')` bằng
      `node:https` + `guardedLookup` (option `lookup` kiểm mọi IP rồi GHIM IP đã kiểm
      vào socket, đóng TOCTOU) + `safeGet` theo redirect thủ công ≤3 chặng, chỉ https,
      mỗi chặng qua guardedLookup (đóng redirect-SSRF), từ chối hạ cấp http. Zero-dep
      (built-in bền hơn undici như phác thảo gốc). Test `domainVerify.test.ts` **30**;
      trust-service **87/87**; cổng chung sạch.
- [x] **A2. npm audit** - KHÔNG có bản vá non-breaking. qs (GHSA-q8mj-m7cp-5q26)
      đến qua express@4.22.1 vốn ghim `qs ~6.14.0`, loại trừ bản vá 6.15.2; override
      bị npm 10 từ chối. Lỗi ở `qs.stringify` mà mã ta không dùng (grep 0 chỗ) nên
      không với tới được. Chỉ express@5 (major) mới thoát → dời sang B1.
- [x] **A3. Rate limit content + storage qua module dùng chung** - trích
      `createRateLimit`+`callerIp` thành `@tsudev/ratelimit` (semicolon-style;
      reference ở `tsconfig.json`, `tsconfig.services.json`, `trust-service/tsconfig.json`;
      Dockerfile đã COPY `packages/` nên không sửa). trust-service import từ package,
      xóa `src/rateLimit.ts`, test re-point. content + storage gắn limiter `/api`
      theo mô hình MIỄN TRỪ token: lưu lượng mang `x-internal-token` đúng (BFF tin
      cậy) bỏ qua limiter; chỉ lưu lượng TRỰC TIẾP (không token) bị giới hạn theo IP
      thật - vì BFF KHÔNG chuyển IP client xuống (giới hạn không miễn trừ sẽ gộp cả
      site vào một xô). Ngưỡng env-chỉnh-được (`RATE_LIMIT_DIRECT_MAX`): content 300,
      storage 120/phút. Test rateLimit.test cả hai. trust **87** · content **46** ·
      storage **15**; cổng chung sạch.

### Phase B - breaking, PHẢI đợt riêng (chờ chủ dự án mở)

- [ ] **B1. Đợt nâng cấp dependency major** (vùng `infra-deploy` + `frontend-web`).
      Gồm 4 high sharp/libvips (cần next@16) + 3 moderate qs/express (cần express@5).
      ĐO phơi nhiễm sharp trên Workers TRƯỚC (opennextjs thường không chạy sharp trên
      Workers → có thể hạ mức khẩn). Thử `sharp@latest` độc lập trước khi bump next.
      next@16 và express@5 đều BREAKING: chạy full CI + e2e 20/20 (`--workers=1`) +
      rà giao diện mắt người.

### Phase C - tuỳ chọn

- [ ] **C1. Siết CSP** (vùng `frontend-web`) - bỏ style-src unsafe-inline (nonce
      cho style hoặc gỡ styled-jsx) + thu hẹp connect-src https về đúng host R2.
      Nguồn CSP DUY NHẤT: `apps/frontend-main/middleware.ts` (`buildCsp`); test
      `apps/frontend-main/test/csp.test.ts`. Rủi ro vỡ style → nghiệm thu runtime prod.

### Phase 0 - xác nhận rẻ

- [ ] Rà nốt 7/9 mục `loi-that-typescript-bat-duoc` bằng grep; đóng memory nếu hết.
- [ ] (Mắt người, chủ dự án) DevTools prod Console sạch dòng CSP vi phạm; đăng
      nhập GitHub thật chạy auto-link.

## 3. Phát hành Phase A (bước tiếp theo cần chủ dự án)

Phase A chưa lên prod. Đường phát hành:

- Backend (A1 trust-service + A3 content/storage/trust) chạy trên Render qua
  `services/backend-bundle` - Render tự dựng lại khi merge vào `main`.
- Nghiệm thu sau deploy: `curl` một `/api/trust/verify/<serial>` rác → phản hồi
  bình thường; direct flood `/api/<x>` không token → thấy 429; lưu lượng site qua
  BFF không bị 429.
- KHÔNG cần biến env mới ở prod (ngưỡng có default). Muốn siết thì đặt
  `RATE_LIMIT_DIRECT_MAX`.

## 4. File đã đụng ở Phase A (đã nhả khóa)

- Mới: `packages/ratelimit/{package.json,tsconfig.json,src/index.ts}`,
  `services/trust-service/test/domainVerify.test.ts`,
  `services/content-service/test/rateLimit.test.ts`,
  `services/storage-service/test/rateLimit.test.ts`.
- Sửa: `services/trust-service/src/{domainVerify.ts,index.ts,tsconfig.json,package.json}`,
  `services/trust-service/test/rateLimit.test.ts` (import),
  `services/content-service/src/index.ts`, `services/storage-service/src/index.ts`,
  `tsconfig.json`, `tsconfig.services.json`.
- Xóa: `services/trust-service/src/rateLimit.ts`.

## 5. Cảnh báo / quyết định quan trọng

- **A1 có lỗ redirect-SSRF chưa từng ghi ở đâu** (nặng hơn TOCTOU): `fetch` cũ
  `redirect:'follow'` bỏ qua kiểm IP. Đã đóng bằng guardedLookup + redirect thủ công.
- **BFF không chuyển IP client xuống service** (`makeAuthedProxy`, storage proxy
  build header từ đầu). Hệ quả: rate limit theo IP CHỈ có nghĩa cho lưu lượng
  trực tiếp; lưu lượng site qua BFF phải được miễn trừ bằng `x-internal-token`.
  Cùng lý do, limiter 240/phút của trust-service (public, không token) thực chất
  gộp mọi lượt badge qua BFF vào một xô - ghi lại để trust-seal cân nhắc sau.
- **A3 = module dùng chung** (chủ dự án chốt). `@tsudev/ratelimit` semicolon-style
  vì `.prettierrc` `semi:false` chỉ khớp `services/**` và `packages/db/**`.
- **B1 phải đo phơi nhiễm sharp trước khi bump next**; next@16 + express@5 breaking,
  đừng gộp vào phiên khác.
- Push/deploy: xin phép chủ dự án; nhánh + PR (`.husky/pre-push` chặn push thẳng).

## 6. Kết quả xử lý (agent nhận điền)

_(Phase A xong 22/08 phiên 17, chưa phát hành. B1/C1/Phase0 còn mở.)_
