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

/**
 * Mục lục tài liệu của CHÍNH repo tsudev, dùng làm đề tài cho chuyên mục Tài liệu.
 *
 * Vì sao không phải RSS: RSS là dòng tin của người khác. Tài liệu thì nói về sản
 * phẩm của mình - một chuyên mục Tài liệu nuôi bằng RSS sẽ đầy bài dịch lại tin
 * công nghệ, đúng thể loại mà `/blog` đã làm. Nguồn đúng của tài liệu là bề mặt
 * thật của sản phẩm: những gì `docs/` đang mô tả, và những gì CHANGELOG nói là
 * vừa đổi.
 *
 * Đọc qua API công khai của GitHub, không cần khoá: repo đã Public từ
 * 21/08/2026. Không có khoá thì trần là 60 lượt/giờ theo IP - lượt quét chạy
 * mỗi giờ và dùng 2 lượt, nên biên vẫn rất rộng.
 *
 * `url` của nguồn là địa chỉ repo dạng `owner/name`, KHÔNG phải một URL tải về:
 * ở đây `kind` quyết định cách lấy, còn `url` chỉ là tham số.
 */
export async function fetchRepoDocs(repo: string, limit = 20): Promise<RawItem[]> {
  const gh = async (path: string): Promise<unknown> => {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        'user-agent': 'tsudev-newsroom/1.0 (+https://tsudev.com)',
        accept: 'application/vnd.github+json',
      },
    })
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status} (${path})`)
    return res.json()
  }

  const out: RawItem[] = []
  const base = `https://github.com/${repo}/blob/main`

  // 1. Các tệp trong `docs/`. Đây là tài liệu NỘI BỘ dành cho người phát triển;
  //    đề tài rút ra từ chúng là "viết bản công khai của chủ đề này cho người
  //    dùng", không phải "đăng lại tệp này".
  const tree = (await gh('/contents/docs')) as Array<{ name?: string; type?: string }>
  if (Array.isArray(tree)) {
    for (const f of tree) {
      if (f.type !== 'file' || !f.name?.endsWith('.md')) continue
      const stem = f.name.replace(/\.md$/, '')
      // Tệp viết HOA là quy ước nội bộ (README, CHANGELOG...) - không phải chủ đề.
      if (stem === stem.toUpperCase()) continue
      out.push({
        title: stem.replace(/[-_]/g, ' '),
        url: `${base}/docs/${f.name}`,
        summary: `Tài liệu nội bộ docs/${f.name} của tsudev. Đề tài: viết bản công khai, dành cho người đọc ngoài dự án.`,
      })
      if (out.length >= limit) return out
    }
  }

  // 2. Những gì vừa đổi. Một thay đổi vừa phát hành mà tài liệu công khai chưa
  //    nói tới chính là khoảng trống rõ nhất.
  const commits = (await gh('/commits?per_page=20')) as Array<{
    sha?: string
    commit?: { message?: string }
  }>
  if (Array.isArray(commits)) {
    for (const c of commits) {
      const msg = (c.commit?.message || '').split('\n')[0]?.trim()
      // Chỉ lấy tính năng: `fix`/`chore`/`docs` phần lớn không thành tài liệu.
      if (!msg || !/^feat(\(|:)/.test(msg)) continue
      out.push({
        title: msg.replace(/^feat(\([^)]*\))?:\s*/, ''),
        url: c.sha ? `https://github.com/${repo}/commit/${c.sha}` : base,
        summary: `Tính năng vừa được phát hành ở tsudev. Đề tài: tài liệu hướng dẫn dùng tính năng này.`,
      })
      if (out.length >= limit) return out
    }
  }

  return out
}

/// Lấy một nguồn. Ném lỗi thì người gọi ghi vào NewsroomSource.lastError và đi
/// tiếp nguồn khác - đó là hợp đồng, đừng bắt lỗi ở đây.
export async function fetchSource(kind: string, url: string): Promise<RawItem[]> {
  // `repo_docs` KHÔNG tải `url` như một trang: `url` của nó là `owner/name`.
  // Đặt nhánh này TRƯỚC lời gọi fetch bên dưới, nếu không nó sẽ cố tải
  // "tsudev-tsudev/tsudev" như một địa chỉ và hỏng với lỗi chẳng liên quan gì.
  if (kind === 'repo_docs') return fetchRepoDocs(url)

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
