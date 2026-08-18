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
