# CHANGELOG

Mỗi bản phát hành **một dòng**, dạng `{version} — {DD/MM/YYYY} — {nội dung}`
(`docs/DESIGN_SYSTEM.md` §6). Mới nhất trên cùng.

tsudev là **website**, không phải app cài đặt, nên nó không mang chuỗi version
theo khuôn `{YY}.{M}.{DD}{NN}` - khuôn đó chỉ áp cho tool/phần mềm desktop phát
hành thành file cài. Ở đây mỗi dòng là một đợt thay đổi đáng kể, đánh dấu bằng ngày.

## Chưa phát hành

- 20/08/2026 — Tái cấu trúc toàn bộ giao diện theo bộ quy ước v1.0.0: ba chế độ
  Sáng/Ấm/Tối, `tokens/design-tokens.json` thành nguồn chân lý duy nhất,
  `packages/ui/src/tokens.css` thành bản sinh ra, đổi tên toàn bộ token trên ~50
  file, thang chữ ghi đè hoàn toàn bằng token, ngày hiển thị chuẩn `DD/MM/YYYY`.
  Nghiệm thu: 12 trang × 3 chế độ không có lỗi tương phản, e2e 20/20.
