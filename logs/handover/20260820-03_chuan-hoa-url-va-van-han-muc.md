# PHIẾU BÀN GIAO — Chuẩn hoá URL + van hạn mức LLM của Toà soạn

- **Mã phiếu**: 20260820-03
- **Từ**: phiên 8 (20/08/2026) — **Đến**: phiên 9
- **Thời điểm**: 18:10 20/08/2026
- **Trạng thái**: MỞ — mã xong, cổng xanh hết, PR #36 đã mở. Chặn ở khâu GỘP + PHÁT HÀNH (xem §5)

## 1. Việc dang dở + bước tiếp theo CỤ THỂ

### 1.1 🔴 Phải PHÁT HÀNH BACKEND thì lỗi ở production mới hết

Toàn bộ bản vá hạn mức nằm trong `services/newsroom-service`, tức trong
`backend-bundle` trên Render. **Chưa deploy thì `/admin/newsroom` vẫn hiện lỗi
cũ.** Thứ tự:

1. Trộn nhánh này (`refactor/giao-dien-quy-uoc-v1`) → Render tự dựng lại.
2. Vào `/admin/newsroom`, bấm **"Hồi sinh việc đã dừng (N)"** — nút chỉ hiện khi
   có sự kiện `DEAD` và đang cạn hạn mức. Nó chỉ hồi sinh việc chết vì hạn mức;
   lỗi thật vẫn nằm nguyên ở `DEAD` để còn nhìn thấy mà sửa.
3. Frontend cũng cần deploy (đổi middleware + trang chủ), qua
   `scripts/deploy-frontend.js` — **đừng** gọi thẳng `opennextjs-cloudflare`.

### 1.2 ✅ ~~Quyết định về `GEMINI_API_KEY`~~ — XONG

Chủ dự án đã đặt ở Render ngày 20/08/2026. **Không** đặt ở Cloudflare Workers:
Worker cron cố ý không chạm DB và không gọi LLM, frontend Worker cũng không -
để secret ở nơi không dùng tới chỉ mở rộng vùng thiệt hại khi lộ.

Ghi chú gốc, giữ lại làm bối cảnh: hiện production **chưa có** đường dự phòng (kiểm bằng banner mới ở
`/admin/newsroom`: nếu thiếu thì nó nói thẳng). Không có nó thì mỗi ngày cạn
Neuron là toà soạn **đứng im tới 00:00 UTC** — nay đứng im êm, không còn giết
bản nháp, nhưng vẫn là đứng im.

Gemini bậc Free (project **chưa bật billing**) đủ dùng và tốn 0đ. Đặt ở Render:
`GEMINI_API_KEY`. Xem `docs/free-tier.md`.

### 1.3 🟠 Sổ Neuron của ta vẫn đếm THIẾU — lỗ hổng đã biết, chưa vá

`withRun()` chỉ ghi `neuronsUsed` ở nhánh THÀNH CÔNG. Một lượt gọi mô hình sinh
xong chữ rồi hỏng ở khâu parse vẫn tiêu Neuron thật, mà sổ ghi 0 — và lỗ hổng
này tập trung đúng vào đường hay hỏng nhất. Đó là một phần lý do sổ ta (~714/ngày
đo hôm 19/08) lệch xa sổ Cloudflare (10.000).

Bản vá phiên này không dựa vào con số đó nữa (sổ chính là lời của nhà cung cấp),
nên đây **không còn là lỗi chặn**. Muốn vá cho đúng: cho `complete()` trả chi phí
ra ngoài cả khi người gọi ném lỗi, rồi ghi vào `AgentRun` ở nhánh `catch`.

### 1.4 🟡 Cân nhắc hạ bậc model cho việc rẻ

Mọi agent đang dùng `llama-3.3-70b` (204.805 Neuron/1tr token ra). Scout (lọc
tiêu đề) và SEO không cần bậc đó; `llama-3.1-8b` rẻ hơn ~6 lần ở token ra. Model
nằm ở `AgentProfile.model` (seed `packages/db/prisma/seed-newsroom.js`), đổi được
mà không sửa mã. Cần đo chất lượng trước — đây là đề xuất, chưa làm.

### 1.5 🟡 `CLAUDE.md` nói "§0.7 ghi mười hai kỹ thuật" — nay là mười bốn

Phiên 8 thêm hai mục vào `HANDOFF.md` §0.7. `CLAUDE.md` không được sửa giữa phiên
(bust cache), nên con số ở đó đang cũ. Sửa ở đầu phiên sau, cùng lúc thêm một
dòng trỏ tới `docs/url-convention.md` trong mục Tài liệu.

## 2. Đã làm xong trong phiên này

### A. Chuẩn hoá URL

| Thay đổi                                                                                 | File                                                 |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `www.tsudev.com` → **308** về `tsudev.com`; `*.workers.dev` nhận `X-Robots-Tag: noindex` | `apps/frontend-main/middleware.ts` (`canonicalHost`) |
| Trang chủ thôi in cổng nội bộ ra khối terminal                                           | `apps/frontend-main/pages/index.tsx`                 |
| **Khẳng định D** của `topology:check`: cấm in cổng nội bộ ra giao diện                   | `scripts/topology/check.js`                          |
| Tài liệu quy ước URL (nguồn duy nhất trả lời "địa chỉ nào chính tắc")                    | `docs/url-convention.md`                             |

**Kết luận quan trọng:** hình trạng URL vốn đã đúng — dev có MỘT điểm vào
(`http://tsudev.localhost:8080`, `mode: proxy` trong `config/topology.json`),
production có MỘT tên miền. `:3000`, `:4001`–`:4005` chưa bao giờ là địa chỉ
người dùng gõ; chúng chỉ **rò rỉ** ra ba chỗ, và phiên này bịt cả ba. Không đổi
cổng, không đổi tên miền, không dời route nào.

Vì sao **không** hạ 8080 xuống 80 cho URL không có số cổng: cổng < 1024 cần root
trên Linux; chạy tiến trình dev dưới quyền root để đổi lấy URL đẹp là đánh đổi
tồi, và `setcap` phải làm lại sau mỗi lần cập nhật Node.

### B. Van hạn mức LLM — ba khiếm khuyết chồng nhau

Triệu chứng: `/admin/newsroom` đầy dòng đỏ
`AiError: AiError: you have used up your daily free allocation of 10,000 neurons`.

1. **Van đọc sai sổ.** `NEWSROOM_DAILY_NEURON_BUDGET` cộng ước lượng CỦA TA; hạn
   mức thì Cloudflare đếm bằng sổ CỦA HỌ. Hai sổ lệch ⇒ van không bao giờ đóng.
   → Thêm sổ THẬT: `provider.exhausted` ghi vào `NewsroomEvent` khi chính nhà
   cung cấp báo cạn; tin nó tới 00:00 UTC. Ghi DB chứ không biến nhớ (Render
   restart bất cứ lúc nào).
2. **Không có trí nhớ.** Mỗi nhịp lại thử lại lượt gọi chắc chắn hỏng.
   → `anyProviderAvailableToday()` được hỏi TRƯỚC khi `claimBatch()`.
3. **Cạn hạn mức đi chung đường với lỗi thật** ⇒ ăn hết 3 lần thử ⇒ `DEAD` vĩnh
   viễn vì một lý do tự hết lúc 00:00 UTC.
   → `AllProvidersExhaustedError` + nhánh **HOÃN**: trả sự kiện về `PENDING`,
   `attempts: { decrement: 1 }`, dừng nhịp. Thêm `reviveQuotaCasualties()` cho
   những bản nháp đã chết trước bản vá.

Kèm theo: không dán lỗi hạn mức vào `NewsroomSource.lastError` nữa (đổ oan cho
nguồn RSS lành lặn); `budget.exhausted` chỉ ghi MỘT lần mỗi ngày UTC (trước đây
19 dòng/ngày đẩy trôi nhật ký thật); `/api/newsroom/state` trả thêm `providers`
và `deadEvents`; bảng điều khiển hiện trạng thái vận hành thay vì dòng lỗi thô.

## 3. Trạng thái nghiệm thu (đo lúc 20:05 20/08/2026)

| Cổng                                                                      | Kết quả                      |
| ------------------------------------------------------------------------- | ---------------------------- |
| E2E `--project=app --workers=1`                                           | **20/20** xanh               |
| Test service (content · storage · trust · auth · newsroom · bundle)       | 26 · 13 · 57 · 61 · 42 · 14  |
| `packages/ui` · `frontend-main`                                           | 199 · 29 xanh                |
| `format:check` · `lint` · `typecheck` · `topology:check` · `tokens:check` | xanh                         |
| `next build`                                                              | sạch                         |
| GitHub Actions                                                            | **không chạy được** — xem §5 |

⚠️ **E2E phải chạy `--workers=1`.** Chạy song song trên máy 4 nhân cho 18/20 với
hai lỗi rải rác; chạy lại từng cái thì cả hai xanh, cả bộ tuần tự thì 20/20.
Flake do tải, nhưng nó trông y hệt hồi quy - đừng đọc kết quả chạy song song.

## 4. File liên quan

| File                                          | Vai trò                                                       |
| --------------------------------------------- | ------------------------------------------------------------- |
| `services/newsroom-service/src/llm/index.ts`  | router + sổ hạn mức thật (`exhaustedToday`, `providerHealth`) |
| `services/newsroom-service/src/llm/types.ts`  | `AllProvidersExhaustedError` — hoãn ≠ hỏng                    |
| `services/newsroom-service/src/dispatcher.ts` | nhánh HOÃN, `emitOncePerDay`, `reviveQuotaCasualties`         |
| `apps/frontend-main/middleware.ts`            | host chính tắc ở production, cookie host ở dev                |
| `scripts/topology/check.js`                   | khẳng định D                                                  |
| `docs/url-convention.md`                      | quy ước URL — đọc trước khi thêm route hoặc tên miền          |

## 5. Kết quả xử lý

**Cập nhật 20:10 20/08/2026 (vẫn phiên 8).**

Đã làm thêm:

- `GEMINI_API_KEY` đã được chủ dự án đặt ở Render. **Không** đặt thêm ở
  Cloudflare Workers - Worker cron cố ý rất ngu (không chạm DB, không gọi LLM,
  chỉ gõ cửa backend), và frontend Worker không bao giờ gọi mô hình. Đặt secret
  ở nơi không dùng tới chỉ mở rộng vùng thiệt hại khi lộ.
- PR **#36** đã mở, nhánh đã push, thêm một commit sửa seed dev.
- Nghiệm thu đầy đủ ở local (bảng ở §3 đã cập nhật).

**HAI THỨ CHẶN, cả hai ngoài tầm agent:**

1. **GitHub Actions không chạy.** Cả 5 job đỏ trong 2 giây với thông báo
   `The job was not started because recent account payments have failed or your
spending limit needs to be increased`. Không job nào chạy một dòng nào - đây
   là vấn đề TÀI KHOẢN, không phải mã. Repo private + GitHub Free được 2.000
   phút/tháng (`docs/free-tier.md`). Kiểm mục _Billing & plans_.
2. **Lệnh gộp PR bị chính sách phân quyền của phiên chặn.** Không tìm đường vòng.
   Chủ dự án gộp tay: `gh pr merge 36 --merge`.

Vì `main` chưa nhận được commit nào nên **Render chưa dựng lại**, tức là
`/admin/newsroom` trên production **vẫn đang chạy mã cũ** và vẫn hiện lỗi.
Kết quả "8 lượt agent đã thực thi" mà `newsroom:check` báo là của mã cũ.

**Thứ tự phát hành còn lại:** gộp #36 → chờ Render dựng xong → deploy frontend
(`npm --workspace apps/frontend-main run deploy`) → vào `/admin/newsroom` bấm
"Hồi sinh việc đã dừng".
