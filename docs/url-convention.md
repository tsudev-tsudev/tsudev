# Quy ước URL của tsudev

> Một câu hỏi, một câu trả lời: **địa chỉ nào là chính tắc?** File này là nơi
> duy nhất trả lời. Cổng và tên miền vẫn lấy từ `config/topology.json` - ở đây
> chỉ nói về _hình dạng_ của URL và về đường nào được phép lộ ra ngoài.

## 1. Một điểm vào, ở cả hai môi trường

| Môi trường | Địa chỉ CHÍNH TẮC              | Ai được biết địa chỉ này |
| ---------- | ------------------------------ | ------------------------ |
| Dev        | `http://tsudev.localhost:8080` | người phát triển         |
| Production | `https://tsudev.com`           | tất cả mọi người         |

Ngoài hai dòng đó, **không có địa chỉ thứ ba nào được gõ tay**. Cụ thể:

- `localhost:3000` (cổng nội bộ của Next), `:4001`–`:4005` (service backend),
  `:5433` (Postgres), `:9000` (MinIO) là **chi tiết cài đặt**. Chúng tồn tại,
  nhưng không ai - kể cả người phát triển - cần gõ chúng để dùng site.
- Trình duyệt không bao giờ gọi thẳng cổng service. Mọi lời gọi đi qua route
  proxy `apps/frontend-main/pages/api/<domain>/[...path].ts`.
- Ở dev, `scripts/dev-proxy.js` nghe **một** cổng (8080) và phân biệt bằng
  subdomain - đúng hình trạng production, để lỗi liên quan tới host lộ ra ở máy
  dev chứ không lộ ra ở production.

**Vì sao 8080 chứ không phải 80** (để URL không có số cổng): cổng dưới 1024 cần
quyền root trên Linux. Đổi lấy một URL đẹp hơn bằng việc chạy tiến trình dev
dưới quyền root là một đánh đổi tồi, và `sudo setcap` thì phải làm lại sau mỗi
lần cập nhật Node. Số cổng ở dev là cái giá đã cân nhắc, không phải thứ bị bỏ quên.

## 2. Bí danh gộp về một chỗ, không phục vụ song song

`www.tsudev.com` **chuyển hướng 308** về `tsudev.com`
(`apps/frontend-main/middleware.ts`, hàm `canonicalHost`).

Thẻ `<link rel="canonical">` là chưa đủ: nó là gợi ý cho công cụ tìm kiếm, không
phải quy tắc cho trình duyệt. Khi hai host cùng trả 200 thì người dùng ở lại
`www.` suốt phiên và mọi liên kết họ chia sẻ mang một tên miền thứ hai - đúng
thứ mà việc thống nhất URL sinh ra để dẹp. `NEXTAUTH_URL` cũng chỉ khai apex,
nên đường quay lại sau đăng nhập sẽ nhảy host giữa chừng.

308 chứ không phải 302: vĩnh viễn, và giữ nguyên method + body nên một POST gõ
nhầm host không biến thành GET rồi mất dữ liệu.

Bản xem trước `*.workers.dev` **không** bị chuyển hướng - phải mở được thì mới
nghiệm thu được - nhưng nhận header `X-Robots-Tag: noindex, nofollow` để một bản
nháp không đi tranh chỗ trong chỉ mục với bản thật.

Ở dev, cùng file middleware chuyển hướng 307 mọi host nằm ngoài domain cookie về
`NEXTAUTH_URL`. Đó là việc khác: nó cứu phiên đăng nhập chứ không phải cứu SEO
(cookie mang `Domain=.tsudev.localhost` nên trình duyệt vứt nó ở host khác, và
triệu chứng là _thành công giả_ - đăng nhập trả 200 mà phiên không tồn tại).

## 3. Hình dạng đường dẫn

- **Chữ thường, gạch nối, không đuôi mở rộng**: `/blog/mot-bai-viet`.
- **Không dấu `/` ở cuối** (Next mặc định `trailingSlash: false` và tự trả 308
  cho biến thể có dấu).
- **Danh từ số nhiều cho khu vực, slug cho từng mục**: `/projects/<slug>`,
  `/blog/<slug>`, `/docs/<slug>`, `/trust/verify/<serial>`.
- **Điều hướng trong site dùng href TƯƠNG ĐỐI.** tsudev chỉ còn một origin;
  `MAIN_URL` của `@tsudev/ui` chỉ dành cho URL tuyệt đối thật sự cần: thẻ
  canonical, ảnh OG, `sitemap.xml`, `robots.txt`, mã nhúng huy hiệu.
- **`/api/*` là bề mặt máy gọi máy**, không phải trang. `robots.txt` chặn nó;
  khu vực riêng tư (`/admin`, `/settings`, `/trust`) thì dùng thẻ `noindex` chứ
  KHÔNG dùng `Disallow` - lý do ghi ở đầu `pages/robots.txt.ts`.

## 4. Cổng chặn hồi quy

| Cổng                                            | Bắt được gì                                                    |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `npm run topology:check` khẳng định A, B        | literal `localhost:<cổng>` mọc lại trong mã, docs, CI          |
| `npm run topology:check` khẳng định **D**       | số cổng nội bộ in ra **giao diện người dùng**, kể cả dạng trần |
| `apps/frontend-main/test/sessionCookie.test.ts` | tên cookie phiên lệch giữa hai phía (lỗi chỉ sống trên HTTPS)  |

Khẳng định D ra đời từ một chỗ hỏng thật: trang chủ vẽ khối terminal in
`:4001 healthy` / `:4002 healthy`. Không có chữ "localhost" nên khẳng định A
không thấy, và dòng đó sống nhiều tháng trên production - nơi bốn service ấy đã
gộp thành **một** tiến trình, tức là con số in ra vừa lộ chi tiết nội bộ vừa sai.
