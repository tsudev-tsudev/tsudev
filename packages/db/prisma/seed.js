'use strict'
// Seed dữ liệu khởi tạo cho môi trường dev: user, blog, docs, chương trình dấu.
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../../.env') })
const { prisma } = require('../src/index')

async function main() {
  // --- Users ---
  const admin = await prisma.user.upsert({
    where: { username: 'tsudev' },
    update: {},
    create: {
      username: 'tsudev',
      email: 'dev.nguyentrangtinhsu@gmail.com',
      displayName: 'Nguyễn Trang Tình Sử',
      role: 'ADMIN',
      credits: 500,
      bio: 'Founder của tsudev — Decoding the Future, One Commit at a Time.',
    },
  })
  await prisma.user.upsert({
    where: { username: 'alice' },
    update: {},
    create: {
      username: 'alice',
      email: 'alice@tsudev.vn',
      displayName: 'Alice',
      role: 'MEMBER',
      credits: 20,
    },
  })
  await prisma.user.upsert({
    where: { username: 'bob' },
    update: {},
    create: {
      username: 'bob',
      email: 'bob@tsudev.vn',
      displayName: 'Bob',
      role: 'VIP',
      credits: 75,
    },
  })

  // --- Blog posts ---
  const posts = [
    {
      slug: 'welcome-to-tsudev',
      title: 'Chào mừng đến với tsudev',
      excerpt: 'Giới thiệu hệ sinh thái công nghệ tsudev.',
      tags: ['thông báo', 'giới thiệu'],
      contentMd:
        '# Chào mừng\n\ntsudev là hệ sinh thái đa nền tảng cho developer: blog, tài liệu, diễn đàn và kho mã nguồn.\n\n> Decoding the Future, One Commit at a Time.',
    },
    {
      slug: 'kien-truc-microservices',
      title: 'Kiến trúc từ Monolith đến Microservices',
      excerpt: 'Vì sao nên bắt đầu bằng modular monolith.',
      tags: ['kiến trúc', 'backend'],
      contentMd:
        '## Modular Monolith\n\nVới đội nhỏ, gộp service và tách sau khi cần scale là lựa chọn tối ưu về chi phí vận hành.',
    },
    {
      slug: 'toi-uu-seo-nextjs',
      title: 'Tối ưu SEO với Next.js App Router',
      excerpt: 'RSC, streaming và metadata API.',
      tags: ['frontend', 'seo'],
      contentMd:
        '## SEO-first\n\nApp Router mang lại Server Components và metadata API giúp SEO tuyệt đối cho blog và docs.',
    },
  ]
  for (const p of posts) {
    await prisma.post.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...p, authorId: admin.id },
    })
  }

  // --- Docs ---
  const docs = [
    {
      slug: 'getting-started',
      title: 'Bắt đầu nhanh',
      category: 'guide',
      position: 1,
      contentMd: '## Cài đặt\n\n```bash\nnpm run dev:local\n```',
    },
    {
      slug: 'api-reference',
      title: 'Tài liệu API',
      category: 'reference',
      position: 2,
      contentMd: '## Endpoints\n\n- `GET /api/users`\n- `GET /api/posts`',
    },
  ]
  for (const d of docs) {
    await prisma.doc.upsert({ where: { slug: d.slug }, update: {}, create: d })
  }

  // --- Trust Seal: chương trình dấu ---
  // Tiêu chí được công bố công khai trên /trust/programs/<slug>; đổi tiêu chí ở
  // đây là đổi luôn nội dung trang, không phải sửa code.
  const programs = [
    {
      slug: 'copyright-verified',
      name: 'Xác minh bản quyền',
      summary: 'Website sử dụng nội dung của tsudev đúng giấy phép và ghi nguồn đầy đủ.',
      validityDays: 365,
      feeCredits: 50,
      badgeVariant: 'copyright',
      sortOrder: 1,
      criteria: [
        { key: 'source-listed', label: 'Liệt kê đầy đủ nội dung tsudev đang sử dụng' },
        { key: 'attribution', label: 'Ghi nguồn tsudev ở vị trí người đọc thấy được' },
        { key: 'license-scope', label: 'Sử dụng đúng phạm vi giấy phép đã cấp' },
        { key: 'no-derivative-claim', label: 'Không tự nhận là tác giả gốc của nội dung dẫn lại' },
      ],
      evidenceSpec: [
        { kind: 'content-urls', label: 'URL các trang có dùng nội dung tsudev', required: true },
        { kind: 'license-ref', label: 'Mã giấy phép hoặc thư chấp thuận', required: true },
      ],
    },
    {
      slug: 'ownership-attested',
      name: 'Chứng nhận sở hữu',
      summary: 'tsudev xác nhận sở hữu một phần hoặc toàn bộ website được nêu.',
      validityDays: 730,
      feeCredits: 0,
      badgeVariant: 'ownership',
      sortOrder: 2,
      criteria: [
        { key: 'legal-entity', label: 'Pháp nhân vận hành website được xác định rõ' },
        { key: 'ownership-share', label: 'Tỉ lệ sở hữu của tsudev được nêu chính xác' },
        { key: 'domain-control', label: 'Quyền kiểm soát domain đã được xác minh' },
      ],
      evidenceSpec: [
        { kind: 'legal-doc', label: 'Giấy tờ pháp nhân hoặc thoả thuận góp vốn', required: true },
        { kind: 'ownership-share', label: 'Tỉ lệ sở hữu (%)', required: true },
      ],
    },
    {
      slug: 'security-compliant',
      name: 'Chứng chỉ bảo mật',
      summary: 'Website đáp ứng bộ yêu cầu bảo mật tối thiểu của tsudev.',
      validityDays: 180,
      feeCredits: 120,
      badgeVariant: 'security',
      sortOrder: 3,
      criteria: [
        { key: 'tls', label: 'HTTPS bắt buộc, TLS 1.2 trở lên, chứng chỉ còn hạn' },
        { key: 'hsts', label: 'Bật HSTS' },
        { key: 'headers', label: 'Có CSP, X-Content-Type-Options, Referrer-Policy' },
        { key: 'no-mixed', label: 'Không có nội dung tải qua HTTP trên trang HTTPS' },
        { key: 'disclosure', label: 'Có kênh tiếp nhận báo lỗi bảo mật' },
      ],
      evidenceSpec: [
        { kind: 'scan-report', label: 'Báo cáo quét bảo mật gần nhất', required: false },
        { kind: 'contact', label: 'Email tiếp nhận báo lỗi bảo mật', required: true },
      ],
    },
    {
      slug: 'data-protection',
      name: 'Tuân thủ bảo vệ dữ liệu',
      summary: 'Website có cơ chế bảo vệ dữ liệu cá nhân theo tiêu chí tsudev công bố.',
      validityDays: 365,
      feeCredits: 120,
      badgeVariant: 'privacy',
      sortOrder: 4,
      criteria: [
        { key: 'policy', label: 'Có chính sách quyền riêng tư truy cập được công khai' },
        { key: 'lawful-basis', label: 'Nêu rõ căn cứ và mục đích xử lý dữ liệu' },
        { key: 'rights', label: 'Có quy trình để người dùng truy cập/xoá dữ liệu của họ' },
        { key: 'contact', label: 'Có đầu mối phụ trách dữ liệu' },
        { key: 'retention', label: 'Nêu rõ thời hạn lưu trữ' },
      ],
      evidenceSpec: [
        { kind: 'policy-url', label: 'URL chính sách quyền riêng tư', required: true },
        { kind: 'dpo-contact', label: 'Đầu mối phụ trách dữ liệu', required: true },
      ],
    },
  ]
  for (const p of programs) {
    await prisma.sealProgram.upsert({
      where: { slug: p.slug },
      update: { ...p },
      create: { ...p },
    })
  }

  // --- Dự án & bản quyền ---
  // Ba trạng thái bản quyền đều có mặt để trang /projects và /admin/projects
  // hiện được cả ba nhánh hiển thị ngay từ lần chạy đầu.
  const projects = [
    {
      slug: 'tsudev-platform',
      name: 'tsudev Platform',
      summary: 'Nền tảng web monorepo: blog, tài liệu, con dấu tín nhiệm, SSO và object storage.',
      descriptionMd:
        '## Tổng quan\n\nMonorepo npm workspaces gồm một ứng dụng Next.js và ba service Express dùng chung một database qua Prisma.\n\n- Một cổng vào duy nhất ở dev, phân biệt bằng subdomain\n- Nguồn sự thật về cổng/tên miền nằm trong `config/topology.json`\n- Trình duyệt không bao giờ gọi thẳng cổng service\n',
      kind: 'APP',
      status: 'BETA',
      version: '0.1.0',
      license: 'MIT',
      repoUrl: 'https://github.com/b4djl1h/tsudev',
      copyrightStatus: 'PENDING',
      copyrightOwner: 'Nguyễn Trang Tình Sử',
      trustProgramSlug: 'copyright-verified',
      featured: true,
      sortOrder: 1,
    },
    {
      slug: 'tsudev-trust-seal',
      name: 'Con dấu tín nhiệm tsudev',
      summary:
        'Dịch vụ cấp và xác thực huy hiệu tín nhiệm cho website: ký Ed25519, xác minh tên miền, giám sát định kỳ.',
      descriptionMd:
        '## Con dấu tín nhiệm\n\nCấp huy hiệu cho website dùng mã nguồn tsudev, và chứng nhận cho website do đội ngũ tsudev thực hiện.\n\nMỗi chứng chỉ mang một chữ ký Ed25519 xác minh được độc lập qua JWKS công khai — không cần tin vào máy chủ tsudev để kiểm tra tính toàn vẹn.\n',
      kind: 'SERVICE',
      status: 'BETA',
      version: '0.1.0',
      license: 'MIT',
      homepageUrl: '/trust',
      copyrightStatus: 'REGISTERED',
      copyrightNo: 'TSD-2026-0001',
      copyrightAt: new Date('2026-03-14'),
      copyrightOwner: 'Nguyễn Trang Tình Sử',
      trustProgramSlug: 'ownership-attested',
      featured: true,
      sortOrder: 2,
    },
    {
      slug: 'tsudev-ui',
      name: '@tsudev/ui',
      summary: 'Hệ thống thiết kế chỉ-chế-độ-tối: token màu, component dùng chung, Storybook.',
      descriptionMd:
        '## Design system\n\nThứ bậc thị giác dựng bằng độ sáng nền (`--surface` < `--panel` < `--panel-2`) chứ không bằng viền hay đổ bóng.\n',
      kind: 'LIBRARY',
      status: 'STABLE',
      version: '0.1.0',
      license: 'MIT',
      copyrightStatus: 'NONE',
      sortOrder: 3,
    },
    {
      slug: 'topology-check',
      name: 'topology:check',
      summary:
        'Cổng chặn giữ cổng và tên miền trong mã nguồn luôn khớp một nguồn sự thật duy nhất.',
      descriptionMd:
        '## Vì sao\n\nCổng bị hardcode rải rác là thứ mọc lại sau mỗi lần dọn. `topology:check` chạy trong CI và `pre-push`, bắt ba loại lệch: literal ngoài danh sách miễn trừ, cổng không có trong topology, và compose công bố sai cổng.\n',
      kind: 'TOOL',
      status: 'STABLE',
      version: '1.0.0',
      license: 'MIT',
      copyrightStatus: 'NONE',
      sortOrder: 4,
    },
  ]
  for (const p of projects) {
    await prisma.project.upsert({ where: { slug: p.slug }, update: { ...p }, create: { ...p } })
  }

  console.log('Seed hoàn tất:', {
    admin: admin.username,
    users: 3,
    posts: posts.length,
    docs: docs.length,
    trustPrograms: programs.length,
    projects: projects.length,
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
