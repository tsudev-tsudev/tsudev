// Cloudflare Email Routing - bí danh thư nội bộ `*@tsudev.com`.
//
// Vì sao là bí danh chuyển tiếp chứ không phải hộp thư thật: Email Routing miễn
// phí và không giới hạn số địa chỉ, còn hộp thư thật ở mọi nhà cung cấp đều có
// trần tài khoản ở bản miễn phí. Ràng buộc 0 đồng của dự án
// (`.standards/docs/FREE_TIER_STACK.md`) chọn giúp.
//
// ⚠️ Module này gọi ra một dịch vụ NGOÀI, nên nó phải hỏng theo kiểu đọc được:
//
//  - Thiếu cấu hình ⇒ `isConfigured()` false và người gọi trả một thông điệp
//    nói RÕ thiếu biến nào. KHÔNG âm thầm bỏ qua: bí danh "tạo thành công" mà
//    không có quy tắc nào bên Cloudflare là một hộp thư đen - thư gửi tới bị
//    trả về, và không ai biết cho tới khi có người phàn nàn.
//  - Cloudflare trả lỗi ⇒ ném kèm thông điệp của chính họ. Nuốt thành `false`
//    là vứt đi manh mối duy nhất có được.

const API = 'https://api.cloudflare.com/client/v4'

export type AliasRule = {
  id: string
  address: string
  destination: string
  enabled: boolean
}

/** Tên miền thư nội bộ. Cấu hình chứ không cắm cứng - dev và prod khác nhau. */
export const mailDomain = (): string => process.env.INTERNAL_MAIL_DOMAIN || 'tsudev.com'

export const addressOf = (localPart: string): string => `${localPart}@${mailDomain()}`

/**
 * `localPart` hợp lệ: chữ thường, số, dấu chấm/gạch ngang/gạch dưới ở GIỮA.
 *
 * Chặt hơn RFC có chủ đích. RFC cho phép những thứ như `"a b"@x.com`, và một
 * địa chỉ như thế đi qua trang quản trị, qua API Cloudflare, rồi hiện lên trong
 * danh sách gửi thư - mỗi tầng thoát chuỗi một kiểu. Ở đây không cần khả năng
 * đó, nên không mở nó ra.
 */
export const LOCAL_PART_RE = /^[a-z0-9](?:[a-z0-9._-]{0,38}[a-z0-9])?$/

export function isConfigured(): boolean {
  return Boolean(process.env.CF_API_TOKEN && process.env.CF_ZONE_ID)
}

/** Lý do CỤ THỂ khiến tính năng chưa dùng được, để trả thẳng ra giao diện. */
export function configProblem(): string | null {
  const missing = ['CF_API_TOKEN', 'CF_ZONE_ID'].filter((k) => !process.env[k])
  return missing.length ? `Chưa cấu hình: ${missing.join(', ')}` : null
}

async function cf(path: string, init: RequestInit = {}): Promise<unknown> {
  const problem = configProblem()
  if (problem) throw new Error(problem)
  const res = await fetch(`${API}/zones/${process.env.CF_ZONE_ID}${path}`, {
    ...init,
    // Trần thời gian là thứ SINH RA bằng chứng, không chỉ chặn thiệt hại: một
    // lời gọi treo không để lại log nào, và trang quản trị chỉ quay mãi.
    signal: AbortSignal.timeout(15_000),
    headers: {
      authorization: `Bearer ${process.env.CF_API_TOKEN}`,
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  })
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean
    errors?: Array<{ message?: string }>
    result?: unknown
  }
  if (!res.ok || body.success === false) {
    const detail = body.errors
      ?.map((e) => e.message)
      .filter(Boolean)
      .join('; ')
    throw new Error(`Cloudflare ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  return body.result
}

type CfRule = {
  tag?: string
  enabled?: boolean
  matchers?: Array<{ type?: string; field?: string; value?: string }>
  actions?: Array<{ type?: string; value?: string[] }>
}

const toAlias = (r: CfRule): AliasRule | null => {
  const to = r.matchers?.find((m) => m.type === 'literal' && m.field === 'to')?.value
  const fwd = r.actions?.find((a) => a.type === 'forward')?.value?.[0]
  // Quy tắc "catch-all" và quy tắc worker không có cặp này. Bỏ qua thay vì đoán:
  // hiện chúng lên như bí danh sẽ mời người vận hành bấm Xoá vào một quy tắc mà
  // họ không hiểu.
  if (!r.tag || !to || !fwd) return null
  return { id: r.tag, address: to, destination: fwd, enabled: r.enabled !== false }
}

export async function listRules(): Promise<AliasRule[]> {
  const result = (await cf('/email/routing/rules?per_page=200')) as CfRule[]
  return (Array.isArray(result) ? result : [])
    .map(toAlias)
    .filter((x): x is AliasRule => x !== null)
}

export async function createRule(localPart: string, destination: string): Promise<AliasRule> {
  const result = (await cf('/email/routing/rules', {
    method: 'POST',
    body: JSON.stringify({
      enabled: true,
      name: `tsudev: ${localPart}`,
      matchers: [{ type: 'literal', field: 'to', value: addressOf(localPart) }],
      actions: [{ type: 'forward', value: [destination] }],
    }),
  })) as CfRule
  const alias = toAlias(result)
  if (!alias) throw new Error('Cloudflare trả về quy tắc không đọc được')
  return alias
}

export async function deleteRule(ruleId: string): Promise<void> {
  await cf(`/email/routing/rules/${encodeURIComponent(ruleId)}`, { method: 'DELETE' })
}
