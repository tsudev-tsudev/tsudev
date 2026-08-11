# Phân vai agent — tsudev

Repo này định nghĩa **8 agent chuyên trách** trong `.claude/agents/`. Mỗi agent
sở hữu một vùng đường dẫn tách rời nhau — **quyền sở hữu theo đường dẫn là cơ chế
tránh xung đột, không cần file khoá**.

Lưu ý phạm vi: quyền sở hữu đường dẫn tránh được việc **hai agent sửa cùng một
file**. Nó **không** tránh được xung đột git khi nhiều terminal dùng chung một
working tree. Muốn chạy song song thật thì đọc mục [Chạy song
song](#chạy-song-song) bên dưới.

## Bảng sở hữu

| Agent           | Sở hữu đường dẫn                                                              | Thế mạnh                                     |
| --------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| `backend-api`   | `services/{user,content,storage}-service/`                                    | route Express, truy vấn Prisma, hợp đồng API |
| `trust-seal`    | `services/trust-service/`, `apps/frontend-main/pages/{trust,admin/trust}`     | ký Ed25519, vòng khoá, quy tắc giám sát      |
| `frontend-web`  | `apps/frontend-main/`, `apps/frontend-forum/` (trừ phần của trust-seal)       | trang Next, route proxy, NextAuth            |
| `design-system` | `packages/ui/`, `packages/brand/`                                             | token, component dùng chung, a11y, Storybook |
| `data-schema`   | `packages/db/`                                                                | schema Prisma, migration, seed               |
| `infra-deploy`  | `docker/`, `render.yaml`, `.github/`, `.husky/`, `scripts/`, `wrangler.jsonc` | build, phát hành, CI, biến môi trường        |
| `qa-test`       | `services/*/test/`, `e2e/`                                                    | unit + E2E, chẩn đoán CI                     |
| `docs-curator`  | `docs/`, mọi `README.md`, `AGENTS.md`                                         | giữ tài liệu đúng và gọn                     |

## Gọi agent thế nào

Gõ `/agents` để xem danh sách đã đăng ký. Hai cách gọi, khác nhau ở **chỗ tiêu
tốn context**:

**Cách 1 — giao cho subagent (tiết kiệm context nhất).** Trong phiên đang mở:

```
Dùng subagent backend-api để thêm endpoint GET /api/users/:username/badges
```

Subagent chạy trong **context window riêng**. Việc `grep`, đọc file, chạy test
của nó không đổ vào phiên của bạn — chỉ báo cáo cuối cùng quay về. Một task đọc
20 file mà phiên chính chỉ nhận về vài đoạn kết luận.

Không nêu tên cũng được, Claude tự khớp theo trường `description` của agent. Nêu
tên rõ khi ở vùng giáp ranh (`trust-seal` và `backend-api` đều là service
Express, nhưng luật khác hẳn nhau).

**Cách 2 — cả terminal đóng một vai.** Mở terminal mới, câu đầu tiên:

```
Đọc .claude/agents/frontend-web.md và tuân theo suốt phiên này.
Việc: sửa route proxy /api/market để trả kèm pagination.
```

Hợp khi cần **lặp nhiều vòng có trao đổi** trong cùng một vùng — subagent chạy
một mạch rồi trả kết quả, khó chen ngang giữa chừng. Đánh đổi: mọi thứ nó đọc
đều nằm trong context của bạn.

Với chuỗi xuyên vùng, giao cả chuỗi cho **một** phiên và để nó tự điều phối theo
đúng thứ tự ở giao thức 2:

```
Thêm trường `pinnedAt` cho Thread. Theo đúng thứ tự chuỗi xuyên vùng
trong AGENTS.md, gọi lần lượt data-schema → backend-api → frontend-web.
```

## Ba giao thức

**1. Không tự vượt biên.** Cần đổi file thuộc agent khác thì **mô tả thay đổi
cần thiết và báo lại**, đừng tự sửa. Ngoại lệ duy nhất: người dùng nói rõ "làm
luôn cả phần kia".

**2. Thay đổi xuyên vùng có thứ tự cố định.** Ba chuỗi hay gặp:

| Việc                          | Thứ tự bắt buộc                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Thêm trường dữ liệu           | `data-schema` (migration + generate) → `backend-api` (endpoint) → `frontend-web` (proxy + trang) |
| Thêm endpoint trình duyệt gọi | `backend-api` (route) → `frontend-web` (mở rộng proxy)                                           |
| Đổi hành vi xác thực          | `backend-api` sửa **cả bốn** `authMiddleware.js` → `qa-test` cập nhật test                       |

Đảo thứ tự thì khâu sau đỏ vì khâu trước chưa có.

**3. Một nhánh git cho một chuỗi việc.** `main` không có branch protection phía
server; chỉ có hook `.husky/pre-push` chặn. Nhiều agent cùng commit vào một nhánh
thì `git add <file cụ thể>`, **không** `git add -A` — `-A` sẽ nuốt cả thay đổi
dang dở của agent khác vào commit của bạn.

## Chạy song song

Quyền sở hữu đường dẫn giải quyết xung đột **sửa file**. Nó không giải quyết ba
thứ dùng chung khác: một working tree, một nhánh git đang checkout, và một dải
cổng local. Ba lựa chọn, xếp theo mức an toàn:

### Tuần tự — mặc định

Một terminal một lúc, xong pha này mới mở pha sau. Không có gì để hỏng. Đủ dùng
cho hầu hết việc, kể cả việc chạm nhiều vùng.

### Song song trên cùng working tree

Được, với **cả ba** điều kiện:

- Các agent thật sự không chạm file của nhau (đối chiếu bảng sở hữu trước).
- Mỗi terminal `git add <file cụ thể>`, không `git add -A`.
- **Chỉ một** terminal chạy `npm run dev:local`. Hai tiến trình cùng giành cổng
  3000/3001/4000–4003, cái thứ hai chết hoặc chiếm cổng của cái thứ nhất.

Không hợp cho việc đổi nhánh: `git checkout` ở terminal này đổi luôn file dưới
chân terminal kia.

### Git worktree — song song thật

Mỗi agent một thư mục, một nhánh, không giẫm chân gì cả:

```bash
git worktree add ../tsudev-backend  -b feat/backend-badges
git worktree add ../tsudev-frontend -b feat/frontend-market
```

Rồi mở `claude` trong từng thư mục. Đánh đổi:

- Mỗi worktree cần `npm install` riêng (và `npm run db:generate` nếu đụng
  Prisma) — `node_modules/` không dùng chung được.
- Dùng chung **một** database local (:5433). Hai worktree cùng chạy migration
  khác nhau sẽ đá nhau — chỉ một worktree được sở hữu DB tại một thời điểm, hoặc
  tách bằng `TSUDEV_PGDATA` + `TSUDEV_PGPORT` riêng.
- Vẫn phải chỉ một worktree chạy `dev:local`, trừ khi đổi cổng.
- Cuối cùng phải merge nhiều nhánh.

Dọn khi xong:

```bash
git worktree remove ../tsudev-backend
git worktree list                        # kiểm còn sót không
```

Đáng dùng khi hai chuỗi việc **dài và độc lập thật sự** (ví dụ `design-system`
làm lại token, `infra-deploy` dựng đường deploy cho forum). Việc ngắn thì chi phí
dựng worktree lớn hơn lợi ích — làm tuần tự.

## Kỷ luật token (áp dụng cho mọi agent)

Ngân sách ngữ cảnh là tài nguyên chung. Bốn luật, xếp theo mức tiết kiệm:

**1. Định vị trước, đọc sau.** `grep -n` để tìm dòng, rồi `sed -n 'X,Yp'` đọc
đúng đoạn. `content-service/src/index.js` hơn 1000 dòng — đọc cả file là đốt
ngân sách cho 95% thứ không dùng.

**2. Đọc theo bảng định tuyến, không đọc cả `docs/`.** Mỗi agent đã liệt kê sẵn
1–3 file cần nạp trong định nghĩa của mình. `docs/README.md` là mục lục cho
trường hợp còn lại. Nạp thừa một file là trả tiền cho nó ở **mọi** lượt còn lại
của phiên.

**3. Không bao giờ đọc:** `node_modules/`, `.git/`, `.next/`, `dist/`, `build/`,
`coverage/`, `package-lock.json`, file nhị phân/ảnh.

**4. Gộp lượt.** Nhiều lệnh độc lập ⇒ một lượt nhiều tool call. Mỗi lượt qua lại
là một lần trả tiền cho **toàn bộ** ngữ cảnh đã tích luỹ.

Kèm theo:

- Đừng đọc lại file vừa sửa để "kiểm tra" — công cụ đã báo lỗi nếu sửa hỏng.
- Sửa hàng loạt theo khuôn mẫu ⇒ viết script biến đổi, chạy thử rồi mới áp dụng;
  đừng sửa tay từng file.
- Chạy cổng kiểm tra **một lần ở cuối** cụm thay đổi, không chạy sau mỗi file.
- Đừng tóm tắt lại việc vừa làm ở mỗi lượt; báo cáo khi xong một pha.
- Phiên dài thì đóng terminal mở phiên mới thay vì kéo dài — ngữ cảnh cũ là chi
  phí chết ở mọi lượt sau. Tri thức đáng giữ thì ghi vào `docs/`.

## Cổng an toàn

- **Xin xác nhận trước khi `git push` hoặc deploy.** Chỉ commit/push khi người
  dùng yêu cầu.
- Trước commit: `npm run format:check` + `npm run lint`, và test của workspace
  đã sửa.
- Không bao giờ chạy `npm run db:reset` với `DATABASE_URL` trỏ ra ngoài local.
- Không ghi giá trị secret thật vào bất kỳ file nào được theo dõi bởi git.
