# Kế hoạch: Toà soạn Agent AI (Newsroom)

> **Trạng thái: 5/5 đợt ĐÃ DỰNG XONG ở cây làm việc, CHƯA PHÁT HÀNH.**
> Phạm vi chốt 18/08/2026; toàn bộ mã đã viết, mọi cổng kiểm xanh, 189 test
> đơn vị + 4 E2E.
>
> Việc còn lại là **phát hành**, và nó có ràng buộc thứ tự không đảo được -
> xem §Thứ tự phát hành. Việc chặn trước đó: gộp PR #12 + #13 và phát hành đợt
> 2 mã mời (`HANDOFF.md` §0.8).
>
> Tài liệu này giữ nguyên dạng KẾ HOẠCH vì phần phát hành chưa chạy. Khi
> production đã chạy toà soạn, rút phần hiện trạng về `docs/newsroom.md` và xoá
> tệp này - đừng để hai tầng tài liệu nói khác nhau.

## Mục tiêu (chủ dự án giao)

Một đội ngũ nhân sự AI vận hành 100% tự động cho toàn bộ nội dung của
tsudev.com, cộng một trang quản lý trực quan tại `/admin/newsroom`:

1. **Phòng Tin Tức** - agent Săn Tin quét nguồn theo tần suất, đẩy ý tưởng vào
   hàng đợi.
2. **Phòng Biên Tập** - agent Biên Tập Viên nhận chủ đề, nghiên cứu, viết bài
   chuẩn SEO theo phong cách từng chuyên mục.
3. **Phòng Kiểm Duyệt** - agent Tổng Biên Tập thẩm định (fact-check, chính sách,
   SEO, giọng văn) rồi **duyệt đăng** hoặc **trả về kèm góp ý**.
4. **RBAC khắt khe** - agent có CREATE/READ/UPDATE, **không có DELETE**. Xoá
   mềm cho mọi bài; xoá cứng chỉ chủ dự án làm được.
5. **Dashboard** - sàn ảo realtime, bảng Kanban luồng bài, nhật ký kiểm toán +
   lịch sử phiên bản.

## Quyết định đã có (18/08/2026)

| #   | Quyết định                                                                | Hệ quả                                                                      |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Engine chạy **trong `backend-bundle`**, Cron Trigger Cloudflare đánh nhịp | Chi phí hạ tầng 0đ. §1.1 ping giữ ấm thành **bắt buộc**                     |
| 2   | **Full auto cả 4 chuyên mục** (`/blog` `/docs` `/projects` `/trust`)      | Mức tự chủ vẫn là cấu hình theo chuyên mục, chỉ khác là mặc định mở         |
| 3   | Sàn ảo hoạt ảnh từ **dữ liệu thật**, không có dữ liệu mô phỏng            | Không có cờ `isSimulated`, không seed hoạt động giả vào Audit Log           |
| 4   | Gộp #12/#13 + phát hành đợt 2 **trước**                                   | Nhánh `feat/newsroom` mở từ `main` sạch                                     |
| 5   | **Không dùng bất kỳ tính năng trả phí nào**                               | Claude API bị loại. Workers AI chính + Gemini dự phòng, cả hai gói miễn phí |
| 6   | Scout quét **cả bốn** nhóm nguồn RSS + chủ đề tự đặt                      | Không có `web_search` máy chủ; Scout tự lấy nguồn, có ràng buộc bản quyền   |

Quyết định 5 là ràng buộc mạnh nhất trong tài liệu này và nó lan ra mọi mục:
không Render Cron Jobs, không Workers Paid, không Queues, không Claude API. Mọi
thứ dưới đây đã được đối chiếu với hạn mức miễn phí thật - xem §Hạn mức.

Quyết định 2 đi kèm một ghi nhận đã nêu với chủ dự án và được tái khẳng định:
tsudev.com bán Con dấu tín nhiệm, `/docs` và `/projects` mô tả phần mềm có
thật, và Google có chính sách về nội dung tự động quy mô lớn. Cấu hình
`autonomy` theo chuyên mục vẫn được dựng đầy đủ để siết lại bằng một ô chọn khi
cần - nhưng mặc định là `FULL_AUTO` cho cả bốn.

---

## Sáu phát hiện làm lệch giả định ban đầu

Đây là kết quả khảo sát mã nguồn, không phải phỏng đoán. Bỏ qua mục này là lặp
lại đúng những lỗi `CLAUDE.md` đã ghi.

### 1. Không có CMS layer - blog và docs hiện là dữ liệu SEED

`content-service` chỉ có CRUD cho `/api/admin/projects`. **Không tồn tại**
`/api/admin/posts` hay `/api/admin/docs`. 3 bài `/blog` và 2 bài `/docs` trên
production đến từ `packages/db/prisma/seed.js`. "CMS Layer" trong sơ đồ ban đầu
không phải thứ để nối vào - nó là phần lớn nhất của khối lượng công việc.

### 2. `Post`/`Doc`/`Project` không có trạng thái luồng, phiên bản, hay xoá mềm

`Post.published` là `Boolean @default(true)` - hai trạng thái, mặc định **đã
đăng**. Không có `PENDING_REVIEW`, `REJECTED_WITH_FEEDBACK`, `deletedAt`, không
có bảng lịch sử, không cột nào ghi agent nào viết.

### 3. `/api/admin` đã bị content-service chiếm trọn trong bảng tiền tố

`services/backend-bundle/src/index.ts` khai
`prefixes: ['/api/posts', '/api/docs', '/api/projects', '/api/admin', '/debug']`
cho content-service. Đặt engine ở `/api/admin/newsroom` ⇒ request đi vào app
content trước, dính cổng `INTERNAL_API_TOKEN`, và **404 ở production trong khi
chạy service riêng ở dev vẫn sống**.

➡️ Engine dùng tiền tố riêng **`/api/newsroom`**, và phải thêm vào bảng tiền tố
**trong cùng commit** với route đầu tiên.

### 4. Ngân sách chạy nền đã cạn

Render free: 750 giờ instance/tháng cho **cả tài khoản**; `tsudev-backend` chạy
liên tục tiêu ~720. Render Cron Jobs là tính năng trả phí. Đó là lý do quyết
định 1 - engine sống ké trong tiến trình đã có.

### 5. "Khoá cứng DELETE ở cấp database" cần cơ chế cụ thể

Bốn service dùng **chung một `DATABASE_URL`, một Prisma Client**. Không có ranh
giới kết nối nào để tách quyền agent. Cách thật sự ở cấp DB là **trigger
Postgres**, xem §6.

### 6. Va tên với `.claude/agents/`

`AGENTS.md` nói về 8 subagent Claude Code **thời phát triển**. Hệ mới là nhân sự
AI **lúc runtime**. Hai khái niệm trùng tên hoàn toàn.

➡️ Hệ mới tên là **Newsroom / Toà soạn**: `services/newsroom-service/`,
`/admin/newsroom`, `docs/refactor-newsroom-agents.md`. Không đặt tên nào chứa
"agents" ở cấp thư mục gốc.

---

## Kiến trúc

**EDA ở đây = outbox transactional, không phải message broker.** Đừng giả vờ có
Kafka trên một tiến trình Node. Một bảng `NewsroomEvent` append-only vừa là hàng
đợi sự kiện, vừa là nguồn cấp cho dashboard, vừa **chính là Audit Trail**. Một
bảng làm ba việc, và nó bền qua restart - điều event bus trong RAM không làm được.

```
Cron Trigger (Worker riêng, miễn phí)
   │  mỗi 5 phút: POST /api/newsroom/tick  (+ giữ ấm Render - §1.1 HANDOFF)
   ▼
┌──────────────────────────────────────────────────────────────┐
│ newsroom-service - app Express thứ 5 trong backend-bundle    │
│  ├ Dispatcher  claim event bằng FOR UPDATE SKIP LOCKED       │
│  ├ Scout (RSS) · Writer · Editor · SEO                       │
│  │        └─▶ LlmProvider ──▶ Workers AI  (chính, 0đ)        │
│  │                       └──▶ Gemini      (dự phòng, 0đ)     │
│  └ /api/newsroom/state?since=<cursor>   (poll 3s)            │
└────┬──────────────────────────────────────────┬──────────────┘
     │ ghi                                       │ đọc
     ▼                                           ▼
NewsroomEvent · ContentDraft · DraftRevision   /admin/newsroom
AgentProfile · AgentRun · TopicIdea            (Sàn ảo · Kanban · Nhật ký)
NewsroomSource · NewsroomChannel
     │ publish = phép chiếu draft → bản ghi thật
     ▼
Post · Doc · Project  →  /blog /docs /projects /trust
```

### Bốn quyết định nền

**Agent làm việc trên `ContentDraft`, không trên `Post`.** Publish là phép chiếu
draft → Post/Doc/Project. Lý do: đường đọc công khai (`/api/posts`) không đổi
một dòng, không chạm vào lớp đã từng gây sự cố "trang trống", và tắt toàn bộ hệ
agent thì site vẫn chạy y nguyên. `Post` chỉ thêm ba cột thuần tính cộng.

**Poll cursor trước, SSE sau.** Frontend chạy opennextjs trên Cloudflare
Workers. SSE qua Pages Router API route trên open-next **chưa được kiểm chứng**
trong repo này - coi đó là một spike phải làm trước khi cam kết, không phải giả
định. Nền tảng là `GET /api/newsroom/state?since=<eventId>` poll 3 giây: một
người xem, một tiến trình, không rủi ro tầng biên. Nâng cấp lên SSE khi spike
xanh; hợp đồng dữ liệu giống hệt nên đổi transport không đụng UI.

**Agent không phải `User`, không có phiên NextAuth.** Chúng là `AgentProfile`.
Cho agent một hàng `User` với `role = AGENT_AI` nghe gọn nhưng mở một loại
principal mới vào đúng chỗ `CLAUDE.md` dặn là chỉ có MỘT nguồn phân quyền
(`User.role` qua `@tsudev/auth`). Agent không đăng nhập, nên không nên có danh
tính đăng nhập được. Enum `Role` **không được thêm giá trị nào**.

**Bộ đếm và fanout nằm trong RAM của một tiến trình.** Đúng giả định mà
`services/trust-service/src/rateLimit.ts` đang dựa vào. Chú thích đầu tệp phải
ghi rõ, y như tệp đó.

---

## Schema (`packages/db` - thuần tính cộng)

Bảy model mới + ba cột thêm vào `Post`. Không `DROP` gì, nên **migration đi
trước, code đi sau** (ngược với đợt gỡ `credits`).

```prisma
enum AgentDept      { RESEARCH EDITORIAL PUBLISHING SEO }
enum AgentStatus    { IDLE PLANNING SCANNING WRITING REVIEWING SUSPENDED }
enum DraftStatus    { IDEA IN_PROGRESS PENDING_REVIEW PENDING_HUMAN
                      REJECTED_WITH_FEEDBACK PUBLISHED ARCHIVED }
enum DraftTarget    { BLOG DOC PROJECT TRUST }
enum Autonomy       { FULL_AUTO HUMAN_APPROVAL DRAFT_ONLY }
enum NewsroomEventStatus { PENDING CLAIMED DONE FAILED DEAD }

model AgentProfile {
  id           String      @id @default(cuid())
  slug         String      @unique          // "scout-01"
  displayName  String                        // "Lê Săn Tin"
  title        String                        // "Phóng viên hiện trường"
  dept         AgentDept
  avatarSeed   String                        // sinh avatar định danh, không upload
  /// "workers-ai" | "gemini". Adapter tra bản cài theo giá trị này.
  provider     String      @default("workers-ai")
  model        String      @default("@cf/meta/llama-3.3-70b-instruct-fp8-fast")
  systemPrompt String      @db.Text
  status       AgentStatus @default(IDLE)
  statusNote   String?                       // "đang quét Google Trends"
  suspendedAt  DateTime?                     // SUSPEND_AGENT - chỉ ADMIN
  enabled      Boolean     @default(true)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  runs   AgentRun[]
  drafts ContentDraft[]  @relation("draftAuthorAgent")
  @@index([dept, status])
}

/// Cấu hình theo chuyên mục. Mặc định FULL_AUTO cho cả bốn (quyết định 2).
model NewsroomChannel {
  id            String     @id @default(cuid())
  target        DraftTarget @unique
  autonomy      Autonomy   @default(FULL_AUTO)
  styleGuide    String     @db.Text
  dailyPostCap  Int        @default(2)
  enabled       Boolean    @default(true)
  updatedAt     DateTime   @updatedAt
}

/// Nguồn săn tin. Sửa được từ dashboard, không phải hằng số trong mã.
model NewsroomSource {
  id        String      @id @default(cuid())
  label     String
  kind      String              // "rss" | "atom" | "hn_algolia" | "manual"
  url       String?             // NULL với kind="manual"
  target    DraftTarget
  /// Ghi chú bản quyền hiện lên dashboard. Nguồn báo chí BẮT BUỘC viết mới.
  rewriteOnly Boolean   @default(true)
  enabled   Boolean     @default(true)
  lastScanAt DateTime?
  createdAt DateTime    @default(now())
  @@index([enabled, lastScanAt])
}

model TopicIdea {
  id         String      @id @default(cuid())
  title      String
  rationale  String      @db.Text
  target     DraftTarget
  sourceUrls String[]    @default([])
  sourceId   String?
  score      Int         @default(0)
  /// Chống trùng chủ đề giữa các lần quét. sha256(title chuẩn hoá).
  fingerprint String     @unique
  consumedAt DateTime?
  createdAt  DateTime    @default(now())
  @@index([consumedAt, score])
}

model ContentDraft {
  id        String      @id @default(cuid())
  target    DraftTarget
  status    DraftStatus @default(IDEA)
  slug      String?
  title     String
  excerpt   String?
  contentMd String      @db.Text  @default("")
  tags      String[]    @default([])
  metaTitle String?
  metaDesc  String?

  topicId       String?
  authorAgentId String?
  authorAgent   AgentProfile? @relation("draftAuthorAgent", fields: [authorAgentId], references: [id], onDelete: SetNull)

  /// Đếm vòng Writer→Editor→Writer. Trần cứng trong mã, xem §7.
  revisionCount Int      @default(0)
  reviewFeedback String? @db.Text
  publishedPostId String?
  deletedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  revisions DraftRevision[]
  @@index([status, target, updatedAt])
  @@index([deletedAt])
}

/// Lịch sử phiên bản. Append-only - không có đường UPDATE nào trong mã.
model DraftRevision {
  id        String   @id @default(cuid())
  draftId   String
  draft     ContentDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)
  seq       Int
  title     String
  contentMd String   @db.Text
  actorKind String              // "agent" | "human"
  actorId   String?
  note      String?
  createdAt DateTime @default(now())
  @@unique([draftId, seq])
}

model AgentRun {
  id        String   @id @default(cuid())
  agentId   String
  agent     AgentProfile @relation(fields: [agentId], references: [id], onDelete: Cascade)
  draftId   String?
  action    String              // "scan" | "write" | "review" | "seo"
  startedAt DateTime @default(now())
  endedAt   DateTime?
  /// Lease chống run treo khi Render restart giữa chừng. Xem §5.
  leaseUntil DateTime
  ok        Boolean?
  errorMsg  String?
  inputTokens  Int    @default(0)
  outputTokens Int    @default(0)
  /// Neuron tiêu thụ, KHÔNG phải tiền. Hệ này không tốn tiền - đừng đặt tên
  /// cột là "cost" cho thứ không phải chi phí (bài học từ User.credits).
  neuronsUsed  Int    @default(0)
  /// Nhà cung cấp đã phục vụ lần chạy này. Cần để đọc dashboard khi có fallback.
  usedProvider String @default("workers-ai")
  @@index([agentId, startedAt])
  @@index([leaseUntil])
}

/// Hàng đợi sự kiện + nguồn cấp dashboard + NHẬT KÝ KIỂM TOÁN. Append-only.
model NewsroomEvent {
  id        String   @id @default(cuid())
  type      String              // "idea.created" | "draft.submitted" | ...
  status    NewsroomEventStatus @default(PENDING)
  draftId   String?
  agentId   String?
  actorKind String   @default("agent")
  payload   Json
  attempts  Int      @default(0)
  claimedAt DateTime?
  createdAt DateTime @default(now())
  @@index([status, createdAt])
  @@index([draftId, createdAt])
}
```

Thêm vào `Post` (và tương tự `Doc`, `Project`):

```prisma
  deletedAt        DateTime?
  sourceDraftId    String?
  authoredByAgentId String?
```

⚠️ **Mọi truy vấn đọc công khai phải thêm `deletedAt: null`.** Grep từ khoá
`prisma.post.findMany` / `findUnique` trên cả cây - không grep trong danh sách
tệp đoán trước (bài học đợt 1 của §1.9). Quên một chỗ là bài đã xoá vẫn hiện.

---

## Luồng sự kiện

Máy trạng thái của `ContentDraft`, và event nào đẩy nó đi:

```
                    idea.created
  (Scout)  ──────────────────────────▶  IDEA
                    draft.claimed
  (Writer) ──────────────────────────▶  IN_PROGRESS
                    draft.submitted
           ──────────────────────────▶  PENDING_REVIEW
                                          │
  (Editor)          review.rejected       │  review.approved
      ┌───────────────────────────────────┤
      ▼                                   ▼
REJECTED_WITH_FEEDBACK          autonomy == FULL_AUTO ?
      │  writer nhận lại                ├── có  ─▶ publish.requested ─▶ PUBLISHED
      └──▶ IN_PROGRESS                  └── không ─▶ PENDING_HUMAN
           (revisionCount++)                          │ người bấm duyệt
                                                      └─▶ PUBLISHED
```

`ARCHIVED` là đích của xoá mềm - chỉ người đặt được, xem §6.

### Claim event: đây là chỗ dễ sai nhất

Tick có thể chồng lên tick trước (LLM chạy 30–60s, cron 5 phút, nhưng restart
hoặc gọi tay thì chồng). Claim phải nguyên tử:

```sql
UPDATE "NewsroomEvent" SET status='CLAIMED', "claimedAt"=now(), attempts=attempts+1
WHERE id IN (
  SELECT id FROM "NewsroomEvent"
  WHERE status='PENDING' ORDER BY "createdAt" LIMIT 3
  FOR UPDATE SKIP LOCKED
) RETURNING *;
```

`FOR UPDATE SKIP LOCKED` là lý do dùng `$queryRaw` chứ không phải
`prisma.newsroomEvent.updateMany` - Prisma không phát ra được mệnh đề đó, và
không có nó thì hai tick cùng nhặt một event.

### Tick trả về ngay, việc chạy nền

`POST /api/newsroom/tick` claim lô rồi trả `202` **không await** phần gọi LLM.
Giữ kết nối HTTP mở 60 giây qua Cloudflare Worker là tự tạo timeout. Tiến trình
Node sống lâu nên promise nền chạy tiếp bình thường.

Cái giá: Render restart giữa chừng ⇒ run treo ở `CLAIMED`. Vì thế `AgentRun` có
`leaseUntil`; mỗi tick mở đầu bằng một câu **reclaim**: event `CLAIMED` quá
`leaseUntil` mà run chưa `endedAt` thì trả về `PENDING`, `attempts` đã tăng sẵn.
Quá 3 lần thì `DEAD` và hiện lên dashboard - im lặng nuốt lỗi là đúng cái làm
"trang trống" thành huyền thoại trong repo này.

---

## Phòng ban và agent

**Không nhà cung cấp nào bị cắm cứng.** `services/newsroom-service/src/llm/` là
một adapter `LlmProvider` với hai bản cài: `workers-ai` (chính) và `gemini` (dự
phòng khi cạn Neuron). Agent chỉ biết `complete({ system, user, maxTokens })`.
Đổi nhà cung cấp là đổi cấu hình, không phải viết lại agent.

| Phòng      | Agent                      | Model mặc định                             | Đầu ra                        |
| ---------- | -------------------------- | ------------------------------------------ | ----------------------------- |
| Tin Tức    | **Săn Tin** (Scout)        | `@cf/meta/llama-3.1-8b-instruct-fp8-fast`  | `TopicIdea` vào hàng đợi      |
| Biên Tập   | **Biên Tập Viên** (Writer) | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Draft `PENDING_REVIEW`        |
| Kiểm Duyệt | **Tổng Biên Tập** (Editor) | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Duyệt / trả về kèm góp ý      |
| SEO        | **Chuyên viên SEO**        | `@cf/meta/llama-3.1-8b-instruct-fp8-fast`  | `metaTitle`, `metaDesc`, tags |

Chia model theo việc là có lý do ngân sách: Writer và Editor sinh văn bản dài
nên cần model 70B, còn Scout lọc tiêu đề và SEO sinh vài chục token thì 8B thừa
sức - mà 8B rẻ hơn ~6 lần đầu vào và ~6 lần đầu ra tính theo Neuron.

### Săn tin bằng RSS, không có công cụ tìm kiếm máy chủ

Workers AI **không có** công cụ `web_search` chạy phía máy chủ như Anthropic.
Scout tự lấy nguồn - đúng như mô tả ban đầu của chủ dự án. Cả bốn nhóm đều miễn
phí và **không cần khoá API**:

| Nhóm              | Nguồn                                                                     | Ghi chú                                            |
| ----------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| Công nghệ quốc tế | Hacker News (Algolia API), Lobsters RSS, GitHub Releases atom, Dev.to RSS | Chất lượng cao, ít rác                             |
| Xu hướng Việt Nam | `trends.google.com/trending/rss?geo=VN`                                   | Nhiều chủ đề ngoài công nghệ - Scout phải lọc mạnh |
| Báo công nghệ VN  | RSS VnExpress Số hoá, Tuổi Trẻ Nhịp sống số, Genk                         | Tiếng Việt sẵn, hợp giọng đọc trong nước           |
| Chủ đề tự đặt     | Người nhập tay ở `/admin/newsroom`                                        | Luôn ưu tiên cao nhất trong hàng đợi               |

Danh sách nguồn nằm ở bảng `NewsroomSource` (sửa được từ dashboard), không phải
hằng số trong mã.

⚠️ **Bản quyền là ràng buộc cứng với nhóm "Báo công nghệ VN".** Scout chỉ lấy
**tiêu đề + mô tả ngắn + URL** từ RSS; nó không tải toàn văn và không đưa toàn
văn vào prompt. Writer nhận chủ đề rồi **viết mới**, bắt buộc dẫn nguồn. Đăng
lại toàn văn báo khác là vi phạm bản quyền, và `sourceUrls` tồn tại để kiểm
chứng điều đó khi rà lại.

### Ràng buộc kỹ thuật khi gọi Workers AI

- Gọi từ Render qua **REST API**:
  `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}`
  kèm `Authorization: Bearer $CF_AI_TOKEN`. Không cần binding, nên
  `newsroom-service` vẫn chạy trên Render như mọi service khác.
- **Hạn mức reset 00:00 UTC** (07:00 giờ Việt Nam). Cạn Neuron ⇒ API trả lỗi,
  **không** âm thầm hạ chất lượng. Adapter bắt lỗi đó và chuyển sang Gemini.
- Llama không có chế độ JSON nghiêm ngặt như `output_config.format` của Claude.
  Mọi prompt trả cấu trúc phải **bọc trong khối ``` và parse có phòng vệ**;
  parse hỏng thì `AgentRun.ok = false` và event quay lại `PENDING`, không được
  ném ngoại lệ làm chết dispatcher.
- Token bối cảnh của Llama 3.3 70B nhỏ hơn Claude rất nhiều. Style guide phải
  ngắn gọn; đừng nhồi cả `documents-tsudev.md` vào system prompt.

## RBAC và xoá mềm - ba tầng, không một tầng

**Tầng 1 - không có động từ.** Bề mặt `/api/newsroom/*` **không có route DELETE
nào**. Agent không có gì để gọi. Đây là tầng mạnh nhất và rẻ nhất.

**Tầng 2 - `requireRole('ADMIN')` fail closed.** Mọi đường xoá nằm ở
`/api/admin/newsroom/*` của content-service (tiền tố `/api/admin` vốn đã thuộc
app đó - dùng đúng chỗ thay vì cãi nhau với bảng tiền tố), gọi `requireAdmin()`
đọc `User.role` từ DB. Xoá = đặt `deletedAt`, **không** phát lệnh `DELETE`.

**Tầng 3 - trigger Postgres.** Đây là phần trả lời cho "khoá cứng ở cấp
database":

```sql
CREATE OR REPLACE FUNCTION tsudev_block_hard_delete() RETURNS trigger AS $$
BEGIN
  IF current_setting('tsudev.allow_hard_delete', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Xoá cứng bị chặn ở cấp DB. Dùng xoá mềm (deletedAt).';
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER post_no_hard_delete BEFORE DELETE ON "Post"
  FOR EACH ROW EXECUTE FUNCTION tsudev_block_hard_delete();
-- lặp cho "Doc", "ContentDraft", "DraftRevision", "NewsroomEvent"
```

Xoá cứng chỉ chạy được bằng script vận hành đặt
`SET LOCAL tsudev.allow_hard_delete = 'on'` trong cùng transaction - tức là
bằng tay, bởi chủ dự án.

⚠️ **Trigger này áp cả cho `Project`?** KHÔNG. `/api/admin/projects` hiện có
route DELETE thật và đang chạy; thêm trigger cho `Project` mà không sửa route đó
trước là làm hỏng một tính năng đang dùng được. Đợt 5 xử lý riêng.

⚠️ **`prisma migrate reset` ở dev sẽ chạy `DROP`, không phải `DELETE`** - trigger
không chặn, `db:reset` vẫn hoạt động bình thường. Đã kiểm về mặt ngữ nghĩa
Postgres; vẫn phải nghiệm thu thật ở đợt 1.

---

## Dashboard `/admin/newsroom`

Một trang, ba vùng, dữ liệu từ một endpoint `GET /api/newsroom/state?since=`.

**Sàn Ảo (Realtime Virtual Floor).** Bốn khu tương ứng bốn phòng ban. Mỗi agent
là một thẻ: avatar định danh sinh từ `avatarSeed` (không upload ảnh - tránh kéo
storage-service vào), tên, chức danh, trạng thái. Thẻ **dịch chuyển giữa các khu
theo `AgentStatus` thật**; hoạt ảnh là transition CSS trên vị trí, không phải
vòng lặp giả. Chỉ số: thời gian trung bình hoàn thành một bài (từ `AgentRun`),
token/phút của 5 phút gần nhất, chi phí luỹ kế hôm nay. Agent `IDLE` đứng yên ở
bàn của mình - đó là thông tin, không phải lỗi hiển thị.

**Kanban.** Năm cột đúng theo `DraftStatus`: `Ý tưởng` → `Đang viết` →
`Chờ duyệt` → `Cần sửa` → `Đã đăng`. Cột thứ sáu `Chờ người duyệt` chỉ hiện khi
có chuyên mục đặt `HUMAN_APPROVAL`. Bấm một thẻ mở ngăn kéo: bản nháp hiện tại,
góp ý của Tổng Biên Tập, và **danh sách `DraftRevision` xem lại được từng bản**.

**Nhật ký.** Dòng thời gian từ `NewsroomEvent`, đọc được như câu tiếng Việt:
"_Lê Săn Tin_ thêm chủ đề lúc 10:02 → _Trần Biên Tập_ nộp bản nháp lúc 10:15 →
_Tổng Biên Tập_ duyệt lúc 10:20". Nút dừng khẩn: `SUSPEND_AGENT` cho một agent,
và một công tắc tổng dừng cả toà soạn.

Giao diện dùng `@tsudev/ui`. **Đừng cắm cứng mã hex** - `--on-vivid` đảo theo
chế độ sáng/tối, và `packages/ui/test/contrast.test.ts` canh mọi cặp màu ở
ngưỡng WCAG AA. Màu trạng thái agent phải lấy từ token có sẵn.

---

## Hạn mức miễn phí - thay cho mục chi phí

**Dự án không dùng bất kỳ tính năng trả phí nào.** Đã kiểm chứng trên tài liệu
Cloudflare ngày 18/08/2026:

| Dịch vụ       | Hạn mức miễn phí                                      | Đủ không                                               |
| ------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| Workers AI    | **10.000 Neuron/ngày**, reset 00:00 UTC               | Đủ ~5 bài/ngày trên Llama 3.3 70B                      |
| Cron Triggers | Có trên Free plan, 100.000 request/ngày, 10ms CPU/lần | Dư - cron chỉ `fetch` rồi chờ I/O                      |
| Render        | 750 giờ instance/tháng toàn tài khoản                 | Đã dùng gần hết cho `tsudev-backend`; toà soạn sống ké |
| Neon          | Gói free hiện tại                                     | Bảng mới đều nhỏ                                       |
| Gemini        | Gói miễn phí, làm dự phòng                            | Chỉ chạy khi cạn Neuron                                |

Quy đổi Neuron cho một bài hoàn chỉnh (Llama 3.3 70B: 26.668 Neuron/1M token
vào, 204.805 Neuron/1M token ra):

| Bước                                         | Neuron             |
| -------------------------------------------- | ------------------ |
| Săn tin (chia đều ~5 ý tưởng/lượt, model 8B) | ~150               |
| Viết (≈15k vào, 4k ra)                       | ~1.220             |
| Thẩm định (≈10k vào, 1k ra)                  | ~470               |
| SEO (model 8B)                               | ~140               |
| **Tổng/bài**                                 | **≈ 1.980 Neuron** |

Với `dailyPostCap = 2` cho `/blog` và ít hơn cho ba chuyên mục còn lại, mức tiêu
thụ ~4.000–6.000 Neuron/ngày - nằm trong hạn mức, còn biên cho vòng sửa lại.

Ba cái van bắt buộc, cài ngay từ đợt 2 chứ không để sau:

1. `NEWSROOM_DAILY_NEURON_BUDGET` (mặc định `8000`, chừa biên 20%). Vượt thì
   dispatcher chuyển sang Gemini; cạn cả hai thì dừng, ghi event, hiện đỏ trên
   dashboard.
2. `revisionCount` trần **2** trong mã. Vòng lặp Writer↔Editor không có trần là
   đường đốt hạn mức nhanh nhất và nó im lặng.
3. `dailyPostCap` theo chuyên mục.

⚠️ **`AgentRun.costMicroUsd` giữ lại nhưng đổi nghĩa thành Neuron tiêu thụ**
(`neuronsUsed`). Đừng để lại một cột tên "cost" cho một hệ không tốn tiền - đó
đúng kiểu bẫy mà `User.credits` đã gây ra một lần trong repo này.

## Thứ tự phát hành - năm đợt, không gộp

Migration thuần tính cộng ⇒ **migration trước, code sau** (ngược đợt gỡ
`credits`). Mỗi đợt là một PR.

| Đợt      | Nội dung                                                                            | Vùng agent                       | Migration |
| -------- | ----------------------------------------------------------------------------------- | -------------------------------- | --------- |
| **1** ✅ | Schema + trigger xoá cứng + `deletedAt` vào Post/Doc + seed 4 agent, 4 channel      | `data-schema`                    | ✅ có     |
| **2** ✅ | `newsroom-service` + bảng tiền tố + proxy + dispatcher + Writer/Editor chạy đồng bộ | `backend-api` → `infra-deploy`   | ❌        |
| **3** ✅ | `/admin/newsroom` - sàn ảo, Kanban, nhật ký, poll cursor                            | `frontend-web` + `design-system` | ❌        |
| **4** ✅ | Worker cron riêng + Batch API cho Writer + spike SSE                                | `infra-deploy`                   | ❌        |
| **5** ✅ | Xoá mềm cho `/api/admin/projects` + trigger cho `Project` + `/admin/newsroom/trash` | `backend-api`                    | ❌        |

Đợt 2 và 3 phải theo đúng chuỗi xuyên vùng của `AGENTS.md`: `backend-api` (route)
→ `frontend-web` (mở rộng proxy). Đảo là khâu sau đỏ.

### Ba thứ phải nằm TRONG CÙNG MỘT COMMIT ở đợt 2

Lệch một nhịp là hoặc route chết ở production, hoặc lộ ra ngoài - **cả hai đều
im lặng**:

1. `prefixes: ['/api/newsroom']` trong `services/backend-bundle/src/index.ts`
2. `apps/frontend-main/pages/api/newsroom/[...path].ts` - proxy **có phiên**,
   danh sách trắng tiền tố, khuôn theo `pages/api/account/[...path].ts` chứ
   **không** theo `pages/api/identity/[...path].ts` (cái đó công khai)
3. Test bao phủ ranh giới auth, khuôn theo
   `services/trust-service/test/authCoverage.test.ts`

### Dấu hiệu "bản mới đã lên sóng"

Phải là thứ **thay đổi** giữa hai bản - `/health` thì không (§0.7 HANDOFF):

```
POST /api/newsroom/tick  không kèm token nội bộ
  → 401 ở bản mới · 404 ở bản cũ
```

---

## Cổng kiểm bắt buộc

Trước mỗi PR: `npm run format:check` · `npm run lint` · `npm run typecheck` ·
`npm run topology:check` · test của workspace đã sửa.

Nhớ ba cái bẫy đã có tiền lệ trong repo:

- **Đổi `schema.prisma` ⇒ bắt buộc `npm run db:generate`.** Quên là job "Build
  frontends" của CI đỏ dù không ai đụng frontend.
- **Workspace `.ts` mới phải thêm vào `references` của `tsconfig.json` gốc.**
  Thiếu là workspace đó **không được kiểm kiểu và không có gì báo lỗi**.
- **Spec E2E mới phải khai vào `testMatch`** của `e2e/playwright.config.js`.
  Playwright không tự nhặt; triệu chứng duy nhất là số test không tăng.

Test mới tối thiểu:

| Test                           | Chứng minh điều gì                               |
| ------------------------------ | ------------------------------------------------ |
| `newsroomAuthCoverage.test.ts` | Mọi route nằm rõ ràng ở một bên ranh giới        |
| `noDeleteVerb.test.ts`         | Bề mặt `/api/newsroom` **không có** route DELETE |
| `hardDeleteBlocked.test.ts`    | `prisma.post.delete()` ném lỗi từ trigger        |
| `softDeleteHidden.test.ts`     | `GET /api/posts` không trả bài có `deletedAt`    |
| `dispatcherClaim.test.ts`      | Hai tick song song không nhặt trùng một event    |
| `revisionCap.test.ts`          | Vòng Writer↔Editor dừng ở 2                      |
| `budgetGate.test.ts`           | Vượt ngân sách ngày ⇒ dispatcher dừng            |
| E2E `newsroom.spec.ts`         | Người thường vào `/admin/newsroom` bị chặn       |

---

## Biến môi trường mới

Khai ở `.env.example` **và** `.env.production.example`. Không viết giá trị thật
vào tệp nào được git theo dõi.

| Biến                           | Ở đâu                | Ghi chú                                      |
| ------------------------------ | -------------------- | -------------------------------------------- |
| `CF_ACCOUNT_ID`                | Render               | ID tài khoản Cloudflare, không bí mật        |
| `CF_AI_TOKEN`                  | Render               | **Bí mật.** Token phạm vi `Workers AI: Read` |
| `GEMINI_API_KEY`               | Render               | **Bí mật.** Chỉ dùng khi cạn Neuron          |
| `NEWSROOM_TICK_TOKEN`          | Render + Worker cron | Gác `/api/newsroom/tick`                     |
| `NEWSROOM_DAILY_NEURON_BUDGET` | Render               | Mặc định `8000`                              |
| `NEWSROOM_ENABLED`             | Render               | Công tắc tổng, mặc định `false`              |

`NEWSROOM_ENABLED=false` mặc định là có chủ đích: đợt 2 lên sóng mà không viết
bài nào, để nghiệm thu đường ống trước rồi mới mở van.

⚠️ **Không biến nào trong bảng này được đưa vào `wrangler.jsonc` của
`frontend-main`.** Khoá LLM chỉ sống ở Render. Worker cron là một Worker **riêng**
và chỉ cầm `NEWSROOM_TICK_TOKEN` - nó không gọi LLM, không chạm DB.

## Rủi ro đã biết, ghi để phiên sau khỏi phát hiện lại

- **SSE qua open-next chưa được kiểm chứng.** Đợt 4 spike trước khi cam kết.
  Poll 3 giây đủ dùng cho một người xem và không có rủi ro tầng biên.
- **Render free spin-down.** Cron 5 phút vừa đánh nhịp vừa giữ ấm, nên §1.1 của
  `HANDOFF.md` được giải quyết luôn - nhưng cũng có nghĩa là **cron chết thì cả
  hai thứ cùng chết**. Giám sát ngoài (UptimeRobot) vẫn nên có.
- **Bộ đếm trong RAM giả định đúng một tiến trình.** Đúng hôm nay, **vỡ** nếu
  Render chạy nhiều bản. Chú thích đầu tệp, y như `rateLimit.ts`.
- **`Post.slug` là `@unique`.** Writer sinh slug trùng ⇒ publish 500. Phép
  chiếu draft → Post phải kiểm và hậu tố hoá slug trước khi ghi.
- **Chất lượng văn tiếng Việt của Llama yếu hơn Claude rõ rệt.** Đây là cái giá
  đã biết của quyết định 5, không phải lỗi cần sửa. Đối sách: style guide theo
  chuyên mục viết kỹ, Editor được trả về tới 2 lần, và `PENDING_HUMAN` luôn bật
  được bằng một ô chọn nếu chủ dự án thấy bài chưa đạt.
- **Cạn 10.000 Neuron là hỏng hẳn, không phải chậm lại.** Workers AI trả lỗi chứ
  không hạ chất lượng. Đó là lý do có Gemini dự phòng và van
  `NEWSROOM_DAILY_NEURON_BUDGET` chừa biên 20%.
- **Nguồn RSS bên thứ ba đổi định dạng hoặc chết là chuyện thường.** Mỗi nguồn
  phải độc lập: một nguồn lỗi thì ghi lại và đi tiếp, không làm hỏng cả lượt quét.
- **Bản quyền với nguồn báo chí Việt Nam.** Chỉ lấy tiêu đề + mô tả + URL, viết
  mới, bắt buộc dẫn nguồn. `rewriteOnly` mặc định `true`, không có đường tắt.
- **SEO của toàn site nay phụ thuộc chất lượng agent.** §1.9 đã ghi: Con dấu rút
  khỏi `sitemap.xml`, nên blog · tài liệu · dự án gánh toàn bộ. Bài kém không
  chỉ là bài kém - nó là chỉ số của cả site.

---

## Hiện trạng đã dựng (18/08/2026)

Mọi thứ dưới đây đã tồn tại trong cây làm việc và đã qua cổng kiểm. Chưa phát hành.

| Vùng        | Tệp                                                         | Ghi chú                                                     |
| ----------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| Schema      | `packages/db/prisma/schema.prisma`                          | 7 model + `deletedAt` cho Post/Doc/Project                  |
| Migration   | 4 migration mới                                             | Thuần tính cộng; 0 lệnh `DROP`                              |
| Trigger     | `..._newsroom_no_hard_delete`, `..._project_no_hard_delete` | 7 bảng được gác                                             |
| Seed        | `packages/db/prisma/seed-newsroom.js`                       | `npm run db:seed:newsroom` - 4 agent, 4 chuyên mục, 9 nguồn |
| Adapter LLM | `services/newsroom-service/src/llm/`                        | Workers AI + Gemini + `parseJsonLoose`                      |
| Nguồn tin   | `services/newsroom-service/src/sources.ts`                  | RSS/Atom/HN, không phụ thuộc thư viện ngoài                 |
| Agent       | `services/newsroom-service/src/agents.ts`                   | Scout · Writer · Editor · SEO                               |
| Dispatcher  | `services/newsroom-service/src/dispatcher.ts`               | Claim `FOR UPDATE SKIP LOCKED`, reclaim lease, 3 van        |
| API         | `services/newsroom-service/src/index.ts`                    | `AUTH_PREFIXES` + `TOKEN_PREFIXES`, **0 route DELETE**      |
| Điều phối   | `services/backend-bundle/src/index.ts`                      | Tiền tố `/api/newsroom`                                     |
| Proxy       | `apps/frontend-main/pages/api/newsroom/[...path].ts`        | Khuôn có phiên; `tick` cố ý KHÔNG mở                        |
| Dashboard   | `apps/frontend-main/pages/admin/newsroom.tsx`               | Sàn ảo · Kanban · nhật ký, poll 3s                          |
| Cron        | `infrastructure/newsroom-cron/`                             | Worker riêng, 5 phút/lần, kiêm giữ ấm Render                |

### Nghiệm thu đã chạy

| Phép kiểm                                                   | Kết quả                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `prisma.post.delete()`                                      | ném lỗi từ trigger, bản ghi còn nguyên                                           |
| `SET LOCAL tsudev.allow_hard_delete='on'` trong transaction | xoá cứng được (đường thoát của chủ dự án)                                        |
| Bài/tài liệu/dự án có `deletedAt`                           | biến khỏi cả 6 đường đọc công khai                                               |
| Một lượt tick **không có khoá LLM**                         | event quay lại `PENDING`, `event.failed` ghi rõ lý do, dispatcher **không chết** |
| `/api/newsroom/tick` qua backend-bundle                     | 401 (tới đúng service), không phải 404                                           |
| Bốn cổng kiểm + 189 test đơn vị                             | xanh                                                                             |

### Chưa nghiệm thu được ở đây

- **Chất lượng bài viết thật.** Cần `CF_ACCOUNT_ID` + `CF_AI_TOKEN` và một lượt
  chạy thật. Đây là thứ quyết định hệ này có dùng được không, và không cổng kiểm
  nào thay thế được.
- **Định dạng RSS thật của 8 nguồn.** Bộ bóc tách đã có test với XML mẫu, nhưng
  nguồn thật hay lệch chuẩn. Lượt quét đầu tiên sẽ nói.
- **Poll 3 giây qua opennextjs trên Workers.** Chạy đúng ở dev; tầng biên chưa thử.
