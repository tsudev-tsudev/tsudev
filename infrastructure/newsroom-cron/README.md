# Worker cron của Toà soạn Agent AI

Bộ ping giữ ấm Render mà `HANDOFF.md` §1.1 còn nợ, **và** nhịp đập cho
`newsroom-service`. Một Worker, hai việc, **0đ**.

| Nhịp cron     | Gọi gì                    | Chạm DB? | Vì sao nhịp đó                                                            |
| ------------- | ------------------------- | -------- | ------------------------------------------------------------------------- |
| `*/5 * * * *` | `GET /health`             | Không    | Render free ngủ sau ~15 phút không có request                             |
| `7 * * * *`   | `POST /api/newsroom/tick` | **Có**   | Neon free chỉ có 100 CU-giờ/tháng và tự ngủ sau ~5 phút không có truy vấn |

⚠️ **Đừng gộp hai nhịp lại làm một.** Truy vấn database đúng mỗi 5 phút nghĩa là
compute của Neon không bao giờ ngủ: ~186 CU-giờ/tháng ở 0,25 CU trên hạn mức
100 ⇒ Neon treo compute tới đầu tháng sau ⇒ **cả site chết**, không riêng toà
soạn. Chi tiết và các hạn mức khác: [`docs/free-tier.md`](../../docs/free-tier.md).

## Vì sao tách khỏi `apps/frontend-main`

`frontend-main` dựng bằng `opennextjs-cloudflare`; `.open-next/worker.js` là mã
sinh tự động chỉ có `fetch` handler. Nhét `scheduled` vào đó phải bọc entry của
open-next — một điểm sẽ vỡ ở mỗi lần nâng cấp, đổi lấy thứ mà 30 dòng làm được.

Tách ra còn nghĩa là: cron hỏng thì trang web vẫn chạy, và deploy trang web
không đụng tới cron.

## Chi phí

| Hạng mục      | Gói Free                 | Dùng thực tế                                                          |
| ------------- | ------------------------ | --------------------------------------------------------------------- |
| Cron Triggers | Có, không tính phí riêng | 288 + 24 = 312 lượt/ngày                                              |
| Request       | 100.000/ngày             | 312                                                                   |
| CPU           | 10ms mỗi lần gọi         | ~1ms (chỉ `fetch` rồi chờ I/O; thời gian chờ mạng không tính vào CPU) |

## Phát hành

Chạy từ **gốc repo**:

```bash
npm run cron:secret     # dán NEWSROOM_TICK_TOKEN - phải TRÙNG giá trị ở Render
npm run cron:deploy
npm run cron:tail       # xem log trực tiếp
```

⚠️ `NEWSROOM_TICK_TOKEN` phải **giống hệt** ở hai nơi: secret của Worker này và
biến môi trường của `tsudev-backend` trên Render. Lệch nhau ⇒ mọi lượt tick trả
401 và toà soạn im lặng đứng yên — không có gì báo lỗi, vì đứng yên cũng là một
trạng thái hợp lệ. Đây đúng kiểu sự cố mà `INTERNAL_IDENTITY_SECRET` đã gây ra
một lần; xem `CLAUDE.md`.

## Nghiệm thu

Không phải chờ 5 phút — Worker có đường gõ tay, đã gác bằng chính token đó:

```bash
curl -X POST https://tsudev-newsroom-cron.<subdomain>.workers.dev/tick \
  -H "x-newsroom-token: $NEWSROOM_TICK_TOKEN"
# → {"accepted":true}
```

Rồi kiểm ở phía backend rằng lượt tick đã tới:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST https://tsudev-backend.onrender.com/api/newsroom/tick
# → 401 (đúng: đã tới newsroom-service và bị cổng token chặn)
# → 404 nghĩa là bảng tiền tố của backend-bundle chưa có '/api/newsroom'
```

## Khi cron chết

Cron chết là **mất cả hai việc**: toà soạn đứng yên _và_ Render ngủ. Cả hai đều
im lặng. Nên vẫn dựng một giám sát ngoài (UptimeRobot free) trỏ vào
`https://tsudev-backend.onrender.com/health` — nó là lưới an toàn cho lưới an
toàn.
