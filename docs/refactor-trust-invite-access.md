# Kế hoạch: đưa Con dấu tín nhiệm về chế độ mời, và gỡ tín dụng

> **Trạng thái: KẾ HOẠCH, chưa thực hiện.** Viết cho phiên sau. Đọc hết mục
> "Quyết định đã có" trước khi viết dòng mã đầu tiên. Chủ dự án đã chốt phạm vi
> ngày 16/08/2026; phần còn lại chứa một ràng buộc thứ tự có thể làm trang trống
> ở production mà không test nào bắt được.

## Mục tiêu (chủ dự án giao)

1. Ẩn toàn bộ chức năng Con dấu / cấp huy hiệu khỏi giao diện; chỉ `tsudev` và
   tài khoản được cấp quyền nhìn thấy.
2. Khách muốn nộp đơn xin cấp huy hiệu phải có **mã mời** (đối tác/khách hàng
   VIP).
3. **Gỡ hẳn tín dụng (`credits`)** — site thành dự án cá nhân miễn phí.
4. Giữ chất lượng SEO và độ phổ biến.

---

## Quyết định đã có, và xung đột còn lại

### ✅ Quyết định 1 — GÁC TẤT CẢ, kể cả trang xác minh

**Chủ dự án đã quyết (16/08/2026):** mọi trang liên quan tới chứng chỉ/huy hiệu
chỉ truy cập và nhìn thấy được qua **mã mời do admin cấp**. Không có ngoại lệ
cho trang xác minh.

#### Cái giá thật: bằng KHÔNG, ở thời điểm này

Đã đếm trực tiếp trên Neon ngày 16/08/2026:

```
chứng chỉ đã cấp : 0
tổ chức          : 0
đơn              : 0
tên miền         : 0
chương trình dấu : 4   (dữ liệu tham chiếu từ seed)
```

Không có huy hiệu nào đang chạy trên site của bên thứ ba, nên **không có gì để
hỏng**. Mối lo "vô hiệu hoá chứng chỉ đã cấp" nêu ở bản kế hoạch trước là đúng
về nguyên tắc nhưng vô nghĩa về thực tế — quyết định này hôm nay không tốn gì.

#### Điểm phải quyết lại TRONG TƯƠNG LAI

Ghi ở đây để phiên sau không phải phát hiện lại. Ràng buộc kỹ thuật vẫn còn
nguyên, chỉ là chưa chạm tới:

- `TRUST_ISSUER` được **ký vào chứng chỉ**. URL xác minh nằm trong chứng chỉ đã
  cấp là **cố định vĩnh viễn** — không đổi được bằng cấu hình.
- Khi cấp chứng chỉ đầu tiên cho một khách hàng THẬT, phải trả lời: huy hiệu
  gắn trên site họ, một khách vãng lai bấm vào thì thấy gì? Nếu vẫn đòi mã mời
  thì huy hiệu chỉ là hình trang trí — nó không chứng minh được gì cho người
  đọc, tức là mất lý do tồn tại.

Ba hình khả dĩ khi tới lúc đó, **đừng chọn bây giờ**:

| Hình                  | Nghĩa                                                                                                                                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Huy hiệu nội bộ       | Khách hàng không gắn công khai. Gác tất cả là nhất quán.                                                                                                                                                                                                                           |
| Mở lại trang xác minh | Quay về mô hình thông thường của dịch vụ cấp dấu.                                                                                                                                                                                                                                  |
| URL-năng-lực          | Giữ xác minh không cần đăng nhập NHƯNG serial phải KHÔNG ĐOÁN ĐƯỢC, không liệt kê, không lập chỉ mục. Bản thân đường link là quyền xem. **Serial hiện tại có dạng `TSU-CR-2026-000123` — tuần tự, đoán được**, nên hình này cần đổi cách sinh serial TRƯỚC khi cấp chứng chỉ thật. |

#### Một ngoại lệ được đề nghị giữ công khai: JWKS

`/.well-known/tsudev-trust-jwks.json` chỉ chứa **khoá công khai**. Nó không tiết
lộ khách hàng nào, chứng chỉ nào, hay có bao nhiêu. Gác nó lại không bảo vệ điều
gì mà chỉ làm hỏng khả năng xác minh chữ ký ngoại tuyến, và `.well-known` theo
quy ước là vùng công khai.

Nếu chủ dự án vẫn muốn gác cả JWKS thì được — chỉ cần biết rằng nó **không** che
giấu thông tin nào.

### ✅ Quyết định 2 — SEO nay KHÔNG còn đến từ Con dấu

Hệ quả trực tiếp của Quyết định 1, cần nói thẳng: **gác toàn bộ Con dấu là bỏ
hẳn nhánh này khỏi bài toán SEO.**

Trước đó, trang xác minh là tài sản SEO tốt nhất về lý thuyết — website khách
hàng đặt liên kết về `tsudev.com`, tức backlink thật từ tên miền khác. Nhưng
tài sản đó **chưa từng tồn tại**: 0 chứng chỉ đã cấp nghĩa là 0 backlink. Nên
đây không phải mất mát, chỉ là gạch một hướng chưa bao giờ có khỏi kế hoạch.

Mục tiêu "đạt tiêu chí SEO và phổ biến tới tất cả người dùng" vì thế phải do ba
nhánh còn lại gánh: **blog · tài liệu · dự án & bản quyền**. Đó cũng là ba nhánh
có nội dung thật đang chạy.

Việc cần làm cho SEO nằm ngoài phạm vi tệp này — mở mục riêng khi tới lúc. Tối
thiểu cần rà: `sitemap.xml` (đã có), `robots.txt` (đã có), thẻ canonical và OG
(`components/Seo.tsx` đã có), dữ liệu có cấu trúc cho bài viết (**chưa có**), và
tốc độ tải.

Với Con dấu, việc SEO duy nhất là **rút lui cho sạch**:

| Việc                                 | Vì sao                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Gỡ mọi `/trust/*` khỏi `sitemap.xml` | đang liệt kê 5 nhóm, kể cả `/trust/verify/<serial>` từng chứng chỉ                                                |
| `noindex` cho mọi trang `/trust/*`   | trang mà 100% khách không vào được mà vẫn nằm trong kết quả tìm kiếm chỉ tạo thất vọng và tín hiệu chất lượng xấu |
| Gỡ khỏi điều hướng header/footer     | 1 mục ở `SiteHeader`, 3 mục ở `SiteFooter`                                                                        |

⚠️ `noindex` **không** gỡ trang đã được lập chỉ mục ngay lập tức — công cụ tìm
kiếm phải quay lại đọc mới thấy. Trang bị chặn hẳn (401/404) thì còn chậm hơn vì
bot không đọc được thẻ. Nếu có trang `/trust/*` nào đã nằm trong chỉ mục, hãy để
nó trả **200 kèm `noindex`** cho bot một thời gian trước khi khoá cứng, hoặc dùng
công cụ gỡ URL của Search Console.

### ⚠️ Xung đột 3 — `credits` KHÔNG phải cột chết

`CLAUDE.md` có gotcha riêng cho nó: _"`User.credits` KHÔNG phải di sản của chợ
ký quỹ — trust-service thu phí nộp đơn cấp dấu bằng cột này. Xoá theo là hỏng
luồng nộp đơn, **không test nào bắt được**."_

Nghĩa là gỡ `credits` không phải xoá một cột, mà là **gỡ cơ chế thu phí**. Phải
gỡ trọn cụm, nếu không sẽ còn lại đường code tính phí trên một cột không tồn tại.

---

## Phần A — phân loại lại bề mặt Con dấu

Bảng dưới là nguồn sự thật cho toàn đợt. `authCoverage.test.ts` của
trust-service bắt MỌI route phải nằm rõ ràng ở một bên; cập nhật bảng này và
cập nhật test **cùng lúc**, nếu không test sẽ đỏ đúng lúc và đó là điều tốt.

### Route của trust-service

| Route                                                        | Sau đợt này                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| `GET /.well-known/…jwks.json`                                | **công khai** (chỉ chứa khoá công khai — xem Quyết định 1)    |
| `GET /health`                                                | công khai (Render health check)                               |
| `GET /api/trust/verify/:serial`                              | VIP trở lên                                                   |
| `GET /api/trust/seal/:file`                                  | VIP trở lên                                                   |
| `GET /api/trust/profile/:orgId`                              | VIP trở lên                                                   |
| `GET /api/trust/directory`                                   | VIP trở lên                                                   |
| `GET /api/trust/programs[/:slug]`                            | VIP trở lên                                                   |
| `/api/trust/orgs`, `domains`, `applications`, `certificates` | VIP trở lên (nay thêm cổng VAI TRÒ, không chỉ "đã đăng nhập") |
| `/api/trust/admin/*`                                         | ADMIN — giữ nguyên                                            |

Nghĩa là `AUTH_PREFIXES` gần như nuốt trọn `/api/trust`. Cân nhắc **đảo cách
gắn**: thay vì liệt kê nhánh riêng tư, gắn `requireRole('VIP')` cho cả
`/api/trust` rồi khai danh sách MIỄN TRỪ ngắn (`/health`, `.well-known`).

> ⚠️ Nếu đảo, phải giữ được tính chất mà `authCoverage.test.ts` bảo vệ: route
> mới **buộc phải chọn một bên**, không được có mặc định im lặng. Danh sách miễn
> trừ phải là hằng được xuất ra và test đối chiếu, đúng như `AUTH_PREFIXES` hiện
> nay. Đổi sang "mặc định đóng" an toàn hơn "mặc định mở", nhưng chỉ khi danh
> sách miễn trừ vẫn bị canh.

### Proxy ở frontend

`pages/api/trust/[...path].ts` hiện chia `PUBLIC_PREFIXES` /
`PRIVATE_PREFIXES`. Sau đợt này `PUBLIC_PREFIXES` **rỗng** — cả năm nhánh
(`programs`, `verify`, `directory`, `seal`, `profile`) chuyển sang riêng tư.

⚠️ Nhánh công khai hiện chuyển tiếp `Referer`/`Origin` để trust-service phát
hiện huy hiệu gắn sai tên miền. Khi mọi thứ thành riêng tư, cơ chế đó **không
còn ý nghĩa** (chỉ người đã đăng nhập mới tải được huy hiệu). Gỡ hay giữ đều
được, nhưng đừng để lại đoạn mã trông như một lớp phòng thủ đang chạy.

### Trang ở frontend

| Trang                    | Sau đợt này                                        |
| ------------------------ | -------------------------------------------------- |
| `/trust/verify/*`        | VIP trở lên                                        |
| `/trust/org/[id]`        | VIP trở lên                                        |
| `/trust/directory`       | VIP trở lên                                        |
| `/trust/programs/[slug]` | VIP trở lên                                        |
| `/trust/apply`           | VIP trở lên                                        |
| `/trust/portal`          | VIP trở lên                                        |
| `/trust`                 | trang mời nhập mã cho khách; nội dung thật cho VIP |
| `/trust/redeem`          | **mới** — ô nhập mã, cần đăng nhập                 |
| `/admin/trust`           | ADMIN — giữ nguyên, thêm khối quản lý mã mời       |

Bốn trang hiện **không** kiểm phiên (`directory`, `index`, `org/[id]`,
`programs/[slug]`, `verify/*`) nên phải thêm cổng ở `getServerSideProps` — chặn
ở server, không phải ẩn ở client.

### Điều hướng

Gỡ "Con dấu" khỏi `NAV` của `SiteHeader` và ba mục ở `SiteFooter` đối với người
chưa đạt VIP. `SiteHeader` đã dùng `useSession()`, và `role` đã có trong session
(`callbacks.session` của NextAuth), nên lọc được ngay.

> ⚠️ Ẩn ở điều hướng **không phải** bảo mật — nó chỉ dọn giao diện. Cổng thật
> nằm ở `requireRole()` phía service, vốn đọc `User.role` từ DB và fail closed.
> Đừng bao giờ dựa vào việc giấu link.

## Phần B — mã mời

### Quyết định kiến trúc: dùng lại `Role.VIP`, không dựng hệ quyền thứ hai

`Role` đã có `GUEST · MEMBER · VIP · MODERATOR · ADMIN` và `requireRole('VIP')`
đã fail closed. Đổi mã mời lấy quyền = **nâng `User.role` lên VIP**.

Vì sao không thêm cột `trustAccess` riêng: đó là hệ phân quyền thứ hai chạy song
song với hệ đã có — đúng thứ `CLAUDE.md` cấm sau vụ `REQUIRE_ROLE_ENFORCEMENT`.

### Quyết định kiến trúc: đổi mã ở `auth-service`, không phải `trust-service`

Đổi mã **ghi vào `User.role`**, tức là nó thuộc ranh giới danh tính.
`trust-service` chỉ việc gọi `requireRole('VIP')` và không cần biết mã mời tồn
tại. Lợi thêm: không phải đụng bảng tiền tố của `backend-bundle` — route mới
nằm dưới `/api/identity/*` vốn đã có trong bảng.

### Model mới (`packages/db`, migration THUẦN TÍNH CỘNG)

```prisma
model TrustInvite {
  id         String    @id @default(cuid())
  /// CHỈ lưu SHA-256. Cùng lý do với AuthToken.tokenHash và BackupCode.codeHash:
  /// một bản sao DB bị rò không được phép biến thành một xấp mã mời dùng được.
  codeHash   String    @unique
  /// Nhãn cho người vận hành: "Đối tác ABC", "Hội thảo 09/2026".
  label      String
  /// Mã dùng nhiều lần (mã cho một đối tác) hay một lần (mã cho một người).
  maxUses    Int       @default(1)
  usedCount  Int       @default(0)
  expiresAt  DateTime?
  createdById String
  createdAt  DateTime  @default(now())
  revokedAt  DateTime?

  redemptions TrustInviteRedemption[]
}

/// Ai đã đổi mã nào, lúc nào. Cần cho trách nhiệm pháp lý khi cấp dấu —
/// cùng lý do TrustAuditLog tồn tại.
model TrustInviteRedemption {
  id        String      @id @default(cuid())
  inviteId  String
  invite    TrustInvite @relation(fields: [inviteId], references: [id], onDelete: Cascade)
  userId    String
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime    @default(now())

  @@unique([inviteId, userId])
  @@index([userId])
}
```

`@@unique([inviteId, userId])` chặn một người đổi cùng một mã nhiều lần để đốt
lượt của người khác.

### Route

| Route                              | Ai gọi       | Ghi chú                              |
| ---------------------------------- | ------------ | ------------------------------------ |
| `POST /api/identity/invite/redeem` | đã đăng nhập | đổi mã → nâng lên VIP                |
| `POST /api/identity/invite/create` | ADMIN        | sinh mã, **trả mã thô đúng một lần** |
| `POST /api/identity/invite/list`   | ADMIN        | không trả `codeHash` ra ngoài        |
| `POST /api/identity/invite/revoke` | ADMIN        | đặt `revokedAt`                      |

Đường ghi đi qua proxy **có phiên** `pages/api/account/[...path].ts`, không phải
proxy công khai `pages/api/identity/[...path].ts`. Hai tệp, hai mức bảo vệ.

### Quy tắc bắt buộc khi đổi mã

- **Phải đăng nhập trước.** Cho đổi mã ẩn danh nghĩa là mã trở thành một URL
  chia sẻ được, và không có ai để gắn quyền vào.
- **Chỉ nâng lên đúng VIP.** Không bao giờ MODERATOR/ADMIN. Mã mời là đường
  leo thang đặc quyền — chặn trần cứng trong mã, đừng để dữ liệu quyết định.
- **Không hạ vai trò.** Người đã là ADMIN đổi mã thì giữ nguyên ADMIN.
- **Đếm lượt trong transaction**, với điều kiện `usedCount < maxUses` — kiểu
  `updateMany` có điều kiện như `consumeToken` và `consumeBackupCode` đã làm.
  Đọc-rồi-ghi sẽ cho hai người vượt lượt cuối cùng.
- **Giới hạn tần suất theo IP.** Mã mời ngắn thì dò được. Dùng lại
  `LoginAttempt` (auth-service) hoặc `createRateLimit`.
- **So sánh theo thời gian hằng** khi tra mã (`constantTimeEqual` đã có).
- **Ghi `TrustAuditLog`** cho mỗi lần đổi và mỗi lần cấp/thu hồi mã.
- Sinh mã bằng CSPRNG, hiển thị **đúng một lần** — cùng khuôn với mã dự phòng
  2FA.

### Giao diện

- `/trust/redeem` — ô nhập mã cho người đã đăng nhập.
- `/trust` khi chưa đủ quyền: trang giới thiệu ngắn + nút "Tôi có mã mời" +
  đường liên hệ. **Không** tiết lộ mã hợp lệ trông như thế nào.
- `/admin/trust` thêm khối quản lý mã mời.

---

## Phần C — gỡ tín dụng

### Phạm vi (đã grep)

| Nơi                                           | Việc                                                                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `schema.prisma`                               | bỏ `User.credits`, `SealProgram.feeCredits`, `SealApplication.feeCharged`                                      |
| `trust-service/src/index.ts`                  | bỏ transaction trừ credits ở `applications/:id/submit`; bỏ `feeCredits`/`feeCharged` khỏi mọi payload (≈9 chỗ) |
| `trust-service/scripts/seed-demo.js`          | bỏ `feeCharged`                                                                                                |
| `packages/db/prisma/seed.js`                  | bỏ `credits: 500`, bỏ `feeCredits` của 4 chương trình                                                          |
| `apps/.../trust/index.tsx`                    | bỏ "N tín dụng / miễn phí"                                                                                     |
| `apps/.../trust/programs/[slug].tsx`          | như trên                                                                                                       |
| `apps/.../trust/apply.tsx`                    | như trên                                                                                                       |
| `packages/db/README.md`, `docs/trust-seal.md` | cập nhật mô tả                                                                                                 |

Sau khi gỡ, mọi chương trình mặc nhiên miễn phí — đúng mục tiêu "dự án cá nhân
miễn phí".

### ⚠️ Thứ tự: CODE ĐI TRƯỚC, MIGRATION ĐI SAU

Đây là `DROP COLUMN`, nên thứ tự **ngược** với thêm cột (bài học ở HANDOFF §1.6):

1. Bỏ ba trường khỏi `schema.prisma`, sửa hết mã, tạo migration **nhưng chưa
   chạy lên production**.
2. Phát hành code (Render + Worker). Từ lúc này không tiến trình nào còn SELECT
   ba cột đó.
3. Mới chạy `prisma migrate deploy` lên Neon.

Đảo lại thì Prisma Client đang chạy vẫn SELECT cột đã biến mất ⇒ 500 ⇒
`lib/api.ts` nuốt thành `[]` ⇒ **trang trống**, không phải trang lỗi.

---

## Phần D — SEO: rút Con dấu khỏi chỉ mục cho sạch

Xem Quyết định 2. Với Con dấu, việc SEO duy nhất là rút lui gọn gàng.

1. **Gỡ mọi `/trust/*` khỏi `sitemap.xml`.** Hiện đang liệt kê 5 nhóm, trong đó
   có `/trust/verify/<serial>` cho **từng chứng chỉ** và `/trust/programs/<slug>`
   cho từng chương trình. Bỏ luôn hai lời gọi `trust.programs()` và
   `trust.directory()` trong `sitemap.xml.ts` — chúng sẽ trả `[]` sau khi gác,
   nhưng để lại là để một lời gọi mạng vô nghĩa ở mỗi lần dựng sitemap.
2. **`noindex` cho mọi trang `/trust/*`.** `components/Seo.tsx` đã có prop
   `noindex`.
3. **Gỡ khỏi điều hướng** (1 mục `SiteHeader`, 3 mục `SiteFooter`).

### ⚠️ `noindex` không gỡ trang khỏi chỉ mục ngay

Công cụ tìm kiếm phải quay lại đọc mới thấy thẻ. Và trang bị chặn cứng (401/404)
còn **chậm hơn**, vì bot không đọc được thẻ `noindex` trên một trang nó không
tải được.

Nếu có trang `/trust/*` nào đã nằm trong chỉ mục, thứ tự đúng là:

1. Trả **200 kèm `noindex`** cho bot một thời gian, HOẶC dùng công cụ gỡ URL của
   Search Console để gỡ ngay.
2. Rồi mới khoá cứng.

Kiểm hiện trạng trước khi làm: `site:tsudev.com/trust` trên công cụ tìm kiếm.
Nếu chưa có gì được lập chỉ mục thì bỏ qua toàn bộ mục này và khoá thẳng.

### Nghiệm thu

```bash
# sitemap không được còn /trust/
curl -s https://tsudev.com/sitemap.xml | grep -c '/trust/'   # phải là 0

# khách chưa đăng nhập KHÔNG vào được (401 hoặc chuyển hướng, KHÔNG phải 200 kèm nội dung)
curl -s -o /dev/null -w '%{http_code}\n' https://tsudev.com/trust/directory
```

---

## Thứ tự thực hiện đề nghị

Phạm vi đã được chốt, không còn câu nào phải hỏi trước khi bắt đầu.

**Ba lần phát hành riêng**, không gộp — hai đợt migration chạy ngược chiều nhau:

| Đợt | Nội dung                                     | Thứ tự trong đợt                         |
| --- | -------------------------------------------- | ---------------------------------------- |
| 1   | **Phần C** — gỡ tín dụng                     | code → phát hành → migration (`DROP`)    |
| 2   | **Phần B** — mã mời                          | migration (thêm bảng) → code → phát hành |
| 3   | **Phần A + D** — gác bề mặt, SEO, điều hướng | chỉ code, không migration                |

Vì sao Phần C đi đầu: nó độc lập, ít rủi ro nhất, và làm bề mặt gọn lại trước
khi phân loại — bớt được `feeCredits`/`feeCharged` khỏi 9 chỗ trong
trust-service và 3 trang frontend mà đợt 3 sẽ phải đọc lại.

Vì sao Phần A đi cuối: nó là đợt duy nhất có thể khoá nhầm chính mình ra ngoài.
Làm sau cùng thì lúc đó mã mời đã chạy được và có đường vào lại.

⚠️ Trong đợt 3, thứ tự **bên trong** cũng quan trọng: cập nhật `AUTH_PREFIXES`
của trust-service, `PUBLIC_PREFIXES`/`PRIVATE_PREFIXES` của proxy, và
`authCoverage.test.ts` **trong cùng một commit**. Lệch nhau một nhịp là hoặc
route riêng tư lộ ra, hoặc trang công khai chết — cả hai đều im lặng.

## Cổng kiểm bắt buộc trước khi phát hành

- **`authCoverage.test.ts` phải xanh.** Nó là lưới an toàn duy nhất bắt được một
  route bị bỏ quên ở sai bên ranh giới. Nếu Phần A đảo sang "mặc định đóng" thì
  test này phải được viết lại để canh danh sách MIỄN TRỪ — đừng xoá nó.
- Test mới: khách **chưa đăng nhập** nhận 401 ở cả năm nhánh vừa chuyển sang
  riêng tư (`programs`, `verify`, `directory`, `seal`, `profile`).
- Test mới: tài khoản **MEMBER** cũng bị 403 — "đã đăng nhập" không còn đủ, phải
  đạt VIP. Đây là điểm dễ sai nhất: `PRIVATE_PREFIXES` cũ chỉ đòi có phiên.
- Test mới: `/.well-known/…jwks.json` **vẫn 200 khi chưa đăng nhập** — nó cố ý
  nằm ngoài (Quyết định 1). Nếu chủ dự án đổi ý và gác luôn JWKS thì đảo test.
- Test mới cho mã mời: đổi hai lần không cộng thêm lượt · mã hết hạn bị từ chối ·
  mã đã thu hồi bị từ chối · vượt `maxUses` bị từ chối · mã mời **không bao giờ**
  nâng quá VIP (thử với dữ liệu cố tình khai ADMIN).
- Test mới cho việc gỡ tín dụng: nộp đơn thành công khi `SealProgram` không còn
  `feeCredits` — đường nộp đơn là thứ `CLAUDE.md` cảnh báo sẽ hỏng âm thầm.
- E2E: khách → đăng nhập → `/trust/redeem` nhập mã → `/trust/apply` nộp đơn.
- Nghiệm thu SEO ở Phần D.

## Nhắc lại thứ tự nguy hiểm

`credits` là `DROP COLUMN` ⇒ **code đi trước, migration đi sau**. Migration của
mã mời là thêm bảng ⇒ **migration đi trước, code đi sau**. Hai đợt trong cùng
một kế hoạch chạy NGƯỢC chiều nhau — đừng gộp chúng vào một lần phát hành.
