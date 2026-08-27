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

// ---------------------------------------------------------------------------
// Hạn mức GitHub API.
//
// Đo prod 27/08/2026, ngay lượt quét ĐẦU TIÊN của nguồn `repo_docs`:
// `GitHub HTTP 403 (/contents/docs)` - trong khi cùng endpoint đó gọi từ máy dev
// trả 200. Khác biệt duy nhất là ĐỊA CHỈ IP: trần 60 lượt/giờ của GitHub tính
// theo IP, và Render free đi ra bằng IP DÙNG CHUNG. Ta góp 2 lượt/giờ, hàng xóm
// đốt phần còn lại.
//
// Hai thứ cần khoá lại ở đây, và chúng độc lập nhau:
//   1. CÓ khoá thì phải GỬI khoá - quên gắn header thì biến môi trường trở thành
//      trang trí, và triệu chứng y hệt lúc chưa đặt gì.
//   2. Thông báo lỗi phải PHÂN BIỆT "cạn hạn mức" với "không có quyền". Cả hai
//      đều là 403; in chung một dòng thì người đọc đi kiểm quyền truy cập trong
//      khi repo Public và quyền hoàn toàn lành.
// ---------------------------------------------------------------------------
describe('hạn mức GitHub API', () => {
  const originalFetch = global.fetch
  const originalToken = process.env.NEWSROOM_GITHUB_TOKEN

  /** Phản hồi giả CÓ headers, khác `mockGitHub` ở trên (object trần). */
  const mockRes = (status: number, headers: Record<string, string>) => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    })) as unknown as typeof fetch
  }

  afterEach(() => {
    global.fetch = originalFetch
    if (originalToken === undefined) delete process.env.NEWSROOM_GITHUB_TOKEN
    else process.env.NEWSROOM_GITHUB_TOKEN = originalToken
  })

  test('có NEWSROOM_GITHUB_TOKEN ⇒ gửi header Authorization', async () => {
    process.env.NEWSROOM_GITHUB_TOKEN = 'khoa-gia-de-kiem'
    let sent: Record<string, string> = {}
    global.fetch = jest.fn(async (_u: string, init: { headers: Record<string, string> }) => {
      sent = init.headers
      return { ok: true, json: async () => [] }
    }) as unknown as typeof fetch

    await fetchRepoDocs('tsudev-tsudev/tsudev')
    expect(sent.authorization).toBe('Bearer khoa-gia-de-kiem')
  })

  test('KHÔNG có khoá ⇒ không gửi Authorization (repo Public vẫn đọc được)', async () => {
    delete process.env.NEWSROOM_GITHUB_TOKEN
    let sent: Record<string, string> = {}
    global.fetch = jest.fn(async (_u: string, init: { headers: Record<string, string> }) => {
      sent = init.headers
      return { ok: true, json: async () => [] }
    }) as unknown as typeof fetch

    await fetchRepoDocs('tsudev-tsudev/tsudev')
    expect(sent.authorization).toBeUndefined()
    // Gửi `Bearer undefined` còn tệ hơn không gửi: GitHub trả 401 thay vì đọc
    // được, tức là thêm khoá rỗng lại làm hỏng một nguồn vốn đang chạy.
    expect(JSON.stringify(sent)).not.toContain('undefined')
  })

  test('403 kèm remaining=0 ⇒ nói CẠN HẠN MỨC và chỉ đúng biến cần đặt', async () => {
    delete process.env.NEWSROOM_GITHUB_TOKEN
    mockRes(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1787654400' })
    await expect(fetchRepoDocs('tsudev-tsudev/tsudev')).rejects.toThrow(/cạn hạn mức/)
    await expect(fetchRepoDocs('tsudev-tsudev/tsudev')).rejects.toThrow(/NEWSROOM_GITHUB_TOKEN/)
  })

  test('403 mà remaining>0 ⇒ KHÔNG đổ cho hạn mức', async () => {
    // Đây mới là 403 "không có quyền" thật. Gộp nó vào thông báo hạn mức là dẫn
    // người đọc đi sai hướng đúng bằng cách mà bản trước đã làm, chỉ ngược chiều.
    mockRes(403, { 'x-ratelimit-remaining': '57' })
    await expect(fetchRepoDocs('tsudev-tsudev/tsudev')).rejects.toThrow(/GitHub HTTP 403/)
    await expect(fetchRepoDocs('tsudev-tsudev/tsudev')).rejects.not.toThrow(/cạn hạn mức/)
  })

  test('phản hồi KHÔNG có headers vẫn báo lỗi được, không sập', async () => {
    // Đường báo lỗi mà tự nó ném thì mất luôn nguyên nhân gốc.
    global.fetch = jest.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch
    await expect(fetchRepoDocs('tsudev-tsudev/tsudev')).rejects.toThrow(/GitHub HTTP 500/)
  })
})
