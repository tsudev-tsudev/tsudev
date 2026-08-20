// Bốn agent của toà soạn. Mỗi hàm nhận bối cảnh, gọi LLM, trả kết quả đã parse.
//
// Không hàm nào ở đây tự ghi DB - dispatcher làm việc đó, để một chỗ duy nhất
// chịu trách nhiệm về giao dịch và nhật ký. Agent chỉ suy nghĩ.
import { complete, parseJsonLoose } from './llm'
import { RawItem } from './sources'

// Agent KHÔNG trả chi phí về cho người gọi: `complete()` tự ghi vào sổ chi phí
// theo ngữ cảnh (`withCostLedger` trong ./llm), nên dispatcher đọc được cả khi
// hàm ở đây ném lỗi sau lượt gọi mô hình - và mấy chỗ `throw` bên dưới đều nằm
// SAU lượt gọi đó. Trả chi phí theo đường return là dựng sổ thứ hai chạy song
// song, và nó thủng đúng ở nhánh hỏng.

// --------------------------------------------------------------------------
// Săn Tin
// --------------------------------------------------------------------------

export interface ScoutPick {
  title: string
  rationale: string
  score: number
  sourceUrl: string
}

export async function runScout(opts: {
  systemPrompt: string
  model: string
  items: RawItem[]
  target: string
  existingTitles: string[]
}): Promise<{ picks: ScoutPick[] }> {
  const catalogue = opts.items
    .map((it, i) => `${i + 1}. ${it.title}\n   ${it.url}\n   ${it.summary.slice(0, 200)}`)
    .join('\n')

  const avoid = opts.existingTitles.length
    ? `\n\nĐÃ CÓ trong hàng đợi, KHÔNG chọn lại chủ đề tương tự:\n${opts.existingTitles
        .map((t) => `- ${t}`)
        .join('\n')}`
    : ''

  const r = await complete({
    system: opts.systemPrompt,
    model: opts.model,
    maxTokens: 1500,
    json: true,
    user:
      `Chuyên mục đích: ${opts.target}\n\nDanh sách tin thô:\n${catalogue}${avoid}\n\n` +
      `Chọn tối đa 3 chủ đề đáng viết nhất. Lược đồ:\n` +
      `{"picks":[{"title":"tiêu đề tiếng Việt","rationale":"vì sao đáng viết, 1 câu",` +
      `"score":1-100,"sourceUrl":"URL nguồn"}]}\n` +
      `Không có gì đáng viết thì trả {"picks":[]} - đó là câu trả lời hợp lệ.`,
  })

  const parsed = parseJsonLoose<{ picks?: ScoutPick[] }>(r.text)
  const picks = (parsed?.picks ?? [])
    .filter((p) => p && typeof p.title === 'string' && p.title.trim().length > 8)
    .slice(0, 3)
  return { picks }
}

// --------------------------------------------------------------------------
// Biên Tập Viên
// --------------------------------------------------------------------------

export async function runWriter(opts: {
  systemPrompt: string
  model: string
  styleGuide: string
  title: string
  rationale: string
  sourceUrls: string[]
  /// Có mặt khi Tổng Biên Tập đã trả về - bản nháp cũ + góp ý cần sửa.
  previousDraft?: string
  feedback?: string
}): Promise<{ title: string; excerpt: string; contentMd: string }> {
  const revise = opts.feedback
    ? `\n\nĐÂY LÀ BẢN SỬA. Bản trước bị trả về với góp ý sau - sửa ĐÚNG những điểm này, ` +
      `giữ nguyên phần đã đạt:\n${opts.feedback}\n\nBản trước:\n${opts.previousDraft ?? ''}`
    : ''

  const r = await complete({
    system: `${opts.systemPrompt}\n\n## Giọng văn chuyên mục\n${opts.styleGuide}`,
    model: opts.model,
    maxTokens: 4000,
    json: true,
    user:
      `Chủ đề: ${opts.title}\nLý do đáng viết: ${opts.rationale}\n` +
      `Nguồn tham khảo (BẮT BUỘC dẫn ở cuối bài, viết mới hoàn toàn, không sao chép):\n` +
      opts.sourceUrls.map((u) => `- ${u}`).join('\n') +
      revise +
      `\n\nLược đồ trả về:\n` +
      `{"title":"tiêu đề cuối cùng","excerpt":"tóm tắt 1-2 câu",` +
      `"contentMd":"toàn bộ bài viết bằng Markdown"}`,
  })

  const p = parseJsonLoose<{ title?: string; excerpt?: string; contentMd?: string }>(r.text)
  if (!p?.contentMd || p.contentMd.trim().length < 200) {
    throw new Error('Writer trả về bài rỗng hoặc quá ngắn')
  }
  return {
    title: (p.title || opts.title).trim(),
    excerpt: (p.excerpt || '').trim(),
    contentMd: p.contentMd.trim(),
  }
}

// --------------------------------------------------------------------------
// Tổng Biên Tập
// --------------------------------------------------------------------------

export interface Verdict {
  approved: boolean
  scores: { facts: number; copyright: number; seo: number; voice: number }
  feedback: string
}

export async function runEditor(opts: {
  systemPrompt: string
  model: string
  styleGuide: string
  title: string
  contentMd: string
  sourceUrls: string[]
}): Promise<{ verdict: Verdict }> {
  const r = await complete({
    system: `${opts.systemPrompt}\n\n## Giọng văn chuyên mục\n${opts.styleGuide}`,
    model: opts.model,
    maxTokens: 1200,
    json: true,
    user:
      `Nguồn đã dẫn:\n${opts.sourceUrls.map((u) => `- ${u}`).join('\n')}\n\n` +
      `Tiêu đề: ${opts.title}\n\nBài viết:\n${opts.contentMd}\n\n` +
      `Lược đồ trả về:\n` +
      `{"scores":{"facts":1-5,"copyright":1-5,"seo":1-5,"voice":1-5},` +
      `"approved":true|false,"feedback":"góp ý cụ thể, chỉ rõ câu/đoạn nào"}`,
  })

  const p = parseJsonLoose<Verdict>(r.text)
  if (!p || !p.scores) throw new Error('Editor trả về phán quyết không đọc được')

  const s = p.scores
  // Ngưỡng duyệt được ÉP LẠI ở đây chứ không tin vào cờ `approved` của mô hình:
  // mô hình nhỏ hay chấm điểm thấp rồi vẫn tự đặt approved=true. Điểm là dữ
  // liệu, quyết định là của mã.
  const passed =
    [s.facts, s.copyright, s.seo, s.voice].every((n) => typeof n === 'number' && n >= 4) &&
    p.approved === true

  return {
    verdict: { ...p, approved: passed, feedback: p.feedback || '' },
  }
}

// --------------------------------------------------------------------------
// Chuyên viên SEO
// --------------------------------------------------------------------------

export interface SeoResult {
  slug: string
  metaTitle: string
  metaDesc: string
  tags: string[]
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function runSeo(opts: {
  systemPrompt: string
  model: string
  title: string
  contentMd: string
}): Promise<{ seo: SeoResult }> {
  const r = await complete({
    system: opts.systemPrompt,
    model: opts.model,
    maxTokens: 600,
    json: true,
    user:
      `Tiêu đề: ${opts.title}\n\nTrích bài (2000 ký tự đầu):\n${opts.contentMd.slice(
        0,
        2000
      )}\n\n` + `Lược đồ:\n{"slug":"...","metaTitle":"...","metaDesc":"...","tags":["...","..."]}`,
  })

  const p = parseJsonLoose<Partial<SeoResult>>(r.text)
  // Mọi trường đều có đường lùi tính được từ tiêu đề: SEO hỏng không được chặn
  // việc xuất bản, nó chỉ làm siêu dữ liệu kém đi.
  return {
    seo: {
      slug: slugify(p?.slug || opts.title) || `bai-${Date.now()}`,
      metaTitle: (p?.metaTitle || opts.title).slice(0, 60),
      metaDesc: (p?.metaDesc || '').slice(0, 160),
      tags: Array.isArray(p?.tags) ? p!.tags.map(slugify).filter(Boolean).slice(0, 6) : [],
    },
  }
}
