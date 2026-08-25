// Bóc tách nguồn tin và vân tay chống trùng.
const { parseFeed, parseHnAlgolia, fingerprint } = require('../src/sources')

describe('parseFeed', () => {
  test('RSS 2.0', () => {
    const xml = `<rss><channel>
      <item><title>Bài một</title><link>https://a.test/1</link>
        <description>Tóm tắt một</description></item>
      <item><title><![CDATA[Bài &amp; hai]]></title><link>https://a.test/2</link></item>
    </channel></rss>`
    const items = parseFeed(xml)
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({
      title: 'Bài một',
      url: 'https://a.test/1',
      summary: 'Tóm tắt một',
    })
    expect(items[1].title).toBe('Bài & hai')
  })

  test('Atom dùng <link href> chứ không phải <link>text</link>', () => {
    const xml = `<feed><entry><title>Atom</title>
      <link rel="alternate" href="https://b.test/x"/><summary>tóm</summary></entry></feed>`
    expect(parseFeed(xml)[0]).toEqual({
      title: 'Atom',
      url: 'https://b.test/x',
      summary: 'tóm',
    })
  })

  test('mục thiếu tiêu đề hoặc liên kết bị bỏ, không làm hỏng cả lượt', () => {
    const xml = `<rss><item><title>Không có link</title></item>
      <item><title>Đủ</title><link>https://c.test/1</link></item></rss>`
    expect(parseFeed(xml).map((i: { title: string }) => i.title)).toEqual(['Đủ'])
  })

  test('XML rỗng hoặc rác ⇒ mảng rỗng, KHÔNG ném', () => {
    expect(parseFeed('')).toEqual([])
    expect(parseFeed('<html><body>404</body></html>')).toEqual([])
  })
})

describe('parseHnAlgolia', () => {
  test('mục không có url rơi về liên kết thảo luận', () => {
    const items = parseHnAlgolia({
      hits: [
        { title: 'Ask HN: gì đó', objectID: '42' },
        { title: 'Có url', url: 'https://d.test' },
      ],
    })
    expect(items[0].url).toBe('https://news.ycombinator.com/item?id=42')
    expect(items[1].url).toBe('https://d.test')
  })

  test('phản hồi sai hình dạng ⇒ mảng rỗng', () => {
    expect(parseHnAlgolia(null)).toEqual([])
    expect(parseHnAlgolia({ error: 'x' })).toEqual([])
  })
})

describe('fingerprint', () => {
  test('bỏ qua dấu câu, hoa thường và khoảng trắng thừa', () => {
    expect(fingerprint('Rust 2.0 ra mắt!')).toBe(fingerprint('rust 2.0   ra mat'))
  })

  test('bỏ dấu tiếng Việt - hai cách viết là CÙNG một chủ đề', () => {
    expect(fingerprint('Trí tuệ nhân tạo')).toBe(fingerprint('Tri tue nhan tao'))
  })

  test('chủ đề khác nhau cho vân tay khác nhau', () => {
    expect(fingerprint('Rust ra mắt')).not.toBe(fingerprint('Go ra mắt'))
  })
})

// ---------------------------------------------------------------------------
// Nguồn đề tài của chuyên mục TÀI LIỆU - NEWSROOM-DOCS B1.
//
// Nguồn này khác mọi nguồn khác ở một điểm dễ vấp: `url` của nó là `owner/name`
// chứ không phải địa chỉ tải về. Nhánh `repo_docs` vì thế phải nằm TRƯỚC lời gọi
// `fetch(url)` chung trong `fetchSource`, nếu không nó sẽ cố tải
// "tsudev-tsudev/tsudev" như một URL và hỏng với một thông báo chẳng liên quan gì.
// ---------------------------------------------------------------------------
const { fetchRepoDocs, fetchSource } = require('../src/sources')

describe('fetchRepoDocs', () => {
  const originalFetch = global.fetch

  const mockGitHub = (contents: unknown, commits: unknown) => {
    global.fetch = jest.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).includes('/contents/docs') ? contents : commits),
    })) as unknown as typeof fetch
  }

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('lấy tệp .md trong docs/, bỏ tệp viết HOA và thư mục', async () => {
    mockGitHub(
      [
        { name: 'auth.md', type: 'file' },
        { name: 'design-system.md', type: 'file' },
        // Quy ước nội bộ, không phải chủ đề tài liệu công khai.
        { name: 'README.md', type: 'file' },
        // Thư mục và tệp không phải markdown đều không phải đề tài.
        { name: 'templates', type: 'dir' },
        { name: 'sơ-đồ.png', type: 'file' },
      ],
      []
    )
    const items = await fetchRepoDocs('tsudev-tsudev/tsudev')
    expect(items.map((i: { title: string }) => i.title)).toEqual(['auth', 'design system'])
    expect(items[0].url).toContain('/blob/main/docs/auth.md')
  })

  test('chỉ lấy commit feat, bỏ fix/chore/docs', async () => {
    mockGitHub(
      [],
      [
        { sha: 'aaa', commit: { message: 'feat(table): phân trang chuẩn\n\nthân commit' } },
        { sha: 'bbb', commit: { message: 'fix(auth): sai chính tả' } },
        { sha: 'ccc', commit: { message: 'chore: dọn dẹp' } },
        { sha: 'ddd', commit: { message: 'feat: con dấu tín nhiệm' } },
      ]
    )
    const items = await fetchRepoDocs('tsudev-tsudev/tsudev')
    // Tiền tố conventional-commit bị gỡ: tiêu đề tài liệu không phải thông điệp commit.
    expect(items.map((i: { title: string }) => i.title)).toEqual([
      'phân trang chuẩn',
      'con dấu tín nhiệm',
    ])
    expect(items[0].url).toContain('/commit/aaa')
  })

  test('fetchSource định tuyến repo_docs mà KHÔNG tải `url` như một trang', async () => {
    // Nếu nhánh này nằm sau lời gọi fetch chung, lời gọi đầu tiên sẽ là
    // fetch('tsudev-tsudev/tsudev') - đây là chỗ khẳng định điều đó không xảy ra.
    const calls: string[] = []
    global.fetch = jest.fn(async (url: string) => {
      calls.push(String(url))
      return { ok: true, json: async () => [] }
    }) as unknown as typeof fetch

    await fetchSource('repo_docs', 'tsudev-tsudev/tsudev')
    expect(calls.length).toBeGreaterThan(0)
    for (const u of calls) expect(u.startsWith('https://api.github.com/')).toBe(true)
  })

  test('GitHub trả lỗi ⇒ NÉM, để người gọi ghi vào lastError', async () => {
    // Hợp đồng của fetchSource: một nguồn hỏng không được nuốt thành mảng rỗng,
    // vì "không có đề tài nào" và "nguồn hỏng" trông giống hệt nhau ở dashboard.
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch
    await expect(fetchRepoDocs('khong/ton-tai')).rejects.toThrow(/404/)
  })
})
