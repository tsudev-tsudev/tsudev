// Cloudflare Workers AI qua REST API.
//
// Gọi bằng REST chứ không bằng binding, vì service này chạy trên Render chứ
// không chạy trên Workers. Hạn mức miễn phí áp dụng như nhau cho cả hai đường:
// 10.000 Neuron/ngày, reset 00:00 UTC.
import { CompleteInput, CompleteResult, LlmProvider, QuotaExhaustedError } from './types'

/// Bảng quy đổi Neuron, đơn vị: Neuron trên 1 triệu token.
/// Nguồn: developers.cloudflare.com/workers-ai/platform/pricing (18/08/2026).
/// Model không có trong bảng dùng NEURON_FALLBACK - ước lượng thừa còn hơn
/// thiếu, vì van ngân sách dựa vào con số này.
const NEURONS: Record<string, { in: number; out: number }> = {
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { in: 26668, out: 204805 },
  '@cf/meta/llama-3.1-70b-instruct-fp8-fast': { in: 26668, out: 204805 },
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast': { in: 4119, out: 34868 },
  '@cf/meta/llama-3.2-3b-instruct': { in: 4625, out: 30475 },
  '@cf/meta/llama-3.2-1b-instruct': { in: 2457, out: 18252 },
}
const NEURON_FALLBACK = { in: 30000, out: 210000 }

export function neuronsFor(model: string, inputTokens: number, outputTokens: number): number {
  const rate = NEURONS[model] || NEURON_FALLBACK
  return Math.ceil((inputTokens * rate.in + outputTokens * rate.out) / 1_000_000)
}

/// Ước lượng token khi API không trả `usage`. Tiếng Việt có dấu tốn token hơn
/// tiếng Anh đáng kể, nên hệ số 3 ký tự/token là ước lượng THẬN TRỌNG (thiên về
/// đếm thừa) - van ngân sách nên đóng sớm hơn là đóng muộn.
const estimateTokens = (s: string): number => Math.ceil(s.length / 3)

export class WorkersAiProvider implements LlmProvider {
  readonly name = 'workers-ai' as const

  isConfigured(): boolean {
    return Boolean(process.env.CF_ACCOUNT_ID && process.env.CF_AI_TOKEN)
  }

  async complete(input: CompleteInput): Promise<CompleteResult> {
    const model = input.model || '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
    const url =
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}` +
      `/ai/run/${model}`

    const system = input.json
      ? `${input.system}\n\nTrả về DUY NHẤT một khối JSON hợp lệ, bọc trong \`\`\`json ... \`\`\`. Không viết gì ngoài khối đó.`
      : input.system

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CF_AI_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: input.user },
        ],
        max_tokens: input.maxTokens,
      }),
    })

    const body = (await res.json().catch(() => null)) as {
      success?: boolean
      result?: { response?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }
      errors?: { code?: number; message?: string }[]
    } | null

    if (!res.ok || !body?.success) {
      const msg = body?.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`
      // Cạn hạn mức là 429, và Cloudflare cũng dùng mã 10000 cho vượt giới hạn
      // tài khoản. Phân biệt được mới chuyển dự phòng đúng lúc; ném nhầm loại
      // thì hoặc không bao giờ fallback, hoặc fallback cả khi cấu hình sai.
      const quota =
        res.status === 429 || /quota|limit|exceed|neuron/i.test(msg) || res.status === 402
      if (quota) throw new QuotaExhaustedError('workers-ai', msg)
      throw new Error(`workers-ai: ${msg}`)
    }

    const text = body.result?.response ?? ''
    const inputTokens = body.result?.usage?.prompt_tokens ?? estimateTokens(system + input.user)
    const outputTokens = body.result?.usage?.completion_tokens ?? estimateTokens(text)

    return {
      text,
      inputTokens,
      outputTokens,
      neurons: neuronsFor(model, inputTokens, outputTokens),
      provider: this.name,
      model,
    }
  }
}
