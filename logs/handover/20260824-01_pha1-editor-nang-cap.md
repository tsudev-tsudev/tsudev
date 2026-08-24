# PHIẾU BÀN GIAO - Pha 1 chương trình editor nâng cấp (nền dữ liệu + module search)

- **Mã phiếu**: 20260824-01
- **Từ**: phiên 21-22 (24/08/2026) - **Đến**: phiên 23 (review + phát hành)
- **Thời điểm**: 14:55 24/08/2026 (Pha 1) · cập nhật 16:40 24/08/2026 (Pha 2-7 xong)
- **Trạng thái**: HOÀN THÀNH (Pha 1-7 code-complete, chưa phát hành - xem §6)

> **Bối cảnh**: chủ dự án đặt task lớn "hoàn thiện đầy đủ công cụ đăng/sửa bài cho
> tài khoản có thẩm quyền" + "vùng Nguồn tham khảo" + "tìm/lọc theo thẻ tag". Qua
> thảo luận, chủ dự án CHỐT bộ đầy đủ nhất (xem §5 Quyết định). Chia thành **7 pha**
> theo thứ tự phụ thuộc. **Pha 1 XONG** (phiếu này). Chủ dự án trao quyền tự quyết
> chạy tiếp Pha 2→7; phiên 21 dừng ở điểm sạch để bàn giao theo yêu cầu.

## 1. Việc đã làm xong (Pha 1)

- **Migration `packages/db/prisma/migrations/20260824043047_upgrade_post_publishing_search/`**
  (áp local + backfill; drift check "No difference"):
  - Post thêm cột: `publishedAt DateTime?`, `references Json?`, `coverImageUrl String?`,
    `metaDescription String?`, `searchTitleNorm String?`, `searchBodyNorm String?`.
  - Index: `@@index([published, publishedAt])`, `@@index([tags], type: Gin)`,
    2 GIN trigram `Post_searchTitleNorm_trgm_idx` / `Post_searchBodyNorm_trgm_idx`
    (khai trong schema bằng `raw("gin_trgm_ops")` + `map:` khớp tên migration).
  - SQL tay thêm: `CREATE EXTENSION unaccent, pg_trgm`; backfill `UPDATE Post SET
publishedAt=createdAt WHERE publishedAt IS NULL`.
- **Package mới `packages/search/` (`@tsudev/search`)** - thuần TS, 0-dep, chạy cả
  Node lẫn Workers (nạp như `@tsudev/types`: dist commonjs, KHÔNG transpilePackages):
  - `viRemoveDiacritics` / `viNormalizeText` (xử lý đ/Đ đúng SEARCH_AND_FILTER §3.2),
    `viWordCount`, `stripToPlainText` (bỏ markdown/HTML giữ alt+text link),
    `buildPostSearch({title,excerpt,contentMd}) → {searchTitleNorm, searchBodyNorm}`.
  - Đăng ký ở `tsconfig.json` gốc + `tsconfig.services.json` (references). Build dist OK.
- **Cổng xanh**: `npm run typecheck` (toàn cục) ✓ · lint (search) ✓ · prettier ✓ ·
  `topology:check` ✓ · `db:generate` ✓. Smoke-test 6/6 (đ/Đ, NFC=NFD, "tương
  tác"→"tuong tac", wordcount, strip md, buildPostSearch).
- **CHƯA commit, CHƯA phát hành.** Cây sạch, chỉ có thay đổi Pha 1.

## 2. Việc dang dở + bước tiếp theo CỤ THỂ (làm ngay, không cần hỏi)

**Thứ tự pha (phụ thuộc). Mỗi pha xong chạy cổng chung + test workspace rồi mới sang pha sau.**

- [ ] **Pha 2 - backend-api** (`services/content-service/src/index.ts`; kèm
      `services/backend-bundle` nếu thêm prefix; thêm ref `@tsudev/search` vào
      `services/content-service/tsconfig.json`):
  1. `readPostBody` nhận thêm `publishedAt` (ISO, parse Date, cho phép null=now khi
     tạo), `references` (mảng `{label,url}`; validate url là http/https, label chuỗi
     ngắn; loại phần tử rỗng), `coverImageUrl` (url), `metaDescription` (chuỗi).
  2. **MỌI đường ghi Post gọi `buildPostSearch()`** và ghi 2 cột norm - gồm
     `/api/author/posts` POST+PATCH, đường `/api/admin` (nếu có ghi Post), VÀ đường
     Toà soạn Agent AI ghi Post (tìm nơi agent tạo Post - có thể ở
     `services/newsroom-service` hoặc content). Quên một chỗ = bài đó không tìm được.
  3. **Đường đọc công khai** (`GET /api/posts`, `GET /api/posts/:slug`) thêm cổng
     lịch: `published=true AND deletedAt=null AND (publishedAt IS NULL OR publishedAt
<= now())`, xếp `orderBy publishedAt desc` (fallback createdAt). Trả thêm
     `publishedAt, references, coverImageUrl, metaDescription` cho `:slug`.
  4. **Endpoint tìm/lọc** theo SEARCH_AND_FILTER §7: `GET /api/posts` nhận
     `q, tag, sort(relevance|newest|oldest), page, page_size` (TRẦN page_size 100).
     Lọc tag = `tags has tag`. `q` chuẩn hoá bằng `viNormalizeText` rồi khớp trên
     `searchTitleNorm/searchBodyNorm` (ILIKE '%..%' qua trigram, HOẶC similarity).
     Xếp hạng §5: khớp tiêu đề > tag/tóm tắt > nội dung; tie-break mới hơn trước.
     Trả `{data, meta:{total,page,page_size,query_normalized}, facets:{tag:[...]}}`.
     **Tham số lọc nhạy cảm (status=draft) phải kiểm quyền phía server** - người
     thường KHÔNG thấy nháp qua URL (IDOR §6.3).
  5. **Preview bản nháp**: token xem trước bài chưa published cho chính tác giả
     (query `?preview=<token>` hoặc route `/api/author/posts/:slug` đã có - đủ cho
     editor; nếu cần link chia sẻ preview thì ký token ngắn hạn).
  6. **Script `search:reindex`** (content-service `package.json` + `scripts/`):
     duyệt mọi Post, tính lại `buildPostSearch`, ghi 2 cột. Backfill bài cũ (hiện 2
     cột NULL). Chạy được thủ công (SEARCH_AND_FILTER §9 "reindex toàn bộ").
- [ ] **Pha 3 - frontend-web** (`apps/frontend-main/pages/author*`, proxy
      `pages/api/content/*`): form `/author` đầy đủ - sửa mọi trường + chọn
      `publishedAt` (datetime, cho tương lai = lên lịch) + nhập nhiều dòng nguồn
      tham khảo {label,url} + ô ảnh bìa + ô metaDescription + nút "Xem trước".
      Ngày giờ đi qua `apps/frontend-main/lib/format.ts`.
- [ ] **Pha 4 - frontend công khai + search UI** (frontend-web; component chung có
      thể cần design-system): trang bài `pages/blog/[slug].tsx` render vùng **"Nguồn
      tham khảo"** (rel="noopener noreferrer", target \_blank) + ảnh bìa + OG dùng
      metaDescription. Tag chip **bấm được** → `/blog?tag=<slug>`. Ô tìm kiếm chuẩn
      SEARCH_AND_FILTER §2 (debounce 350ms, AbortController, không dấu, tô sáng ánh
      xạ ngược - thêm hàm `findMatchRanges` vào `@tsudev/search`, ARIA combobox,
      phân nhóm) + trang `/search` phản ánh trạng thái qua URL (§6.4).
- [ ] **Pha 5 - media ảnh/video** (storage-service + content + frontend): luồng
      upload ảnh/video ngắn qua storage presign (đã có hạ tầng presign), chèn vào
      `contentMd`, render an toàn, giới hạn định dạng/dung lượng. `S3_PUBLIC_ENDPOINT`
      cho URL presign (xem CLAUDE.md gotcha). Ảnh bìa dùng chung luồng này.
- [ ] **Pha 6 - agent AI chèn ảnh** (newsroom): cập nhật agent tự đăng chọn + chèn
      ảnh phù hợp nội dung (nguồn ảnh miễn phí/hợp lệ), ghi `coverImageUrl`. Phải gọi
      `buildPostSearch` khi ghi (điểm 2 Pha 2).
- [ ] **Pha 7 - qa-test**: viNormalize (đ/Đ, NFC/NFD, rỗng, chỉ dấu câu), ranking,
      scope tác giả, lịch (bài tương lai ẩn), references validate, IDOR status=draft,
      XSS phần tô sáng, media. `@tsudev/search` nên có test unit riêng.

## 3. File liên quan / đang khóa

- **Không còn khóa nào** (Pha 1 xong, đã nhả trong `logs/LOCKS.md`).
- Đã sửa (chưa commit): `packages/db/prisma/schema.prisma`, migration mới,
  `packages/search/**` (mới), `tsconfig.json`, `tsconfig.services.json`,
  `package-lock.json`, `logs/STATE.md`, `logs/LOCKS.md`.
- Phiên sau khóa trước khi sửa: `services/content-service/src/index.ts` (Pha 2).

## 4. Yêu cầu gửi agent đang giữ khóa

- Không có - không khóa chồng.

## 5. Cảnh báo / quyết định quan trọng

- **Quyết định chủ dự án (đã chốt)**: (a) thời gian bài = cột `publishedAt` RIÊNG,
  `createdAt` giữ bất biến làm audit; (b) editor có ĐỦ tính năng pro: lên lịch,
  xem trước, ảnh bìa+SEO, **media ảnh/video ngắn**, **nâng agent AI tự chèn ảnh**;
  (c) nguồn tham khảo = `{label,url}[]` có cấu trúc; (d) tìm kiếm = **đầy đủ chuẩn
  SEARCH_AND_FILTER GĐ 1-3**.
- **KHÔNG đổi `published Boolean` → enum.** Lịch suy ra: `published=false`=nháp;
  `published=true` + `publishedAt` tương lai = đã lên lịch (đọc công khai ẩn tới
  giờ); `published=true` + `publishedAt<=now` = công khai. Tránh đụng `published`
  rải khắp newsroom.
- **Migration BẤT BIẾN** - đã áp. Cần đổi hình dạng thì migration MỚI.
- **`buildPostSearch` là điểm sống-còn**: gọi ở MỌI đường ghi Post (người + agent).
  Bỏ sót = bài không tìm được, IM LẶNG (bài vẫn hiển thị bình thường).
- **`deletedAt: null` + cổng `publishedAt<=now()`** bắt buộc trên mọi đường đọc
  công khai - quên là bài xoá/bài hẹn lịch lộ ra.
- **`@tsudev/search` phải build (dist) trước khi frontend/services dùng** - nó
  không nằm trong `transpilePackages` của Next (giống `@tsudev/types`).
- Nguồn tham khảo render: `rel="noopener noreferrer"`, KHÔNG chèn thẳng URL người
  dùng vào innerHTML (XSS). Validate url http/https lúc ghi.
- Sau đợt install/branch lớn, chạy `npm run db:generate` trước khi tin typecheck
  (bẫy phiên 20).

## 6. Kết quả xử lý - PHA 2-7 ĐÃ XONG (phiên 22)

Chủ dự án trao quyền tự quyết chạy thẳng Pha 2→7. Tất cả hoàn thành, mọi cổng xanh,
**chưa commit/chưa phát hành**.

**Pha 2 - backend** (`services/content-service/src/index.ts` + tsconfig/package):

- `readPostBody` + type `PostWritable` nhận `publishedAt` (ISO→Date, null=xoá),
  `references` (`readReferences`: mảng {label,url}, url http/https-only qua
  `isHttpUrl`, nhãn rỗng suy từ host, trần 50), `coverImageUrl`, `metaDescription`.
- Create + PATCH `/api/author/posts` gọi `buildPostSearch` ghi 2 cột norm; create
  đặt `publishedAt ?? now()`. PATCH tính lại norm từ giá trị trộn current+patch.
- Đọc công khai: helper `publicPostWhere(now)` (published+deletedAt:null+
  `OR[publishedAt null, <=now]`); `GET /api/posts` lọc `?tag=` + xếp publishedAt;
  `GET /api/posts/:slug` cổng lịch (bài tương lai → 404) + shaper `publicPostDetail`
  (không lộ cột norm). `authorPostCard`/`publicPostCard` thêm trường mới.
- `GET /api/posts/search` (đăng ký TRƯỚC `:slug`): q chuẩn hoá `viNormalizeText` →
  `contains` trên cột norm (trigram tăng tốc); ranking `scorePost` (§5); sort
  relevance(JS, cap 500)/newest/oldest(DB); facet tag; `page_size` trần 100; trả
  `{data, meta, facets}`. KHÔNG nhận `status` ⇒ nháp không lộ qua URL.
- Script `search:reindex` (`src/scripts/reindex-search.ts`, cursor batch 200) - đã
  chạy backfill 3 bài seed local.

**Pha 3 - editor** (`apps/frontend-main/pages/author.tsx`, +dep `@tsudev/search`):
form đầy đủ (datetime-local cho publishedAt + badge "Đã lên lịch"; nguồn tham khảo
thêm/bớt dòng; ảnh bìa; metaDescription; đếm từ `viWordCount`; nút Xem trước dùng
`renderMarkdown`). Danh sách bài hiện trạng thái Nháp/Lên lịch/Đã công bố.

**Pha 4 - công khai + search UI**:

- `blog/[slug].tsx`: ảnh bìa, ngày=publishedAt, SEO description=metaDescription +
  og:image=cover, tag chip → `/blog?tag=`, vùng "Nguồn tham khảo" (`<ol>` rel=
  noopener target=\_blank).
- `blog/index.tsx`: `getServerSideProps` đọc `?tag=`, thanh chip lọc + banner + link
  `/search`.
- `pages/search.tsx` (mới): tương tác đủ chuẩn §2 (debounce 350ms, AbortController,
  min 2 ký tự, `<Highlight>` dùng `findMatchRanges` ánh xạ ngược - chèn qua React
  không innerHTML nên không XSS, ARIA combobox/listbox/option, keyboard ↑↓↵Esc +
  scrollIntoView, sort, facet tag, đồng bộ URL shallow, SSR ban đầu qua
  `api.searchPosts`). Proxy `pages/api/search.ts` (mới) chỉ chuyển tiếp q/tag/sort/
  page/page_size, không mang danh tính.
- `lib/types` thêm `PostRef`/`PostSearchResult` + trường mới; `lib/api` thêm
  `posts(limit,tag)` + `searchPosts(query)`. `@tsudev/search` thêm `findMatchRanges`.

**Pha 5 - media** (`lib/md.ts` + `author.tsx` + `storage-service`):
`renderMarkdown` render `![alt](url)` → `<img loading=lazy>`, đuôi mp4/webm/ogg →
`<video controls>` (src qua `safeHref` whitelist, alt đã esc; đặt TRƯỚC regex link).
Editor: nút tải ảnh/video vào nội dung (chèn `![]()`) + tải ảnh bìa, qua
`/api/storage/upload`. storage `/api/presign` + `/api/upload` trả thêm `publicUrl`
(`publicUrlOf` = S3_PUBLIC_ENDPOINT+bucket+key). md.test.ts 15/15 giữ nguyên.

**Pha 6 - agent AI** (`services/newsroom-service/src/dispatcher.ts` + `images.ts`):
publish gọi `buildPostSearch` (BẮT BUỘC - bài agent mới tìm được) + `publishedAt=now`

- `pickCoverImage` (Pexels, FAIL-OPEN, no-op nếu thiếu `PEXELS_API_KEY`) đặt
  coverImageUrl + ghi công ảnh vào references. +dep/ref `@tsudev/search`.

**Pha 7 - test** (`services/content-service/test/authoringEnhancements.test.ts`, 14):
unit @tsudev/search + write mọi trường + lịch ẩn/hiện + references 400 + search
(min-2/facet/page_size-cap/không dấu) + IDOR nháp không lọt. Rerun-safe.

**Cổng**: typecheck toàn repo ✓ · lint ✓ · format ✓ (chỉ cảnh báo
`.claude/settings.local.json` gitignored) · topology ✓ · tokens ✓. Test: content
**60** · storage **15** · newsroom **49** · bundle **15** · frontend **40**.

### Việc còn lại cho phiên 23 (chủ dự án)

- [ ] **Review + commit + phát hành.** Gợi ý commit theo pha hoặc gộp một PR.
- [ ] **Phát hành CẦN các bước ops** (giống các đợt trước):
  1. `prisma migrate deploy` migration `20260824043047` trên Neon (thêm cột + extension
     `unaccent`/`pg_trgm` + index; **Neon có hỗ trợ 2 extension này** - kiểm trước).
  2. Deploy backend Render (tự dựng khi merge) + frontend Cloudflare qua
     `scripts/deploy-frontend.js`.
  3. `npm run search:reindex` trỏ DB prod để backfill `search*Norm` cho bài cũ
     (bài mới tự có). Không chạy = bài cũ không tìm được cho tới khi được sửa lại.
  4. (Tuỳ chọn) đặt `PEXELS_API_KEY` ở Render để agent AI có ảnh bìa; không đặt thì
     agent vẫn xuất bản, chỉ không ảnh.
  5. (Tuỳ chọn, ops storage) đảm bảo `S3_PUBLIC_ENDPOINT` prod cho phép GET công khai
     object đã upload (ảnh/video nhúng đọc qua URL này). Xem gotcha CLAUDE.md về R2.
- [ ] Nghiệm thu mắt người: đăng thử 1 bài có ảnh/video + nguồn + lên lịch; tìm
      "tuong tac" ra bài gắn tag; bấm tag lọc.
