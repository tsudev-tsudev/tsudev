# PHIẾU BÀN GIAO - Writer hỏng 80%: toà soạn chạy mà không đẻ ra bài nào

- **Mã phiếu**: 20260826-06
- **Từ**: phiên 28 (`backend-api` + `qa-test`) - **Đến**: chủ dự án / phiên 29
- **Thời điểm**: 21:45 26/08/2026
- **Trạng thái**: MỞ - chờ phát hành và một phép đo sau phát hành
- **Nhánh git**: `fix/newsroom-writer-chan-doan` (tách từ `main` = `e0c3c90`, không migration)

## 1. Việc đã làm xong

Phát hiện sau khi phiếu [`20260826-05`](20260826-05_toa-soan-im-lang.md) đã bật
lại toà soạn: hạ tầng đã đúng hết - công tắc bật, hàng đợi chạy, Neuron tiêu đều -
mà `/blog` vẫn đứng im ở bài của 25/08. Guồng quay nhưng không đẻ.

### 1.1. Số đo chỉ thẳng vào thủ phạm

Thêm phép đếm `AgentRun` theo VAI vào `npm run newsroom:chan-doan`. Lượt chạy đầu
tiên đã đủ:

```
-- Lượt chạy agent HÔM NAY, theo vai --
   write      ok=  4  hỏng= 16  (80%)
     └ 16× Writer trả về bài rỗng hoặc quá ngắn
   seo        ok=  2  hỏng=  0  (0%)
```

Nhìn nhật ký sự kiện KHÔNG cho ra kết luận này: ở đó "thỉnh thoảng lỗi" và "hỏng
hệ thống" hiện ra giống hệt nhau - đều là một chuỗi `event.failed`. Phải đếm theo
vai thì tương quan mới lộ.

### 1.2. Nguyên nhân

`write` là vai **duy nhất** bắt cả bài Markdown 800-1500 từ nằm gọn trong một
**giá trị chuỗi JSON**. Các vai khác trả về trường ngắn và hỏng 0%.

Một bài kỹ thuật tiếng Việt đầy **dấu nháy kép** - lời dẫn, tên riêng, mẫu mã
nguồn. Mỗi dấu nháy không được thoát sẽ đóng chuỗi sớm và làm hỏng **toàn bộ**
khối JSON: mất cả bài, không phải hỏng một trường.

`escapeRawControlChars` (bản vá của đợt trước) vá được xuống dòng thô và tab. Nó
**không** vá được dấu nháy lạc, và cũng không vá được đầu ra bị cắt cụt ở trần
token. Bản vá đó đúng cho triệu chứng nó gặp, và người viết nó không sai - chỉ là
cùng một thiết kế còn sinh ra hai lớp lỗi khác nữa.

`writerOutput.test.ts` chứng minh vế ngược, không phải bằng lời: lấy đúng đoạn
Markdown đó nhét vào chuỗi JSON thì `parseJsonLoose` trả `null`.

### 1.3. Bản vá

- **Thân bài đi RA NGOÀI JSON**, sau `WRITER_BODY_SEPARATOR` (`===BODY===`). Siêu
  dữ liệu (`title`, `excerpt`) vẫn là JSON vì chúng ngắn và không chứa Markdown.
  Đổi này bỏ **hẳn** cả lớp lỗi thoát chuỗi, và khi đầu ra bị cắt cụt thì phần
  mất chỉ là đuôi bài chứ không phải cả bài.
- **Giữ nhánh dự phòng JSON** cho lúc mô hình không tuân định dạng - một bài đọc
  được bằng đường cũ vẫn hơn không có bài nào - nhưng **đếm** nó qua
  `usedJsonFallback`, để nó không âm thầm trở thành đường chính.
- **`json: false`** cho vai này. Bật lên thì nhà cung cấp chèn thêm câu "chỉ trả
  về một khối JSON", đá nhau với định dạng mới.
- **Trần token thành `NEWSROOM_WRITER_MAX_TOKENS`** (mặc định 4000), chỉnh được
  mà không phải phát hành lại.
- **Ba thông điệp lỗi riêng** thay cho một câu gộp, mỗi cái kèm số ký tự,
  token/trần, có bị cắt cụt không, có đi qua nhánh dự phòng không.

Cổng: newsroom-service **73/73** (thêm 7) · bundle **20/20** · format · lint ·
typecheck xanh.

## 2. Việc dang dở + bước tiếp theo CỤ THỂ

- [ ] **Bước 1 - merge PR** rồi để Render tự deploy. Không migration, không ràng
      buộc thứ tự.

      ⚠️ Backend Render **phải lên mã mới thì bản vá mới có tác dụng**, và bài học
      hôm nay là đừng suy ra điều đó từ việc `main` đã có commit. Đo thẳng.

- [ ] **Bước 2 - đo lại tỉ lệ hỏng SAU khi backend lên.** Đây là phép nghiệm thu
      thật, và nó cần ít nhất một nhịp:

      ```
      npm run newsroom:check        # gõ một nhịp
      npm run newsroom:chan-doan    # đọc bảng "Lượt chạy agent HÔM NAY, theo vai"
      ```

      **Tiêu chí**: `write` phải tụt hẳn khỏi mốc 80%. Nếu nó vẫn cao thì thông
      điệp lỗi nay đã đủ chi tiết để nói tiếp là vì sao - đọc dòng `└` dưới mỗi
      vai, nó phân biệt "không đọc được đầu ra", "bài quá ngắn" và "bị cắt cụt".

- [ ] **Bước 3 - nếu thấy "BỊ CẮT CỤT"**: nâng `NEWSROOM_WRITER_MAX_TOKENS` ở
      Environment của `tsudev-backend` (thử 6000), hoặc siết độ dài trong giọng
      văn chuyên mục ở `NewsroomChannel.styleGuide`. Lỗi tự nói ra cả hai đường.

- [ ] **Bước 4 - nếu `usedJsonFallback` xuất hiện nhiều**: mô hình đang không
      tuân định dạng mới. Lúc đó bản vá chỉ đang che chứ không chữa, và cần siết
      lại prompt.

- [ ] **Bước 5 - dọn hàng tồn.** Còn ~56 việc PENDING và 33 DEAD. Sau khi tỉ lệ
      hỏng xuống, bấm "Hồi sinh việc đã dừng" ở `/admin/newsroom` một lần, rồi gõ
      thêm vài nhịp bằng `newsroom:check` cho hàng đợi rút nhanh hơn nhịp mỗi giờ.

## 3. File liên quan / đang khóa

`logs/LOCKS.md` đã nhả toàn bộ khóa.

| Đường dẫn                                             | Lý do                                        | Còn khóa? |
| ----------------------------------------------------- | -------------------------------------------- | --------- |
| `services/newsroom-service/src/llm/index.ts`          | `splitWriterOutput`, `WRITER_BODY_SEPARATOR` | Không     |
| `services/newsroom-service/src/agents.ts`             | prompt + ba thông điệp lỗi                   | Không     |
| `services/newsroom-service/test/writerOutput.test.ts` | **mới** - 7 test                             | Không     |
| `scripts/chan-doan-toa-soan.js`                       | đếm `AgentRun` theo vai                      | Không     |

## 4. Cảnh báo và quyết định quan trọng

- 🔴 **Đừng đưa tài liệu dài trở lại vào một chuỗi JSON.** Đó là toàn bộ nội dung
  của đợt này. Trường ngắn thì JSON tốt; một tài liệu Markdown thì mỗi dấu nháy,
  mỗi dấu chéo ngược, mỗi lần chạm trần token đều là một cách làm mất TRỌN VẸN
  bài. Cần thêm trường mới cho Writer thì thêm vào khối JSON ở đầu, giữ thân bài
  ngoài dấu tách.

- 🔴 **`WRITER_BODY_SEPARATOR` phải khớp nguyên văn giữa hằng số và prompt.** Lệch
  một ký tự thì mọi bài rơi xuống nhánh dự phòng JSON và lỗi cũ mọc lại - **im
  lặng**, vì nhánh dự phòng vẫn chạy được. `usedJsonFallback` là thứ duy nhất
  phát hiện được chuyện đó, nên đừng bỏ nó khi dọn mã.

- ⚠️ **Một thông điệp lỗi gộp nhiều nguyên nhân thì tệ hơn không có thông điệp**,
  vì nó tạo cảm giác đã biết. 16 dòng `event.failed` giống hệt nhau nói được đúng
  một điều là "có hỏng", và đã tốn một giờ để đi từ đó tới nguyên nhân. Ba dòng
  khác nhau thì trả lời luôn.

- ⚠️ **`newsroom:check` không thay được `newsroom:chan-doan` ở đây.** Nó đếm
  `AgentRun` tăng lên, mà lượt chạy HỎNG cũng làm số đó tăng. Suốt cả buổi hôm nay
  nó vẫn in "✔ Toà soạn ĐANG CHẠY THẬT" trong khi 80% lượt chạy ném lỗi.
