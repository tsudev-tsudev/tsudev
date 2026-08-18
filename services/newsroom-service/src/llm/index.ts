// Router nhà cung cấp: Workers AI là chính, Gemini là dự phòng.
//
// Quy tắc chuyển: CHỈ chuyển khi cạn hạn mức (QuotaExhaustedError) hoặc khi van
// ngân sách Neuron đã đóng. Lỗi khác (sai khoá, model không tồn tại, mạng hỏng)
// phải nổi lên - âm thầm fallback khi cấu hình sai là cách chắc chắn nhất để
// một lỗi cấu hình sống sót nhiều tháng mà không ai biết.
import { prisma } from '@tsudev/db'
import { CompleteInput, CompleteResult, LlmProvider, QuotaExhaustedError } from './types'
import { WorkersAiProvider } from './workersAi'
import { GeminiProvider } from './gemini'

export * from './types'
export { neuronsFor } from './workersAi'

const primary: LlmProvider = new WorkersAiProvider()
const fallback: LlmProvider = new GeminiProvider()

export const DAILY_NEURON_BUDGET = (): number =>
  parseInt(process.env.NEWSROOM_DAILY_NEURON_BUDGET || '8000', 10)

/// Neuron đã tiêu hôm nay, tính theo mốc 00:00 UTC - ĐÚNG mốc reset của
/// Cloudflare, không phải nửa đêm giờ Việt Nam. Lệch mốc là van mở sai 7 tiếng.
export async function neuronsUsedToday(): Promise<number> {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const agg = await prisma.agentRun.aggregate({
    _sum: { neuronsUsed: true },
    where: { startedAt: { gte: since } },
  })
  return agg._sum.neuronsUsed ?? 0
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

  if (!overBudget && primary.isConfigured()) {
    try {
      const r = await primary.complete(input)
      return { ...r, switched: false }
    } catch (err) {
      if (!(err instanceof QuotaExhaustedError)) throw err
      if (!fallback.isConfigured()) throw err
      const r = await fallback.complete(input)
      return { ...r, switched: true, switchReason: `workers-ai cạn hạn mức: ${err.message}` }
    }
  }

  if (fallback.isConfigured()) {
    const r = await fallback.complete(input)
    return {
      ...r,
      switched: true,
      switchReason: overBudget
        ? `đã tiêu ${used}/${budget} Neuron hôm nay`
        : 'workers-ai chưa cấu hình',
    }
  }

  throw new Error(
    overBudget
      ? `Cạn ngân sách Neuron (${used}/${budget}) và không có nhà cung cấp dự phòng.`
      : 'Không nhà cung cấp LLM nào được cấu hình (thiếu CF_AI_TOKEN và GEMINI_API_KEY).'
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

  try {
    return JSON.parse(s) as T
  } catch {
    // Một lần thử nữa sau khi bỏ dấu phẩy thừa trước } hoặc ] - lỗi phổ biến
    // nhất của mô hình nhỏ, và sửa được mà không cần thư viện nào.
    try {
      return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')) as T
    } catch {
      return null
    }
  }
}
