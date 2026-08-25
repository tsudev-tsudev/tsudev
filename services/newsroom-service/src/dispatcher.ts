// Dispatcher: đọc NewsroomEvent, chạy agent, ghi kết quả.
//
// Đây là chỗ DUY NHẤT ghi vào DB của toà soạn. Agent chỉ suy nghĩ; mọi giao
// dịch, nhật ký và van an toàn nằm ở đây, để không phải đi tìm ở bốn nơi khi
// một bài đi sai đường.
import { prisma } from '@tsudev/db'
import { buildPostSearch } from '@tsudev/search'
import { runScout, runWriter, runEditor, runSeo, slugify } from './agents'
import { pickCoverImage } from './images'
import { fetchSource, fingerprint } from './sources'
import {
  AllProvidersExhaustedError,
  DAILY_NEURON_BUDGET,
  anyProviderAvailableToday,
  neuronsUsedToday,
  newCostLedger,
  utcDayStart,
  withCostLedger,
} from './llm'

/// "Hôm nay hết lượt gọi mô hình" - KHÔNG phải hỏng. Mọi đường xử lý đều phải
/// phân biệt được hai thứ này, nếu không thì một ngày cạn hạn mức sẽ giết bản
/// nháp y như một lỗi thật (xem AllProvidersExhaustedError trong llm/types.ts).
const isQuotaHalt = (err: unknown): boolean => err instanceof AllProvidersExhaustedError

export const MAX_REVISIONS = parseInt(process.env.NEWSROOM_MAX_REVISIONS || '2', 10)
const LEASE_MS = 5 * 60 * 1000
const SCAN_EVERY_MS = 30 * 60 * 1000

type Json = Record<string, unknown>

async function emit(type: string, data: Json = {}, extra: Json = {}): Promise<void> {
  await prisma.newsroomEvent.create({
    data: {
      type,
      payload: data as never,
      draftId: (extra.draftId as string) ?? null,
      agentId: (extra.agentId as string) ?? null,
      actorKind: (extra.actorKind as string) ?? 'agent',
      // Sự kiện chỉ để ghi nhật ký thì đánh dấu DONE ngay - nó không có việc
      // gì để dispatcher làm, và để PENDING là nó quay vòng vô ích mãi mãi.
      status: (extra.terminal as boolean) ? 'DONE' : 'PENDING',
    },
  })
}

/// Ghi MỘT lần mỗi ngày UTC. Nhịp toà soạn chạy mỗi giờ, nên một sự kiện phát
/// lại ở mỗi nhịp sẽ đẩy 19 dòng giống hệt nhau vào nhật ký của một ngày cạn
/// hạn mức - và đẩy trôi những dòng thật sự đáng đọc ra khỏi 80 dòng mà bảng
/// điều khiển lấy về. Nhật ký ồn ào là nhật ký không ai đọc.
async function emitOncePerDay(type: string, data: Json = {}): Promise<void> {
  const seen = await prisma.newsroomEvent.findFirst({
    where: { type, createdAt: { gte: utcDayStart() } },
    select: { id: true },
  })
  if (seen) return
  await emit(type, data, { terminal: true, actorKind: 'system' })
}

/**
 * Hồi sinh những sự kiện đã bị giết BỞI VIỆC CẠN HẠN MỨC, không phải bởi lỗi thật.
 *
 * Vì sao cần một đường dọn dẹp riêng thay vì chỉ sửa nguyên nhân: các bản nháp
 * đã chết trước bản vá này vẫn nằm đó, `attempts >= 3`, `status = DEAD`, và
 * không nhịp nào nhặt chúng lên nữa. Sửa nguồn gây bệnh không tự chữa cho người
 * đã ốm.
 *
 * Nhận diện theo DẤU VẾT ở nhật ký chứ không theo phỏng đoán: chỉ hồi sinh sự
 * kiện `event.dead`/`event.failed` mang thông điệp lỗi có mùi hạn mức. Lỗi thật
 * vẫn phải nằm yên ở DEAD để còn có người nhìn thấy mà sửa.
 */
const QUOTA_FINGERPRINT = /neuron|quota|rate.?limit|exceed|allocation|RESOURCE_EXHAUSTED|429/i

export async function reviveQuotaCasualties(): Promise<{ revived: number }> {
  const dead = await prisma.newsroomEvent.findMany({
    where: { status: 'DEAD' },
    select: { id: true, draftId: true, type: true },
    take: 200,
  })
  if (!dead.length) return { revived: 0 }

  // Thông điệp lỗi không nằm trên chính sự kiện DEAD mà nằm ở sự kiện nhật ký
  // `event.dead` sinh kèm nó - nên đối chiếu qua draftId + type.
  const notes = await prisma.newsroomEvent.findMany({
    where: { type: { in: ['event.dead', 'event.failed'] } },
    select: { draftId: true, payload: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  const quotaKilled = new Set(
    notes
      .filter((n) => QUOTA_FINGERPRINT.test(String((n.payload as Json)?.error ?? '')))
      .map((n) => `${n.draftId ?? ''}|${String((n.payload as Json)?.type ?? '')}`)
  )

  const ids = dead.filter((d) => quotaKilled.has(`${d.draftId ?? ''}|${d.type}`)).map((d) => d.id)
  if (!ids.length) return { revived: 0 }

  const { count } = await prisma.newsroomEvent.updateMany({
    where: { id: { in: ids } },
    data: { status: 'PENDING', attempts: 0, claimedAt: null },
  })
  await emit(
    'event.revived',
    { count, reason: 'chết vì cạn hạn mức LLM, không phải lỗi thật' },
    { terminal: true, actorKind: 'human' }
  )
  return { revived: count }
}

async function agentBySlug(slug: string) {
  const a = await prisma.agentProfile.findUnique({ where: { slug } })
  if (!a) throw new Error(`Không tìm thấy agent "${slug}" - đã chạy db:seed:newsroom chưa?`)
  if (a.suspendedAt || !a.enabled) throw new Error(`Agent ${slug} đang bị treo`)
  return a
}

async function setStatus(id: string, status: string, note?: string): Promise<void> {
  await prisma.agentProfile.update({
    where: { id },
    data: { status: status as never, statusNote: note ?? null },
  })
}

/// Bọc một lượt chạy agent: mở AgentRun (có lease), chạy, đóng, ghi số đo.
/// Ném lỗi thì run được đóng với ok=false rồi lỗi nổi tiếp lên - đừng nuốt.
///
/// Số đo lấy từ SỔ CHI PHÍ theo ngữ cảnh (`withCostLedger`), không phải từ giá
/// trị agent trả về: agent gọi mô hình xong rồi hỏng ở khâu parse vẫn tiêu
/// Neuron thật, và đường đó là đường hay hỏng nhất. Một nguồn đếm duy nhất cho
/// cả hai nhánh - hai nguồn song song là cách chúng lệch nhau mà không ai biết.
async function withRun<T>(
  agentId: string,
  action: string,
  draftId: string | null,
  fn: () => Promise<T>
): Promise<T> {
  const run = await prisma.agentRun.create({
    data: { agentId, action, draftId, leaseUntil: new Date(Date.now() + LEASE_MS) },
  })
  const ledger = newCostLedger()
  /// `usedProvider` không nhận null trong schema; chưa gọi được nhà cung cấp
  /// nào thì để nguyên mặc định của cột thay vì bịa ra một cái tên.
  const spent = () => ({
    inputTokens: ledger.inputTokens,
    outputTokens: ledger.outputTokens,
    neuronsUsed: ledger.neurons,
    ...(ledger.provider ? { usedProvider: ledger.provider } : {}),
  })
  try {
    const result = await withCostLedger(ledger, fn)
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { endedAt: new Date(), ok: true, ...spent() },
    })
    if (ledger.switched) {
      await emit(
        'provider.switched',
        { to: ledger.provider, reason: ledger.switchReason ?? '' },
        { agentId, terminal: true, actorKind: 'system' }
      )
    }
    return result
  } catch (err) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        endedAt: new Date(),
        ok: false,
        // Chi phí của một lượt chạy HỎNG cũng là chi phí thật. Bỏ nó ra khỏi sổ
        // là van ngân sách đếm thiếu, và nó đếm thiếu nhiều nhất đúng vào ngày
        // mô hình trả lời tệ nhất.
        ...spent(),
        errorMsg: String((err as Error).message).slice(0, 500),
      },
    })
    throw err
  }
}

// --------------------------------------------------------------------------
// Săn tin
// --------------------------------------------------------------------------

/**
 * Trần hàng đợi ý tưởng. Chạm trần thì NGỪNG QUÉT, không sinh thêm.
 *
 * ⚠️ Không có van này thì hàng đợi lớn vô hạn, và đó không phải giả thuyết - đo
 * trên production 19/08/2026: 25 `idea.created` còn PENDING và tăng đều.
 *
 * Số học: mỗi nhịp quét tối đa 3 nguồn, mỗi nguồn tới 20 tiêu đề, scout chọn ra
 * vài ý tưởng - trong khi `tick()` chỉ xử lý `batch` sự kiện. Sinh nhanh hơn
 * tiêu thì phần dư không bao giờ được tiêu.
 *
 * Vì sao chọn áp lực ngược thay vì tăng `batch` cho vừa: tăng số chỉ dời điểm
 * vỡ, vì tốc độ sinh phụ thuộc nguồn tin bên ngoài chứ không phải hằng số ở đây.
 * Áp lực ngược thì đúng ở mọi tốc độ - hết việc tồn thì quét lại, còn tồn thì
 * thôi. Nó cũng tiết kiệm Neuron: lượt quét nào cũng gọi scout.
 */
const IDEA_QUEUE_CAP = 12

async function scanSources(): Promise<void> {
  // Đếm TRƯỚC khi gọi bất cứ mô hình nào - đây là chỗ rẻ nhất để dừng.
  const pending = await prisma.newsroomEvent.count({
    where: { type: 'idea.created', status: 'PENDING' },
  })
  if (pending >= IDEA_QUEUE_CAP) {
    await emit(
      'scan.skipped',
      { pending, cap: IDEA_QUEUE_CAP, reason: 'hàng đợi ý tưởng đã đầy' },
      { terminal: true, actorKind: 'system' }
    )
    return
  }

  const due = await prisma.newsroomSource.findMany({
    where: {
      enabled: true,
      kind: { not: 'manual' },
      OR: [{ lastScanAt: null }, { lastScanAt: { lt: new Date(Date.now() - SCAN_EVERY_MS) } }],
    },
    take: 3,
  })
  if (!due.length) return

  const scout = await agentBySlug('scout-01')
  await setStatus(scout.id, 'SCANNING', `đang quét ${due.length} nguồn`)

  try {
    for (const src of due) {
      // Một nguồn hỏng KHÔNG được làm hỏng cả lượt quét. Đây là hợp đồng, và
      // nó là lý do try/catch nằm TRONG vòng lặp chứ không bọc cả vòng.
      try {
        const items = await fetchSource(src.kind, src.url as string)
        if (!items.length) throw new Error('nguồn không trả về mục nào')

        const existing = await prisma.topicIdea.findMany({
          where: { consumedAt: null },
          select: { title: true },
          take: 20,
        })
        // Với chuyên mục Tài liệu, "đã có rồi" phải tính cả thứ ĐÃ ĐĂNG, không
        // chỉ ý tưởng đang chờ. Blog thì viết thêm về một chủ đề cũ vẫn có
        // nghĩa; tài liệu thì không - `/docs` có hai bài trả lời cùng một câu
        // hỏi là tài liệu hỏng. `fingerprint` không đỡ được chỗ này: nó chỉ
        // chặn trùng GIỮA CÁC Ý TƯỞNG và không biết gì về bảng `Doc`.
        const publishedTitles =
          src.target === 'DOC'
            ? (
                await prisma.doc.findMany({
                  where: { deletedAt: null },
                  select: { title: true },
                  orderBy: { createdAt: 'desc' },
                  take: 50,
                })
              ).map((d) => d.title)
            : []

        const { picks } = await withRun(scout.id, 'scan', null, () =>
          runScout({
            systemPrompt: scout.systemPrompt,
            model: scout.model,
            items,
            target: src.target,
            existingTitles: [...existing.map((e) => e.title), ...publishedTitles],
          })
        )

        for (const pick of picks) {
          const fp = fingerprint(pick.title)
          if (await prisma.topicIdea.findUnique({ where: { fingerprint: fp } })) continue
          const idea = await prisma.topicIdea.create({
            data: {
              title: pick.title.slice(0, 200),
              rationale: (pick.rationale || '').slice(0, 500),
              target: src.target,
              sourceUrls: [pick.sourceUrl || (src.url as string)],
              sourceId: src.id,
              score: Math.min(100, Math.max(0, Number(pick.score) || 50)),
              fingerprint: fp,
            },
          })
          await emit('idea.created', { ideaId: idea.id, title: idea.title }, { agentId: scout.id })
        }

        await prisma.newsroomSource.update({
          where: { id: src.id },
          data: { lastScanAt: new Date(), lastError: null },
        })
      } catch (err) {
        // Cạn hạn mức KHÔNG phải lỗi của nguồn tin. Ghi nó vào `lastError` là
        // đổ oan cho nguồn - và đó đúng là dòng đỏ "AiError: ... 10,000
        // neurons" mà bảng điều khiển dán cạnh từng nguồn, khiến người đọc đi
        // sửa nguồn RSS trong khi nguồn hoàn toàn lành. Ném tiếp để dừng cả
        // lượt quét: nguồn kế tiếp cũng đâm vào đúng bức tường ấy.
        if (isQuotaHalt(err)) throw err
        await prisma.newsroomSource.update({
          where: { id: src.id },
          data: { lastScanAt: new Date(), lastError: String((err as Error).message).slice(0, 300) },
        })
        await emit(
          'source.failed',
          { source: src.label, error: String((err as Error).message).slice(0, 300) },
          { terminal: true, actorKind: 'system' }
        )
      }
    }
  } finally {
    await setStatus(scout.id, 'IDLE')
  }
}

// --------------------------------------------------------------------------
// Xử lý từng loại sự kiện
// --------------------------------------------------------------------------

async function channelFor(target: string) {
  const ch = await prisma.newsroomChannel.findUnique({ where: { target: target as never } })
  if (!ch) throw new Error(`Chưa cấu hình chuyên mục ${target}`)
  return ch
}

async function onIdeaCreated(payload: Json): Promise<void> {
  const idea = await prisma.topicIdea.findUnique({ where: { id: payload.ideaId as string } })
  if (!idea || idea.consumedAt) return

  const ch = await channelFor(idea.target)
  if (!ch.enabled) return

  // Trần bài/ngày theo chuyên mục - van thứ ba trong ba van chống đốt hạn mức.
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const todayCount = await prisma.contentDraft.count({
    where: { target: idea.target, status: 'PUBLISHED', updatedAt: { gte: since } },
  })
  if (todayCount >= ch.dailyPostCap) return

  const draft = await prisma.contentDraft.create({
    data: {
      target: idea.target,
      status: 'IN_PROGRESS',
      title: idea.title,
      topicId: idea.id,
    },
  })
  await prisma.topicIdea.update({ where: { id: idea.id }, data: { consumedAt: new Date() } })
  await emit('draft.claimed', { title: draft.title }, { draftId: draft.id })
}

async function onDraftClaimed(draftId: string): Promise<void> {
  const draft = await prisma.contentDraft.findUnique({ where: { id: draftId } })
  if (!draft || draft.deletedAt) return

  const idea = draft.topicId
    ? await prisma.topicIdea.findUnique({ where: { id: draft.topicId } })
    : null
  const ch = await channelFor(draft.target)
  const writer = await agentBySlug('writer-01')
  await setStatus(writer.id, 'WRITING', `đang viết: ${draft.title.slice(0, 60)}`)

  try {
    const out = await withRun(writer.id, 'write', draft.id, () =>
      runWriter({
        systemPrompt: writer.systemPrompt,
        model: writer.model,
        styleGuide: ch.styleGuide,
        title: draft.title,
        rationale: idea?.rationale ?? '',
        sourceUrls: idea?.sourceUrls ?? [],
        previousDraft: draft.contentMd || undefined,
        feedback: draft.reviewFeedback || undefined,
      })
    )

    const seq = (await prisma.draftRevision.count({ where: { draftId: draft.id } })) + 1
    await prisma.$transaction([
      prisma.draftRevision.create({
        data: {
          draftId: draft.id,
          seq,
          title: out.title,
          contentMd: out.contentMd,
          actorKind: 'agent',
          actorId: writer.id,
          note: draft.reviewFeedback ? 'bản sửa theo góp ý' : 'bản đầu',
        },
      }),
      prisma.contentDraft.update({
        where: { id: draft.id },
        data: {
          title: out.title,
          excerpt: out.excerpt,
          contentMd: out.contentMd,
          status: 'PENDING_REVIEW',
          authorAgentId: writer.id,
        },
      }),
    ])
    await emit('draft.submitted', { seq }, { draftId: draft.id, agentId: writer.id })
  } finally {
    await setStatus(writer.id, 'IDLE')
  }
}

async function onDraftSubmitted(draftId: string): Promise<void> {
  const draft = await prisma.contentDraft.findUnique({ where: { id: draftId } })
  if (!draft || draft.deletedAt || draft.status !== 'PENDING_REVIEW') return

  const idea = draft.topicId
    ? await prisma.topicIdea.findUnique({ where: { id: draft.topicId } })
    : null
  const ch = await channelFor(draft.target)
  const editor = await agentBySlug('editor-01')
  await setStatus(editor.id, 'REVIEWING', `đang thẩm định: ${draft.title.slice(0, 60)}`)

  try {
    const { verdict } = await withRun(editor.id, 'review', draft.id, () =>
      runEditor({
        systemPrompt: editor.systemPrompt,
        model: editor.model,
        styleGuide: ch.styleGuide,
        title: draft.title,
        contentMd: draft.contentMd,
        sourceUrls: idea?.sourceUrls ?? [],
      })
    )

    if (verdict.approved) {
      await prisma.contentDraft.update({
        where: { id: draft.id },
        data: { reviewFeedback: null },
      })
      await emit(
        'review.approved',
        { scores: verdict.scores },
        { draftId: draft.id, agentId: editor.id }
      )
      return
    }

    // Trả về - nhưng có trần. Vòng Writer<->Editor không trần là đường đốt hạn
    // mức nhanh nhất, và nó im lặng vì mỗi vòng riêng lẻ trông vẫn hợp lệ.
    if (draft.revisionCount >= MAX_REVISIONS) {
      await prisma.contentDraft.update({
        where: { id: draft.id },
        data: { status: 'PENDING_HUMAN', reviewFeedback: verdict.feedback },
      })
      await emit(
        'review.exhausted',
        { revisions: draft.revisionCount, feedback: verdict.feedback },
        { draftId: draft.id, agentId: editor.id, terminal: true }
      )
      return
    }

    await prisma.contentDraft.update({
      where: { id: draft.id },
      data: {
        status: 'REJECTED_WITH_FEEDBACK',
        reviewFeedback: verdict.feedback,
        revisionCount: { increment: 1 },
      },
    })
    await emit(
      'review.rejected',
      { scores: verdict.scores, feedback: verdict.feedback },
      { draftId: draft.id, agentId: editor.id }
    )
  } finally {
    await setStatus(editor.id, 'IDLE')
  }
}

async function onReviewRejected(draftId: string): Promise<void> {
  const draft = await prisma.contentDraft.findUnique({ where: { id: draftId } })
  if (!draft || draft.deletedAt || draft.status !== 'REJECTED_WITH_FEEDBACK') return
  await prisma.contentDraft.update({ where: { id: draft.id }, data: { status: 'IN_PROGRESS' } })
  await emit('draft.claimed', { revision: draft.revisionCount }, { draftId: draft.id })
}

async function onReviewApproved(draftId: string): Promise<void> {
  const draft = await prisma.contentDraft.findUnique({ where: { id: draftId } })
  if (!draft || draft.deletedAt) return

  const seoAgent = await agentBySlug('seo-01')
  await setStatus(seoAgent.id, 'PLANNING', `tối ưu SEO: ${draft.title.slice(0, 60)}`)
  try {
    const { seo } = await withRun(seoAgent.id, 'seo', draft.id, () =>
      runSeo({
        systemPrompt: seoAgent.systemPrompt,
        model: seoAgent.model,
        title: draft.title,
        contentMd: draft.contentMd,
      })
    )
    await prisma.contentDraft.update({
      where: { id: draft.id },
      data: {
        slug: seo.slug,
        metaTitle: seo.metaTitle,
        metaDesc: seo.metaDesc,
        tags: seo.tags,
      },
    })
  } finally {
    await setStatus(seoAgent.id, 'IDLE')
  }

  const ch = await channelFor(draft.target)
  if (ch.autonomy === 'FULL_AUTO') {
    await emit('publish.requested', {}, { draftId: draft.id })
  } else {
    await prisma.contentDraft.update({ where: { id: draft.id }, data: { status: 'PENDING_HUMAN' } })
    await emit('review.awaiting_human', {}, { draftId: draft.id, terminal: true })
  }
}

/// Slug phải là DUY NHẤT trên Post/Doc. SEO sinh slug từ tiêu đề nên trùng là
/// chuyện sẽ xảy ra, và khi đó ghi thẳng sẽ 500 lúc xuất bản.
async function uniqueSlug(target: string, base: string): Promise<string> {
  const table = target === 'DOC' ? 'doc' : 'post'
  const slug = base || `bai-${Date.now()}`
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`
    const clash =
      table === 'doc'
        ? await prisma.doc.findUnique({ where: { slug: candidate } })
        : await prisma.post.findUnique({ where: { slug: candidate } })
    if (!clash) return candidate
  }
  return `${slug}-${Date.now()}`
}

/**
 * XUẤT RA để test được trực tiếp.
 *
 * Đường vào thật là `tick()`, nhưng `tick()` đòi `NEWSROOM_ENABLED=true`, một
 * nhà cung cấp mô hình còn hạn mức, và chạy `scanSources()` trước - tức là muốn
 * kiểm nhánh đăng bài thì phải dựng cả toà soạn. Nhánh `target === 'DOC'` bên
 * dưới **chưa từng chạy một lần nào trên production** (không có nguồn DOC nào
 * nên không có đề tài DOC nào), nên nó cần được chứng minh là chạy được TRƯỚC
 * khi có thứ gì xây lên trên nó. Xuất ra một hàm thuần DB là cái giá rẻ nhất
 * cho chứng minh đó.
 */
export async function onPublishRequested(draftId: string): Promise<void> {
  const draft = await prisma.contentDraft.findUnique({ where: { id: draftId } })
  if (!draft || draft.deletedAt || draft.status === 'PUBLISHED') return

  const base = draft.slug || slugify(draft.title)

  if (draft.target === 'DOC') {
    const slug = await uniqueSlug('DOC', base)
    const category = 'huong-dan'
    // `/api/docs` sắp theo `[category asc, position asc]`. Để `position` ở mặc
    // định 0 nghĩa là MỌI tài liệu do agent viết đều mang cùng một khoá sắp xếp,
    // và thứ tự trong chuyên mục thành ra do Postgres quyết định - đổi giữa hai
    // lần tải trang mà không ai đụng gì. Nối vào cuối chuyên mục thay vì thế.
    const last = await prisma.doc.findFirst({
      where: { category, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const doc = await prisma.doc.create({
      data: {
        slug,
        title: draft.title,
        contentMd: draft.contentMd,
        category,
        position: (last?.position ?? 0) + 1,
        sourceDraftId: draft.id,
        authoredByAgentId: draft.authorAgentId,
      },
    })
    await prisma.contentDraft.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHED', slug, publishedRefId: doc.id },
    })
  } else if (draft.target === 'PROJECT') {
    // Agent KHÔNG được tạo dự án mới: Project mang phiên bản, giấy phép và số
    // đăng ký bản quyền - dữ liệu pháp lý về phần mềm có thật, không được suy
    // đoán. Nó chỉ được cập nhật phần MÔ TẢ của một dự án đã tồn tại.
    const project = await prisma.project.findUnique({ where: { slug: base } })
    if (!project) {
      await prisma.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: 'PENDING_HUMAN',
          reviewFeedback:
            `Không có dự án nào mang slug "${base}". Agent không được tạo dự án mới ` +
            `(phiên bản/giấy phép/bản quyền là dữ liệu pháp lý). Chủ dự án chọn dự án đích.`,
        },
      })
      await emit(
        'publish.needs_human',
        { reason: 'project_not_found' },
        { draftId: draft.id, terminal: true }
      )
      return
    }
    await prisma.project.update({
      where: { id: project.id },
      data: { descriptionMd: draft.contentMd },
    })
    await prisma.contentDraft.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHED', slug: base, publishedRefId: project.id },
    })
  } else {
    // BLOG và TRUST cùng đổ vào Post; TRUST được gắn thẻ để lọc lại được.
    const slug = await uniqueSlug('BLOG', base)
    const tags = draft.target === 'TRUST' ? [...draft.tags, 'con-dau'] : draft.tags
    // Ảnh bìa tự chọn theo chủ đề (no-op nếu chưa cấu hình nguồn ảnh). Ghi công
    // tác giả ảnh vào Nguồn tham khảo (Pexels đòi ghi công).
    const cover = await pickCoverImage([draft.title, ...draft.tags].join(' '))
    // Cột chỉ mục tìm kiếm PHẢI tính ở đây - bỏ qua là bài của Toà soạn không
    // tìm được (SEARCH_AND_FILTER §4). Cùng một hàm với đường ghi của người viết.
    const search = buildPostSearch({
      title: draft.title,
      excerpt: draft.excerpt,
      contentMd: draft.contentMd,
    })
    const post = await prisma.post.create({
      data: {
        slug,
        title: draft.title,
        excerpt: draft.excerpt,
        contentMd: draft.contentMd,
        tags,
        published: true,
        publishedAt: new Date(),
        coverImageUrl: cover?.url ?? null,
        references: cover ? [{ label: cover.credit, url: cover.sourceUrl }] : [],
        ...search,
        sourceDraftId: draft.id,
        authoredByAgentId: draft.authorAgentId,
      },
    })
    await prisma.contentDraft.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHED', slug, publishedRefId: post.id },
    })
  }

  await emit('draft.published', { slug: base }, { draftId: draft.id, terminal: true })
}

// --------------------------------------------------------------------------
// Vòng lặp
// --------------------------------------------------------------------------

const HANDLERS: Record<string, (payload: Json, draftId: string | null) => Promise<void>> = {
  'idea.created': (p) => onIdeaCreated(p),
  'draft.claimed': (_p, d) => onDraftClaimed(d as string),
  'draft.submitted': (_p, d) => onDraftSubmitted(d as string),
  'review.rejected': (_p, d) => onReviewRejected(d as string),
  'review.approved': (_p, d) => onReviewApproved(d as string),
  'publish.requested': (_p, d) => onPublishRequested(d as string),
}

/// Trả sự kiện của những lượt chạy đã chết về hàng đợi.
///
/// Cần vì tick trả 202 ngay rồi chạy nền: Render restart giữa chừng là event
/// mắc kẹt ở CLAIMED vĩnh viễn, và triệu chứng là toà soạn "im lặng" chứ không
/// phải một lỗi nào.
async function reclaimStale(): Promise<number> {
  const cutoff = new Date(Date.now() - LEASE_MS)
  const { count } = await prisma.newsroomEvent.updateMany({
    where: { status: 'CLAIMED', claimedAt: { lt: cutoff }, attempts: { lt: 3 } },
    data: { status: 'PENDING' },
  })
  await prisma.newsroomEvent.updateMany({
    where: { status: 'CLAIMED', claimedAt: { lt: cutoff }, attempts: { gte: 3 } },
    data: { status: 'DEAD' },
  })
  return count
}

/// Nhặt một lô sự kiện. `FOR UPDATE SKIP LOCKED` là lý do phải dùng $queryRaw:
/// Prisma không phát ra được mệnh đề đó, và thiếu nó thì hai tick chồng nhau sẽ
/// cùng nhặt một sự kiện rồi viết hai bài giống hệt.
async function claimBatch(limit: number) {
  return prisma.$queryRawUnsafe<
    { id: string; type: string; payload: Json; draftId: string | null }[]
  >(
    `UPDATE "NewsroomEvent" SET status = 'CLAIMED', "claimedAt" = now(), attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM "NewsroomEvent"
       WHERE status = 'PENDING'
       ORDER BY "createdAt"
       LIMIT ${limit}
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, type, payload, "draftId"`
  )
}

export interface TickResult {
  processed: number
  reclaimed: number
  skipped?: string
}

/**
 * `batch` = số sự kiện xử lý mỗi nhịp.
 *
 * 5 chứ không phải 3: đo 19/08/2026 cho 26 Neuron trung bình mỗi lượt agent và
 * 714 Neuron cả ngày, trên trần 8.000 (hạn mức Cloudflare 10.000). Biên đủ rộng
 * để tiêu hàng đợi nhanh hơn, và trần Neuron vẫn là van chặn thật sự - nó được
 * kiểm ở đầu mỗi lượt gọi mô hình, không phải ở đây.
 */
export async function tick(batch = 5): Promise<TickResult> {
  if (process.env.NEWSROOM_ENABLED !== 'true') {
    return { processed: 0, reclaimed: 0, skipped: 'NEWSROOM_ENABLED chưa bật' }
  }

  const budget = DAILY_NEURON_BUDGET()
  const used = await neuronsUsedToday()
  const reclaimed = await reclaimStale()

  // Hỏi TRƯỚC khi nhận việc. Nhận rồi mới biết không làm được thì sự kiện đã bị
  // đánh dấu CLAIMED và tăng `attempts` một cách vô ích - ba nhịp như thế là
  // sự kiện DEAD vĩnh viễn vì một lý do hoàn toàn tạm thời.
  if (!(await anyProviderAvailableToday())) {
    await emitOncePerDay('budget.exhausted', { used, budget })
    return { processed: 0, reclaimed, skipped: 'cạn hạn mức LLM - chờ 00:00 UTC' }
  }

  await scanSources().catch(async (err) => {
    if (isQuotaHalt(err)) return
    await emit(
      'scan.failed',
      { error: String((err as Error).message).slice(0, 300) },
      { terminal: true, actorKind: 'system' }
    )
  })

  const events = await claimBatch(batch)
  let processed = 0

  for (const ev of events) {
    const handler = HANDLERS[ev.type]
    if (!handler) {
      // Sự kiện chỉ để ghi nhật ký (source.failed, provider.switched, ...) rơi
      // vào đây nếu lỡ được tạo với status PENDING. Đánh dấu DONE thay vì để nó
      // quay vòng mãi.
      await prisma.newsroomEvent.update({ where: { id: ev.id }, data: { status: 'DONE' } })
      continue
    }
    try {
      await handler(ev.payload || {}, ev.draftId)
      await prisma.newsroomEvent.update({ where: { id: ev.id }, data: { status: 'DONE' } })
      processed++
    } catch (err) {
      // HOÃN, không phải THẤT BẠI: trả sự kiện về hàng đợi và HOÀN LẠI lần thử
      // mà claimBatch() đã cộng, rồi dừng cả nhịp - việc sau cũng gọi mô hình
      // nên cũng sẽ đâm vào đúng bức tường. Không có nhánh này thì một ngày cạn
      // Neuron ăn hết ba lần thử của mọi sự kiện đang chờ và bản nháp chết
      // vĩnh viễn dù chưa từng có lỗi thật nào.
      if (isQuotaHalt(err)) {
        await prisma.newsroomEvent.update({
          where: { id: ev.id },
          data: { status: 'PENDING', claimedAt: null, attempts: { decrement: 1 } },
        })
        await emitOncePerDay('budget.exhausted', { used, budget })
        break
      }
      const msg = String((err as Error).message).slice(0, 300)
      // Ba lần thất bại thì DEAD và hiện lên dashboard. Im lặng nuốt lỗi là
      // đúng cái đã làm "trang trống" thành huyền thoại trong repo này.
      const dead = (await prisma.newsroomEvent.findUnique({ where: { id: ev.id } }))!.attempts >= 3
      await prisma.newsroomEvent.update({
        where: { id: ev.id },
        data: { status: dead ? 'DEAD' : 'PENDING' },
      })
      await emit(
        dead ? 'event.dead' : 'event.failed',
        { type: ev.type, error: msg },
        { draftId: ev.draftId ?? undefined, terminal: true, actorKind: 'system' }
      )
    }
  }

  if (used >= budget) {
    await emitOncePerDay('budget.exhausted', { used, budget })
  }

  return { processed, reclaimed }
}
