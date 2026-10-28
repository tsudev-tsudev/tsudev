# Kế hoạch: tái cấu trúc toàn diện tsudev.com (Q4/2026)

> Trả lời câu hỏi vận hành: **"muốn tsudev.com có bản sắc thương hiệu riêng,
> chữ tiếng Việt hiển thị đúng trên mọi thiết bị, và chỗ để người ta tải app về
> dùng - thì làm theo thứ tự nào, và mỗi bước nghiệm thu bằng số đo gì?"**

Soạn 28/10/2026. Mọi con số trong file này là **số đo thật** lấy trong phiên
soạn, không phải suy luận. Chỗ nào chưa đo được thì ghi rõ là chưa đo.

## Tình trạng - cập nhật 28/10/2026 (cùng ngày soạn)

| pha                          | tình trạng                                   | nghiệm thu đo được                                                                                                                                                             |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **§0** cứu DB                | 🟠 **CHẶN** - cần chủ dự án đọc Neon → Usage | nghi phạm compute đã khoanh và **ĐÃ VÁ** (§0.5 bên dưới); script dọn storage đã có                                                                                             |
| **§0.5** làm "trống" kêu lên | ✅ **XONG**                                  | `npm run prod:dem-noi-dung` **thoát 1** hôm nay, in đúng 5/5 phép đo rỗng                                                                                                      |
| **§1** font tiếng Việt       | ✅ **XONG**                                  | CSS prod đã build: `grep -c googleapis` = **0**, 25 `@font-face`, `--font-family` mở đầu `"Be Vietnam Pro"`, 24 woff2 có subset `vietnamese`                                   |
| **§2** icon · logo · màu     | 🟡 **MỘT PHẦN**                              | icon **17 → 78**, có `icons:check` (đã chứng minh bắt được role sai + đường vẽ ra ngoài khung). **Logo SVG master và tông màu riêng: CẦN QUYẾT ĐỊNH CỦA CHỦ DỰ ÁN** - xem §2.3 |
| **§3** bố cục · chuyển động  | ✅ **XONG phần nền**                         | 6 token chuyển động mới, scroll-reveal an toàn-khi-không-JS, `scrollReveal.test.ts` 5/5                                                                                        |
| **§4** tải app về            | ✅ **XONG**                                  | migration + 5 route + modal + trang quản trị; **23/23** test; nghiệm thu đầu-cuối ở local: 302 → đúng CDN, `downloadCount` 0→1                                                 |
| **§5** empty state           | ✅ **XONG**                                  | `EmptyState` dùng chung, 2 cặp màu mới qua cổng WCAG ở cả ba chế độ                                                                                                            |

**Ba khuyết ĐO ĐƯỢC phát hiện trong lúc làm, không có trong bản kế hoạch gốc:**

1. **Vòng poll 3 giây của `/admin/newsroom` là nguồn đánh thức Neon mà
   `docs/free-tier.md` không canh** - tài liệu đó dựng cả kiến trúc hai nhịp cron
   để tránh đúng cái bẫy này, rồi bị vượt qua từ hướng TRÌNH DUYỆT. Đã vá bằng ba
   van (ẩn tab · trần 10 phút không tương tác · backoff khi lỗi). Đã ghi vào
   `docs/free-tier.md`.

2. **Trang chi tiết trả HTTP 200 kèm "Không tìm thấy bài viết" khi lượt gọi THẤT
   BẠI** - với Google đó là soft 404, nó gỡ URL khỏi chỉ mục và không đọc lại.
   Nay ba mã trạng thái: 503 khi gọi lỗi · 404 khi thật sự không có · 200 khi có.

3. **`@@unique([projectId, version, platform, arch])` KHÔNG chặn được trùng khi
   `arch` bỏ trống** - trong SQL `NULL != NULL`, và bỏ trống là trường hợp phổ
   biến nhất. Đã kiểm trực tiếp trên Postgres: hai lượt `INSERT` giống nhau đều
   lọt. Ràng buộc vẫn hiện trong `\d`, test trùng-lặp vẫn xanh vì nó truyền
   `arch: 'arm64'`. Đã sửa cột thành `NOT NULL DEFAULT ''` và thêm hai test canh
   đúng nhánh bỏ trống.

**Năm cổng mới, tất cả đã được chứng minh ĐỎ với lỗi thật rồi XANH sau khi sửa:**

| cổng                        | bắt gì                                                                |
| --------------------------- | --------------------------------------------------------------------- |
| `npm run prod:dem-noi-dung` | site trả 200 mà KHÔNG có nội dung                                     |
| `npm run fonts:check`       | artifact font lệch nguồn, thiếu woff2                                 |
| `npm run icons:check`       | `IconName` không tồn tại · `role` sai · đường vẽ ra ngoài khung 24×24 |
| `test/fontSource.test.ts`   | quay lại nạp font từ host ngoài (CSP chặn im lặng)                    |
| `test/scrollReveal.test.ts` | nội dung bị ẩn vĩnh viễn khi JavaScript không chạy                    |

---

Bốn quyết định của chủ dự án đã chốt khi mở kế hoạch:

| quyết định           | đã chọn                                                    |
| -------------------- | ---------------------------------------------------------- |
| Cứu DB               | giữ gói free, dọn dữ liệu để về dưới hạn mức               |
| Font chữ chính       | **Be Vietnam Pro**, tự host                                |
| Bảng màu thương hiệu | ghi đè cục bộ ở `tokens/extensions.tsudev-web.json`        |
| Bộ icon              | tự vẽ tiếp + script sinh sprite, không nhập thư viện ngoài |

---

## §0 - VIỆC CHẶN: tsudev.com đang là một website trống

### 0.1 Số đo

Đo lúc 13:0x ngày 28/10/2026, trực tiếp trên production:

| đo                                    | kết quả                                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| `/`, `/blog`, `/docs`, `/projects`    | HTTP **200**, nội dung là "Chưa có bài viết / tài liệu / dự án" |
| `/sitemap.xml`                        | **7** `<url>` - đúng số trang tĩnh, không bài nào               |
| `/feed.xml`                           | **0** `<item>`                                                  |
| `/api/search?q=a`                     | `{"data":[],"meta":{"total":0}}`                                |
| backend `/health`                     | 200, `bundled:[content,storage,trust,identity,newsroom]` - sống |
| `/.well-known/tsudev-trust-jwks.json` | 200, có khoá thật                                               |

`logs/STATE.md` ghi ngày 27/08/2026 `/blog` liệt kê **50 bài**. Hôm nay là **0**.

### 0.2 Nguyên nhân

`npm run newsroom:canh-kenh`:

```
Error querying the database: ERROR: Your account or project has exceeded
the quota. Upgrade your plan to increase limits.
```

Neon đã **treo compute**. `docs/free-tier.md` §"Ngân sách chật số 2" đã mô tả
trước hậu quả này bằng đúng chữ: _"Vượt là Neon treo compute tới đầu tháng sau,
và lúc đó cả site chết, không riêng phần nào."_

Vì sao các trang vẫn 200 thay vì 500: `apps/frontend-main/lib/api.ts` bắt mọi
lỗi và trả giá trị rỗng. Backend `/health` 200 vì nó trả JSON tĩnh, không chạm
Prisma. JWKS 200 vì khoá nằm ở biến môi trường. Đây chính là bài học §0.7 thứ
nhất của `HANDOFF.md` - _"Mã 200 không chứng minh trang có nội dung"_ - lần này
sống **hai tháng** mà không ai biết.

### 0.3 Hai nhánh nguyên nhân, và chúng cần hai cách chữa TRÁI NGƯỢC

Thông điệp lỗi của Neon giống nhau cho cả ba hạn mức, nên **không phân biệt được
từ bên ngoài**. Hạn mức gói free: `0,5 GB storage` · `100 CU-giờ/tháng` ·
`5 GB egress`.

| nhánh                           | chữa bằng                                  | dọn dữ liệu có giúp? |
| ------------------------------- | ------------------------------------------ | -------------------- |
| **A - Storage** vượt 0,5 GB     | xoá dữ liệu tích luỹ + lắp retention       | **có**               |
| **B - Compute** vượt 100 CU-giờ | tìm thứ đánh thức Neon liên tục và chặn nó | **không**            |

> ⚠️ **Bước đầu tiên của cả kế hoạch là một việc chỉ MẮT NGƯỜI làm được:**
> mở Neon console → project → **Usage**, đọc xem dòng nào đỏ: _Storage_ hay
> _Compute time_. `docs/free-tier.md` §Giám sát đã ghi sẵn rằng con số này
> "phải nhìn bằng mắt trên trang quản trị của nhà cung cấp, không có lệnh nào
> thay được". Chưa đọc dòng đó thì mọi việc dưới đây là đoán.

Nếu là **nhánh B**, có một tin tốt và một tin xấu: compute **tự mở lại vào đầu
tháng 11** (còn 4 ngày), nhưng nếu không chặn nguyên nhân thì nó sẽ vỡ lại vào
khoảng giữa tháng - và chu kỳ "sống ~10 ngày, trống ~20 ngày mỗi tháng" đó khớp
với việc site đã trống suốt hai tháng qua.

### 0.4 Nhánh A - bằng chứng cho giả thuyết storage

Ba bảng tích luỹ **không giới hạn** và **chưa bao giờ được xả**:

| bảng            | cột nặng           | vì sao phình                                     |
| --------------- | ------------------ | ------------------------------------------------ |
| `DraftRevision` | `contentMd String` | lưu **toàn văn bài viết cho MỌI lần sửa**        |
| `NewsroomEvent` | `payload Json`     | payload thô, `STATE.md` ghi 60 PENDING + 35 DEAD |
| `AgentRun`      | `errorMsg String?` | một dòng mỗi lượt chạy agent, mỗi giờ nhiều lượt |

Đã kiểm: `grep -rln "deleteMany" scripts/ services/newsroom-service/src/` trả về
**rỗng**. Không có script dọn, không có retention policy, không có `olderThan` ở
bất kỳ đâu. Toà soạn chạy từ tháng 8 tới nay **chỉ tích vào, chưa từng xả ra**.

### 0.5 Nhánh B - nghi phạm đã khoanh được

Hai thứ đánh thức Neon mà bảng audit cron trong `docs/free-tier.md` **không
nhìn tới**, vì cả hai đều không phải cron:

**Nghi phạm 1 (nặng) - vòng poll 3 giây của trang quản trị toà soạn.**

```
apps/frontend-main/pages/admin/newsroom.tsx:19   const POLL_MS = 3000;
apps/frontend-main/pages/admin/newsroom.tsx:235  const id = setInterval(load, POLL_MS);
apps/frontend-main/pages/admin/newsroom.tsx:211  fetch(`/api/newsroom/state${qs}`)   // CHẠM DB
```

Vòng này chạy **vô thời hạn** khi tab còn mở và phiên còn sống. Không có pause
khi tab bị ẩn, không có backoff, không có trần thời gian.

Một tab `/admin/newsroom` bị bỏ quên = **1.200 truy vấn DB mỗi giờ, 28.800 mỗi
ngày, 24/7**. Neon tự ngủ sau ~5 phút không truy vấn; nhịp 3 giây nghĩa là nó
**không bao giờ ngủ**. Compute 0,25 CU thức 24/7 tiêu `0,25 × 744 = 186` CU-giờ
trong tháng 31 ngày, trên hạn mức 100 - tức vỡ sau khoảng **17 ngày**.

Đây là đúng cái bẫy mà `docs/free-tier.md` đã dựng cả một kiến trúc hai nhịp cron
để tránh, rồi bị vượt qua từ một hướng mà tài liệu đó không canh: **trình duyệt**,
không phải cron.

**Nghi phạm 2 (đã loại).** `services/trust-service/src/recheck.ts:287` có
`setInterval` chạy trong tiến trình backend. Đã kiểm `intervalMin` mặc định
**360 phút = 6 giờ** (`recheck.ts:50`), tức 4 lượt/ngày. Không đủ để giữ Neon
thức. **Không phải nguyên nhân** - ghi lại để lần sau không phải điều tra lại.

### 0.6 Việc của pha 0

| #   | việc                                                                                                                                                                                                          | nhánh  | ai làm        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------- |
| 0.1 | Đọc Neon → Usage, chốt Storage hay Compute                                                                                                                                                                    | cả hai | **chủ dự án** |
| 0.2 | Chặn poll: pause khi `document.hidden`, backoff khi tab nền, trần thời gian phiên poll                                                                                                                        | B      | agent         |
| 0.3 | Script `npm run db:don-toa-soan` - xoá `DraftRevision` cũ giữ N bản mới nhất mỗi draft, xoá `NewsroomEvent` DONE/DEAD quá hạn, xoá `AgentRun` quá hạn. **Chạy thử `--dry-run` in số dòng + dung lượng trước** | A      | agent         |
| 0.4 | Lắp retention vào chính đường ghi, không chỉ script chạy tay                                                                                                                                                  | A      | agent         |
| 0.5 | `VACUUM FULL` sau khi xoá - Postgres không trả dung lượng về cho Neon nếu không vacuum, nên xoá xong mà quota vẫn đỏ là **bình thường, không phải thất bại**                                                  | A      | agent         |

> ⚠️ Việc 0.3 và 0.5 **cần DB sống mới chạy được**. Nếu là nhánh B thì phải chờ
> đầu tháng 11, hoặc chủ dự án nâng gói tạm một tháng để có cửa sổ thao tác.

---

## §0.5 - Làm cho "trống" KÊU LÊN

Đây là pha rẻ nhất và đáng giá nhất của cả kế hoạch, vì nó là thứ **đáng ra phải
chặn sự cố hai tháng ở §0**.

### Vấn đề

```ts
// apps/frontend-main/lib/api.ts
async function getJSON<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { headers: internalHeaders() });
    if (!res.ok) return fallback; // 401, 500, 503 → []
    return await res.json();
  } catch (e) {
    return fallback; // DB chết, mạng đứt → []
  }
}
```

Hàm này **cố ý** nuốt lỗi, và lý do gốc là đúng: trang công khai không nên 500 vì
một service phụ chết. Nhưng nó gộp hai trạng thái khác nhau về bản chất thành
một: _"truy vấn thành công, không có dữ liệu"_ và _"không truy vấn được"_. Người
xem thấy y hệt nhau. Agent nghiệm thu thấy y hệt nhau. CI thấy y hệt nhau.

### Việc

| #     | việc                                                                                                                                                                                   | nghiệm thu                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 0.5.1 | `getJSON` trả `{ data, failed: boolean }` thay vì chỉ `data`. Giữ nguyên hành vi không-ném-lỗi                                                                                         | typecheck xanh ở mọi nơi gọi           |
| 0.5.2 | Trang phân biệt hai trạng thái: rỗng thật → empty state có CTA; gọi thất bại → khối "Không tải được nội dung, đang thử lại" **nhìn thấy được**                                         | mắt người, ba trang blog/docs/projects |
| 0.5.3 | `sitemap.xml` và `feed.xml` **ném lỗi** thay vì phát ra file rỗng. Một sitemap 7 URL là tín hiệu sai gửi cho Google; thà 500                                                           | `curl` sitemap khi DB chết phải ra 5xx |
| 0.5.4 | Cổng nghiệm thu `npm run prod:dem-noi-dung` - đếm `<item>` của feed, `<url>` của sitemap, số thẻ bài trên `/blog`. **Có mã thoát** 0/1/2 như `newsroom:canh-kenh` để cắm được vào cron | chạy ngay bây giờ phải ra ĐỎ           |

Việc 0.5.4 theo đúng nguyên tắc mà phiên 29 đã rút ra cho `canh-kenh-toa-soan.js`:
**cổng phải hỏi "kết quả có ra không", không phải "tiến trình có chạy không"**.
Ba cổng cũ đều hỏi câu thứ hai và đều trả lời CÓ trong suốt hai tháng site trống.

---

## §1 - Font tiếng Việt: có một lỗi đang chạy trên production

### 1.1 Số đo

```
apps/frontend-main/styles/globals.css:7
  @import url('https://fonts.googleapis.com/css2?family=Inter:...&family=JetBrains+Mono:...')

CSP thật trên prod (curl -I https://tsudev.com/):
  style-src 'self' 'unsafe-inline'
  font-src  'self' data:
```

`'unsafe-inline'` chỉ cho phép `<style>` nội tuyến và thuộc tính `style=`. Nó
**không** cho phép stylesheet từ host ngoài. Và `font-src` không có
`fonts.gstatic.com`.

**Kết luận: Inter và JetBrains Mono chưa bao giờ nạp được trên production.**
Đã xác nhận trong CSS đã build (`/_next/static/css/c25a5feb98b84a1c.css`): chuỗi
`@import ...googleapis...` còn nguyên trong file, và chuỗi dự phòng là

```css
--font-family: 'Inter', 'SF Pro Text', 'Segoe UI', 'Roboto', system-ui, -apple-system, sans-serif;
```

Nên thực tế: Windows thấy Segoe UI, Android thấy Roboto, macOS thấy SF Pro,
Linux thấy một thứ khác nữa. **Mỗi thiết bị một font** - đúng phản đề của yêu
cầu "mọi chữ cái có dấu tiếng Việt đều hiển thị tối ưu trên mọi loại thiết bị".

Lỗi này **không bộ test nào ở đây bắt được**, vì dev và E2E chạy
`http://localhost` không có CSP. Đúng bài học §0.7 thứ hai: _"Lỗi chỉ tồn tại
trên HTTPS thì không bộ test nào ở đây bắt được - canh những thứ đó bằng test
quét NGUỒN."_

### 1.2 Vì sao Be Vietnam Pro

|                             | Be Vietnam Pro                             | Inter                       |
| --------------------------- | ------------------------------------------ | --------------------------- |
| dấu tiếng Việt              | **thiết kế gốc**, nhóm thiết kế Việt       | bản mở rộng thêm vào sau    |
| tổ hợp hai dấu (ậ, ộ, ặ, ữ) | dựng đúng vị trí, không chồng chân chữ hoa | chồng dấu ở nét đậm kém hơn |
| tông                        | hình học, trẻ trung                        | trung tính                  |
| nét                         | 9                                          | 9                           |

Giữ **JetBrains Mono** cho khối mã, cũng tự host - khối code là bản sắc của site
này và font mono hệ thống không có nét giống nhau giữa các máy.

### 1.3 Ràng buộc kiến trúc

Token `font-family` nằm ở `.standards/tokens/design-tokens.json:87` - **bản
chỉ-đọc, bất khả xâm phạm**. Đổi font vì thế đi qua ghi đè ở
`tokens/extensions.tsudev-web.json` rồi `npm run tokens:sync`, **không sửa tay**
`packages/ui/src/tokens.css` (nó là artifact; sửa tay là thay đổi sống ở local
rồi biến mất im lặng ở lần sinh kế tiếp - `npm run tokens:check` canh trong CI).

### 1.4 Việc

| #   | việc                                                                                                                                                                                                                                  | ghi chú                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1.1 | Tải woff2 Be Vietnam Pro + JetBrains Mono, **subset `latin` + `vietnamese`**, các nét 400/500/600/700. **Không nạp 300** - `DESIGN_SYSTEM.md` §4 cấm dùng vì nét mảnh làm dấu khó đọc, và `globals.css:5` đã ghi rõ là cố ý không nạp | đặt ở `apps/frontend-main/public/fonts/` (thư mục này **chưa tồn tại**) |
| 1.2 | `@font-face` trong `globals.css`, `font-display: swap`, kèm `size-adjust`/`ascent-override` cho chuỗi dự phòng để không giật layout khi font tới                                                                                      | thay thế hoàn toàn dòng `@import`                                       |
| 1.3 | Xoá dòng `@import url(...googleapis...)` ở `globals.css:7`                                                                                                                                                                            | lý do xoá phải ghi vào comment: CSP chặn, không phải "đổi ý"            |
| 1.4 | Ghi đè `font-family` / `font-mono` ở `tokens/extensions.tsudev-web.json`, chạy `npm run tokens:sync`                                                                                                                                  | `tokens:check` phải xanh                                                |
| 1.5 | **Test quét NGUỒN**: chặn mọi URL tuyệt đối `fonts.googleapis.com` / `fonts.gstatic.com` trong `styles/` và `pages/`; và khẳng định `font-src` của CSP phủ hết nguồn font mà CSS thật sự yêu cầu                                      | đây là tầng mà bài học §0.7 thứ hai đòi                                 |
| 1.6 | Nghiệm thu prod: tải CSS đã build, `grep -c googleapis` phải ra **0**; và `--font-family` phải mở đầu bằng `"Be Vietnam Pro"`                                                                                                         | đừng đọc "trang vẫn đẹp" thành "font đã nạp"                            |

> Lợi ích phụ đáng kể: bỏ `@import` ngoài host cũng bỏ luôn một request chặn
> render tới một domain thứ ba, và bỏ một đường rò rỉ IP người đọc sang Google.

---

## §2 - Bản sắc: icon, logo, bảng màu

### 2.1 Số đo hiện trạng

|          | hiện có                                                                                | cần                            |
| -------- | -------------------------------------------------------------------------------------- | ------------------------------ |
| icon     | **17 cái**, path viết tay, `Icon.tsx` 118 dòng                                         | ~80-120                        |
| logo     | `packages/brand/source/logo.jpeg` + `avatar.png` - **raster, không có SVG master nào** | SVG wordmark + monogram        |
| bảng màu | `--primary #2563eb`, `--bg-base #eef4fb`, 3 chế độ, có `contrast.test.ts` gác WCAG AA  | tông riêng, giữ nguyên cổng AA |

Điểm đáng giữ của `Icon.tsx`: màu icon đi qua **vai trò** chứ không phải mã màu
(`nav`/`create`/`edit`/`danger`/`info`/`trust` → `text-icon-*`). Đó là thiết kế
đúng và bộ mở rộng phải theo, không được phá.

Điểm thiếu nền tảng: **thương hiệu không có vector**. Mọi thứ cần logo ở kích
thước khác - favicon, OG image, huy hiệu con dấu nhúng vào site bên thứ ba, splash
của app tải về - đều đang phóng từ ảnh raster.

### 2.2 Việc

| #   | việc                                                                                                                                  | ghi chú                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 2.1 | Dựng **SVG master**: wordmark `tsudev` + monogram vuông, mỗi cái một bản sáng/tối                                                     | nền của 2.2 và của §4                                   |
| 2.2 | `packages/brand/build-assets.js` sinh favicon/OG/avatar **từ SVG** thay vì từ jpeg                                                    | hết phóng raster                                        |
| 2.3 | Mở rộng `Icon.tsx` lên ~100 icon, chia nhóm theo vùng: nav · nội dung · toà soạn · con dấu · phát hành/tải về · quản trị · trạng thái | giữ nguyên hệ vai trò màu                               |
| 2.4 | Script `npm run icons:sprite` sinh sprite SVG + union type `IconName` từ một thư mục nguồn                                            | để thêm icon không phải sửa tay ba chỗ                  |
| 2.5 | Test: mọi `IconName` được dùng trong app phải tồn tại trong sprite; mọi icon trong sprite phải có `role` hợp lệ                       | icon thiếu hiện nay sẽ render rỗng, im lặng             |
| 2.6 | Lớp ghi đè tông thương hiệu ở `tokens/extensions.tsudev-web.json`                                                                     | `tokens:check` + `contrast.test.ts` ba chế độ phải xanh |

> ⚠️ Vùng này thuộc agent `design-system` (`packages/ui`, `packages/brand`). Việc
> 2.6 chạm `tokens/` nên phải chạy `npm run tokens:sync` trong **cùng commit** -
> artifact lệch nguồn là CI đỏ.

### 2.3 Hai việc TÔI KHÔNG TỰ LÀM, và vì sao

**Logo SVG master (việc 2.1-2.2).** Thương hiệu tsudev đã có một biểu tượng:
**chim cú mạch điện**, ở `packages/brand/source/logo.jpeg`. Nó là một hình vẽ
minh hoạ, và dựng lại nó thành vector bằng hình học tay tôi sẽ không cho ra cùng
một biểu tượng - nó cho ra MỘT BIỂU TƯỢNG KHÁC. Thay bản sắc thương hiệu là
quyết định của chủ dự án, không phải một bước kỹ thuật.

Ba đường đi, chọn một:

| đường                                                  | được gì                                        | mất gì                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| Vector hoá con cú hiện có                              | giữ nguyên bản sắc, dùng được ở mọi kích thước | cần người vẽ lại bằng công cụ vector; tôi làm được bản xấp xỉ nhưng nó sẽ KHÁC bản gốc |
| Giữ raster, chỉ thêm SVG **wordmark** cho chữ "tsudev" | rẻ, không chạm bản sắc, đủ cho OG/huy hiệu chữ | favicon và huy hiệu nhỏ vẫn phóng từ raster                                            |
| Thiết kế monogram mới                                  | sắc nét ở mọi cỡ, hiện đại                     | **đổi bản sắc thương hiệu**                                                            |

**Tông màu riêng (việc 2.6).** Bảng màu hiện tại (`--primary #2563eb`,
`--bg-base #eef4fb`, ba chế độ) **đã đạt mọi phép đo khách quan**: tươi sáng, trẻ
trung, và 205 khẳng định WCAG AA xanh ở cả ba chế độ. Đổi tông là quyết định
THẨM MỸ, và đổi mò thì rủi ro duy nhất là làm nó xấu đi.

Cơ chế đã sẵn sàng: ghi đè ở `tokens/extensions.tsudev-web.json` rồi
`npm run tokens:sync`. Cần chủ dự án nói **tông nào** - một mã màu, một ảnh tham
chiếu, hoặc một site làm ví dụ.

---

## §3 - Bố cục, hoa văn, chuyển động, tầng số liệu

### 3.1 Giữ gì

Trang chủ đã có `tsu-grid` (lưới có mặt nạ radial), `animate-fade-up`,
`animate-pulse-glow`, thẻ terminal, và `globals.css:74` đã tôn trọng
`prefers-reduced-motion`. Thứ bậc bề mặt bằng độ sáng nền đã đúng. **Không đập
đi xây lại** - mở rộng.

### 3.2 Thêm gì

| #   | việc                                                                                                           | ghi chú                                       |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 3.1 | Hệ chuyển động thành token: duration (fast/base/slow đã có ở `tokens.css:231`) + **easing** + độ trễ bậc thang | hiện mỗi chỗ tự đặt `animationDelay` bằng tay |
| 3.2 | Scroll-reveal dùng `IntersectionObserver`, **CSS-first**, không nạp framer-motion                              | app chạy trên Workers, bundle là tiền         |
| 3.3 | Tầng số liệu sống trên trang chủ: số dự án, số bài, số chứng chỉ còn hiệu lực, nhịp toà soạn gần nhất          | `Stat.tsx` đã có; cần nguồn dữ liệu           |
| 3.4 | Hoa văn thứ hai ngoài `tsu-grid` cho các trang trong (đường đồng mức/mạch nối), đi qua token `--grid-line`     | đừng cắm hex                                  |
| 3.5 | Mọi chuyển động mới phải tắt sạch dưới `prefers-reduced-motion`, có test                                       | khối hiện có đã làm đúng, bộ mới phải theo    |

> ⚠️ Việc 3.3 phụ thuộc §0 và §0.5: một dãy số liệu sống đọc "0 dự án · 0 bài ·
> 0 chứng chỉ" trên một site có DB chết thì **tệ hơn là không có nó**. Chỉ làm
> sau khi §0.5 phân biệt được rỗng với thất bại.

---

## §4 - Tải app về dùng: `ProjectRelease`

### 4.1 Schema đang chặn

```prisma
model Project {
  downloadUrl String?   // MỘT chuỗi duy nhất
}
```

Một chuỗi không mô tả nổi "app la bàn cho Android" và "công cụ quét cho Windows"
của cùng một dự án, chưa nói tới nhiều phiên bản, nhiều kiến trúc, hay kênh
beta/stable. Đây là **thiếu cấu trúc dữ liệu**, không phải thiếu một cái modal.

### 4.2 Hình dạng đề xuất

```prisma
model ProjectRelease {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  version    String            // semver
  channel    ReleaseChannel    @default(STABLE)
  platform   ReleasePlatform   // ANDROID | WINDOWS | LINUX | MACOS | WEB | SOURCE
  arch       String?           // arm64, x86_64, universal

  storageKey String            // khoá trong R2, KHÔNG phải URL công khai
  fileName   String
  fileSize   Int
  sha256     String            // người tải xác minh được
  signature  String?           // Ed25519 qua @tsudev/trust-crypto

  releaseNotesMd String  @default("")
  minOsVersion   String?
  downloadCount  Int     @default(0)
  publishedAt    DateTime?
  deletedAt      DateTime?

  @@unique([projectId, version, platform, arch])
  @@index([projectId, publishedAt])
}
```

### 4.3 Vì sao `sha256` và `signature` không phải trang trí

Repo này đã có `@tsudev/trust-crypto` ký Ed25519 và một hệ con dấu tín nhiệm
dùng để chứng nhận website của người khác. **Ký chính file phát hành của mình và
cho người tải xác minh được** là hệ đó tự áp lên chính nó - và đó là thứ gần như
không site cá nhân nào làm. Nó cũng là câu trả lời thực dụng cho rào cản thật
của việc phát hành app ngoài store: Windows SmartScreen và Android "nguồn không
xác định" đều làm người dùng chùn tay, và một checksum hiển thị công khai kèm
đường xác minh là thứ duy nhất ta cho được mà không mua chứng chỉ ký mã.

### 4.4 Việc

| #   | việc                                                                                                                                                            | vùng agent     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 4.1 | Migration mới + enum `ReleaseChannel`/`ReleasePlatform`, `npm run db:generate`                                                                                  | `data-schema`  |
| 4.2 | `GET /api/projects/:slug/releases` (công khai) + `/api/admin/releases/*` (ghi, `requireAdmin()` tự gọi, **không dựa vào middleware**)                           | `backend-api`  |
| 4.3 | Mở rộng **bảng tiền tố** của `services/backend-bundle/src/index.js` nếu thêm tiền tố mới - thiếu là route **404 ở production** trong khi service riêng vẫn sống | `infra-deploy` |
| 4.4 | Upload file phát hành qua presign R2 (`storage-service` đã có đường này)                                                                                        | `backend-api`  |
| 4.5 | Modal tải về: chọn nền tảng, hiện phiên bản/dung lượng/ngày, **hiện sha256 và đường xác minh**, release notes                                                   | `frontend-web` |
| 4.6 | Khối "Tải app" trên trang chủ: thẻ tab theo nền tảng, tự chọn tab theo `navigator.userAgentData.platform` nhưng **cho đổi tay**                                 | `frontend-web` |
| 4.7 | Đếm lượt tải qua một route redirect, không gắn vào URL R2 trực tiếp                                                                                             | `backend-api`  |
| 4.8 | Test đường ghi (theo khuôn `applicationSubmit.test.ts`) để không ai gỡ lén được cổng phân quyền                                                                 | `qa-test`      |

> ⚠️ **Thứ tự phát hành là bất khả xâm phạm:** `prisma migrate deploy` lên Neon
> **TRƯỚC**, merge `main` **SAU**. Ngày 27/08/2026 PR #88 đã đảo thứ tự này và
> site chỉ sống nhờ hai điều may - `STATE.md` ghi rõ. Migration của §4 là thuần
> bổ sung nên cũng sẽ "may", nhưng đừng lấy đó làm lệ.

---

## §5 - Empty state và kiến trúc nội dung các trang con

### 5.1 Đừng chữa triệu chứng của §0

Các chữ "Chưa có bài viết / tài liệu / dự án" mà chủ dự án thấy trên
`tsudev.com/*` hôm nay **là DB chết, không phải thiếu nội dung**. Seed nội dung
để lấp chúng là **che mất sự cố**. Pha này chỉ chạy sau khi §0 xong và §0.5 đã
phân biệt được hai trạng thái.

### 5.2 Khuyết thật, độc lập với sự cố

26 empty state trong app đều là **một dòng chữ xám trần**, ví dụ
`docs/index.tsx:16` → `Chưa có tài liệu.`. Không skeleton lúc tải, không giải
thích vì sao trống, không việc gì làm tiếp.

Và có một khuyết **kiến trúc** mà `STATE.md` đã ghi: **`/projects` sẽ không bao
giờ có bài của agent - đó là thiết kế.** Agent bị cấm tạo dự án mới vì `Project`
mang phiên bản/giấy phép/bản quyền, tức dữ liệu pháp lý. Kênh PROJECT cố ý không
có nguồn, có test canh. Nên empty state của `/projects` **không được** hứa "nội
dung sẽ tự xuất hiện" - nó phải nói đúng rằng dự án do người đăng.

### 5.3 Việc

| #   | việc                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5.1 | Component `EmptyState` dùng chung: icon, tiêu đề, một câu giải thích **đúng với kênh đó**, CTA                                                         |
| 5.2 | Skeleton lúc tải cho ba trang danh sách, thay vì nhảy từ trống sang đầy                                                                                |
| 5.3 | Viết lại 26 empty state theo đúng sự thật của từng kênh - `/projects` nói người đăng, `/docs` và `/blog` nói nhịp toà soạn                             |
| 5.4 | Trần kênh DOC hiện là **1 bài/ngày** và hàng đợi ăn theo thứ tự; `/docs` thưa là **đúng thiết kế**, không phải lỗi. Ghi điều này vào chính empty state |

---

## Thứ tự và phụ thuộc

```
§0  cứu DB ──────────────────┬──────────────► §3.3 số liệu sống
    (chặn, cần MẮT NGƯỜI)    │
                             └──────────────► §5  empty state + nội dung
§0.5 làm "trống" kêu lên ────────────────────► (điều kiện của §3.3 và §5)

§1  font tiếng Việt ─────────► độc lập, làm được NGAY
§2  icon + logo + màu ───────► cần §1 xong (font là nền của bản sắc)
     └──► §3 bố cục/chuyển động
            └──► §4 modal tải app (cần §2 cho icon nền tảng)
§4  schema+API ──────────────► độc lập với §1-§3, làm song song được
```

Hai pha làm được ngay mà không cần DB: **§0.5** và **§1**.

## Cổng nghiệm thu của cả kế hoạch

Không pha nào tính là xong khi chỉ có "lệnh chạy xong". Mỗi pha phải trả một
**số đo**:

| pha  | số đo phải đạt                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------- |
| §0   | `npm run newsroom:canh-kenh` thoát 0; Neon Usage dưới hạn mức                                     |
| §0.5 | `npm run prod:dem-noi-dung` ĐỎ hôm nay, XANH sau khi §0 xong                                      |
| §1   | CSS prod `grep -c googleapis` = **0**; `--font-family` mở đầu `"Be Vietnam Pro"`                  |
| §2   | `tokens:check` + `contrast.test.ts` ba chế độ xanh; không `IconName` nào render rỗng              |
| §3   | mọi chuyển động tắt sạch dưới `prefers-reduced-motion`                                            |
| §4   | `curl /api/projects/<slug>/releases` trả payload thật; `backend-bundle/test/routing.test.ts` xanh |
| §5   | ba trang danh sách có nội dung thật; không empty state nào hứa sai                                |

Cổng chung chạy một lần ở cuối mỗi cụm: `npm run format:check` · `npm run lint` ·
`npm run typecheck` · `npm run topology:check` · `npm run tokens:check`.
