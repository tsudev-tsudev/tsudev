// Lập chỉ mục lại toàn bộ Post VÀ Doc (SEARCH_AND_FILTER §9 "reindex toàn bộ").
//
// Chạy tay khi chỉ mục lệch CSDL: bài cũ có `search*Norm` NULL (tạo trước Pha 1),
// tài liệu cũ có NULL (tạo trước DOCS-SEARCH), hoặc sau khi đổi logic chuẩn hoá
// trong @tsudev/search. An toàn chạy lại nhiều lần (idempotent).
// `npm --workspace services/content-service run search:reindex`.
//
// ⚠️ Dữ liệu seed KHÔNG được lập chỉ mục lúc seed (seed.js không phụ thuộc
// @tsudev/search - nó chạy TRƯỚC `build:services` trong `dev:full`). Bài và tài
// liệu seed chỉ tìm thấy SAU khi chạy script này.
require('dotenv').config()
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../../.env') })
}
import { prisma } from '@tsudev/db'
import { buildDocSearch, buildPostSearch } from '@tsudev/search'

const BATCH = 200

async function reindexPosts(): Promise<number> {
  let cursor: string | undefined
  let done = 0
  for (;;) {
    const posts = await prisma.post.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, title: true, excerpt: true, contentMd: true },
    })
    if (posts.length === 0) break
    for (const p of posts) {
      const search = buildPostSearch({ title: p.title, excerpt: p.excerpt, contentMd: p.contentMd })
      await prisma.post.update({ where: { id: p.id }, data: search })
      done++
    }
    cursor = posts[posts.length - 1]!.id
    console.log(`[reindex] đã xử lý ${done} bài...`)
  }
  return done
}

async function reindexDocs(): Promise<number> {
  let cursor: string | undefined
  let done = 0
  for (;;) {
    // KHÔNG lọc `deletedAt: null`: tài liệu đã xoá mềm có thể được khôi phục, và
    // khôi phục xong mà chỉ mục vẫn NULL thì nó lặng lẽ biến mất khỏi tìm kiếm.
    // Đường ĐỌC mới là chỗ lọc bản đã xoá, không phải đường lập chỉ mục.
    const docs = await prisma.doc.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, title: true, contentMd: true },
    })
    if (docs.length === 0) break
    for (const d of docs) {
      await prisma.doc.update({
        where: { id: d.id },
        data: buildDocSearch({ title: d.title, contentMd: d.contentMd }),
      })
      done++
    }
    cursor = docs[docs.length - 1]!.id
    console.log(`[reindex] đã xử lý ${done} tài liệu...`)
  }
  return done
}

async function main() {
  const posts = await reindexPosts()
  const docs = await reindexDocs()
  console.log(`[reindex] XONG - ${posts} bài + ${docs} tài liệu đã lập chỉ mục lại.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (e) => {
    console.error('[reindex] lỗi:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
