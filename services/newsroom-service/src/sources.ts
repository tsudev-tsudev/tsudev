// Lấy và bóc tách nguồn săn tin.
//
// KHÔNG dùng thư viện parse XML: ta chỉ cần tiêu đề, liên kết và mô tả ngắn từ
// RSS/Atom, và thêm một dependency cho việc đó là chi phí không đáng. Đánh đổi
// đã biết: bộ bóc tách bằng regex này KHÔNG phải trình phân tích XML đúng
// chuẩn - nó bỏ qua namespace lạ và CDATA lồng nhau. Nguồn nào ra kết quả rỗng
// thì ghi lastError rồi đi tiếp, không được làm hỏng cả lượt quét.
//
// BẢN QUYỀN: chỉ lấy tiêu đề + mô tả ngắn + URL. Không tải toàn văn, không đưa
// toàn văn vào prompt. Writer nhận chủ đề rồi VIẾT MỚI và dẫn nguồn.
import { createHash } from 'crypto'

export interface RawItem {
  title: string
  url: string
  summary: string
}

const decodeEntities = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')

const stripTags = (s: string): string =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const pick = (block: string, tag: string): string => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return m?.[1] ? stripTags(decodeEntities(m[1])) : ''
}

/// Atom dùng <link href="..."/> chứ không phải <link>...</link>.
const pickLink = (block: string): string => {
  const href = block.match(/<link[^>]*href=["']([^"']+)["']/i)
  if (href?.[1]) return href[1]
  const inner = pick(block, 'link')
  if (inner) return inner
  return pick(block, 'guid')
}

export function parseFeed(xml: string, limit = 20): RawItem[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || []
  const out: RawItem[] = []
  for (const b of blocks.slice(0, limit)) {
    const title = pick(b, 'title')
    const url = pickLink(b)
    if (!title || !url) continue
    const summary = (pick(b, 'description') || pick(b, 'summary') || pick(b, 'content')).slice(
      0,
      400
    )
    out.push({ title, url, summary })
  }
  return out
}

/// Hacker News qua Algolia - JSON, miễn phí, không cần khoá.
export function parseHnAlgolia(json: unknown, limit = 20): RawItem[] {
  const hits = (json as { hits?: { title?: string; url?: string; objectID?: string }[] })?.hits
  if (!Array.isArray(hits)) return []
  return hits
    .filter((h) => h.title)
    .slice(0, limit)
    .map((h) => ({
      title: h.title as string,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      summary: '',
    }))
}

/// Vân tay chống trùng chủ đề giữa các lượt quét. Chuẩn hoá mạnh tay có chủ
/// đích: bỏ dấu tiếng Việt, bỏ ký tự không phải chữ/số, gộp khoảng trắng. Hai
/// tiêu đề khác nhau vài dấu câu là CÙNG một chủ đề, và ta muốn chúng đụng nhau.
export function fingerprint(title: string): string {
  const norm = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return createHash('sha256').update(norm).digest('hex')
}

/// Lấy một nguồn. Ném lỗi thì người gọi ghi vào NewsroomSource.lastError và đi
/// tiếp nguồn khác - đó là hợp đồng, đừng bắt lỗi ở đây.
export async function fetchSource(kind: string, url: string): Promise<RawItem[]> {
  // Timeout cứng: một nguồn treo không được giữ cả lượt quét. AbortSignal.timeout
  // có từ Node 18, và repo yêu cầu Node >= 20.
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { 'user-agent': 'tsudev-newsroom/1.0 (+https://tsudev.com)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  if (kind === 'hn_algolia') return parseHnAlgolia(await res.json())
  return parseFeed(await res.text())
}
