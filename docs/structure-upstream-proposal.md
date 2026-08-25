# Đề xuất: quy ước cấu trúc thư mục cần một hình trạng thứ hai (monorepo)

> **Trạng thái: ĐÃ ĐƯỢC NHẬN, đóng ngày 25/08/2026 (phiên 24).** Bộ quy ước
> `.standards/` **v2.8.0** đã tách `PROJECT_STRUCTURE.md` thành **§1 Hình trạng A -
> ứng dụng đơn** và **§2 Hình trạng B - monorepo nhiều workspace**, đúng đề nghị
> dưới đây, kèm bảng phân biệt `services/` ở gốc repo (tiến trình độc lập) với
> `src/services/` bên trong một app.
> Issue nguồn: [tsudev-standards#2](https://github.com/tsudev-tsudev/tsudev-standards/issues/2).
>
> Hệ quả: tsudev-web **hết lệch** quy ước cấu trúc - repo khai theo Hình trạng B.
> Mục "Điểm lệch cần biết" của [`architecture.md`](architecture.md) đã rút xuống
> một dòng khai báo, đúng như đoạn cuối file này dự trù.
>
> File giữ lại làm hồ sơ, không phải việc còn dở. Cùng loại với
> [`token-upstream-proposal.md`](token-upstream-proposal.md).
>
> Đối tượng lúc soạn: `docs/PROJECT_STRUCTURE.md` v1.0.0 (file bất khả xâm phạm ở
> các repo con, nên chỉ sửa được từ trung tâm).

## Vấn đề

Quy ước hiện mô tả **một** hình trạng: một cây `src/` duy nhất cho toàn repo.

```
src/
├── main/ hoặc app/
├── components/
├── features/
├── services/
├── utils/
├── styles/
└── types/ hoặc models/
```

Hình trạng đó đúng cho ứng dụng đơn (Electron, CLI, một app web). Nó **không mô
tả được** một monorepo nhiều workspace, mà tsudev-web là ví dụ đang chạy thật:

```
apps/frontend-main/       # Next 15
services/{content,storage,auth,trust,newsroom}-service/
services/backend-bundle/  # gộp các service thành một tiến trình ở production
packages/{ui,db,auth,types,identity-token,trust-crypto}/
```

Ở đây `services/` là **tiến trình độc lập**, không phải thư mục "gọi API" bên
trong một app; `packages/` là thư viện có ranh giới build riêng. Ép cả cây về một
`src/` chung sẽ xoá chính thứ đang tách chúng ra.

## Đề xuất

Thêm vào quy ước một mục "Hình trạng B - monorepo nhiều workspace", giữ nguyên
mục hiện có làm "Hình trạng A - ứng dụng đơn". Repo tự khai mình theo hình trạng
nào; mọi quy tắc KHÔNG phụ thuộc cây thư mục vẫn áp dụng cho cả hai:

- quy tắc đặt tên (`kebab-case`, `camelCase`, `UPPER_SNAKE.md`…)
- một file một trách nhiệm, > 400 dòng thì cân nhắc tách
- `logs/`, `tokens/`, `docs/` đặt đúng chỗ ở gốc repo
- sản phẩm build luôn nằm trong `.gitignore`
- hàm dùng chung ≥ 2 nơi thì gom lại, không copy-paste

Khác biệt duy nhất của hình trạng B là **nơi** cây `src/` sống: mỗi workspace có
`src/` riêng, và quy tắc "hàm dùng chung ≥ 2 nơi" được thoả bằng một package
dùng chung (`packages/<tên>/`) thay vì `src/utils/`.

### Gợi ý cách diễn đạt

> **Hình trạng B - monorepo.** Repo khai `workspaces` trong `package.json` (hoặc
> tương đương ở hệ khác) thì mỗi workspace là một đơn vị theo Hình trạng A thu
> nhỏ: `<workspace>/src/…`. Gốc repo chỉ giữ thứ dùng chung cho toàn repo:
> `docs/`, `logs/`, `tokens/`, `scripts/`, cấu hình build/CI. Không có `src/` ở
> gốc. Ranh giới sở hữu và quyền sửa file khai ở `AGENTS.md`.

## Vì sao đáng sửa ở trung tâm thay vì để mỗi repo tự lệch

Một repo lệch quy ước rồi ghi chú lại thì người đọc vẫn phải tin ghi chú đó.
Hai repo lệch theo hai kiểu khác nhau thì quy ước thôi trả lời được câu hỏi
"đặt file mới ở đâu" - mà đó là toàn bộ lý do nó tồn tại.

Hiện tsudev-web đang ghi điểm lệch trong `docs/architecture.md` §"Điểm lệch cần
biết". Nếu trung tâm nhận hình trạng B, đoạn đó rút xuống còn một dòng khai báo.
