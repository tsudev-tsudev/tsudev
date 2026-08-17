# observability

Theo dõi lỗi và cảnh báo. **Thư mục thuần, không phải npm workspace** - không có
`package.json`, import theo đường dẫn tương đối chứ không phải `@tsudev/...`.

| File            | Việc                                                   |
| --------------- | ------------------------------------------------------ |
| `initSentry.js` | bật Sentry khi có `SENTRY_DSN` (cả server lẫn browser) |
| `notify.js`     | gửi cảnh báo tới Telegram và email                     |

## Cấu hình

| Biến                                     | Dùng cho                       |
| ---------------------------------------- | ------------------------------ |
| `SENTRY_DSN`                             | Sentry                         |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | cảnh báo Telegram              |
| `ALERT_EMAIL_WEBHOOK`, `ALERT_EMAIL_TO`  | cảnh báo email                 |
| `NEW_RELIC_LICENSE_KEY`                  | APM (`newrelic.js` ở gốc repo) |

Chưa cấu hình thì `notify.js` chỉ log `would send` - an toàn cho dev, không im
lặng nuốt lỗi.

## Điều kiện kích hoạt

Theo TSD §4.2: tỷ lệ lỗi > 1%, service downtime, exception nghiêm trọng.

Nghiệm thu: `GET /debug/boom` trên content-service (chỉ có ngoài production) →
500 → cảnh báo phải tới trong 30 giây.
