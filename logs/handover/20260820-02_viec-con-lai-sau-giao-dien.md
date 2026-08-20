# PHIẾU BÀN GIAO — Việc còn lại sau đợt tái cấu trúc giao diện

- **Mã phiếu**: 20260820-02
- **Từ**: phiên 7 (20/08/2026) — **Đến**: phiên 8
- **Thời điểm**: 16:41 20/08/2026
- **Trạng thái**: MỞ

> Đợt giao diện **đã commit xong** trên nhánh `refactor/giao-dien-quy-uoc-v1`,
> cây làm việc sạch. Việc còn lại: push/PR (§1.1) rồi bốn mục §1.2-§1.6.

## 1. Việc dang dở + bước tiếp theo CỤ THỂ

### 1.1 ✅ ~~Quyết định commit~~ — XONG, còn lại là push/PR

Đợt giao diện đã commit thành **ba cụm** trên nhánh
`refactor/giao-dien-quy-uoc-v1` (tách khỏi `main`), 82 file, +3622 −1240:

```
d3d77d7  chore(quy-uoc): cài bộ quy ước v1.0.0 và hạ tầng phối hợp phiên
d685ced  refactor(ui): đưa toàn bộ giao diện về bộ quy ước v1.0.0
596a079  docs: nhật ký phiên 7 và phiếu bàn giao cho phiên mới
```

Cây làm việc **sạch**. Cổng kiểm chạy lại trên trạng thái đã commit: xanh hết.

**Chưa push.** Bước tiếp theo cần chủ dự án xác nhận:

```bash
git push -u origin refactor/giao-dien-quy-uoc-v1
gh pr create --fill
```

⚠️ `.husky/pre-push` sẽ chạy lúc push - nó là lớp chắn DUY NHẤT vì `main` không
có branch protection (GitHub Free + repo private). Đừng vượt bằng
`ALLOW_MAIN_FORCE=1` cho đợt này.

⚠️ `tsudev-conventions/` (thư mục + zip nguồn, 20K) **đã được commit** trong cụm
đầu, làm nguồn gốc của bộ quy ước. Mọi thứ trong đó đã cài vào đúng chỗ nên nó
dư - xoá được bằng một commit riêng khi đã đối chiếu xong. Để lại thì có rủi ro
ai đó đọc `tsudev-conventions/AGENTS.md` (bản gốc) thay vì `AGENTS.md` ở gốc repo
(bản đã gộp phần A + phần B), và hai bản đó KHÁC nhau.

### 1.2 🟠 Đẩy hai mã màu vá lên repo token trung tâm

Bảng màu chuẩn v1.0.0 **không đạt chính quy tắc §1 của nó**, đo bằng
`packages/ui/test/contrast.test.ts`:

| Token           | Đo được       | Ngưỡng              |
| --------------- | ------------- | ------------------- |
| `text-muted`    | 3.69 – 4.58:1 | 4.5:1 (§1, WCAG AA) |
| `border-strong` | 1.65 – 2.49:1 | 3:1 (WCAG 1.4.11)   |

`text-muted` là token bị dùng nhiều nhất trong app (~200 chỗ). Khối `color` bất
khả xâm phạm nên tsudev-web vá cục bộ trong `extensions.tsudev-web`: ghi đè
`text-muted`, thêm vai trò mới `border-control` cho viền nút phụ / ô nhập.

**Bước tiếp theo:** giá trị đã tính sẵn và đã có test canh — chỉ cần chép sang repo
token trung tâm (`tsudev-design-tokens` theo `docs/PROJECT_STRUCTURE.md`). Lý do
và số đo đầy đủ nằm ở khoá `$accessibility_gap` trong `tokens/design-tokens.json`.
**Đây là việc ảnh hưởng mọi repo trong hệ sinh thái**, không riêng tsudev-web.

### 1.3 🟠 `e2e/tests/invite.spec.js` không lặp lại được — khiếm khuyết SẴN CÓ

`services/auth-service/scripts/seed-dev-users.js` chỉ đặt lại mật khẩu, **không**
reset `User.role`. Test nâng `alice` MEMBER→VIP vĩnh viễn, nên **lần chạy thứ hai
trên cùng một DB luôn đỏ** — và triệu chứng là timeout ở một bước không liên quan
(`page.goto('/trust/redeem')` của `bob`), nên rất dễ chẩn nhầm thành lỗi giao diện.
Phiên 7 đã mất một vòng chạy vì chuyện này.

**Bước tiếp theo:** cho seed đặt lại `role` về đúng bậc ban đầu
(`tsudev`=ADMIN, `alice`=MEMBER, `bob`=VIP) và xoá tài khoản `e2e-member-*` tồn
đọng. Chủ vùng: `backend-api` (script nằm trong auth-service), test do `qa-test`.
Phiên 7 đã reset tay trạng thái này rồi, nên DB local **hiện đang sạch**.

### 1.4 🟡 Storybook chưa chạy được

`npm --workspace packages/ui run build-storybook` → `sh: 1: storybook: not found`.
devDependencies của `packages/ui` không có trong `node_modules`. Cấu hình ba chế
độ **đã viết** (`.storybook/preview.js`, nút "Giao diện" trên thanh công cụ) nhưng
**chưa ai nhìn thấy nó chạy**, và Storybook không nằm trong CI nên cũng không có
gì canh.

⚠️ Trước khi `npm i`: `HANDOFF.md` §1.3 ghi Storybook mang **30 trong 37** lỗ
`npm audit` của repo, và §2 đã đăng ký nó là nợ có chủ đích. Cài lại thì con số
audit tăng vọt — **đừng để nó kéo phiên đi sai hướng**.

### 1.5 🟡 `docs/PROJECT_STRUCTURE.md` chưa được áp — cần QUYẾT ĐỊNH của chủ dự án

Nó mô tả cây `src/main`, `src/components`, `src/features`… — hình trạng của một
app đơn, không phải npm workspaces với `apps/`, `services/`, `packages/`. Áp
nguyên văn nghĩa là dời cả repo.

**Không tự làm.** Hai đường: (a) sửa quy ước ở repo trung tâm cho phép hình trạng
monorepo, (b) chấp nhận tsudev lệch chuẩn ở điểm này và ghi rõ ngoại lệ.

### 1.6 🟡 Rà bằng MẮT NGƯỜI

Phiên 7 rà bằng **máy**: 12 trang × 3 chế độ, đo tương phản thật trên DOM đã dựng
→ 0 vấn đề. Máy đo được tương phản và cỡ chữ; nó **không** đọc được "cái này trông
cân đối chưa", "khoảng trắng có bị hụt không".

**Bước tiếp theo:** `npm run dev:local`, mở `http://tsudev.localhost:8080`, dùng
menu Giao diện trên header đảo qua ba chế độ. Ảnh chụp của phiên 7 nằm ở scratchpad
và **đã mất khi phiên đóng**.

### 1.7 ⚪ `packages/utils` (`@tsudev/utils`) không ai dùng

Cân nhắc gỡ, hoặc chuyển `apps/frontend-main/lib/format.ts` vào đó khi có nơi thứ
hai cần định dạng ngày. Không gấp.

## 2. File liên quan / đang khóa

**Không còn khoá nào** — `logs/LOCKS.md` trống.

| File                                    | Vai trò                                          |
| --------------------------------------- | ------------------------------------------------ |
| `tokens/design-tokens.json`             | **nguồn chân lý**; khối `color` bất khả xâm phạm |
| `scripts/sync-tokens.js`                | bộ sinh; `npm run tokens:sync` / `tokens:check`  |
| `packages/ui/src/tokens.css`            | **ARTIFACT** — đừng sửa tay, sẽ bị ghi đè        |
| `apps/frontend-main/tailwind.config.js` | bản đồ tên token ↔ class                         |
| `apps/frontend-main/lib/format.ts`      | định dạng ngày `DD/MM/YYYY`                      |
| `docs/design-system.md`                 | repo này hiện thực quy ước bằng file nào         |

## 3. Trạng thái nghiệm thu (đo lúc 16:41 20/08/2026)

| Cổng                                                              | Kết quả                                   |
| ----------------------------------------------------------------- | ----------------------------------------- |
| Rà máy 12 trang × 3 chế độ (đăng nhập ADMIN)                      | **0 vấn đề tương phản**                   |
| E2E `npm run e2e:app`                                             | **20/20**                                 |
| `packages/ui` · `frontend-main`                                   | 199 · 29 xanh                             |
| `tokens:check` `format:check` `lint` `typecheck` `topology:check` | xanh                                      |
| `next build`                                                      | sạch; không còn cỡ chữ/mã màu ngoài token |

⚠️ **Chạy e2e ở máy này thì đừng chạy song song thứ gì khác.** Lần đầu 5 test đỏ
vì timeout 60s trong khi load average ~6.4 trên 4 nhân — `next dev` biên dịch
nguội từng route. Mẹo: dựng stack trước, chờ ấm, rồi
`E2E_NO_WEBSERVER=1 npx playwright test --config=e2e/playwright.config.js --project=app`.

## 4. Yêu cầu gửi agent đang giữ khóa

Không có.

## 5. Cảnh báo / quyết định quan trọng

Ba quyết định của phiên 7 mà **đảo lại thì phải sửa cả test**:

1. **Mặc định là chế độ Sáng, KHÔNG bám `prefers-color-scheme`.**
   `DESIGN_SYSTEM.md` §1 và `CLAUDE.md` mâu thuẫn nhau; hoà giải bằng lựa chọn thứ
   tư "Theo hệ thống" do người dùng tự bật. Bảng màu không có media query nào treo
   vào cài đặt máy — `themeTokens.test.ts` canh điều đó.
2. **`fontSize` của Tailwind là GHI ĐÈ, không phải `extend`.** Với `extend`, thang
   mặc định sống song song với thang token và 41 chỗ đã dùng nó mà không ai biết.
3. **Token riêng của repo sống ở `extensions.tsudev-web`**, tách bạch khỏi khối
   `color`. Đừng thêm token mới vào khối `color`.

Ba bẫy kỹ thuật của phiên 7 đã ghi vào `HANDOFF.md` §0.7 (Tailwind quét cả comment ·
`color(srgb …)` khác thang với `rgb()` · hai cổng kiểm đá nhau). Đọc ở đó, không
lặp lại ở đây.

## 6. Kết quả xử lý

_(phiên 8 điền)_
