'use strict'
// Seed Toà soạn Agent AI: nhân sự, chuyên mục, nguồn săn tin.
//
// Tách khỏi seed.js vì đây là DỮ LIỆU THAM CHIẾU của một hệ con, không phải dữ
// liệu mẫu cho dev. Nó cần chạy được cả trên production đúng một lần, mà seed.js
// thì tạo user và bài viết giả - không được phép chạy ở đó.
//
// Idempotent: dùng upsert theo khoá tự nhiên, chạy lại nhiều lần không nhân bản.
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../../.env') })
const { prisma } = require('../src/index')

// Model mặc định. 70B cho việc sinh văn bản dài, 8B cho việc lọc và sinh vài
// chục token - 8B rẻ hơn ~6 lần theo Neuron, và hạn mức miễn phí là 10.000/ngày.
const M70 = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const M8 = '@cf/meta/llama-3.1-8b-instruct-fp8-fast'

const AGENTS = [
  {
    slug: 'scout-01',
    displayName: 'Thợ săn tin',
    title: 'Phóng viên hiện trường',
    dept: 'RESEARCH',
    avatarSeed: 'scout-01',
    model: M8,
    systemPrompt: [
      'Bạn là phóng viên săn tin của tsudev.com - một website kỹ thuật cá nhân',
      'về lập trình, mã nguồn mở và bản quyền phần mềm.',
      '',
      'Nhiệm vụ: từ danh sách tiêu đề tin thô, chọn ra những chủ đề ĐÁNG viết',
      'cho độc giả kỹ thuật người Việt.',
      '',
      'Tiêu chí chọn:',
      '- Có giá trị kỹ thuật thật, không phải tin đồn hay thông cáo báo chí.',
      '- Còn mới (ưu tiên trong vòng 7 ngày).',
      '- Viết được thành bài có ích mà không cần truy cập nguồn trả phí.',
      '',
      'Loại bỏ: tin giật gân, tin tài chính/crypto thuần tuý, quảng cáo trá hình,',
      'và mọi chủ đề trùng lặp với chủ đề đã có trong hàng đợi.',
      '',
      'Chỉ trả về JSON đúng lược đồ được yêu cầu, không thêm lời dẫn.',
    ].join('\n'),
  },
  {
    slug: 'writer-01',
    displayName: 'Biên tập viên',
    title: 'Biên tập viên nội dung',
    dept: 'EDITORIAL',
    avatarSeed: 'writer-01',
    model: M70,
    systemPrompt: [
      'Bạn là biên tập viên của tsudev.com. Bạn viết tiếng Việt cho độc giả kỹ',
      'thuật: lập trình viên, người làm sản phẩm, sinh viên CNTT.',
      '',
      'Nguyên tắc bất di bất dịch:',
      '1. VIẾT MỚI HOÀN TOÀN. Không bao giờ sao chép câu văn từ nguồn. Nguồn chỉ',
      '   là chất liệu; bài viết là của bạn.',
      '2. DẪN NGUỒN. Mọi số liệu, trích dẫn, tuyên bố kỹ thuật phải kèm liên kết',
      '   tới nguồn gốc ở cuối bài.',
      '3. KHÔNG BỊA. Không có thông tin thì nói là chưa rõ. Không sáng tác số',
      '   liệu đo lường, phiên bản, hay tên người.',
      '4. Viết văn xuôi mạch lạc, không phải danh sách gạch đầu dòng dài. Dùng',
      '   tiêu đề phụ để chia mạch. Câu ngắn hơn câu bạn định viết.',
      '5. Không dùng giọng quảng cáo, không cảm thán, không "trong bài viết này',
      '   chúng ta sẽ".',
      '',
      'Trả về Markdown. Không nhúng HTML. Không dùng tiêu đề cấp 1 (#) vì tiêu đề',
      'bài đã nằm ở trường riêng.',
    ].join('\n'),
  },
  {
    slug: 'editor-01',
    displayName: 'Tổng biên tập',
    title: 'Tổng biên tập',
    dept: 'PUBLISHING',
    avatarSeed: 'editor-01',
    model: M70,
    systemPrompt: [
      'Bạn là tổng biên tập của tsudev.com. Bạn thẩm định bản nháp trước khi',
      'đăng. Bạn là hàng phòng thủ cuối cùng - không ai đọc sau bạn.',
      '',
      'Thẩm định theo bốn trục, mỗi trục cho điểm 1-5:',
      '- Sự thật: có tuyên bố nào không dẫn nguồn, hoặc mâu thuẫn với nguồn?',
      '  Có dấu hiệu bịa số liệu, phiên bản, tên người, tên dự án không?',
      '- Bản quyền: có đoạn nào giống nguyên văn nguồn không?',
      '- SEO: tiêu đề, mô tả, cấu trúc tiêu đề phụ có hợp lý không?',
      '- Giọng văn: có đúng giọng kỹ thuật điềm đạm, không quảng cáo không?',
      '',
      'Duyệt khi CẢ BỐN trục đạt từ 4 điểm. Dưới ngưỡng thì trả về kèm góp ý',
      'CỤ THỂ, chỉ rõ câu nào đoạn nào - góp ý chung chung là vô dụng vì người',
      'nhận nó là một agent khác, không phải người.',
      '',
      'Thà trả về nhầm còn hơn duyệt nhầm: bài sai đăng lên là uy tín của site.',
      '',
      'Chỉ trả về JSON đúng lược đồ được yêu cầu, không thêm lời dẫn.',
    ].join('\n'),
  },
  {
    slug: 'seo-01',
    displayName: 'Chuyên viên Marketing',
    title: 'Chuyên viên SEO',
    dept: 'SEO',
    avatarSeed: 'seo-01',
    model: M8,
    systemPrompt: [
      'Bạn tối ưu siêu dữ liệu cho bài viết của tsudev.com.',
      '',
      'Yêu cầu:',
      '- metaTitle: tối đa 60 ký tự, có từ khoá chính, không nhồi nhét.',
      '- metaDesc: 140-160 ký tự, mô tả đúng nội dung, có lời mời đọc tự nhiên.',
      '- tags: 3-6 thẻ, chữ thường, không dấu, nối bằng gạch ngang.',
      '- slug: chữ thường không dấu, nối bằng gạch ngang, tối đa 60 ký tự.',
      '',
      'Không phóng đại, không hứa hẹn thứ bài viết không có.',
      '',
      'Chỉ trả về JSON đúng lược đồ được yêu cầu, không thêm lời dẫn.',
    ].join('\n'),
  },
]

const CHANNELS = [
  {
    target: 'BLOG',
    dailyPostCap: 2,
    styleGuide: [
      'Bài blog kỹ thuật, 800-1500 từ. Mở bài đi thẳng vào vấn đề trong 2-3 câu,',
      'không dẫn dắt vòng vo. Có ít nhất một ví dụ mã hoặc một con số cụ thể.',
      'Kết bài nói rõ điều độc giả nên làm tiếp hoặc nên nhớ.',
    ].join(' '),
  },
  {
    target: 'DOC',
    dailyPostCap: 1,
    styleGuide: [
      'Tài liệu hướng dẫn. Mỗi bài trả lời ĐÚNG MỘT câu hỏi vận hành và đặt tên',
      'theo câu hỏi đó. Viết hiện trạng đã kiểm chứng, không viết ý tưởng hay lộ',
      'trình. Có bước chạy được, không có bước "tuỳ tình huống".',
    ].join(' '),
  },
  {
    target: 'PROJECT',
    dailyPostCap: 1,
    styleGuide: [
      'Mô tả dự án phần mềm. Nói dự án GIẢI QUYẾT VẤN ĐỀ GÌ trước khi nói nó',
      'dùng công nghệ nào. Nêu rõ trạng thái phát hành và giấy phép. Tuyệt đối',
      'không mô tả tính năng chưa tồn tại.',
    ].join(' '),
  },
  {
    target: 'TRUST',
    dailyPostCap: 1,
    styleGuide: [
      'Nội dung về Con dấu tín nhiệm. Giọng trang trọng, chính xác về mặt pháp',
      'lý và kỹ thuật mật mã. Không hứa hẹn mức bảo đảm mà chương trình dấu',
      'không thực sự cung cấp. Mọi thuật ngữ mật mã phải dùng đúng nghĩa.',
    ].join(' '),
  },
]

// Nguồn săn tin. Tất cả đều miễn phí và không cần khoá API.
// `rewriteOnly: true` với mọi nguồn báo chí - chỉ lấy tiêu đề/mô tả/URL rồi
// viết mới. Đăng lại toàn văn là vi phạm bản quyền.
const SOURCES = [
  // --- Tài liệu: nguồn là CHÍNH sản phẩm, không phải tin tức bên ngoài ---
  //
  // Trước 26/08/2026 không có dòng nào ở đây mang `target: 'DOC'`, và đó là toàn
  // bộ lý do `/docs` không có bài nào do agent viết: chuỗi là
  // NewsroomSource.target → TopicIdea.target → ContentDraft.target, nên không có
  // nguồn thì không có đề tài, không có đề tài thì nhánh đăng DOC không chạy lần
  // nào - dù nhánh đó vẫn nằm trong mã và trông hoàn chỉnh.
  //
  // `url` ở đây là `owner/name`, KHÔNG phải địa chỉ tải về: với kind `repo_docs`
  // thì `kind` quyết định cách lấy còn `url` chỉ là tham số.
  {
    label: 'Kho mã tsudev (tài liệu và thay đổi)',
    kind: 'repo_docs',
    url: 'tsudev-tsudev/tsudev',
    target: 'DOC',
  },

  // --- Công nghệ quốc tế ---
  {
    label: 'Hacker News (front page)',
    kind: 'hn_algolia',
    url: 'https://hn.algolia.com/api/v1/search?tags=front_page',
    target: 'BLOG',
  },
  { label: 'Lobsters', kind: 'rss', url: 'https://lobste.rs/rss', target: 'BLOG' },
  {
    label: 'Dev.to - top tuần',
    kind: 'rss',
    url: 'https://dev.to/feed/tag/programming',
    target: 'BLOG',
  },
  // ⚠️ Nguồn này TỪNG mang `target: 'PROJECT'` và đó là một gán SAI KÊNH, không
  // phải một nguồn tồi. Kênh PROJECT không được tạo dự án mới (Project mang
  // phiên bản, giấy phép, số đăng ký bản quyền - dữ liệu pháp lý); nó chỉ được
  // cập nhật MÔ TẢ của một dự án đã tồn tại, và tìm dự án đó bằng SLUG suy ra từ
  // tiêu đề bản nháp. Slug sinh từ tiêu đề một bài báo GitHub thì không đời nào
  // trùng slug dự án của tsudev, nên mọi lượt đều rơi vào `publish.needs_human`.
  //
  // Đo prod 27/08/2026: `publish.needs_human {"reason":"project_not_found"}`
  // **28 lần / 7 ngày**, `ContentDraft` kênh PROJECT có 6 PENDING_HUMAN và
  // **0 PUBLISHED**. Mỗi lượt tốn Neuron để viết một bản nháp chắc chắn bị vứt.
  //
  // Nội dung của nó vốn là tin kỹ thuật, đúng chất BLOG - cùng loại với Dev.to,
  // Lobsters, Hacker News. Chuyển về BLOG là giữ lại giá trị và bỏ phần lãng phí.
  {
    label: 'GitHub Blog - Engineering',
    kind: 'atom',
    url: 'https://github.blog/engineering/feed/',
    target: 'BLOG',
  },
  // ⚠️ Kênh PROJECT CỐ Ý không có nguồn nào. Muốn bật lại thì phải có nguồn phát
  // ra ĐÚNG SLUG DỰ ÁN CÓ THẬT (`topology-check`, `tsudev-platform`,
  // `tsudev-trust-seal`, `tsudev-ui`, ...) chứ không phải tiêu đề tin tức - ví dụ
  // một `kind` mới đọc chính bảng `Project`. Gán đại một nguồn tin vào đây là tái
  // tạo đúng lỗi vừa gỡ.
  // --- Xu hướng Việt Nam ---
  {
    label: 'Google Trends Việt Nam',
    kind: 'rss',
    url: 'https://trends.google.com/trending/rss?geo=VN',
    target: 'BLOG',
  },
  // --- Báo công nghệ Việt Nam ---
  {
    label: 'VnExpress - Số hoá',
    kind: 'rss',
    url: 'https://vnexpress.net/rss/so-hoa.rss',
    target: 'BLOG',
  },
  {
    label: 'Tuổi Trẻ - Nhịp sống số',
    kind: 'rss',
    url: 'https://tuoitre.vn/rss/nhip-song-so.rss',
    target: 'BLOG',
  },
  { label: 'Genk', kind: 'rss', url: 'https://genk.vn/rss/home.rss', target: 'BLOG' },
  // --- Chủ đề tự đặt ---
  {
    label: 'Chủ đề do chủ dự án nhập',
    kind: 'manual',
    url: null,
    target: 'BLOG',
    rewriteOnly: false,
  },
]

async function main() {
  for (const a of AGENTS) {
    await prisma.agentProfile.upsert({
      where: { slug: a.slug },
      // Cập nhật prompt và model khi chạy lại, nhưng KHÔNG đụng tới status /
      // suspendedAt / enabled - đó là trạng thái vận hành do người điều khiển.
      update: {
        displayName: a.displayName,
        title: a.title,
        dept: a.dept,
        model: a.model,
        systemPrompt: a.systemPrompt,
      },
      create: { ...a, provider: 'workers-ai' },
    })
  }

  for (const c of CHANNELS) {
    await prisma.newsroomChannel.upsert({
      where: { target: c.target },
      // KHÔNG ghi đè `autonomy` và `enabled`: chủ dự án đổi trên dashboard, seed
      // chạy lại không được kéo ngược về mặc định.
      update: { styleGuide: c.styleGuide, dailyPostCap: c.dailyPostCap },
      create: c,
    })
  }

  for (const s of SOURCES) {
    const existing = await prisma.newsroomSource.findFirst({ where: { label: s.label } })
    if (existing) {
      await prisma.newsroomSource.update({
        where: { id: existing.id },
        data: { kind: s.kind, url: s.url, target: s.target },
      })
    } else {
      await prisma.newsroomSource.create({ data: s })
    }
  }

  console.log('Seed toà soạn hoàn tất:', {
    agents: AGENTS.length,
    channels: CHANNELS.length,
    sources: SOURCES.length,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
