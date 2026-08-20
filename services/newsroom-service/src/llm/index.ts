// Router nhà cung cấp: Workers AI là chính, Gemini là dự phòng.
//
// Quy tắc chuyển: CHỈ chuyển khi cạn hạn mức (QuotaExhaustedError) hoặc khi van
// ngân sách Neuron đã đóng. Lỗi khác (sai khoá, model không tồn tại, mạng hỏng)
// phải nổi lên - âm thầm fallback khi cấu hình sai là cách chắc chắn nhất để
// một lỗi cấu hình sống sót nhiều tháng mà không ai biết.
import { prisma } from '@tsudev/db'
import {
  AllProvidersExhaustedError,
  CompleteInput,
  CompleteResult,
  LlmProvider,
  ProviderName,
  QuotaExhaustedError,
} from './types'
import { WorkersAiProvider } from './workersAi'
import { GeminiProvider } from './gemini'

export * from './types'
export { neuronsFor } from './workersAi'

const primary: LlmProvider = new WorkersAiProvider()
const fallback: LlmProvider = new GeminiProvider()

export const DAILY_NEURON_BUDGET = (): number =>
  parseInt(process.env.NEWSROOM_DAILY_NEURON_BUDGET || '8000', 10)

/// Mốc 00:00 UTC của hôm nay - ĐÚNG mốc reset hạn mức của Cloudflare, không
/// phải nửa đêm giờ Việt Nam. Lệch mốc là van mở sai 7 tiếng.
export function utcDayStart(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/// Neuron đã tiêu hôm nay theo SỔ CỦA TA (tổng ước lượng của các lượt chạy).
export async function neuronsUsedToday(): Promise<number> {
  const agg = await prisma.agentRun.aggregate({
    _sum: { neuronsUsed: true },
    where: { startedAt: { gte: utcDayStart() } },
  })
  return agg._sum.neuronsUsed ?? 0
}

/**
 * Sổ CẠN HẠN MỨC THẬT, tách khỏi van ngân sách ước lượng.
 *
 * ⚠️ Đây là bài học đắt nhất của mảng này: `neuronsUsedToday()` đếm bằng BẢNG
 * QUY ĐỔI CỦA TA, còn hạn mức thì Cloudflare đếm bằng sổ CỦA HỌ - và hai con số
 * đó không bắt buộc phải bằng nhau. Sổ của ta chỉ cộng những lượt THÀNH CÔNG
 * của chính service này; sổ của họ tính cho cả tài khoản, mọi model, mọi lượt
 * gọi. Khi Cloudflare nói "đã dùng hết 10.000 Neuron" mà sổ ta mới ghi vài trăm
 * thì van ngân sách KHÔNG BAO GIỜ đóng, và mọi nhịp còn lại trong ngày cứ đâm
 * vào cùng một bức tường.
 *
 * Nên khi chính nhà cung cấp nói đã cạn, ta ghi lại lời nói đó và tin nó cho
 * tới 00:00 UTC. Ghi bằng `NewsroomEvent` chứ không phải biến trong bộ nhớ:
 * Render restart tiến trình bất cứ lúc nào, mà biến nhớ thì mất theo tiến trình
 * - còn cái ta cần nhớ là một sự kiện của NGÀY.
 */
const EXHAUSTED_EVENT = 'provider.exhausted'

export async function exhaustedToday(provider: ProviderName): Promise<boolean> {
  const hit = await prisma.newsroomEvent.findFirst({
    where: {
      type: EXHAUSTED_EVENT,
      createdAt: { gte: utcDayStart() },
      payload: { path: ['provider'], equals: provider },
    },
    select: { id: true },
  })
  return Boolean(hit)
}

async function markExhausted(provider: ProviderName, message: string): Promise<void> {
  if (await exhaustedToday(provider)) return
  await prisma.newsroomEvent.create({
    data: {
      type: EXHAUSTED_EVENT,
      status: 'DONE',
      actorKind: 'system',
      payload: { provider, message: message.slice(0, 300), resetsAt: '00:00 UTC' },
    },
  })
}

export interface ProviderHealth {
  name: ProviderName
  configured: boolean
  exhaustedToday: boolean
}

/// Trạng thái nhà cung cấp cho dashboard - để bảng điều khiển nói "đang chờ hạn
/// mức" thay vì đổ một chuỗi lỗi thô của Cloudflare vào mặt người đọc.
export async function providerHealth(): Promise<ProviderHealth[]> {
  const list = [primary, fallback]
  return Promise.all(
    list.map(async (p) => ({
      name: p.name,
      configured: p.isConfigured(),
      exhaustedToday: await exhaustedToday(p.name),
    }))
  )
}

/// Còn đường nào gọi được mô hình trong hôm nay không. `tick()` hỏi câu này
/// TRƯỚC khi nhận việc - nhận rồi mới biết không làm được thì sự kiện đã bị
/// đánh dấu claimed một cách vô ích.
export async function anyProviderAvailableToday(): Promise<boolean> {
  const health = await providerHealth()
  const usable = health.filter((h) => h.configured && !h.exhaustedToday)
  if (!usable.length) return false
  // Nhà cung cấp DUY NHẤT còn lại là Workers AI mà van ngân sách đã đóng ⇒ coi
  // như hết đường: van đóng nghĩa là ta tự cấm mình gọi nó.
  if (usable.every((h) => h.name === primary.name)) {
    return (await neuronsUsedToday()) < DAILY_NEURON_BUDGET()
  }
  return true
}

export interface RouteOutcome extends CompleteResult {
  /// Đã phải dùng dự phòng hay không - dashboard cần biết để giải thích vì sao
  /// chất lượng bài nửa cuối ngày khác nửa đầu.
  switched: boolean
  switchReason?: string
}

export async function complete(input: CompleteInput): Promise<RouteOutcome> {
  const budget = DAILY_NEURON_BUDGET()
  const used = await neuronsUsedToday()
  const overBudget = used >= budget

  const reasons: string[] = []
  let primaryUsable = primary.isConfigured()
  if (!primaryUsable) reasons.push('workers-ai chưa cấu hình')
  else if (overBudget) {
    primaryUsable = false
    reasons.push(`đã tiêu ${used}/${budget} Neuron hôm nay`)
  } else if (await exhaustedToday(primary.name)) {
    primaryUsable = false
    reasons.push('workers-ai đã báo cạn hạn mức hôm nay')
  }

  if (primaryUsable) {
    try {
      const r = await primary.complete(input)
      return { ...r, switched: false }
    } catch (err) {
      // Chỉ chuyển khi cạn hạn mức. Lỗi khác (sai khoá, model không tồn tại,
      // mạng hỏng) phải nổi lên - âm thầm fallback khi cấu hình sai là cách
      // chắc chắn nhất để một lỗi cấu hình sống sót nhiều tháng mà không ai biết.
      if (!(err instanceof QuotaExhaustedError)) throw err
      await markExhausted(primary.name, err.message)
      reasons.push(`workers-ai cạn hạn mức: ${err.message}`)
    }
  }

  const fallbackConfigured = fallback.isConfigured()
  if (fallbackConfigured && !(await exhaustedToday(fallback.name))) {
    try {
      const r = await fallback.complete(input)
      return { ...r, switched: true, switchReason: reasons.join('; ') }
    } catch (err) {
      if (!(err instanceof QuotaExhaustedError)) throw err
      await markExhausted(fallback.name, err.message)
      reasons.push(`gemini cạn hạn mức: ${err.message}`)
    }
  } else if (!fallbackConfigured) {
    reasons.push('không có nhà cung cấp dự phòng (thiếu GEMINI_API_KEY)')
  } else {
    reasons.push('gemini đã báo cạn hạn mức hôm nay')
  }

  // Không nhà cung cấp NÀO được cấu hình là lỗi CẤU HÌNH, không phải cạn hạn
  // mức - phải ồn ào, vì hoãn lại đến ngày mai cũng không tự sửa được.
  if (!primary.isConfigured() && !fallbackConfigured) {
    throw new Error(
      'Không nhà cung cấp LLM nào được cấu hình (thiếu CF_AI_TOKEN và GEMINI_API_KEY).'
    )
  }

  throw new AllProvidersExhaustedError(
    `Cạn hạn mức LLM, hoãn tới 00:00 UTC - ${reasons.join('; ')}`
  )
}

/// Parse JSON từ đầu ra của mô hình mở. KHÔNG mô hình nào ở đây bảo đảm cú pháp
/// như structured outputs của Claude, nên đây là đường nóng chứ không phải ca
/// hiếm: mô hình hay bọc JSON trong khối ```, thêm lời dẫn, hoặc thêm dấu phẩy
/// thừa. Trả về null thay vì ném - người gọi biến nó thành AgentRun thất bại và
/// event quay lại PENDING, chứ không làm chết dispatcher.
export function parseJsonLoose<T>(raw: string): T | null {
  if (!raw) return null
  let s = raw.trim()

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) s = fence[1].trim()

  // Cắt tới cặp ngoặc ngoài cùng - bỏ lời dẫn trước và lời chào sau.
  const first = s.search(/[[{]/)
  if (first === -1) return null
  const close = s[first] === '{' ? '}' : ']'
  const last = s.lastIndexOf(close)
  if (last <= first) return null
  s = s.slice(first, last + 1)

  const attempts = [
    (x: string) => x,
    // Bỏ dấu phẩy thừa trước } hoặc ] - lỗi phổ biến của mô hình nhỏ.
    (x: string) => x.replace(/,\s*([}\]])/g, '$1'),
    // Escape ký tự điều khiển THÔ nằm trong chuỗi.
    escapeRawControlChars,
    (x: string) => escapeRawControlChars(x).replace(/,\s*([}\]])/g, '$1'),
  ]
  for (const fix of attempts) {
    try {
      return JSON.parse(fix(s)) as T
    } catch {
      // thử cách tiếp theo
    }
  }
  return null
}

/**
 * Escape xuống dòng / tab THÔ nằm bên trong chuỗi JSON.
 *
 * ⚠️ Đây là đường NÓNG, không phải ca hiếm - và nó đã làm Toà soạn đứng im trên
 * production. Llama 70B được yêu cầu trả `{"contentMd":"<cả bài Markdown>"}` thì
 * xuống dòng nguyên văn:
 *
 *     "contentMd": "
 *     # Tiêu đề
 *
 *     Đoạn văn...
 *     "
 *
 * JSON KHÔNG cho phép ký tự điều khiển thô trong chuỗi, nên `JSON.parse` ném,
 * `parseJsonLoose` trả null, Writer ném "bài rỗng hoặc quá ngắn", và sự kiện
 * quay lại PENDING. Triệu chứng: agent chạy đều, Neuron bị tiêu, mà không bài
 * nào ra đời - hàng đợi chỉ dài thêm.
 *
 * Máy trạng thái chứ không phải regex: phải biết đang ở TRONG hay NGOÀI chuỗi,
 * vì xuống dòng giữa các trường là hợp lệ và không được đụng tới. Dấu `\` bật
 * cờ thoát để `\"` không bị hiểu là kết thúc chuỗi.
 */
export function escapeRawControlChars(src: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (const ch of src) {
    if (escaped) {
      out += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      out += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      out += ch
      continue
    }
    if (inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
      out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : '\\t'
      continue
    }
    out += ch
  }
  return out
}
