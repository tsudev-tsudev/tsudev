# Ngân sách miễn phí - hạn mức nào, van ở đâu, vượt thì sao

Toàn bộ tsudev chạy trên gói miễn phí của bảy dịch vụ. Quy tắc của repo này:
**mọi thứ có thể sinh ra hoá đơn phải có một cái van trong mã, hoặc không được
dùng.** File này ghi các van đó nằm ở đâu và con số nào làm chúng đóng lại.

Số liệu trong bảng dưới được đọc từ trang giá chính thức ngày **18/08/2026**.
Nhà cung cấp đổi hạn mức mà không báo ai, nên khi con số quan trọng cho một
quyết định thì kiểm lại nguồn thay vì tin bảng này.

## Bảy dịch vụ đang dùng

| Dịch vụ                        | Hạn mức miễn phí                                            | Vượt thì sao                                              | Van trong repo                                  |
| ------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| Cloudflare Workers (site+cron) | 100.000 request/ngày · 10ms CPU mỗi lượt                    | request bị từ chối, không tính tiền                       | -                                               |
| Cloudflare Workers AI          | **10.000 Neuron/ngày**, reset 00:00 UTC                     | request **fail**, không tính tiền (chỉ gói Paid mới tính) | `NEWSROOM_DAILY_NEURON_BUDGET=8000`             |
| Cloudflare R2                  | 10 GB-tháng · 1tr Class A · 10tr Class B · egress 0đ        | -                                                         | ảnh và tệp tải lên của site                     |
| Neon (Postgres)                | 0,5 GB · **100 CU-giờ/tháng** · 5 GB egress · không cần thẻ | **treo compute** tới đầu tháng sau, không tính tiền       | nhịp cron theo giờ (xem dưới)                   |
| Render (backend)               | **750 giờ instance/tháng cho CẢ workspace**                 | **tạm dừng mọi service free** tới đầu tháng sau           | đúng MỘT service trong `render.yaml`            |
| Resend (thư giao dịch)         | 3.000 thư/tháng · 100 thư/ngày · 1 tên miền                 | -                                                         | chỉ dùng cho xác minh email và đặt lại mật khẩu |
| Google Gemini (LLM dự phòng)   | bậc Free khi project **chưa bật billing**                   | 429, toà soạn dừng và ghi event                           | chỉ chạy khi Workers AI đã cạn Neuron           |

Thêm một cái nữa không phải dịch vụ chạy nhưng vẫn có hạn mức: **GitHub Actions**
trên repo private được 2.000 phút/tháng, và hết phút thì job **bị chặn** chứ
không sinh hoá đơn (miễn là tài khoản không có phương thức thanh toán hợp lệ).
Triệu chứng vì thế không phải một dòng tiền mà là **"CI không chạy nữa" ngay giữa
một đợt phát hành** - đúng lúc cần CI nhất.

Một lượt chạy đầy đủ tốn ~18 phút tính phí (tổng năm job), nên hạn mức này chỉ
đủ cho khoảng 110 lượt/tháng. Hai van đã lắp trong `.github/workflows/ci.yml`:

- `on.push` **chỉ nghe `main`**. Trước 19/08/2026 nó nghe cả `feat/**` trong khi
  `on.pull_request` nghe mọi PR, nên mỗi lượt đẩy một nhánh đang có PR sinh HAI
  lần chạy y hệt nhau. Đo trong tháng 8: 49 lượt do push + 28 lượt do
  pull_request, khoảng 360 phút đốt vô ích (~18% hạn mức).
- `concurrency` huỷ lượt đang chạy dở khi có lượt mới trên cùng nhánh - trừ
  `main`, nơi mỗi commit là một trạng thái đã phát hành.

⚠️ Một job TREO là khoản đắt nhất ở đây: trần mặc định của GitHub là 360 phút,
tức một job treo tiêu 18% hạn mức tháng mà không sinh kết quả nào. Đã xảy ra một
lần (18/08, job E2E). Thấy một job chạy quá gấp đôi thời gian bình thường thì
huỷ tay, đừng chờ nó tự hết giờ.

Điểm chung đáng mừng của cả bảng: **không dịch vụ nào tự động tính tiền khi
vượt.** Tất cả đều chặn hoặc treo. Nghĩa là rủi ro thật của dự án này không phải
"bị trừ tiền" mà là **"site chết cho tới đầu tháng sau"** - và hai ngân sách
dưới đây là hai chỗ chật nhất.

## Ngân sách chật số 1: Render, 589 trên 750 giờ

Render free ngủ sau ~15 phút không có request, nên có bộ giữ ấm gõ cửa mỗi 5
phút. Giữ ấm 24/7 gần như tiêu hết hạn mức, nên **cả hai nhịp cron đều nghỉ
01:00-06:00 giờ Việt Nam** (chốt 19/08/2026):

| Hình giữ ấm        | Giờ instance/tháng (31 ngày) | Còn lại trên hạn mức 750 |
| ------------------ | ---------------------------- | ------------------------ |
| 24/7               | 744                          | **6 giờ**                |
| nghỉ 5 giờ mỗi đêm | **~589**                     | **~161 giờ**             |

Cái giá đã chấp nhận: người truy cập đầu tiên sau khung nghỉ chờ cold start ~50
giây. Đổi lại, biên đủ rộng để một lần dựng lại service hay một đợt gỡ lỗi không
làm vỡ hạn mức của cả workspace.

⚠️ **Hai nhịp phải nghỉ CÙNG khung.** Nhịp toà soạn cũng là một request tới
Render: để nó chạy 24/7 thì mỗi giờ đêm Render lại thức ~15 phút và khung nghỉ
chỉ tiết kiệm được khoảng một phần tư số giờ ở bảng trên.

⚠️ **Cron của Cloudflare không có múi giờ - `0-17,23` là giờ UTC.** Khung nghỉ
01:00-06:00 giờ VN (UTC+7) viết ngược lại thành "chạy ở giờ UTC 0-17 và 23". Đọc
nhầm nó thành giờ VN là đặt khung nghỉ vào đúng giờ cao điểm.

Hệ quả phải nhớ trước khi động vào Render:

- **Không được có service free thứ hai chạy liên tục.** Hạn mức tính cho cả
  workspace. Thêm một service chạy vài giờ trong tháng 31 ngày là vượt, và khi
  vượt thì Render tạm dừng **mọi** service free - kể cả `tsudev-backend`.
- `tsudev-backend-rqkz` (HANDOFF §1.10) chưa bao giờ khởi động nổi nên **không**
  tiêu giờ instance. Nó vẫn nên bị xoá, nhưng nó không phải nguồn rủi ro ở đây.
- Khung nghỉ đêm ở trên là **van duy nhất** còn lại cho ngân sách này. Muốn hẹp
  lại (nghỉ ít giờ hơn) thì phải trả bằng biên an toàn; muốn rộng ra thì trả
  bằng số giờ khách gặp cold start.

## Ngân sách chật số 2: Neon, 100 CU-giờ/tháng

Đây là hạn mức **dễ vỡ nhất và khó thấy nhất** của cả dự án, vì nó không tính
theo dung lượng hay số truy vấn mà theo **thời gian compute còn thức**.

Neon free tự ngủ sau ~5 phút không có truy vấn. Một compute 0,25 CU thức 24/7
tiêu `0,25 × 744 = 186` CU-giờ trong tháng 31 ngày - **gần gấp đôi hạn mức 100**.
Vượt là Neon treo compute tới đầu tháng sau, và lúc đó **cả site chết**, không
riêng phần nào.

Cái làm compute thức 24/7 không phải người dùng thật (site cá nhân, lưu lượng
thưa) mà là **cron gọi vào một endpoint có truy vấn database đúng mỗi 5 phút** -
tức là đánh thức lại ngay trước mỗi lần Neon định ngủ.

Vì thế Worker cron chạy **hai nhịp, gọi hai endpoint khác nhau**:

| Nhịp cron (UTC)     | Gọi gì                    | Chạm DB? | Việc                  |
| ------------------- | ------------------------- | -------- | --------------------- |
| `*/5 0-17,23 * * *` | `GET /health`             | Không    | giữ ấm Render         |
| `7 0-17,23 * * *`   | `POST /api/newsroom/tick` | **Có**   | nhịp đập của toà soạn |

`GET /health` của `backend-bundle` trả JSON tĩnh, không đụng Prisma - nên giữ ấm
Render **không** đánh thức Neon. Chỉ nhịp giờ mới đánh thức, và giữa hai lượt
Neon ngủ lại được.

⚠️ **Đừng gộp hai nhịp lại làm một** vì thấy "cùng là gõ cửa backend". Đó đúng
là hình dạng ban đầu của Worker này, và nó sẽ làm site chết vào khoảng giữa
tháng thứ hai - đủ xa lần sửa để không ai nối được nhân quả.

Chuỗi cron của nhịp đập nằm ở **hai chỗ phải trùng nguyên văn**: hằng `TICK_CRON`
trong `infrastructure/newsroom-cron/src/index.ts` và mảng `triggers.crons` trong
`wrangler.jsonc` cạnh đó. Lệch một ký tự thì lượt đó rơi xuống nhánh giữ ấm và
toà soạn đứng yên trong im lặng - Worker vẫn chạy, log vẫn xanh, chỉ là không
còn bài mới. Nay có `services/newsroom-service/test/cronContract.test.ts` đọc cả
hai tệp và bắt đúng chuyện đó, kể cả việc hai nhịp lỡ nghỉ hai khung khác nhau.

## Van chi phí của Toà soạn Agent AI

Toà soạn là phần duy nhất của repo gọi ra dịch vụ tính theo lượng dùng, nên nó
có ba van xếp chồng:

1. **`NEWSROOM_ENABLED`** - công tắc tổng. Khác `true` thì `tick()` trả về ở
   dòng đầu tiên: không truy vấn database, không gọi LLM. Đây là mặc định trong
   `render.yaml` và `.env.example`, và nó phải giữ nguyên như thế cho tới khi
   đường ống được nghiệm thu.
2. **`NEWSROOM_DAILY_NEURON_BUDGET`** (mặc định 8000) - trần Neuron/ngày, đếm từ
   bảng `AgentRun` theo mốc 00:00 UTC (đúng mốc reset của Cloudflare, không phải
   nửa đêm giờ Việt Nam). Chạm trần thì router chuyển sang Gemini; hết cả Gemini
   thì dừng và ghi event. 8000 trên 10.000 là chừa biên 20% cho vòng sửa lại.
3. **`NEWSROOM_MAX_REVISIONS`** (mặc định 2) - trần số vòng Writer↔Editor cho
   một bài. Không có trần này thì hai agent có thể quay vòng cho tới khi cạn
   hạn mức mà không ai thấy gì bất thường.

Cộng thêm một van không nằm trong biến môi trường: `/api/newsroom/tick` bị gác
bằng `NEWSROOM_TICK_TOKEN`, và Worker cron cũng gác đường gõ tay của nó bằng
chính token đó. Để hở là bất kỳ ai cũng ép toà soạn quay vòng tới cạn hạn mức -
một kiểu DoS nhắm vào hạn mức thay vì vào máy chủ.

## Danh sách cấm - làm là mất "0đ"

- **Nâng lên Workers Paid.** Trên gói Free, vượt 10.000 Neuron/ngày là request
  bị từ chối. Trên gói Paid, đúng tình huống đó thành 0,011 USD/1.000 Neuron.
  Van ngân sách trong mã sẽ vẫn chạy, nhưng nó không còn là lớp bảo vệ cuối.
- **Đổi model Workers AI sang nhóm premium** (DeepSeek, GLM, Kimi và tương tự).
  Nhóm đó đòi phương thức thanh toán kể cả khi tài khoản ở gói Free. Bảng
  `NEURONS` trong `services/newsroom-service/src/llm/workersAi.ts` chỉ liệt kê
  các model Llama, và model lạ rơi vào `NEURON_FALLBACK` - tức van vẫn đếm,
  nhưng hoá đơn thì không do van này quyết định.
- **Bật billing cho project Gemini.** Bật là Google chuyển bậc ngay lập tức và
  hết bậc Free. Khoá `GEMINI_API_KEY` phải lấy từ project **chưa** bật billing.
- **Thêm service free thứ hai trên Render** (xem ngân sách số 1).
- **Đặt cron trong GitHub Actions.** Repo private, mỗi lượt chạy tính tối thiểu
  1 phút ⇒ ~8.600 phút/tháng trên hạn mức 2.000. Việc giữ ấm đã có Worker cron
  lo, miễn phí thật.
- **Thêm binding Cloudflare cần gói trả tiền** (Queues là ví dụ rõ nhất). Cả hai
  `wrangler.jsonc` của repo hiện chỉ khai `vars`, `routes`, `triggers` và
  `observability` - không có binding nào cần Paid.

## Tự kiểm mỗi tháng

Năm phút, làm vào đầu tháng:

```bash
# 1. Không có binding tính tiền nào mọc thêm trong hai wrangler.jsonc
grep -n "queues\|durable_objects\|hyperdrive\|d1_databases" \
  apps/frontend-main/wrangler.jsonc infrastructure/newsroom-cron/wrangler.jsonc
# → không ra dòng nào

# 2. Công tắc toà soạn vẫn đúng chủ ý (false cho tới khi nghiệm thu xong)
curl -s https://tsudev-backend.onrender.com/health

# 3. Cron còn sống - nếu chết thì Render ngủ và toà soạn đứng yên, cả hai im lặng
npm run cron:tail
```

Ba thứ phải nhìn bằng mắt trên trang quản trị của nhà cung cấp, không có lệnh
nào thay được:

- **Neon** - đồ thị CU-giờ đã tiêu trong tháng. Đây là con số cần nhìn trước
  tiên; mọi thứ khác còn xa hạn mức hơn nó.
- **Render** - giờ instance đã tiêu của workspace, và **số service đang tồn tại**.
- **Cloudflare** - mục Workers AI, xem Neuron/ngày có bám sát trần 8000 không.
  Nếu có thì hạ `NEWSROOM_DAILY_NEURON_BUDGET` hoặc giảm nhịp, đừng nâng gói.
