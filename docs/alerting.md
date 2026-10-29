# Báo động - đặt `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID`

> Trả lời câu hỏi vận hành: **"làm sao tôi biết site hỏng mà không phải tự mở ra
> xem?"**

## Vì sao file này tồn tại

Ngày 28/10/2026 đo được tsudev.com trả HTTP 200 ở mọi trang công khai với nội
dung **rỗng hoàn toàn** - `sitemap.xml` còn đúng 7 URL tĩnh, `feed.xml` 0 item.
Việc đó sống **hai tháng**.

Nay đã có cổng đo (`prod:dem-noi-dung`, chạy tự động trong Worker cron hai lượt
mỗi ngày) và nó phát hiện đúng. Nhưng **nó chưa gửi được tin cho ai**:

```
[cron] CHƯA cấu hình Telegram - báo động chỉ nằm ở log này:
  ✘ sitemap.xml — HTTP 500 · 0 URL — cần ≥ 8
  ...
```

Và đây là phần đáng chú ý hơn: **kênh báo động của repo chưa bao giờ được cấu
hình ở đâu cả.** `packages/observability/notify.js` hỗ trợ Telegram và email
webhook từ lâu, nhưng không biến nào được khai trong `render.yaml` lẫn
`.env.example`. Nghĩa là báo động của `migrationGate` - thứ sẽ hét lên khi
database thiếu migration, đúng loại sự cố làm sập cả site - cũng đang đi vào hư
không.

Hai biến dưới đây bật **cả hai** đường đó.

## Hai chỗ phải đặt, và chúng KHÁC NHAU

| nơi                                          | ai báo động                                                               | đặt bằng gì                    |
| -------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------ |
| **Cloudflare Worker** `tsudev-newsroom-cron` | cổng đếm nội dung (site trống)                                            | `npm run cron:secret-telegram` |
| **Render** `tsudev-backend`                  | `migrationGate` (DB thiếu migration) và mọi lời gọi `notify.alert()` khác | dashboard Render → Environment |

Cùng tên biến, cùng giá trị, nhưng **hai hệ thống khác nhau** - đặt một chỗ thì
chỗ kia vẫn im lặng.

---

## Bước 1 - Tạo bot và lấy token

Mở Telegram, tìm **@BotFather**, gửi:

```
/newbot
```

Nó hỏi hai thứ:

1. **Tên hiển thị** - gõ gì cũng được, ví dụ `tsudev canh site`
2. **Username** - phải kết thúc bằng `bot`, ví dụ `tsudev_canh_site_bot`

BotFather trả về token, dạng:

```
8123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Đó là `TELEGRAM_BOT_TOKEN`.

> ⚠️ Token này là **mật khẩu của bot**. Ai có nó thì gửi tin được dưới danh nghĩa
> bot và đọc được mọi tin người ta gửi cho bot. Đừng dán nó vào commit, vào issue,
> hay vào `wrangler.jsonc`. Lỡ lộ thì `/revoke` ở BotFather để cấp token mới.

## Bước 2 - Lấy `TELEGRAM_CHAT_ID`

🔴 **Phải NHẮN CHO BOT TRƯỚC.** Telegram không cho bot chủ động nhắn tới một
người chưa từng nhắn cho nó - đây là cơ chế chống spam, không phải lỗi cấu hình.
Bỏ qua bước này thì bước sau trả về danh sách rỗng và rất dễ chẩn nhầm thành
"token sai".

1. Trong Telegram, mở bot vừa tạo (BotFather cho sẵn đường dẫn `t.me/<username>`)
2. Bấm **Start**, hoặc gửi một tin bất kỳ - gõ `xin chao` là đủ
3. Rồi chạy, thay `<TOKEN>` bằng token ở bước 1:

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | python3 -m json.tool
```

Tìm `message.chat.id` trong kết quả:

```json
{
  "result": [
    {
      "message": {
        "chat": { "id": 123456789, "first_name": "...", "type": "private" }
      }
    }
  ]
}
```

`123456789` là `TELEGRAM_CHAT_ID`. Với chat riêng nó là số dương; với nhóm nó là
số **âm** (ví dụ `-1001234567890`) - giữ nguyên cả dấu trừ.

### Nếu `result` rỗng

| nguyên nhân             | cách xử                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- |
| chưa nhắn cho bot       | làm lại bước 2.1-2.2                                                                    |
| token sai               | `curl -s "https://api.telegram.org/bot<TOKEN>/getMe"` phải trả `"ok": true` kèm tên bot |
| đã gọi `getUpdates` rồi | Telegram xoá tin sau khi trả về một lần. Nhắn cho bot một tin mới rồi gọi lại           |
| bot có webhook          | `curl -s "https://api.telegram.org/bot<TOKEN>/deleteWebhook"` rồi thử lại               |

## Bước 3 - Kiểm hai giá trị TRƯỚC khi đem đi đặt

Đừng đặt secret rồi mới phát hiện giá trị sai. Gửi một tin thử bằng chính hai
giá trị đó:

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d chat_id="<CHAT_ID>" \
  -d text="tsudev: thử kênh báo động"
```

Đạt khi: điện thoại bạn **nhận được tin**, và phản hồi chứa `"ok": true`.

Đây là phép kiểm quan trọng nhất của cả file này, vì nó tách **"giá trị sai"**
khỏi **"Worker chưa đọc được giá trị"** - hai lỗi trông giống nhau nếu chỉ đi
thẳng vào bước 4.

| phản hồi                          | nghĩa                                 |
| --------------------------------- | ------------------------------------- |
| `"ok": true`                      | hai giá trị đúng                      |
| `401 Unauthorized`                | token sai                             |
| `400 chat not found`              | chat id sai, hoặc chưa nhắn cho bot   |
| `403 bot was blocked by the user` | bạn đã chặn bot - bỏ chặn rồi thử lại |

## Bước 4a - Đặt cho Cloudflare Worker

```bash
npm run cron:secret-telegram
```

Lệnh hỏi lần lượt `TELEGRAM_BOT_TOKEN` rồi `TELEGRAM_CHAT_ID`. Dán giá trị, Enter.

> Cần `wrangler` đã đăng nhập. Nếu nó báo `Not logged in` thì chạy
> `npx wrangler login` **trong một terminal thật** - nó cần TTY, gọi qua tầng
> khác sẽ thoát ngay. Và phải mở URL bằng trình duyệt **trên chính máy đó**: luồng
> OAuth quay về `http://localhost:8976`.

Kiểm đã nhận:

```bash
npx wrangler secret list --config infrastructure/newsroom-cron/wrangler.jsonc
```

Phải thấy cả hai tên. Lệnh này in **tên**, không in giá trị - đúng như phải vậy.

## Bước 4b - Đặt cho Render

Dashboard Render → service **`tsudev-backend`** → **Environment** → thêm hai biến:

```
TELEGRAM_BOT_TOKEN = <token>
TELEGRAM_CHAT_ID   = <chat id>
```

`render.yaml` đã khai sẵn hai khoá này với `sync: false`, nghĩa là blueprint
**nói rằng chúng tồn tại** nhưng không giữ giá trị. Lý do: giá trị bí mật không
được nằm trong git, và một service dựng mới từ blueprint thì an toàn mặc định
(không báo động) thay vì gửi tin tới chat của người khác.

⚠️ Đổi biến môi trường trên Render **kích hoạt dựng lại service**. Việc đó bình
thường, nhưng biết trước thì không bất ngờ: trang sẽ chờ cold start ~50 giây ở
lượt truy cập đầu sau đó.

⚠️ Và nó chạy `migrationGate` lúc khởi động. Nếu `main` đang mang một migration
chưa áp lên Neon thì lần dựng lại này là lúc nó `exit(1)`. Xem `logs/STATE.md`
trước khi đổi biến nếu đang có migration treo.

## Bước 5 - Nghiệm thu, và đừng đọc "lệnh chạy xong" thành "chạy được"

### Worker

Cổng đếm chạy vào **01:23 và 13:23 UTC** (08:23 và 20:23 giờ Việt Nam). Để xem
nó gửi thật:

```bash
npm run cron:tail
```

Rồi chờ tới nhịp. Dòng cần thấy:

```
[cron] đếm nội dung https://tsudev.com — TRƯỢT
[cron] báo động → Telegram 200
```

Dòng thứ hai là bằng chứng. Nếu thấy

```
[cron] CHƯA cấu hình Telegram - báo động chỉ nằm ở log này:
```

thì secret chưa tới được Worker - quay lại bước 4a.

**Không muốn chờ tới nhịp?** Đo phần đếm ngay bằng đường gõ tay (nó **không** gửi
báo động - cố ý, để thử không làm ồn):

```bash
curl -s https://tsudev-newsroom-cron.dev-nguyentrangtinhsu.workers.dev/dem \
  | python3 -m json.tool
```

Hoặc chạy trọn nhánh báo động ở local:

```bash
npx wrangler dev --config infrastructure/newsroom-cron/wrangler.jsonc \
  --test-scheduled --port 8788
# cửa sổ khác:
curl "http://localhost:8788/__scheduled?cron=23+1,13+*+*+*"
```

> Bản `wrangler dev` đọc secret từ `infrastructure/newsroom-cron/.dev.vars`, KHÔNG
> đọc secret trên Cloudflare. Nên lượt thử local chứng minh **mã** chạy đúng, còn
> việc **secret đã tới production** thì chỉ `secret list` và `cron:tail` trả lời
> được. Hai câu hỏi khác nhau.

### Render

Không có nhịp định kỳ nào gọi `notify.alert()`, nên đường này chỉ lên tiếng khi
có sự cố thật. Cách kiểm rẻ nhất là bước 3 ở trên - nó dùng đúng hai giá trị đó.

## Khi nào bạn sẽ nhận được tin, và khi nào KHÔNG

| tình huống                                                  | có tin?                               |
| ----------------------------------------------------------- | ------------------------------------- |
| site trả 200 nhưng rỗng nội dung                            | ✅ hai lượt/ngày tới khi khỏi         |
| database treo / backend chết                                | ✅ (biểu hiện là trang rỗng hoặc 5xx) |
| `main` có migration chưa áp lên Neon, backend khởi động lại | ✅ từ `migrationGate`                 |
| site hoàn toàn bình thường                                  | ❌ **cố ý không có tin**              |

Vì sao không báo "vẫn ổn": một tin như thế hai lần mỗi ngày là cách nhanh nhất để
người ta tắt thông báo, và lúc đó tin ĐỎ cũng không ai đọc.

Nhưng im lặng không phải bằng chứng là tốt. Muốn chắc cổng còn sống thì gõ
`/dem` - nó trả số đo thật, không phụ thuộc có báo động hay không.

## Xoay và thu hồi

| việc                | làm gì                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| token lộ            | `/revoke` ở @BotFather → cấp token mới → đặt lại ở **cả hai** chỗ (4a và 4b)                                                                       |
| đổi chat đích       | lấy chat id mới (bước 2) → đặt lại ở cả hai chỗ                                                                                                    |
| tắt báo động Worker | `npx wrangler secret delete TELEGRAM_BOT_TOKEN --config infrastructure/newsroom-cron/wrangler.jsonc` - cổng vẫn chạy và vẫn log, chỉ không gửi tin |

⚠️ Đặt lại ở **một** chỗ thôi là chỗ kia im lặng, và sự im lặng đó trông giống hệt
"không có sự cố". Đó đúng là hình dạng của sự cố hai tháng.
