# PHIẾU BÀN GIAO - Vì sao /docs và /projects không có bài của Agent AI

- **Mã phiếu**: 20260827-02
- **Từ**: phiên 29 (`backend-api` + `data-schema` + `qa-test`) - **Đến**: chủ dự án / phiên 30
- **Thời điểm**: 14:55 27/08/2026
- **Trạng thái**: HOÀN THÀNH - PR #89 + #90 đã merge, secret đã đặt, **`/docs` đã thông** (xem §7-§8)
- **Nhánh git**: `fix/toa-soan-bo-doi-kenh-doc` (tách từ `main` = `23af25d`, **KHÔNG migration**)

## 1. Hai trang, hai nguyên nhân khác hẳn nhau

Câu hỏi nhận được gộp `/docs` và `/projects` làm một. Số đo tách chúng ra ngay:
không cái nào là "mã hỏng", và cách sửa của hai cái không liên quan gì đến nhau.

## 2. `/docs` - chuỗi chết ở mắt xích ĐẦU TIÊN

Mã ghi sẵn chuỗi: `NewsroomSource.target → TopicIdea.target → ContentDraft.target`.

**Số đo dứt điểm trên prod (27/08/2026):**

| `TopicIdea` từ trước tới nay |       |
| ---------------------------- | ----- |
| BLOG                         | 220   |
| PROJECT                      | 9     |
| **DOC**                      | **0** |

Chưa MỘT ý tưởng DOC nào từng được sinh ra. Nên nhánh `draft.target === 'DOC'`
trong `onPublishRequested` - có `buildDocSearch`, có chống trùng tiêu đề, trông
hoàn chỉnh - **chưa chạy lần nào**. Hai `Doc` đang có đều từ seed 15/08,
`authoredByAgentId` rỗng.

### 2.1. Ba lớp chồng nhau, mỗi lớp đủ để chặn

**Lớp 1 - nguồn DOC ĐÃ có, nên "chưa seed" KHÔNG còn là nguyên nhân.**
Nguồn `Kho mã tsudev (tài liệu và thay đổi)` tồn tại trên prod, `enabled=true`,
tạo lúc `13:16 26/08/2026`. Phiếu [`20260826-05`](20260826-05_toa-soan-im-lang.md)
§Bước 2 vẫn ghi "chờ seed" - **ghi chú đó đã lỗi thời và đã được sửa trong đợt
này**. Ai đọc nó rồi đi seed lại sẽ thấy không có gì đổi, và mất thêm một phiên.

Nhưng `lastScanAt` của nguồn đó vẫn **NULL**: chưa từng được quét lần nào.

**Lớp 2 - `scanSources()` thoát sớm gần như mọi nhịp.**
`scan.skipped` **119 lần / 7 ngày**. Van là `IDEA_QUEUE_CAP = 12` đếm sự kiện
`idea.created` đang PENDING; lúc đo là **14 ≥ 12**, và 8 nguồn BLOG giữ con số đó
ở trên trần gần như liên tục.

**Lớp 3 - vì sao nạn nhân là DOC chứ không phải nguồn khác.**
Truy vấn chọn nguồn dùng `take: 3` **không có `orderBy` nào**, nên thứ tự do
Postgres quyết. Nguồn DOC tạo **muộn hơn 8 ngày** so với 9 nguồn kia (26/08 vs
18/08) nên nằm cuối hàng.

> **Đối chứng loại trừ giả thuyết "chuyện riêng của DOC"**: Tuổi Trẻ và Genk
> (đều là BLOG, đều tạo 18/08) cũng kẹt ở `lastScanAt = 19/08` - **8 ngày không
> được quét**. Cùng một cơ chế bỏ đói theo tuổi hàng.

### 2.2. Gốc thật sự: van TOÀN CỤC trên hàng đợi NHIỀU KÊNH

Van áp lực ngược tự nó đúng và cần thiết - nó ra đời từ một số đo thật (19/08:
hàng đợi tăng đều, không bao giờ tiêu hết). Sai lầm là nó đếm **một con số chung
cho cả toà soạn**. Trên hàng đợi nhiều kênh, một con số chung **luôn** bị kênh
đông nguồn nhất chiếm hết, và kênh chậm không bao giờ tới lượt.

Đây là lớp hỏng im lặng đúng kiểu repo này hay gặp: `newsroom:check` in "✔ Toà
soạn ĐANG CHẠY", `newsroom:chan-doan` cho thấy mọi vai đều 0% hỏng, Neuron tiêu
đều, bài BLOG ra đều. Mọi thứ xanh - chỉ có một trang của site vĩnh viễn trống.

### 2.3. Đã sửa

1. **Trần tính theo TỪNG KÊNH**: `IDEA_QUEUE_CAP` (toàn cục, 12) →
   `IDEA_QUEUE_CAP_PER_TARGET` (6). Kênh nào đầy thì chỉ nguồn CỦA KÊNH ĐÓ bị bỏ
   qua; các kênh khác vẫn quét.
   Đếm vẫn theo **sự kiện** chứ không theo `TopicIdea.consumedAt`, và khác biệt
   đó lớn: prod có **91** `TopicIdea` chưa tiêu nhưng chỉ **14** sự kiện PENDING.
   Ý tưởng tồn lại là chuyện BÌNH THƯỜNG (mỗi kênh có trần đăng/ngày, phần dư chờ
   hôm sau); lấy `consumedAt` làm thước đo áp lực thì van sẽ đóng vĩnh viễn.
2. **Thứ tự quét công bằng**:
   `orderBy: [{ lastScanAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }]`.
   `nulls: 'first'` là phần bắt buộc chứ không phải trang trí - Postgres mặc định
   xếp NULL ở **cuối** khi sắp tăng dần, nên bỏ nó đi thì nguồn chưa từng chạy
   lại xuống cuối hàng, tái tạo đúng lỗi vừa gỡ.
3. `take: 3` giữa truy vấn → hằng `SOURCES_PER_SCAN`, và vòng lặp chạy trên danh
   sách **đã lọc** (`eligible`) chứ không phải danh sách thô (`due`).

## 3. `/projects` - một nửa CỐ Ý, một nửa gán sai kênh

**Nửa cố ý, không phải lỗi:** agent **bị cấm tạo dự án mới**. Chú thích trong
`dispatcher.ts` nói rõ lý do: `Project` mang phiên bản, giấy phép và số đăng ký
bản quyền - dữ liệu pháp lý về phần mềm có thật, không được suy đoán. Nó chỉ được
cập nhật `descriptionMd` của một dự án **đã tồn tại**.

⇒ **Sẽ không bao giờ có "bài đăng" của agent ở `/projects`.** Đó là thiết kế, và
đợt này KHÔNG đổi nó.

**Nửa sai:** kênh PROJECT vẫn chạy đều và **100% đổ vào thùng rác**.

| Đo trên prod, 7 ngày                                 |        |
| ---------------------------------------------------- | ------ |
| `publish.needs_human {"reason":"project_not_found"}` | **28** |
| `ContentDraft` kênh PROJECT: PENDING_HUMAN           | 6      |
| `ContentDraft` kênh PROJECT: **PUBLISHED**           | **0**  |

Lý do hiện ra ngay khi đặt hai cột cạnh nhau:

| Nguồn của kênh PROJECT | **GitHub Blog - Engineering** (tin bên ngoài)                              |
| ---------------------- | -------------------------------------------------------------------------- |
| Slug agent nhắm tới    | `lam-viec-voi-github-copilot-sdk-cho-java`, `cach-github-su-dung-ebpf-...` |
| Project có thật        | `topology-check`, `tsudev-platform`, `tsudev-trust-seal`, `tsudev-ui`      |

Gán một nguồn **tin tức bên ngoài** cho một kênh chỉ được phép sửa **dự án nội
bộ**. Slug sinh từ tiêu đề bài báo GitHub thì vĩnh viễn không trùng slug dự án
tsudev. Mỗi lượt tốn Neuron để viết một bản nháp chắc chắn bị vứt.

### 3.1. Đã sửa - và vì sao chọn cách này

Ba phương án cân nhắc:

|                                    | đánh giá                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------- |
| Tắt hẳn kênh PROJECT               | Mất nguồn tin kỹ thuật tốt, và nhánh đăng PROJECT vẫn đúng - không đáng vứt |
| Thêm `kind` mới đọc bảng `Project` | Đúng hướng nhưng là TÍNH NĂNG mới, ngoài phạm vi một bản vá                 |
| **Chuyển nguồn về đúng kênh**      | **Chọn**                                                                    |

`GitHub Blog - Engineering` vốn là tin kỹ thuật, **đúng chất BLOG** - cùng loại
Dev.to, Lobsters, Hacker News. Đổi `target: 'PROJECT'` → `'BLOG'` giữ được giá
trị nội dung và bỏ phần lãng phí.

Kênh PROJECT nay **cố ý không có nguồn nào**. Nhánh đăng của nó vẫn nằm trong mã,
chờ một nguồn phát ra ĐÚNG SLUG DỰ ÁN CÓ THẬT. Đã khai điều đó thành chú thích
trong seed **và thành test**, nên không bật lén lại được.

## 4. Test - và ba phép đột biến chứng minh test là thật

`services/newsroom-service/test/backPressure.test.ts` viết lại; thêm
`test/sourceTargets.test.ts`. newsroom **73 → 81** test, toàn repo **710 xanh**.

Guard mới khoá đúng bốn thứ đã hỏng: trần theo kênh, phép lọc đọc `s.target`,
`orderBy` có `nulls: 'first'`, và vòng lặp chạy trên danh sách đã lọc.

Một test đọc mã nguồn dễ trở thành lời khen rỗng, nên đã **thử gỡ bản vá và xem
test có đỏ không**:

| đột biến                              | kết quả     |
| ------------------------------------- | ----------- |
| bỏ `nulls: 'first'`                   | **1 đỏ** ✅ |
| phép lọc thành no-op                  | **1 đỏ** ✅ |
| lặp lại trên `due` thay vì `eligible` | **1 đỏ** ✅ |
| khôi phục                             | 81 xanh     |

> Bản đầu của `sourceTargets.test.ts` tự nó là một ví dụ: nó khớp
> `target: 'PROJECT'` nằm trong **chú thích** và báo có 1 nguồn PROJECT không tồn
> tại. Test đọc mã bằng biểu thức chính quy mà không lọc chú thích thì nó đang đo
> VĂN BẢN, không đo CẤU HÌNH. Đã lọc, và ghi lý do ngay trong hàm.

## 5. Việc còn lại - cần chủ dự án

### 5.1. 🔴 Phải chạy lại seed trên prod, nếu không §3 KHÔNG có tác dụng

Đổi `target` trong `seed-newsroom.js` chỉ vào database khi seed chạy lại. Seed
**idempotent** và cập nhật `target` theo `label`, nên chạy lại là đủ:

```
set -a && . ~/.tsudev-prod.env && set +a && npm run db:seed:newsroom
```

Nghiệm thu: `npm run newsroom:chan-doan` với env prod, mục "5. Nguồn đề tài" phải
cho thấy `GitHub Blog - Engineering` mang **BLOG**, và **không dòng nào** còn
mang PROJECT.

§2 (van + thứ tự quét) thì **không cần seed** - nó vào theo bản dựng backend khi
Render tự deploy lúc merge.

### 5.2. Nghiệm thu §2 phải ĐO, đừng suy ra từ việc đã merge

Sau khi backend lên, chạy `newsroom:chan-doan` với env prod và kiểm hai thứ:

1. Nguồn DOC có `quét=` một mốc thời gian thật (không còn `-`).
2. Sau vài nhịp, `TopicIdea` kênh DOC > 0.

Bài tài liệu đầu tiên còn phải qua write → review → seo → publish, nên đừng chờ
`/docs` đổi ngay trong giờ đầu. **Thứ chứng minh bản vá chạy là nguồn DOC được
quét**, không phải bài đã lên.

⚠️ `newsroom:check` **không** bắt được lớp lỗi này - nó chỉ đếm `AgentRun` tăng,
mà toà soạn vẫn chạy đầy đủ cho BLOG suốt thời gian `/docs` chết.

### 5.3. Rác còn lại trên prod (không chặn gì)

6 `ContentDraft` PROJECT ở PENDING_HUMAN và 3 ở IN_PROGRESS. Ba cái IN_PROGRESS
sẽ còn đẻ thêm `publish.needs_human` một lần nữa rồi thôi. Dọn tay ở
`/admin/newsroom` nếu thấy vướng mắt.

## 6. File đã đổi

```
services/newsroom-service/src/dispatcher.ts        trần theo kênh + thứ tự quét công bằng
packages/db/prisma/seed-newsroom.js                GitHub Blog: PROJECT -> BLOG (+ lý do)
services/newsroom-service/test/backPressure.test.ts  viết lại, +5 guard
services/newsroom-service/test/sourceTargets.test.ts MỚI - canh hình dạng nguồn trong seed
services/newsroom-service/test/publishDoc.test.ts    chú thích: thêm nguồn CHƯA đủ
logs/handover/20260826-05_toa-soan-im-lang.md        Bước 2 đã chạy - sửa ghi chú lỗi thời
logs/STATE.md                                        như trên
```

---

## 7. Nghiệm thu trên prod (27/08/2026) - bản vá ĐÚNG, và nó mở ra tầng tiếp theo

PR #89 đã merge, `db:seed:newsroom` đã chạy trên prod. Đo lại:

**Cả hai cơ chế đều chứng minh được bằng số, không phải suy luận:**

|                             |                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Nguồn DOC                   | `quét=09:28 27/08/2026` - **lần đầu tiên kể từ khi tạo** (26/08), và đi TRƯỚC mọi nguồn khác ⇒ `nulls: 'first'` ăn |
| Số nguồn quét lượt đó       | **1**, không phải 3 - BLOG bão hoà nên bị lọc, DOC vẫn lọt ⇒ trần theo kênh ăn                                     |
| `GitHub Blog - Engineering` | nay mang **BLOG**                                                                                                  |
| Kênh PROJECT                | **không còn nguồn nào**                                                                                            |

Nếu van toàn cục còn đó, lượt 09:28 đã bị bỏ qua sạch như 119 lần trước.

### 7.1. 🔴 Tầng thứ ba: `GitHub HTTP 403 (/contents/docs)`

Ngay khi được quét lần đầu, nguồn DOC ném lỗi và ghi vào `lastError`.

Ba phép đo tách nguyên nhân:

1. Cùng endpoint, cùng `user-agent`, gọi **từ máy dev → 200**.
2. `user-agent` trong `fetchRepoDocs` **đã đặt đúng** ⇒ không phải lỗi kinh điển
   "GitHub 403 vì thiếu User-Agent".
3. Trần GitHub API **không xác thực: 60 lượt/giờ, tính theo ĐỊA CHỈ IP**.

⇒ 403 là **cạn hạn mức**, và khác biệt duy nhất giữa hai phép gọi là IP. Render
free đi ra bằng **IP dùng chung** giữa nhiều khách: ta góp 2 lượt/giờ, hàng xóm
đốt hết phần còn lại.

> **Chú thích trong mã đã nói sai, và cái sai nằm ở hai chữ "của ai".** > `fetchRepoDocs` viết: _"trần là 60 lượt/giờ theo IP - lượt quét chạy mỗi giờ và
> dùng 2 lượt, nên biên vẫn rất rộng"_. Phép tính đúng; giả định ngầm "60 lượt đó
> là của mình" mới sai. Trên hạ tầng dùng chung, biên không rộng - nó bằng 0 vào
> bất cứ lúc nào.

**Vì sao không thể thấy trước hôm nay:** nguồn chưa từng được quét thì chưa từng
gọi API. Lỗi này nằm sau đúng cái cửa mà §2 vừa mở. Bản vá bỏ-đói không sai - nó
làm lộ ra tầng kế tiếp, và đó là dấu hiệu nó chạy.

### 7.2. Đã vá - PR riêng

Xem nhánh `fix/newsroom-github-han-muc`:

- `NEWSROOM_GITHUB_TOKEN` (tuỳ chọn) → trần **60 → 5.000 lượt/giờ**, tính theo
  **khoá** thay vì theo IP dùng chung. Repo Public nên khoá **không cần scope nào**.
  Cố ý KHÔNG đặt tên `GITHUB_TOKEN`: cái tên đó có nghĩa khác trong GitHub Actions.
- Thông báo lỗi phân biệt **cạn hạn mức** với **không có quyền** bằng
  `x-ratelimit-remaining`. Cả hai đều là 403; bản trước in chung một dòng, và
  người đọc dòng đó ở `/admin/newsroom` sẽ đi kiểm quyền repo trong khi repo
  Public và quyền hoàn toàn lành.

⚠️ Mã chạy được **cả khi chưa có khoá** (repo Public), chỉ là vẫn dính 60/giờ theo
IP dùng chung - tức vẫn hỏng trên Render. **Phải đặt secret thì mới thật sự vá.**

---

## 8. Kết: `/docs` đã thông, đo lúc 10:38 27/08/2026

Sau khi chủ dự án đặt secret `NEWSROOM_GITHUB_TOKEN` ở Render và merge #90:

| phép đo                           | trước                              | sau                |
| --------------------------------- | ---------------------------------- | ------------------ |
| `NewsroomSource` DOC `lastError`  | `GitHub HTTP 403 (/contents/docs)` | **rỗng**           |
| `NewsroomSource` DOC `lastScanAt` | `-` (chưa từng)                    | `10:38 27/08/2026` |
| `TopicIdea` kênh DOC              | **0** (suốt lịch sử dự án)         | **3**              |

Ba ý tưởng sinh ra rút từ chính commit `feat(...)` của phiên 29 - xác minh tài
khoản, nâng next@16.3.3, bộ tìm kiếm. Tức nguồn `repo_docs` đọc đúng thứ nó được
thiết kế để đọc.

**Bài chưa lên `/docs` ngay, và đó không phải lỗi**: 60 việc PENDING trong hàng
đợi, ý tưởng DOC đứng thứ 19/21, mỗi nhịp nhặt 5 và nhịp mỗi giờ ⇒ khoảng 12 giờ.
Trần kênh DOC là 1 bài/ngày. Gõ thêm `npm run newsroom:check` nếu muốn nhanh, và
bấm "Hồi sinh việc đã dừng" cho **35** sự kiện DEAD.

### 8.1. Ba tầng, và vì sao không thể thấy trước

| tầng | phát hiện        |                                                            |
| ---- | ---------------- | ---------------------------------------------------------- |
| 1    | phiên 25 (26/08) | thiếu nguồn DOC - **chưa đủ**                              |
| 2    | phiên 29 (27/08) | van toàn cục + không `orderBy` ⇒ nguồn chưa từng được quét |
| 3    | phiên 29 (27/08) | quét được rồi thì ăn 403 vì IP dùng chung của Render       |

Mỗi tầng chỉ lộ ra sau khi gỡ tầng trước. Tầng 3 **không thể biết trước**: chưa
quét thì chưa gọi API, chưa gọi API thì chưa có 403. Một bản vá làm lộ ra tầng kế
tiếp là dấu hiệu nó CHẠY.

Đáng ghi thêm: cả ba tầng đều **không làm gì đỏ lên**. `newsroom:check` in "✔ Toà
soạn ĐANG CHẠY THẬT" suốt thời gian đó, vì nó đếm `AgentRun` tăng - mà toà soạn
vẫn chạy đầy đủ cho BLOG. Chỉ có một trang của site trống, và không có cổng nào
canh "một kênh đã bao lâu không ra bài".

## 9. 🔴 Sự cố suýt xảy ra: merge #88 trước khi chạy migration

Không thuộc đợt này, nhưng phát hiện trong lúc nghiệm thu nên ghi lại ở đây.

PR #88 (VERIFY-CODE) được merge **TRƯỚC** khi `prisma migrate deploy` chạy trên
prod. Đó đúng là thứ tự mà phiếu `20260827-01`, `LOCKS.md`, mô tả PR #88 và chính
đầu file migration đều cảnh báo là làm **SẬP CẢ SITE**.

Đo lúc phát hiện: `prisma migrate status` báo `20260826152436_email_verify_code`
**chưa áp dụng**, trong khi `main` đã chứa mã cần nó.

**Site vẫn 200 vì hai điều MAY, không phải vì an toàn:**

1. Migration này **thuần bổ sung** - `ALTER TYPE ... ADD VALUE` và
   `ADD COLUMN ... NOT NULL DEFAULT 0`. Không có `DROP`, không có `RENAME`, nên
   backend cũ đang chạy không hề bị nó phá.
2. **Render chưa dựng xong** bản mới tại thời điểm đó, nên mã cần cột mới chưa
   thực sự chạy.

Đã áp migration ngay khi phát hiện. Sau đó: `migrate status` → "Database schema is
up to date!", và `/`, `/blog`, `/docs`, `/settings/profile` đều 200.

> **Điều cần rút ra**: cái cứu site lần này là TÍNH CHẤT của migration, không phải
> quy trình. Một migration có `DROP COLUMN` hay `RENAME` trong cùng thứ tự đó sẽ
> hạ site ngay khi Render dựng xong, và triệu chứng sẽ là 500 trên mọi trang - đúng
> `BLOG-500` đã xảy ra 26/08. Quy trình tồn tại cho những lần không may.
