# PHIẾU BÀN GIAO - Phiên 9: phát hành PR #36 lên production

- **Mã phiếu**: 20260820-05
- **Từ**: phiên 9 (20/08/2026) - **Đến**: phiên 10
- **Thời điểm**: 19:35 20/08/2026
- **Trạng thái**: MỞ

> **Phiếu vào cửa của phiên 10.** [`20260820-04`](20260820-04_ket-phien-8.md) đã
> đóng - chuỗi phát hành mà nó bàn giao đã chạy xong hai bước rưỡi.

## 1. Việc đã làm xong

### A. Cổng kiểm tay đầy đủ trước khi gộp

GitHub Actions **vẫn chết vì tài khoản** (5 job đỏ trong 2 giây, chưa ai sửa
billing), nên chạy tay ở local đủ **cả năm** hạng mục CI - lần này gồm cả cổng
WASM mà phiên 8 chưa đo:

| Hạng mục                                    | Kết quả                                                   |
| ------------------------------------------- | --------------------------------------------------------- |
| `format:check` · `lint` · `typecheck`       | xanh                                                      |
| `topology:check` · `tokens:check`           | 52 literal cổng khớp · 3 chế độ khớp                      |
| service content·storage·trust·auth·newsroom | 26 · 13 · 57 · 61 · 42                                    |
| bundle · `packages/ui` · frontend-main      | 14 · 199 · 29                                             |
| WASM con dấu                                | `cargo test --release` 9 test · `.wasm` **khớp** mã nguồn |
| `next build`                                | sạch                                                      |
| **e2e** `--workers=1`                       | **20/20** (1.7m)                                          |

Hai bẫy vận hành của phiếu trước đều được kiểm chứ không tin suông: cổng
3000/4001–4005/8080 **trống** trước khi dựng stack (không có tiến trình mồ côi),
và e2e chạy **tuần tự**. DB dev được seed lại ngay trước khi chạy e2e.

### B. Chuỗi phát hành - bước 1 và 2 xong

1. `gh pr merge 36 --merge` → merge commit **`12987d0`** trên `main`.
2. Render dựng lại backend từ `main`; chủ dự án xác nhận **Live** trên dashboard.
3. `npm --workspace apps/frontend-main run deploy` → Worker version
   **`d59853a7-785c-4748-9d31-12d338e0bc52`**, triggers `tsudev.com` +
   `www.tsudev.com`.

**Nghiệm thu - đếm hành vi, không đếm mã 200:**

- `curl https://tsudev.com/api/auth/providers` → **chỉ** `credentials` +
  `passkey`. Không provider dev nào lọt vào bản dựng.
- `https://www.tsudev.com/` → **308** về apex. Bản vá chuẩn hoá URL đã sống trên
  production, không chỉ trong test.
- `npm run newsroom:check` → tick **202**, `AgentRun` **160 → 165**. Toà soạn
  đang chạy thật trên mã mới.
- **Bằng chứng backend đúng là bản mới** (tìm được sau, xem §5): `/api/newsroom/state`
  trả trường `deadEvents`. Trường đó và `providers` được thêm **cùng một commit**
  `e7a3dfe`, nên trang trả về nó là chứng cứ mã mới đang chạy - thứ mà mã HTTP
  không chứng minh được.

## 2. Việc dang dở + bước tiếp theo CỤ THỂ

### 2.1 🔴 Bước 3 chưa xong - nút bị một lỗi lồng điều kiện giấu mất

Chủ dự án vào `/admin/newsroom` và **không thấy nút**. Không phải deploy hỏng:
nút có trong bản đã phát hành, nhưng bị lồng **bên trong** thẻ cảnh báo
`{exhausted.length > 0 && (…)}`.

`exhaustedToday` chỉ đúng khi có sự kiện `provider.exhausted` trong **ngày UTC
hiện tại** (`services/newsroom-service/src/llm/index.ts:63`). Nên nút biến mất
đúng vào lúc cần nó nhất: hạn mức đã đặt lại lúc 00:00 UTC, hệ khoẻ trở lại, và
giờ mới là lúc đi dọn xác của hôm trước. Production lúc đó có **`deadEvents: 16`**
mà trang không vẽ nút nào.

**Đã sửa** trong phiên 9: nút tách ra thành Card riêng, điều kiện duy nhất là
`deadEvents > 0`. Kèm `apps/frontend-main/test/newsroomRevive.test.ts` (3 test,
quét NGUỒN) - đã kiểm chứng nó **đỏ trên mã cũ, xanh trên mã mới**, vì trang này
không có test kết xuất và hồi quy kiểu đó không làm gì đỏ lên: trang vẫn dựng,
vẫn 200, chỉ thiếu một cái nút.

**Đã deploy** bản sửa: Worker version **`d2a0640a-7840-41ad-b53e-19346a8f0d16`**
(hai commit `59a5724` + `b47da52` trên nhánh `fix/nut-hoi-sinh-viec-da-dung`).

Nghiệm thu **không dừng ở mã 200**: tải chính chunk mà trình duyệt tải,
`/_next/static/chunks/pages/admin/newsroom-30277cf9d6427320.js`, và tìm thấy câu
chỉ tồn tại ở bản sửa - `" việc đang nằm ở trạng th\xe1i đ\xe3 dừng."`.

⚠️ Lần đầu grep trả **0** cho cả chuỗi vốn có ở CẢ HAI bản, tức phép đo hỏng chứ
không phải bản dựng: bundle escape các ký tự **Latin-1** (`đã` → `đ\xe3`,
`nhà` → `nh\xe0`) nhưng giữ nguyên ký tự ngoài Latin-1 (`ừ`, `ồ`, `ạ`). Grep
chuỗi tiếng Việt đầy đủ trong bundle Next vì thế **luôn trượt**. Đây là lần thứ
hai trong một phiên một phép đo suýt bị đọc thành kết luận - xem §5.

**Bước tiếp theo:** vào `https://tsudev.com/admin/newsroom` bấm **"Hồi sinh việc đã dừng (16)"**.
Endpoint phía sau: `POST /api/newsroom/admin/events/revive` → `{ revived: n }`.
Nó chỉ hồi sinh `NewsroomEvent` `DEAD` **có dấu vân tay cạn hạn mức**; lỗi thật
vẫn nằm yên ở `DEAD` (`dispatcher.ts:70`).

Kiểm sau khi bấm: `npm run newsroom:check`, `AgentRun` phải tiếp tục tăng.

### 2.2 🔴 GitHub Actions vẫn chết - vấn đề TÀI KHOẢN

Không đổi so với phiếu 20260820-04: _Settings → Billing & plans_. Tới khi sửa
xong, mọi lần gộp đều phải chạy tay bộ lệnh ở §5 phiếu này.

### 2.3 🟠 Cân nhắc xoay `NEWSROOM_TICK_TOKEN`

`wrangler deploy` in **nguyên giá trị token** ra terminal (nó nằm trong `vars`
của frontend Worker ở remote, không phải secret). Giá trị không vào git -
`backup/` đã trong `.gitignore` - nhưng đã nằm trong scrollback phiên 9.

Deploy vừa rồi đã **gỡ** biến đó khỏi frontend Worker, và đó là **đúng**: token
thuộc về Render (service kiểm nó) và Worker cron `tsudev-newsroom-cron` (dạng
`secret_text`, đã kiểm chứng còn nguyên bằng `wrangler secret list`). Frontend
Worker không dùng tới - proxy `pages/api/newsroom/[...path].ts` cố ý không mở
đường `tick` ra trình duyệt.

Muốn xoay: đổi **đồng thời** ở Render và `npm run cron:secret`. Lệch nhau là mỗi
nhịp giờ trả 401 và **toà soạn đứng yên mà không có gì đỏ lên**
(`docs/deployment.md` §342).

### 2.4 🟠 Sổ Neuron của ta vẫn đếm THIẾU - thừa kế, chưa vá

Không đổi: `withRun()` chỉ ghi `neuronsUsed` ở nhánh THÀNH CÔNG. Cách vá ở
§2.3 phiếu 20260820-04.

### 2.5 Còn lại trong hàng đợi `STATE.md`

Đẩy hai mã màu vá lên repo token trung tâm 🟠 · Storybook chưa chạy được 🟡 ·
rà giao diện bằng MẮT NGƯỜI 🟡 · `PROJECT_STRUCTURE.md` cho monorepo 🟡 ·
gỡ `packages/utils` ⚪.

## 3. File liên quan / đang khóa

**Không còn khoá nào** - `logs/LOCKS.md` trống. Đang đứng ở `main`.

| File                                             | Vai trò                                             |
| ------------------------------------------------ | --------------------------------------------------- |
| `HANDOFF.md` §0                                  | nhật ký phiên 9                                     |
| `HANDOFF.md` §0.7                                | bài học thứ **15** - phép đo bị cổng chặn làm hỏng  |
| `scripts/deploy-frontend.js`                     | đường deploy DUY NHẤT của frontend                  |
| `scripts/kiem-toa-soan.sh`                       | nghiệm thu toà soạn - đếm `AgentRun`, không đếm 200 |
| `services/newsroom-service/src/dispatcher.ts:70` | `reviveQuotaCasualties` - cái nút ở bước 3 gọi tới  |

## 4. Yêu cầu gửi agent đang giữ khóa

Không có.

## 5. Cảnh báo / quyết định quan trọng

**Bài học mới, đã ghi vào `HANDOFF.md` §0.7 (mục thứ 15):**

Để biết Render đã dựng xong mã mới, phiên này định dùng dấu hiệu "route mới
`POST /api/newsroom/admin/events/revive` hết 404". Sáu phút sau khi gộp nó trả
**401** - đọc theo giả thiết ấy thì "đã Live", và con số đó suýt đi thẳng vào
phiếu nghiệm thu.

Nó **sai**: đường bịa ra `/api/newsroom/admin/khong-ton-tai-xyz` cũng trả 401,
vì middleware xác thực chạy **trước** bảng định tuyến. Cả hai bản dựng trả cùng
một mã cho mọi đường con.

> **Phép đo "route mới đã có chưa" chỉ có giá trị khi đường đó nằm NGOÀI mọi cổng
> chặn, hoặc khi đo kèm một đường đối chứng chắc chắn không tồn tại.** Đối chứng
> tốn đúng một lệnh `curl`.

Đây là "công cụ ĐO có thể sai theo kiểu trông y hệt lỗi thật" **ngược chiều**:
phép đo sai theo kiểu trông y hệt **thành công**. Chiều này nguy hơn - không ai
đi điều tra một kết quả tốt.

Hệ quả vận hành: backend repo này **không có** bề mặt công khai nào phân biệt hai
bản dựng (`/health` không mang commit SHA). Tới khi có, câu "Render đã Live chưa"
phải hỏi **dashboard Render**, không suy ra từ mã HTTP.

**Ba quyết định của phiên 8 vẫn nguyên hiệu lực** (van chi phí · hoãn ≠ hỏng ·
giữ cổng dev 8080) - xem §5 phiếu 20260820-04.

**Cổng kiểm chạy tay** (bắt buộc, tới khi GitHub Actions sống lại):

```bash
npm run format:check && npm run lint && npm run typecheck
npm run topology:check && npm run tokens:check
for s in content storage trust auth newsroom; do npm --workspace services/$s-service test; done
npm --workspace services/backend-bundle test
npm --workspace packages/ui test && npm --workspace apps/frontend-main test
npm --workspace apps/frontend-main run build
# WASM (phiên 8 bỏ sót):
(cd packages/trust-crypto && cargo test --release)
npm --workspace packages/trust-crypto run build:wasm   # chạy từ GỐC repo
git diff --exit-code -- packages/trust-crypto/pkg/trust_crypto.wasm
# e2e: dựng stack, kiểm cổng trống, seed, hâm nóng route, rồi
E2E_NO_WEBSERVER=1 npx playwright test --config=e2e/playwright.config.js --project=app --workers=1
```

## 6. Kết quả xử lý

_(phiên 10 điền)_
