# Kế hoạch: đưa Con dấu tín nhiệm về chế độ mời, và gỡ tín dụng

> **Trạng thái: KẾ HOẠCH, chưa thực hiện.** Viết cho phiên sau. Đọc hết mục
> "Ba xung đột" trước khi viết dòng mã đầu tiên — hai trong ba xung đột có thể
> làm hỏng chứng chỉ ĐÃ CẤP, và không có test nào bắt được.

## Mục tiêu (chủ dự án giao)

1. Ẩn toàn bộ chức năng Con dấu / cấp huy hiệu khỏi giao diện; chỉ `tsudev` và
   tài khoản được cấp quyền nhìn thấy.
2. Khách muốn nộp đơn xin cấp huy hiệu phải có **mã mời** (đối tác/khách hàng
   VIP).
3. **Gỡ hẳn tín dụng (`credits`)** — site thành dự án cá nhân miễn phí.
4. Giữ chất lượng SEO và độ phổ biến.

---

## Ba xung đột phải quyết TRƯỚC khi viết mã

### ⚠️ Xung đột 1 — trang xác minh KHÔNG THỂ nằm sau mã mời

Đây là ràng buộc cứng, không phải ý kiến thiết kế.

Huy hiệu gắn trên website khách hàng trỏ tới `tsudev.com/trust/verify/<serial>`.
Người bấm vào là **khách vãng lai trên site của bên thứ ba** — họ không có tài
khoản tsudev và càng không có mã mời. Đặt trang đó sau mã mời nghĩa là:

- Mọi huy hiệu ĐÃ CẤP thành liên kết chết. Huy hiệu mất toàn bộ giá trị với
  khách hàng đang trả tiền cho nó.
- Tệ hơn: `TRUST_ISSUER` được **ký vào chứng chỉ**, và URL trong chứng chỉ đã
  cấp là **cố định vĩnh viễn** (xem `docs/trust-seal.md` và gotcha ở
  `CLAUDE.md`). Không sửa được bằng cách đổi cấu hình.
- `trust-service` đọc `Referer`/`Origin` để phát hiện huy hiệu bị gắn sai tên
  miền. Cơ chế đó chỉ chạy khi trình duyệt bên thứ ba với tới được.

**Đề nghị:** giữ CÔNG KHAI VĨNH VIỄN bốn thứ — `/trust/verify/:serial`, huy hiệu
SVG (`/api/trust/seal/:file`), JWKS, và trang hồ sơ tổ chức mà huy hiệu trỏ tới.
Mã mời gác phần **nộp đơn và quản lý**, không gác phần **xác minh**.

Đọc lại yêu cầu của chủ dự án thì đúng tinh thần này: ví dụ được nêu là "có mã
mời thì mới **nộp đơn yêu cầu cấp huy hiệu**". Kế hoạch dưới đây theo cách hiểu
đó. **Nếu chủ dự án thật sự muốn giấu cả trang xác minh thì phải quyết định có
chấp nhận vô hiệu hoá chứng chỉ đã cấp hay không — hỏi trước, đừng tự làm.**

### ⚠️ Xung đột 2 — "ẩn khỏi giao diện" và "đạt tiêu chí SEO" kéo ngược nhau

Trang xác minh chính là **tài sản SEO** của site: website khách hàng đặt liên
kết trỏ về `tsudev.com`, tức là backlink thật từ tên miền khác. Gỡ chúng khỏi
`sitemap.xml` hoặc đặt `noindex` là tự tay bỏ thứ SEO tốt nhất đang có.

**Phân biệt hai việc thường bị gộp:**

| Việc                     | Ảnh hưởng SEO                                |
| ------------------------ | -------------------------------------------- |
| Bỏ khỏi thanh điều hướng | Không ảnh hưởng lập chỉ mục                  |
| Bỏ khỏi `sitemap.xml`    | Giảm tốc độ khám phá, không xoá khỏi chỉ mục |
| `noindex`                | Xoá khỏi kết quả tìm kiếm                    |

**Đề nghị:** ẩn khỏi ĐIỀU HƯỚNG cho khách, giữ `/trust/verify/*` và
`/trust/directory` trong sitemap và cho lập chỉ mục. Đặt `noindex` cho
`/trust/apply`, `/trust/portal` (đã không có trong sitemap) và cho trang giới
thiệu `/trust` nếu nó trở thành chỉ-mời — một trang mà 100% người đọc không
hành động được thì lập chỉ mục nó chỉ tạo thất vọng.

**Cần chủ dự án quyết:** `/trust/directory` liệt kê tên khách hàng đã được cấp
dấu. Giữ công khai thì đó là bằng chứng uy tín và nguồn SEO; ẩn đi thì bảo vệ
danh sách khách hàng. Hai lựa chọn đều hợp lý, nhưng phải chọn.

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
cập nhật test cùng lúc.

| Nhóm                                                         | Ai vào được             | Ghi chú                                         |
| ------------------------------------------------------------ | ----------------------- | ----------------------------------------------- |
| `GET /api/trust/verify/:serial`                              | **công khai vĩnh viễn** | huy hiệu trỏ tới; xem Xung đột 1                |
| `GET /api/trust/seal/:file`                                  | **công khai vĩnh viễn** | SVG nhúng trên site bên thứ ba                  |
| `GET /.well-known/…jwks.json`                                | **công khai vĩnh viễn** | xác minh chữ ký ngoại tuyến                     |
| `GET /api/trust/profile/:orgId`                              | **công khai vĩnh viễn** | trang hồ sơ huy hiệu trỏ tới                    |
| `GET /api/trust/directory`                                   | ❓ chủ dự án quyết      | xem Xung đột 2                                  |
| `GET /api/trust/programs[/:slug]`                            | VIP trở lên             | danh mục chương trình = tài liệu bán hàng       |
| `/api/trust/orgs`, `domains`, `applications`, `certificates` | VIP trở lên             | nay thêm cổng vai trò, không chỉ "đã đăng nhập" |
| `/api/trust/admin/*`                                         | ADMIN                   | giữ nguyên                                      |

Trang tương ứng ở frontend:

| Trang                    | Sau đợt này                               |
| ------------------------ | ----------------------------------------- |
| `/trust/verify/*`        | công khai, giữ trong sitemap              |
| `/trust/org/[id]`        | công khai                                 |
| `/trust/directory`       | ❓ theo quyết định ở Xung đột 2           |
| `/trust`                 | VIP trở lên; khách thấy trang mời nhập mã |
| `/trust/programs/[slug]` | VIP trở lên                               |
| `/trust/apply`           | VIP trở lên                               |
| `/trust/portal`          | VIP trở lên                               |
| `/admin/trust`           | ADMIN, giữ nguyên                         |

**Điều hướng:** gỡ "Con dấu" khỏi `NAV` của `SiteHeader` và ba mục ở
`SiteFooter` đối với người chưa đạt VIP. `SiteHeader` đã có `useSession()` nên
lọc theo `session.user.role` — vai trò đã được đưa vào JWT ở
`callbacks.jwt`/`session`.

> ⚠️ Ẩn ở điều hướng **không phải** bảo mật. Nó chỉ là dọn giao diện. Cổng thật
> nằm ở `requireRole()` phía service, vốn đọc `User.role` từ DB và fail closed.
> Đừng dựa vào việc giấu link.

---

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

## Phần D — SEO

- Giữ `/trust/verify/*` và `/trust/org/*` trong `sitemap.xml`, cho lập chỉ mục.
- `/trust`, `/trust/programs/*`: thêm `noindex` NẾU chúng thành chỉ-mời, và gỡ
  khỏi `sitemap.xml`. `Seo` component đã có prop `noindex`.
- `/trust/directory`: theo quyết định ở Xung đột 2.
- Kiểm sau khi làm: `curl -s https://tsudev.com/sitemap.xml` không được liệt kê
  trang chỉ-mời; `/trust/verify/<serial>` của một chứng chỉ thật vẫn phải trả
  200 **khi chưa đăng nhập** (dùng cửa sổ ẩn danh hoặc `curl` không cookie).

---

## Thứ tự thực hiện đề nghị

1. **Hỏi chủ dự án hai câu ở Xung đột 1 và 2** trước khi viết mã.
2. Phần C (gỡ tín dụng) — độc lập, ít rủi ro nhất, làm trước để bề mặt gọn lại.
   Nhớ thứ tự code-trước-migration-sau.
3. Phần B (mã mời) — migration thuần tính cộng, route ở auth-service, test.
4. Phần A (phân loại lại bề mặt) — **cùng lúc** cập nhật `AUTH_PREFIXES`,
   `PUBLIC_PREFIXES`/`PRIVATE_PREFIXES` của proxy, và `authCoverage.test.ts`.
5. Phần D (SEO) và điều hướng.

## Cổng kiểm bắt buộc trước khi phát hành

- `authCoverage.test.ts` phải xanh — nó là lưới an toàn duy nhất bắt được một
  route riêng tư bị bỏ quên ở nhánh công khai.
- Test mới: khách **chưa đăng nhập** vẫn xem được `/trust/verify/:serial` và
  huy hiệu SVG. Đây là hồi quy nguy hiểm nhất của cả đợt, và nó im lặng —
  huy hiệu chỉ đơn giản biến mất trên site khách hàng.
- Test mới: tài khoản MEMBER **không** vào được `/api/trust/applications`.
- Test mới: đổi mã hai lần không nâng được lượt; mã hết hạn/đã thu hồi bị từ chối.
- E2E: luồng khách → nhập mã → nộp đơn.
