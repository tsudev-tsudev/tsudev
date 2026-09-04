# PHIẾU BÀN GIAO - Cổng canh kênh toà soạn im lặng

- **Mã phiếu**: 20260827-03
- **Từ**: phiên 29 (`backend-api` + `qa-test` + `infra-deploy`) - **Đến**: chủ dự án / phiên 30
- **Thời điểm**: 18:20 27/08/2026
- **Trạng thái**: MỞ - code xong, mọi cổng xanh, **một quyết định cần chủ dự án (§5)**
- **Nhánh git**: `feat/cong-canh-kenh-toa-soan` (tách từ `main` = `3529651`, **KHÔNG migration**)

## 1. Lỗ hổng cần bịt

Ngày 27/08/2026 đóng được `/docs` sau khi gỡ **ba tầng** chồng nhau. Cả ba sống
nhiều ngày mà **không có gì đỏ lên**, và lý do rất cụ thể - mọi cổng đang có đều
hỏi cùng một câu hỏi sai:

| cổng                 | nó hỏi gì                    | vì sao không bắt được               |
| -------------------- | ---------------------------- | ----------------------------------- |
| `newsroom:check`     | "toà soạn có chạy không"     | CÓ - nó chạy đầy đủ cho BLOG        |
| `newsroom:chan-doan` | "van nào của `tick()` đóng"  | không van nào đóng cả               |
| test đơn vị          | "mã có đúng hình dạng không" | mã đúng; dữ liệu production mới sai |

Không cổng nào hỏi **"KÊNH NÀY đã bao lâu không ra bài"** - mà đó mới là câu hỏi
một trang trống trả lời được.

## 2. Đã dựng

**`services/newsroom-service/src/channelHealth.ts`** - logic quyết định, **thuần**:
không đọc `Date.now()`, không đọc `process.env`, không chạm database. Tách ra vì
phần dễ sai là QUYẾT ĐỊNH, không phải truy vấn - và tách thì test dựng thẳng được
mọi ca biên mà không cần một database nào.

**`scripts/canh-kenh-toa-soan.js`** (`npm run newsroom:canh-kenh`) - nạp dữ liệu
rồi gọi hàm trên. **CHỈ ĐỌC.**

> Khác `chan-doan` ở đúng một điểm quyết định: script này có **MÃ THOÁT**
> (`0` đạt · `1` có kênh đỏ · `2` script tự hỏng). `chan-doan` là báo cáo để người
> đọc lần ra nguyên nhân nên nó luôn thoát 0; **một cổng không có mã thoát thì
> không phải cổng** - không cắm vào cron hay CI được.

## 3. Nguyên tắc chia mức - đây là phần quyết định cổng SỐNG hay CHẾT

**Cổng trượt vì KẾT QUẢ; trục trặc ở nguồn chỉ giải thích TẠI SAO.**

Bản đầu của tôi bắt mọi trục trặc nguồn thành ĐỎ. Chạy thử trên prod thì hỏng
ngay: Tuổi Trẻ và Genk kẹt **8 ngày** không được quét, **trong khi BLOG vẫn đăng
đều** (64 bài PUBLISHED, 2 bài/ngày). Cổng sẽ đỏ vĩnh viễn trong khi trang đầy bài.

Một cổng kêu oan thì người ta ngừng đọc nó - tức **nó chết mà vẫn còn chạy**, đúng
kiểu hỏng mà repo này ghét nhất. Nên:

| tình huống                            | mức           | có chặn |
| ------------------------------------- | ------------- | ------- |
| kênh còn ra bài + nguồn trục trặc     | **VÀNG**      | không   |
| kênh KHÔNG ra bài + nguồn trục trặc   | **ĐỎ**        | có      |
| kênh tắt                              | `TAT`         | không   |
| chưa từng ra bài + chưa từng có nguồn | `KHONG_NGUON` | không   |
| **TỪNG ra bài** rồi mất hết nguồn     | **ĐỎ**        | có      |

Hai dòng cuối trông giống hệt nhau ("không có nguồn nào") mà ý nghĩa ngược nhau:
một cái là **thiết kế** (kênh PROJECT từ 27/08), cái kia là **hồi quy** (có người
tắt hoặc xoá nhầm). Gộp chúng làm một là bỏ lọt đúng thứ cổng sinh ra để bắt.

Và khi đỏ, cổng nêu **mắt xích đứt** chứ không chỉ nói "kênh im lặng" - im lặng là
hệ quả, không phải nguyên nhân.

## 4. Ba ngưỡng, ba lý do khác nhau

| ngưỡng      | giá trị    | vì sao đúng con số đó                                                                                                              |
| ----------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `choQuetMs` | **6 giờ**  | nhịp mỗi giờ, mỗi nhịp quét tối đa 3 nguồn ⇒ nguồn mới phải chờ vài nhịp. Dưới 6 giờ là báo động giả mỗi lần thêm nguồn            |
| `quetCuMs`  | **3 ngày** | kênh tồn hàng đợi thì nguồn bị bỏ qua HỢP LỆ khoảng một ngày (trần theo kênh) - 3 ngày không bắt nhầm ca đó; ca thật là **8 ngày** |
| `imLangMs`  | **7 ngày** | kênh DOC trần 1 bài/ngày và nguồn là chính kho mã ⇒ vài ngày trống là bình thường; 7 ngày thì không                                |

⚠️ **`choQuetMs` = 6 GIỜ chứ không phải ngày, và đó là điểm ăn thua.** Sự cố thật:
nguồn DOC tạo 13:16 ngày 26/08, tới 09:28 hôm sau vẫn chưa từng được quét - mới
**20 giờ**. Ân hạn theo NGÀY thì cổng im suốt tuần đầu và sự cố sống y như cũ. Có
test dựng lại đúng mốc 20 giờ đó.

## 5. 🟠 Quyết định cần chủ dự án: chạy cổng này TỰ ĐỘNG bằng gì

Hiện cổng chạy khi có người gõ. Một cổng chỉ chạy khi có người nhớ thì nó bịt được
một nửa lỗ hổng - nửa còn lại vẫn là "không ai để ý trong nhiều ngày".

Hai đường, và tôi **không tự chọn** vì cả hai đều đánh đổi thật:

| đường                                | đánh đổi                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| GitHub Actions chạy theo lịch        | Cần đặt **DATABASE_URL của prod thành secret GitHub**. Đó là quyết định bảo mật, không phải quyết định kỹ thuật |
| Gõ tay định kỳ (ví dụ mỗi đầu phiên) | Không thêm bề mặt bảo mật nào, nhưng phụ thuộc trí nhớ                                                          |

Đường thứ ba - nhét vào `infrastructure/newsroom-cron/` - **không dùng được**: đó
là Cloudflare Worker, không có kết nối Postgres.

Gợi ý tối thiểu mà không tốn gì: thêm `npm run newsroom:canh-kenh` vào thói quen
đầu phiên, cạnh việc đọc `logs/STATE.md`.

## 6. Test: 86 → 107 (newsroom), toàn bộ logic không cần database

18 test mới, trong đó **bốn ca dựng lại đúng số đo production**:

- nguồn DOC chưa từng được quét sau 20 giờ ⇒ ĐỎ (bắt được **ngày đầu**)
- Genk kẹt 8 ngày mà BLOG vẫn đăng ⇒ **VÀNG**, cổng vẫn ĐẠT
- cùng nguồn đó nhưng kênh đã ngừng ra bài ⇒ **ĐỎ**, và nêu tên "Genk"
- 403 của `/contents/docs` ⇒ ĐỎ với mã `NGUON_LOI`

Có một test khoá riêng việc **mã lý do là hằng ổn định** (`BINH_THUONG`,
`NGUON_LOI`, …): câu chữ tiếng Việt sẽ được sửa cho dễ đọc, và một cái cron grep
câu chữ sẽ hỏng lặng lẽ ở lần sửa đó.

## 7. Nghiệm thu trên production - cổng cho đúng bốn kết luận

```
! BLOG     nguồn "Tuổi Trẻ - Nhịp sống số" quét lần cuối 8 ngày trước
✔ DOC      nguồn còn mới, chưa ra bài nhưng chưa tới mức đáng lo
· PROJECT  không có nguồn nào đang bật ⇒ kênh này sẽ không bao giờ ra bài
· TRUST    không có nguồn nào đang bật ⇒ kênh này sẽ không bao giờ ra bài

✔ ĐẠT - không kênh nào đang im lặng bất thường.
! 1 cảnh báo (không chặn): BLOG/NGUON_QUET_CU
MÃ THOÁT = 0
```

Cả bốn đều đúng: BLOG khoẻ nhưng có nguồn ngủ · DOC vừa thông hôm nay, chưa kịp ra
bài · PROJECT và TRUST cố ý không có nguồn.

> Lần chạy đầu in ra `undefined` ở dòng BLOG vì tôi quên khai ký hiệu cho mức
> `VANG` vừa thêm. Đã sửa, và ghi lý do ngay tại bảng ký hiệu: **một cổng báo động
> mà tự nó in `undefined` thì người đọc sẽ ngờ cả kết luận của nó.**

## 8. File

```
services/newsroom-service/src/channelHealth.ts       MỚI - logic thuần, test được
services/newsroom-service/test/channelHealth.test.ts MỚI - 18 test, 4 ca từ prod thật
scripts/canh-kenh-toa-soan.js                        MỚI - cổng, CHỈ ĐỌC, có mã thoát
package.json                                         thêm script newsroom:canh-kenh
```
