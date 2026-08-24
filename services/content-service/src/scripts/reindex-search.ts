// Lập chỉ mục lại toàn bộ Post (SEARCH_AND_FILTER §9 "reindex toàn bộ").
//
// Chạy tay khi chỉ mục lệch CSDL: bài cũ có `search*Norm` NULL (tạo trước Pha 1),
// hoặc sau khi đổi logic chuẩn hoá trong @tsudev/search. An toàn chạy lại nhiều
// lần (idempotent). `npm --workspace services/content-service run search:reindex`.
require('dotenv').config()
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../../.env') })
}
import { prisma } from '@tsudev/db'
import { buildPostSearch } from '@tsudev/search'

async function main() {
  const BATCH = 200
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
  console.log(`[reindex] XONG - ${done} bài đã lập chỉ mục lại.`)
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
