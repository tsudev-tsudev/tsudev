# Phiếu bàn giao - agent vùng `newsroom`

> Từ: phiên agent chính, 18/08/2026.
> Nhận: agent đang làm nhánh `feat/newsroom`.
> Xong việc thì **xoá file này**.

## Vì sao có phiếu này

Repo đã chuẩn hoá: **không dùng em dash `-`, chỉ dùng gạch nối `-`**. Đợt quét
toàn repo nằm ở commit `56af669` và `c1c577b`.

Ba file thuộc vùng của bạn được tạo/sửa **sau** đợt quét nên còn em dash. Tôi
**cố ý không sửa** vì bạn đang làm dở trên chúng - sửa vào là giẫm chân nhau.

## Việc cần làm

Đổi mọi ký tự `-` (U+2014) thành `-` trong:

- [ ] `apps/frontend-main/pages/admin/newsroom.tsx`
- [ ] `docs/refactor-newsroom-agents.md`
- [ ] `infrastructure/newsroom-cron/README.md`

Tìm nhanh: `grep -n '-' <file>`

## Một cái bẫy đã trả giá để học

Em dash **đầu dòng** trong markdown, khi đổi thành `-`, biến dòng đang nối tiếp
thành **bullet lồng** - nội dung render sai mà không công cụ nào báo. Đợt quét
đã vấp đúng hai lần (`CLAUDE.md` và `docs/refactor-newsroom-agents.md`).

Cách xử: dời dấu `-` lên **cuối dòng trước**, đừng để nó mở đầu dòng.

Kiểm sau khi sửa:

```bash
grep -nE '^\s+- ' docs/refactor-newsroom-agents.md   # phải không ra dòng nối tiếp nào lạ
npm run format:check
```

## Không liên quan nhưng nên biết

`docs/refactor-newsroom-agents.md` lúc đó đang untracked; tôi đã quét dấu và
chạy prettier trên nó rồi (chỉ chuẩn hoá thụt lề 3 dòng), nhưng **không commit**
vì nó là việc dở của bạn. Đọc lại file từ đĩa trước khi ghi tiếp, kẻo đè mất.

---

## Thêm: test của bạn đang ĐỎ (không phải do tôi)

`e2e/tests/newsroom.spec.js:30 › trang không được lập chỉ mục` hỏng:

```
locator.getAttribute: Test timeout of 60000ms exceeded.
  - waiting for locator('meta[name="robots"]')
```

**Đã chứng minh không phải do thay đổi của tôi**: tôi gỡ tạm
`apps/frontend-main/middleware.ts` rồi chạy lại đúng test đó - vẫn hỏng y hệt.

**Nguyên nhân**: test gọi `page.goto('/admin/newsroom')` mà **không đăng nhập**.
Lúc đó trang render cổng đăng nhập, và `<Seo title="Toà soạn Agent AI" noindex />`
ở `apps/frontend-main/pages/admin/newsroom.tsx:261` nằm trong nhánh
**đã-đăng-nhập** nên không bao giờ chạy - thẻ `meta[name="robots"]` vì thế không
tồn tại.

Hai đường sửa, chọn theo ý bạn:

1. **Sửa test**: đăng nhập trước khi `goto`, giống các test admin khác.
2. **Sửa trang**: đưa `<Seo … noindex />` ra **ngoài** nhánh xác thực.

Đường 2 đáng cân nhắc hơn: hiện tại trang cổng-đăng-nhập của `/admin/newsroom`
**không có `noindex`**, tức là nó lập chỉ mục được. Đó đúng là thứ test này sinh
ra để chặn, nên test đang nói thật chứ không phải nó sai.
