// Google Gemini - nhà cung cấp DỰ PHÒNG, chỉ chạy khi Workers AI cạn Neuron.
//
// Gói miễn phí đếm theo request/ngày chứ không theo Neuron, nên `neurons` luôn
// là 0 và van ngân sách Neuron không áp cho nhánh này. Đổi lại nó có hạn mức
// riêng của Google mà ta không đo được từ đây - hết thì API trả 429 và toà soạn
// dừng, có ghi event.
import { CompleteInput, CompleteResult, LlmProvider, QuotaExhaustedError } from './types'

const DEFAULT_MODEL = 'gemini-2.0-flash'

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY)
  }

  async complete(input: CompleteInput): Promise<CompleteResult> {
    // Model của Gemini khác hệ với Workers AI, nên KHÔNG dùng input.model ở đây
    // - truyền một chuỗi "@cf/meta/..." sang Gemini là 404.
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${process.env.GEMINI_API_KEY}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: 'user', parts: [{ text: input.user }] }],
        generationConfig: {
          maxOutputTokens: input.maxTokens,
          ...(input.json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    })

    const body = (await res.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
      error?: { message?: string; status?: string }
    } | null

    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`
      if (res.status === 429 || body?.error?.status === 'RESOURCE_EXHAUSTED') {
        throw new QuotaExhaustedError('gemini', msg)
      }
      throw new Error(`gemini: ${msg}`)
    }

    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''

    return {
      text,
      inputTokens: body?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: body?.usageMetadata?.candidatesTokenCount ?? 0,
      neurons: 0,
      provider: this.name,
      model,
    }
  }
}
