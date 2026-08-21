# AGENTS.md - tsudev

> File này có HAI phần. **Phần A** là bộ quy ước v1.0.0 dùng chung cho mọi repo
> trong hệ sinh thái tsudev - nguyên văn, bất khả xâm phạm. **Phần B** là phần
> riêng của repo tsudev: bảng phân vai 8 agent và cách chạy song song. Phần B
> tuân theo phần A, không ghi đè nó; chỗ nào cần nói rõ thêm thì nói rõ ở phần B.
>
> Ngữ cảnh kỹ thuật của repo (bản đồ cổng, gotcha, quy ước code) nằm ở
> [`CLAUDE.md`](CLAUDE.md), không lặp lại ở đây.

---

# PHẦN A - Quy ước bắt buộc (bộ quy ước v1.0.0, KHÔNG SỬA)

> **ĐỌC FILE NÀY ĐẦU TIÊN trong mọi phiên làm việc mới.** Áp dụng cho toàn bộ project.
> Các file quy ước (`AGENTS.md`, `docs/*`, `tokens/*`, `.gitignore`) là **BẤT KHẢ XÂM PHẠM**: chỉ đọc-hiểu-tuân thủ, KHÔNG được sửa/xóa trừ khi chủ project yêu cầu trực tiếp.

## 0. Câu lệnh khởi động phiên (dán vào đầu mỗi phiên terminal mới)

```
Đọc AGENTS.md, logs/STATE.md và phiếu bàn giao mới nhất trong logs/handover/.
Tuân thủ toàn bộ quy ước. Nhận task tiếp theo trong hàng đợi của STATE.md,
khóa file mình sẽ sửa vào logs/LOCKS.md rồi mới bắt đầu. Trả lời ngắn gọn,
tiết kiệm token, không lặp lại nội dung đã có trong file quy ước.
```

## 1. Nguyên tắc tiết kiệm token / context

- Không đọc lại file đã nắm nội dung trong cùng phiên; không in toàn bộ file dài ra hội thoại - chỉ trích phần liên quan.
- Trả lời và ghi log **ngắn gọn, gạch đầu dòng, không văn mẫu**. Không lặp lại quy ước đã có sẵn trong docs.
- Mọi tri thức dùng lại được (quyết định kiến trúc, cách chạy build, lỗi đã gặp) ghi vào file markdown tương ứng **một lần duy nhất**, các phiên sau chỉ tham chiếu đường dẫn.
- Task lớn phải chia nhỏ; làm xong phần nào chốt phần đó vào log ngay để mất phiên không mất công.

## 2. Đội ngũ agent & chống giẫm chân (File Lock + Phiếu bàn giao)

- Mỗi agent nhận **một nhiệm vụ duy nhất** tại một thời điểm, ghi rõ trong `logs/STATE.md` (mục "Đang thực hiện").
- **Trước khi sửa bất kỳ file nào**: kiểm tra `logs/LOCKS.md`. File chưa ai khóa → thêm dòng khóa `<đường dẫn> | <tên agent/nhiệm vụ> | <HH:mm DD/MM/YYYY>` rồi mới sửa. Sửa xong → xóa dòng khóa.
- File **đang bị agent khác khóa** → TUYỆT ĐỐI không sửa. Thay vào đó tạo phiếu bàn giao tại `logs/handover/` theo mẫu `docs/templates/HANDOVER.md`, ghi rõ cần thay đổi gì, vì sao, tiêu chí hoàn thành.
- Agent đang giữ khóa **có trách nhiệm đọc phiếu gửi đến mình trước khi nhả khóa** và thực hiện/ghi kết quả vào chính phiếu đó.
- Không bao giờ tự ý can thiệp nhiệm vụ, nhánh git, hoặc file của agent khác đang thực hiện.

## 3. Git, bảo mật & .gitignore

- `.gitignore` gốc của repo là chuẩn tối thiểu. Trong quá trình làm việc, hễ **tạo ra** file/thư mục chứa secret, credential, cache, build output, dữ liệu cá nhân → **bổ sung ngay vào `.gitignore` trước khi commit**.
- **Checklist bắt buộc trước mọi commit / PR / merge / deploy / push:**
  1. `git status` - không có file lạ ngoài phạm vi task.
  2. Không có secret/API key/token/mật khẩu/connection string trong diff (kể cả trong comment, log, file test). Secret chỉ nằm trong `.env*` (đã ignore) hoặc secret manager của nền tảng.
  3. File mới thuộc nhóm nhạy cảm/cache đã vào `.gitignore`.
  4. Build/test pass ở mức tối thiểu của task.
  5. Commit message: `loại(phạm-vi): mô tả ngắn` - ví dụ `fix(auth): sửa hết hạn token`.
- Lỡ commit secret → coi secret đã lộ: thu hồi/đổi khóa ngay, xóa khỏi lịch sử, ghi sự cố vào `logs/STATE.md`.
- Không tắt HTTPS/SSL verify, không hạ cấp thuật toán mã hóa, không mở cổng/quyền rộng hơn mức task cần.

## 4. Tiết kiệm chi phí hạ tầng (mặc định cho mọi project)

- **Luôn ưu tiên gói miễn phí** trước khi cân nhắc trả phí: GitHub (repo/Actions/Pages), Cloudflare (Pages/Workers/R2/DNS), Vercel/Netlify free tier, Supabase/Neon free tier, Oracle Cloud Always Free… Chỉ đề xuất trả phí khi free tier chứng minh không đủ, kèm số liệu.
- Chọn **region gần Việt Nam**: ưu tiên **Singapore**, kế đến **Nhật Bản (Tokyo/Osaka)** cho mọi dịch vụ có chọn vùng (server, DB, CDN origin, storage).
- Tận dụng cache/CDN miễn phí, nén tài nguyên, tránh polling - giảm băng thông là giảm chi phí.
- Trước khi thêm dependency/dịch vụ mới: kiểm tra đã có thứ tương đương trong project chưa; ưu tiên thư viện nhẹ, mã nguồn mở.

## 5. Kết thúc phiên & bàn giao (bắt buộc)

Khi (a) hàng đợi việc trong `logs/STATE.md` đã cạn, (b) được yêu cầu bàn giao, hoặc (c) context sắp cạn:

1. Ghi vào `logs/STATE.md`: việc đã làm, việc dang dở + bước tiếp theo cụ thể, quyết định quan trọng.
2. Tạo phiếu bàn giao `logs/handover/YYYYMMDD-NN_<chủ-đề>.md` theo mẫu (đủ để phiên sau làm tiếp **không cần hỏi lại**, kể cả khi máy tắt đột ngột).
3. Nhả toàn bộ khóa của mình trong `logs/LOCKS.md`.
4. Dọn tàn dư: xóa file tạm/scratch, không để thay đổi chưa commit ngoài phạm vi bàn giao - chuẩn hóa cây làm việc sạch để phiên sau không tốn "chi phí chết".
5. Đề xuất chủ project **đóng terminal, mở phiên mới** cho task kế tiếp.

## 6. Quy ước giao diện & phát hành

- Mọi thay đổi UI phải dùng token trong `tokens/` - cấm hard-code màu/cỡ chữ/radius. Chi tiết: `docs/DESIGN_SYSTEM.md`.
- **Chỉ dùng gạch ngang ngắn `-` (hyphen, U+002D)** trong MỌI văn bản: code, comment, chuỗi hiển thị, tài liệu, log, commit. **KHÔNG dùng em-dash `—` (U+2014)** - nó phá tính thống nhất của giao diện và khó gõ. En-dash `–` (U+2013) chỉ chấp nhận cho khoảng số (`3-5`, `14-15px`) và cũng nên ưu tiên `-`.
- Ngày tháng hiển thị dạng số `DD/MM/YYYY` (ví dụ `01/02/2027`).
- Tên bản phát hành app/tool theo mục 6 của `docs/DESIGN_SYSTEM.md` (ví dụ `tsudev-swico_26.8.1901_x64-setup.exe`).
- Cấu trúc thư mục chuẩn: `docs/PROJECT_STRUCTURE.md` - tạo file mới phải đặt đúng vị trí quy định.

---

# PHẦN B - Phân vai agent trong repo tsudev

## Tám agent chuyên trách của repo này

Repo này định nghĩa **8 agent chuyên trách** trong `.claude/agents/`. Mỗi agent
sở hữu một vùng đường dẫn tách rời nhau.

Quyền sở hữu đường dẫn và `logs/LOCKS.md` ở §2 giải quyết **hai** việc khác nhau,
cần cả hai:

- **Quyền sở hữu đường dẫn** trả lời "ai được sửa file này" - nó là quy tắc TĨNH,
  đọc một lần là biết, không phải hỏi ai.
- **`logs/LOCKS.md`** trả lời "ngay lúc này có ai đang sửa nó không" - đó là trạng
  thái ĐỘNG, và quyền sở hữu đường dẫn không trả lời được: hai phiên cùng đóng vai
  `frontend-web` trên hai terminal vẫn giẫm chân nhau, và một task xuyên vùng thì
  một agent buộc phải chạm file của vùng khác.

Quyền sở hữu nói ai ĐƯỢC sửa; khoá nói ai ĐANG sửa. Bỏ cái nào cũng hở.

Lưu ý phạm vi: cả hai đều không tránh được xung đột git khi nhiều terminal dùng
chung một working tree. Muốn chạy song song thật thì đọc mục [Chạy song
song](#chạy-song-song) bên dưới.

## Bảng sở hữu

| Agent           | Sở hữu đường dẫn                                                                                          | Thế mạnh                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `backend-api`   | `services/{content,storage,auth}-service/`                                                                | route Express, truy vấn Prisma, hợp đồng API |
| `trust-seal`    | `services/trust-service/`, `apps/frontend-main/pages/{trust,admin/trust}`                                 | ký Ed25519, vòng khoá, quy tắc giám sát      |
| `frontend-web`  | `apps/frontend-main/` (trừ phần của trust-seal)                                                           | trang Next, route proxy, NextAuth            |
| `design-system` | `packages/ui/`, `packages/brand/`, `tokens/`                                                              | token, component dùng chung, a11y, Storybook |
| `data-schema`   | `packages/db/`                                                                                            | schema Prisma, migration, seed               |
| `infra-deploy`  | `docker/`, `render.yaml`, `.github/`, `.husky/`, `scripts/`, `wrangler.jsonc`, `services/backend-bundle/` | build, phát hành, CI, biến môi trường        |
| `qa-test`       | `services/*/test/`, `e2e/`, `packages/ui/test/`                                                           | unit + E2E, cổng tương phản, chẩn đoán CI    |
| `docs-curator`  | `docs/` (trừ file viết HOA), mọi `README.md`, `CHANGELOG.md`                                              | giữ tài liệu đúng và gọn                     |

> **Ba nhóm file KHÔNG agent nào sở hữu vì không agent nào được sửa**: `AGENTS.md`
> phần A, `docs/DESIGN_SYSTEM.md`, `docs/PROJECT_STRUCTURE.md`, `tokens/tokens.css`
> và `tokens/design-tokens.json` khối `color`. Chúng đến từ bộ quy ước dùng chung;
> muốn đổi thì đổi ở repo token trung tâm rồi đồng bộ xuống. `design-system` được
> ghi vào `tokens/design-tokens.json` **chỉ ở khối `extensions.tsudev-web`**.
>
> `logs/STATE.md` và `logs/LOCKS.md` thì ngược lại: **mọi** agent đều ghi, và đó là
> điểm duy nhất trong repo mà việc ghi đồng thời là bình thường - thêm/xoá đúng
> dòng của mình, đừng viết lại cả file.

> **`services/backend-bundle/` là vùng giáp ranh nguy hiểm.** Nó không chứa
> logic nghiệp vụ nào - chỉ mount bốn app Express của `backend-api` và
> `trust-seal` vào một tiến trình, điều phối theo **bảng tiền tố đường dẫn**.
> Thêm route mới có tiền tố chưa nằm trong bảng đó ⇒ route sống khi chạy service
> riêng, nhưng **404 ở production** (nơi chạy chế độ gộp). Sửa route thì sửa
> bảng, và test của bundle sẽ bắt phần lớn - nhưng không bắt được tiền tố hoàn
> toàn mới.

## Gọi agent thế nào

Gõ `/agents` để xem danh sách đã đăng ký. Hai cách gọi, khác nhau ở **chỗ tiêu
tốn context**:

**Cách 1 - giao cho subagent (tiết kiệm context nhất).** Trong phiên đang mở:

```
Dùng subagent backend-api để thêm endpoint GET /api/users/:username/badges
```

Subagent chạy trong **context window riêng**. Việc `grep`, đọc file, chạy test
của nó không đổ vào phiên của bạn - chỉ báo cáo cuối cùng quay về. Một task đọc
20 file mà phiên chính chỉ nhận về vài đoạn kết luận.

Không nêu tên cũng được, Claude tự khớp theo trường `description` của agent. Nêu
tên rõ khi ở vùng giáp ranh (`trust-seal` và `backend-api` đều là service
Express, nhưng luật khác hẳn nhau).

**Cách 2 - cả terminal đóng một vai.** Mở terminal mới, câu đầu tiên:

```
Đọc .claude/agents/frontend-web.md và tuân theo suốt phiên này.
Việc: sửa route proxy /api/market để trả kèm pagination.
```

Hợp khi cần **lặp nhiều vòng có trao đổi** trong cùng một vùng - subagent chạy
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
thì `git add <file cụ thể>`, **không** `git add -A` - `-A` sẽ nuốt cả thay đổi
dang dở của agent khác vào commit của bạn.

## Chạy song song

Quyền sở hữu đường dẫn giải quyết xung đột **sửa file**. Nó không giải quyết ba
thứ dùng chung khác: một working tree, một nhánh git đang checkout, và một dải
cổng local. Ba lựa chọn, xếp theo mức an toàn:

### Tuần tự - mặc định

Một terminal một lúc, xong pha này mới mở pha sau. Không có gì để hỏng. Đủ dùng
cho hầu hết việc, kể cả việc chạm nhiều vùng.

### Song song trên cùng working tree

Được, với **cả ba** điều kiện:

- Các agent thật sự không chạm file của nhau (đối chiếu bảng sở hữu trước).
- Mỗi terminal `git add <file cụ thể>`, không `git add -A`.
- **Chỉ một** terminal chạy `npm run dev:local`. Hai tiến trình cùng giành cổng
  3000/3001/4000-4003, cái thứ hai chết hoặc chiếm cổng của cái thứ nhất.

Không hợp cho việc đổi nhánh: `git checkout` ở terminal này đổi luôn file dưới
chân terminal kia.

### Git worktree - song song thật

Mỗi agent một thư mục, một nhánh, không giẫm chân gì cả:

```bash
git worktree add ../tsudev-backend  -b feat/backend-badges
git worktree add ../tsudev-frontend -b feat/frontend-market
```

Rồi mở `claude` trong từng thư mục. Đánh đổi:

- Mỗi worktree cần `npm install` riêng (và `npm run db:generate` nếu đụng
  Prisma) - `node_modules/` không dùng chung được.
- Dùng chung **một** database local (:5433). Hai worktree cùng chạy migration
  khác nhau sẽ đá nhau - chỉ một worktree được sở hữu DB tại một thời điểm, hoặc
  tách bằng `TSUDEV_PGDATA` + `TSUDEV_PGPORT` riêng.
- Vẫn phải chỉ một worktree chạy `dev:local`, trừ khi đổi cổng.
- Cuối cùng phải merge nhiều nhánh.

Dọn khi xong:

```bash
git worktree remove ../tsudev-backend
git worktree list                        # kiểm còn sót không
```

Đáng dùng khi hai chuỗi việc **dài và độc lập thật sự** (ví dụ `design-system`
làm lại token, `infra-deploy` đổi đường deploy). Việc ngắn thì chi phí
dựng worktree lớn hơn lợi ích - làm tuần tự.

## Cổng an toàn

- **Xin xác nhận trước khi `git push` hoặc deploy.** Chỉ commit/push khi người
  dùng yêu cầu.
- Trước commit: `npm run format:check` + `npm run lint`, và test của workspace
  đã sửa.
- Không bao giờ chạy `npm run db:reset` với `DATABASE_URL` trỏ ra ngoài local.
- Không ghi giá trị secret thật vào bất kỳ file nào được theo dõi bởi git.

## Kỷ luật token

Xem **§1 của phần A** - áp dụng nguyên vẹn cho mọi agent. Ba điểm riêng của repo này:

- **Không bao giờ đọc**: `node_modules/`, `.git/`, `.next/`, `dist/`, `build/`,
  `coverage/`, `package-lock.json`, file nhị phân/ảnh.
- `content-service/src/index.js` hơn 1000 dòng. `grep -n` tìm dòng, rồi
  `sed -n 'X,Yp'` đọc đúng đoạn - đọc cả file là đốt ngân sách cho 95% thứ không dùng.
- Mỗi agent đã liệt kê sẵn 1-3 file cần nạp trong định nghĩa của mình ở
  `.claude/agents/`. `docs/README.md` là mục lục cho trường hợp còn lại.
