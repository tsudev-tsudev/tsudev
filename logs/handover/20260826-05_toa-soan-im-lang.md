# PHIẾU BÀN GIAO - Toà soạn im lặng: công tắc tổng, nút duyệt, nút hồi sinh

- **Mã phiếu**: 20260826-05
- **Từ**: phiên 28 (điều phối `backend-api` → `frontend-web` → `qa-test` → `infra-deploy`) - **Đến**: chủ dự án
- **Thời điểm**: 19:45 26/08/2026
- **Trạng thái**: MỞ - **hai việc chỉ chủ dự án làm được, xem §2**
- **Nhánh git**: `fix/newsroom-duyet-dang` (tách từ `main` = `b6b64cc`)

## 1. Ba triệu chứng, ba nguyên nhân khác nhau

Câu hỏi nhận được: (a) vì sao `/blog` và `/docs` hôm nay không có bài của toà
soạn, (b) vì sao bấm "Duyệt đăng" không thấy gì đổi, (c) vì sao bấm "Hồi sinh
việc đã dừng" mà vẫn còn 30 bài. Ba câu, ba nguyên nhân, không cái nào là cái kia.

### 1.1. 🔴 `/blog` im lặng - CÔNG TẮC TỔNG ĐÃ TẮT

**Số đo, không phải suy đoán:**

|                                     |                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Sự kiện toà soạn tạo ngày **25/08** | **125**, thuộc **13 loại** (`idea.created` 26, `draft.claimed` 19, `draft.published` 7, …) |
| Sự kiện toà soạn tạo ngày **26/08** | **2**, cả hai là `publish.requested` - chính hai lần chủ dự án bấm tay                     |
| `newsroom:check`                    | tick → **HTTP 202**, `AgentRun` **515 → 515**                                              |
| Neuron theo sổ ta hôm nay           | **0 / 8000**                                                                               |
| `provider.exhausted` hôm nay        | **không có**                                                                               |
| Bài mới nhất ở `/blog`              | **25/08 16:07 UTC**                                                                        |

Lập luận khép kín: **mọi** đường thoát của `tick()` đều để lại dấu -
`budget.exhausted`, `scan.skipped`, `scan.failed`, hoặc ít nhất là claim một sự
kiện. Đường **duy nhất** không để lại gì là dòng đầu tiên:

```ts
if (process.env.NEWSROOM_ENABLED !== 'true') {
  return { processed: 0, reclaimed: 0, skipped: 'NEWSROOM_ENABLED chưa bật' };
}
```

Số 0 tuyệt đối - không một sự kiện máy nào trong ~12 lượt nhịp - chỉ có một lời
giải. **`NEWSROOM_ENABLED` trên Render không còn là `'true'`.**

**Nguyên nhân gốc, và nó là một cái bẫy đã cài sẵn**: `render.yaml` khai

```yaml
- key: NEWSROOM_ENABLED
  value: 'false'
```

Giá trị literal trong blueprint **ghi đè giá trị đang chạy** ở mỗi lần đồng bộ.
Ý định ban đầu đúng - "mặc định phải là không tiêu gì" - nhưng cách thực hiện thì
kéo ngược cả những service ĐANG chạy. Toà soạn đang khoẻ tự tắt sau một lần
deploy, và không có gì báo: `tick()` thoát TRƯỚC mọi lệnh ghi nhật ký nên không
sinh ra sự kiện nào để ai nhìn thấy.

Đã đổi sang `sync: false`. Mục tiêu an toàn giữ nguyên (service dựng mới từ
blueprint không có giá trị này ⇒ vẫn tắt), nhưng blueprint không giành lại quyền
nữa. Bật/tắt từ nay là việc của bảng điều khiển Render.

### 1.2. `/docs` không có bài nào - KHÔNG phải hỏng, là việc chưa làm

Kênh DOC **không có nguồn đề tài nào đang bật**. Chuỗi sản xuất là
`NewsroomSource.target` → `TopicIdea.target` → `ContentDraft.target`, nên không
có nguồn thì nhánh đăng DOC không chạy lần nào - dù nhánh đó nằm đủ trong
`dispatcher.ts` và đã có `publishDoc.test.ts` canh.

Nguồn `repo_docs` (19 đề tài) được thêm ở **phiên 25** nhưng chỉ tồn tại trong
`packages/db/prisma/seed-newsroom.js`. Chạy `db:seed:newsroom` trên prod là việc
đã treo từ phiên 25, đang nằm ở `logs/STATE.md` và phiếu `20260826-03` §2.2.
Không có gì mới ở đây - chỉ là nay đo được hệ quả cụ thể.

### 1.3. "Duyệt đăng" - nó xếp hàng, và trước nay không ai nói ra

Đường `approve` **không đăng bài**. Nó tạo một sự kiện `publish.requested`; việc
đăng thật nằm ở `onPublishRequested`, chạy ở **nhịp kế tiếp** - mà nhịp là **mỗi
giờ một lần** (`7 0-17,23 * * *`; nhịp 5 phút chỉ gọi `/health` để giữ ấm Render,
lý do là hạn mức Neon). Nên `ContentDraft.status` đứng yên tới 60 phút và thẻ vẫn
nằm ở cột "CHỜ BẠN DUYỆT".

Nói cách khác: kể cả khi mọi thứ lành mạnh, nút này **vẫn trông như hỏng**. Cộng
thêm công tắc tổng đang tắt thì nó hỏng thật - và hai trạng thái đó trước nay
trông giống hệt nhau.

Đã sửa ba chỗ:

- `approve` trả thêm `queuedAt` / `alreadyQueued` / `status`;
- bấm hai lần **không** xếp hai lượt nữa;
- `/state` khai thêm `queuedPublish`, nên thẻ đổi ngay thành "Đã duyệt - chờ nhịp
  đăng (mỗi giờ, phút :07 UTC)" thay vì trông hệt thẻ chưa bấm.

### 1.4. 🔴 "Hồi sinh việc đã dừng" - một lớp DEAD KHÔNG BAO GIỜ cứu được

`reclaimStale()` giết sự kiện kẹt ở `CLAIMED` quá hạn thuê mà **không để lại
`event.dead`**. `reviveQuotaCasualties` nhận diện nạn nhân qua thông điệp lỗi ở
ghi chú kèm theo - không có ghi chú thì **không bao giờ khớp**, nên lớp sự kiện
đó nằm lại DEAD vĩnh viễn và đếm không bao giờ giảm.

Mà kẹt ở `CLAIMED` chính là thứ **Render restart** gây ra - chú thích ngay trên
hàm đó tự nói vậy. Tức đây là lớp phổ biến nhất, không phải trường hợp hiếm.

Đã sửa:

- `reclaimStale` nay **luôn** emit `event.dead` kèm lý do "bị bỏ rơi ở CLAIMED".
- `reviveQuotaCasualties` cứu cả hai loại chết **tạm thời** (cạn hạn mức, bị bỏ
  rơi), và cứu được **hàng tồn** qua nhánh "không có ghi chú nào". Nhánh đó tự
  hết tác dụng: từ bản này mọi cái chết đều có ghi chú, nên "không có ghi chú"
  chỉ còn đúng với những cái chết TRƯỚC bản vá - đúng nhóm cần cứu, không rộng
  hơn một hàng.
- Tra ghi chú theo **đúng tập draftId** thay vì "500 cái mới nhất": cửa sổ 500
  trượt qua mất ghi chú cần tìm khi hàng đợi bận, và triệu chứng là hồi sinh
  "chạy được một nửa".
- Trả thêm `dead` / `keptDead` để giao diện nói được đã cứu bao nhiêu và bỏ lại
  bao nhiêu.

⚠️ Lỗi **thật** vẫn cố ý nằm lại DEAD. Đó là thiết kế đúng và không đổi.

### 1.5. Giao diện nuốt sạch lỗi

`act()` ở `pages/admin/newsroom.tsx` gọi `fetch` rồi **vứt phản hồi đi** - không
đọc `res.ok`, không đọc thân. 401, 404, 500 và `{revived: 0}` dẫn tới đúng một
việc: `load()` rồi vẽ lại đúng thứ cũ.

Đây là bài học `HANDOFF.md` §0.7 _"mã 200 không chứng minh trang có nội dung"_ ở
dạng nặng hơn - mã trạng thái thậm chí không được nhìn tới. Nay `act()` đọc phản
hồi, hiện lỗi, và hiện cả kết quả **thành công** bằng một câu tiếng Việt: phần
lớn hành động ở bảng này không đổi gì nhìn thấy được ngay, nên im lặng lúc thành
công cũng gây hiểu nhầm y như im lặng lúc lỗi.

Thẻ "Toà soạn đang tắt" chuyển **lên đầu trang**, kiểu cảnh báo, và nói **hệ quả**
("không xử lý việc bạn duyệt") chứ không chỉ nói trạng thái. Trước nó là chữ xám
nằm dưới ba thẻ khác - đọc như ghi chú, không như điều kiện chặn.

### 1.6. Công cụ chẩn đoán mới

`npm run newsroom:chan-doan` → `scripts/chan-doan-toa-soan.js`. **Chỉ đọc**: không
ghi database, không gọi LLM, không gọi tick. Nó hỏi đúng những van mà `tick()`
hỏi, **theo đúng thứ tự** `tick()` hỏi chúng, rồi kết luận van nào đóng trước.

Vì sao cần thêm khi đã có `newsroom:check`: cái cũ chỉ đếm `AgentRun`, nên khi số
đó đứng im nó chỉ liệt kê được "một trong hai nhánh" mà không phân định được.
Chính phép đo "hôm nay 2 sự kiện, hôm qua 125" - thứ khép lại chẩn đoán ở §1.1 -
là do script mới cho ra.

## 2. 🔴 HAI việc chỉ chủ dự án làm được

Cổng an toàn của Claude Code chặn agent ghi vào production. Đúng chỗ nên chặn.

- [ ] **Bước 1 - bật lại công tắc tổng.** Bảng điều khiển Render → service
      `tsudev-backend` → Environment → đặt `NEWSROOM_ENABLED` = `true` → Save
      (service tự khởi động lại).

      **Nghiệm thu**: `npm run newsroom:chan-doan` phải hết dòng "Nếu tick vẫn
      không chạy thì nghi NEWSROOM_ENABLED". Rồi `npm run newsroom:check` phải
      cho `AgentRun` **tăng** - đó mới là bằng chứng, không phải mã 202.

      Sau đó **49 sự kiện PENDING đang tồn** sẽ được nhặt dần, trong đó có
      **4 `publish.requested`** từ những lần bấm "Duyệt đăng" - tức mấy bài đã
      duyệt sẽ tự lên. Không mất gì cả.

- [x] **Bước 2 - seed nguồn cho kênh DOC.** ✅ **ĐÃ CHẠY** - đo 27/08/2026: nguồn
      `Kho mã tsudev (tài liệu và thay đổi)` tồn tại trên prod, `target=DOC`,
      `enabled=true`, `createdAt = 13:16 26/08/2026`.

      ⚠️ **Nhưng `/docs` VẪN không có bài của agent, và nguyên nhân KHÔNG phải ở
      đây.** Nguồn có mà `lastScanAt` vẫn NULL - chưa từng được quét lần nào. Thủ
      phạm là van áp lực ngược TOÀN CỤC cộng với truy vấn chọn nguồn không có
      `orderBy`: BLOG (8 nguồn) giữ hàng đợi đầy liên tục nên `scanSources()`
      thoát sớm (`scan.skipped` **119 lần / 7 ngày**), và khi hiếm hoi chạy thì
      `take: 3` không thứ tự bốc trúng các nguồn cũ. Xem phiếu
      [`20260827-02`](20260827-02_bo-doi-kenh-doc.md).

      Giữ lại lệnh bên dưới vì **vẫn cần chạy lại một lần nữa**: đợt 27/08 đổi
      `target` của nguồn `GitHub Blog - Engineering` từ PROJECT sang BLOG, và
      thay đổi đó chỉ vào prod khi seed chạy lại.

      ```
      cd packages/db
      DATABASE_URL='<URL-NEON-PROD>' node prisma/seed-newsroom.js
      ```

      ⚠️ Thay `<URL-NEON-PROD>` bằng URL thật. Phiên 27 đã dán nguyên văn chuỗi
      giữ chỗ này một lần và nhận `P1012`.

      Seed **idempotent** và đã kiểm: nó upsert theo khoá tự nhiên, và **không**
      ghi đè `autonomy`/`enabled` của kênh. `dailyPostCap` trong seed trùng khít
      giá trị đang chạy trên prod (BLOG 2 · DOC 1 · PROJECT 1) nên không kéo
      ngược gì.

      **Nghiệm thu**: `npm run newsroom:chan-doan` phải hết dòng "⚠️ DOC: KHÔNG
      có nguồn nào đang bật".

- [ ] **Bước 3** - merge nhánh này rồi để Render tự deploy, và deploy frontend
      Cloudflare qua `scripts/deploy-frontend.js`. Nhánh **không có migration**
      nên không ràng buộc thứ tự như PR #81.

- [ ] **Bước 4 - sau khi bật lại, bấm "Hồi sinh việc đã dừng"** một lần. Nay nó
      sẽ nói rõ cứu được bao nhiêu trong 30 và bỏ lại bao nhiêu vì lỗi thật.

## 3. File liên quan / đang khóa

`logs/LOCKS.md` đã **nhả toàn bộ** khóa của việc này.

| Đường dẫn                                             | Lý do                                    | Còn khóa? |
| ----------------------------------------------------- | ---------------------------------------- | --------- |
| `services/newsroom-service/src/dispatcher.ts`         | `reclaimStale` + `reviveQuotaCasualties` | Không     |
| `services/newsroom-service/src/index.ts`              | `approve` + `queuedPublish` ở `/state`   | Không     |
| `services/newsroom-service/test/reviveDead.test.ts`   | **mới** - 5 test                         | Không     |
| `services/newsroom-service/test/approveDraft.test.ts` | **mới** - 4 test                         | Không     |
| `apps/frontend-main/pages/admin/newsroom.tsx`         | `act()` đọc phản hồi; thẻ cảnh báo       | Không     |
| `render.yaml`                                         | `NEWSROOM_ENABLED` → `sync: false`       | Không     |
| `scripts/chan-doan-toa-soan.js` · `package.json`      | **mới** - chẩn đoán chỉ đọc              | Không     |

**KHÔNG chạm `services/backend-bundle/`**: không thêm tiền tố đường dẫn mới.
Test của bundle vẫn 20/20.

## 4. Cảnh báo và quyết định quan trọng

- 🔴 **Đừng khai lại `value:` literal cho `NEWSROOM_ENABLED` trong `render.yaml`.**
  Đó là cách toà soạn tự tắt lần này. Van chi phí vẫn còn nguyên - không đặt gì
  thì nó tắt - nhưng blueprint không được kéo ngược service đang chạy.

- 🔴 **Đường thoát sớm nào cũng phải để lại dấu.** Cả ba lỗi ở đây cùng một họ:
  một nhánh trả về sớm mà không ghi gì. `tick()` thoát ở dòng đầu ⇒ không sự
  kiện nào ⇒ không ai biết toà soạn tắt. `reclaimStale` giết mà không ghi ⇒ không
  bao giờ hồi sinh được. `act()` bỏ qua phản hồi ⇒ mọi kết cục trông như nhau.
  **Im lặng không phải trạng thái trung tính - nó là trạng thái sai khó phát
  hiện nhất.**

- ⚠️ **`newsroom:check` một mình không đủ để chẩn đoán, và nó tự biết vậy.** Nó
  đếm `AgentRun` nên chỉ trả lời được "có chạy hay không", không trả lời được
  "vì sao không". Dùng `newsroom:chan-doan` trước, `newsroom:check` sau để nghiệm
  thu.

- ⚠️ **Nút "Duyệt đăng" không bao giờ có phản hồi tức thì**, kể cả sau bản vá -
  đó là bản chất của kiến trúc hàng đợi + nhịp mỗi giờ, không phải khiếm khuyết.
  Thứ bản vá đổi là: nay nó **nói ra** điều đó.
