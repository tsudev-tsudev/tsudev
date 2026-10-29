// Bản phát hành tải về được của dự án (ProjectRelease).
//
// ──────────────────────────────────────────────────────────────────────────────
// BỐN BẤT BIẾN ĐƯỢC CANH Ở ĐÂY, VÀ CẢ BỐN ĐỀU HỎNG IM LẶNG NẾU MẤT
// ──────────────────────────────────────────────────────────────────────────────
//
//   1. `storageKey` KHÔNG BAO GIỜ ra khỏi API công khai. Nó là khoá object
//      trong R2; rò ra là mời người ta gọi thẳng bucket, và lượt tải đó không
//      đi qua bộ đếm. Hỏng im lặng vì `downloadCount` đứng yên trông giống hệt
//      "chưa ai tải".
//
//   2. Bản NHÁP (`publishedAt: null`) không được lọt ra đường đọc công khai.
//      Mất điều kiện này thì một bản chưa sẵn sàng xuất hiện trên trang chủ, và
//      không có gì báo lỗi - nó chỉ là một hàng nữa trong danh sách.
//
//   3. `signature` phải đi kèm `signingKid`. Vòng khoá của repo này CÓ xoay
//      (`TRUST_SIGNING_KEYS_RETIRED`), nên một chữ ký không nói nó được ký bằng
//      khoá nào là chữ ký không kiểm được sau lần xoay đầu tiên. Lúc đó người
//      tải chạy phép kiểm, thất bại, và kết luận tệp đã bị can thiệp.
//
//   4. Đường tải TĂNG bộ đếm rồi mới chuyển hướng. Đây là lý do tồn tại của cả
//      route đó - bỏ phép tăng đi thì route trở thành một chặng mạng vô nghĩa.
//
// Và một bất biến phân quyền: mọi đường ghi tự gọi `requireAdmin()`, theo đúng
// khuôn mà CLAUDE.md đòi ("Thêm route ghi mới thì phải theo khuôn đó, đừng dựa
// vào middleware").
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN
process.env.S3_PUBLIC_ENDPOINT = 'https://cdn-test.example'
process.env.S3_BUCKET = 'tsudev-test'

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')

const ADMIN = 'test-admin-release'
const THUONG = 'test-member-release'
const SLUG = 'test-release-du-an'
const SHA = 'a'.repeat(64)

const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

// Xoá CỨNG bị chặn ở cấp database (trigger + `tsudev.allow_hard_delete`). Dữ
// liệu test vẫn phải biến mất hẳn, nếu không lần chạy sau đụng ràng buộc UNIQUE.
// ProjectRelease đi theo nhờ `onDelete: Cascade`.
const clean = () =>
  prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
    prisma.$executeRawUnsafe(`DELETE FROM "Project" WHERE slug = '${SLUG}'`),
  ])

let projectId = ''

beforeAll(async () => {
  await clean()
  for (const [u, role] of [
    [ADMIN, 'ADMIN'],
    [THUONG, 'MEMBER'],
  ] as const) {
    await prisma.user.upsert({
      where: { username: u },
      update: { role },
      create: { username: u, email: `${u}@tsudev.local`, displayName: u, role },
    })
  }
  const p = await prisma.project.create({
    data: { slug: SLUG, name: 'Dự án test phát hành', summary: 'x', published: true },
  })
  projectId = p.id
}, 30000)

afterAll(async () => {
  await clean()
  await prisma.user.deleteMany({ where: { username: { in: [ADMIN, THUONG] } } })
  await prisma.$disconnect()
})

beforeEach(async () => {
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
    prisma.$executeRawUnsafe(`DELETE FROM "ProjectRelease" WHERE "projectId" = '${projectId}'`),
  ])
})

describe('phân quyền đường ghi', () => {
  test('không đăng nhập thì POST trả 401', async () => {
    const res = await request(app)
      .post(`/api/admin/projects/${SLUG}/releases`)
      .send({ version: '1.0.0', platform: 'ANDROID', storageKey: 'r/a.apk' })
    expect(res.status).toBe(401)
  })

  test('MEMBER thì POST trả 403 - thang vai trò, không phải cờ', async () => {
    const res = await request(app)
      .post(`/api/admin/projects/${SLUG}/releases`)
      .set(await asUser(THUONG))
      .send({ version: '1.0.0', platform: 'ANDROID', storageKey: 'r/a.apk' })
    expect(res.status).toBe(403)
  })

  test('PATCH và DELETE cũng tự gọi requireAdmin', async () => {
    const h = await asUser(THUONG)
    const r = await prisma.projectRelease.create({
      data: { projectId, version: '1.0.0', platform: 'ANDROID', storageKey: 'r/a.apk' },
    })
    expect((await request(app).patch(`/api/admin/releases/${r.id}`).set(h).send({})).status).toBe(
      403
    )
    expect((await request(app).delete(`/api/admin/releases/${r.id}`).set(h)).status).toBe(403)
  })
})

describe('ba bất biến của thân request', () => {
  test('thiếu cả storageKey lẫn externalUrl thì 400', async () => {
    const res = await request(app)
      .post(`/api/admin/projects/${SLUG}/releases`)
      .set(await asUser(ADMIN))
      .send({ version: '1.0.0', platform: 'ANDROID' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/storageKey|externalUrl/)
  })

  test('có CẢ HAI thì 400 - không ai biết nút tải dẫn đi đâu', async () => {
    const res = await request(app)
      .post(`/api/admin/projects/${SLUG}/releases`)
      .set(await asUser(ADMIN))
      .send({
        version: '1.0.0',
        platform: 'ANDROID',
        storageKey: 'r/a.apk',
        externalUrl: 'https://x.test/a.apk',
      })
    expect(res.status).toBe(400)
  })

  test('signature đứng một mình thì 400 - phải có signingKid', async () => {
    const res = await request(app)
      .post(`/api/admin/projects/${SLUG}/releases`)
      .set(await asUser(ADMIN))
      .send({
        version: '1.0.0',
        platform: 'ANDROID',
        storageKey: 'r/a.apk',
        sha256: SHA,
        signature: 'abc',
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/signingKid/)
  })

  test('signature không có sha256 thì 400 - nó là chữ ký CỦA sha256', async () => {
    const res = await request(app)
      .post(`/api/admin/projects/${SLUG}/releases`)
      .set(await asUser(ADMIN))
      .send({
        version: '1.0.0',
        platform: 'ANDROID',
        storageKey: 'r/a.apk',
        signature: 'abc',
        signingKid: 'tsu-2026-08',
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/sha256/)
  })

  test('sha256 sai hình dạng thì 400 - checksum sai còn tệ hơn không có', async () => {
    const res = await request(app)
      .post(`/api/admin/projects/${SLUG}/releases`)
      .set(await asUser(ADMIN))
      .send({ version: '1.0.0', platform: 'ANDROID', storageKey: 'r/a.apk', sha256: 'khongphai' })
    expect(res.status).toBe(400)
  })

  test('platform ngoài enum thì 400', async () => {
    const res = await request(app)
      .post(`/api/admin/projects/${SLUG}/releases`)
      .set(await asUser(ADMIN))
      .send({ version: '1.0.0', platform: 'SYMBIAN', storageKey: 'r/a.apk' })
    expect(res.status).toBe(400)
  })

  /**
   * 🔴 TEST NÀY RA ĐỜI TỪ MỘT KHUYẾT ĐÃ ĐO ĐƯỢC, đừng gộp nó vào test dưới.
   *
   * Bản đầu khai `arch String?`. Trong SQL `NULL != NULL`, nên ràng buộc
   * `@@unique([projectId, version, platform, arch])` KHÔNG chặn trùng khi `arch`
   * bỏ trống - và bỏ trống là trường hợp PHỔ BIẾN NHẤT. Đã kiểm trực tiếp trên
   * Postgres: hai lượt INSERT cùng (projectId, version, platform) với arch NULL
   * đều lọt, cho ra hai hàng y hệt nhau.
   *
   * Điều khiến nó sống sót qua cả một bộ test: test "trùng thì 409" bên dưới
   * truyền `arch: 'arm64'`, tức nó chỉ chứng minh ràng buộc hoạt động ở nhánh
   * mà ràng buộc vốn đã hoạt động. Ràng buộc vẫn hiện ra trong `\d`, test vẫn
   * xanh, và không gì báo lỗi.
   *
   * Cột nay là NOT NULL DEFAULT ''. Test này canh đúng nhánh BỎ TRỐNG.
   */
  test('trùng khi KHÔNG khai arch cũng phải 409 - NULL != NULL trong SQL', async () => {
    const h = await asUser(ADMIN)
    const than = { version: '3.0.0', platform: 'ANDROID', storageKey: 'r/a.apk' }
    const dau = await request(app).post(`/api/admin/projects/${SLUG}/releases`).set(h).send(than)
    expect(dau.status).toBe(201)
    // Đối ngoại `arch` vẫn là null dù trong database là chuỗi rỗng.
    expect(dau.body.arch).toBe('')

    const lai = await request(app).post(`/api/admin/projects/${SLUG}/releases`).set(h).send(than)
    expect(lai.status).toBe(409)
  })

  test('gửi arch: null cũng quy về chuỗi rỗng, không tạo lỗ UNIQUE thứ hai', async () => {
    const h = await asUser(ADMIN)
    const a = await request(app)
      .post(`/api/admin/projects/${SLUG}/releases`)
      .set(h)
      .send({ version: '4.0.0', platform: 'LINUX', storageKey: 'r/a.deb', arch: null })
    expect(a.status).toBe(201)
    const b = await request(app)
      .post(`/api/admin/projects/${SLUG}/releases`)
      .set(h)
      .send({ version: '4.0.0', platform: 'LINUX', storageKey: 'r/b.deb' })
    expect(b.status).toBe(409)
  })

  test('trùng (version, platform, arch) thì 409, không phải 500', async () => {
    const h = await asUser(ADMIN)
    const than = { version: '1.0.0', platform: 'ANDROID', arch: 'arm64', storageKey: 'r/a.apk' }
    expect(
      (await request(app).post(`/api/admin/projects/${SLUG}/releases`).set(h).send(than)).status
    ).toBe(201)
    const lai = await request(app).post(`/api/admin/projects/${SLUG}/releases`).set(h).send(than)
    expect(lai.status).toBe(409)
  })
})

describe('đường đọc công khai', () => {
  test('KHÔNG rò storageKey, và có downloadPath thay thế', async () => {
    await prisma.projectRelease.create({
      data: {
        projectId,
        version: '1.0.0',
        platform: 'ANDROID',
        storageKey: 'releases/bi-mat.apk',
        publishedAt: new Date(),
      },
    })
    const res = await request(app).get(`/api/projects/${SLUG}/releases`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    // Khẳng định trên CHUỖI JSON, không chỉ trên trường: một trường lồng hay một
    // khoá đổi tên vẫn làm rò, và phép kiểm theo tên trường sẽ bỏ qua.
    expect(JSON.stringify(res.body)).not.toContain('storageKey')
    expect(JSON.stringify(res.body)).not.toContain('bi-mat.apk')
    expect(res.body[0].downloadPath).toBe(
      `/api/projects/${SLUG}/releases/${res.body[0].id}/download`
    )
    // Hợp đồng đối ngoại: chuỗi rỗng trong database hiện ra là `null`, không
    // phải `""`. Giao diện kiểm `r.arch &&` để quyết định có vẽ nhãn kiến trúc,
    // và chuỗi rỗng cũng falsy - nhưng hợp đồng phải nói rõ một giá trị, không
    // để hai giá trị cùng nghĩa.
    expect(res.body[0].arch).toBeNull()
  })

  test('bản NHÁP không lọt ra công khai, nhưng admin thấy', async () => {
    await prisma.projectRelease.create({
      data: { projectId, version: '2.0.0-nhap', platform: 'WINDOWS', storageKey: 'r/n.exe' },
    })
    const congKhai = await request(app).get(`/api/projects/${SLUG}/releases`)
    expect(congKhai.body).toHaveLength(0)

    const quanTri = await request(app)
      .get(`/api/admin/projects/${SLUG}/releases`)
      .set(await asUser(ADMIN))
    expect(quanTri.status).toBe(200)
    expect(quanTri.body).toHaveLength(1)
  })

  test('mặc định chỉ STABLE; BETA phải xin bằng ?channel=', async () => {
    await prisma.projectRelease.createMany({
      data: [
        {
          projectId,
          version: '1.0.0',
          platform: 'ANDROID',
          channel: 'STABLE',
          storageKey: 'r/s.apk',
          publishedAt: new Date(),
        },
        {
          projectId,
          version: '1.1.0',
          platform: 'ANDROID',
          channel: 'BETA',
          storageKey: 'r/b.apk',
          publishedAt: new Date(),
        },
      ],
    })
    const macDinh = await request(app).get(`/api/projects/${SLUG}/releases`)
    expect(macDinh.body.map((r: { version: string }) => r.version)).toEqual(['1.0.0'])

    const beta = await request(app).get(`/api/projects/${SLUG}/releases?channel=BETA`)
    expect(beta.body.map((r: { version: string }) => r.version)).toEqual(['1.1.0'])
  })

  test('bản ĐÃ XOÁ MỀM không lọt ra công khai', async () => {
    await prisma.projectRelease.create({
      data: {
        projectId,
        version: '1.0.0',
        platform: 'ANDROID',
        storageKey: 'r/a.apk',
        publishedAt: new Date(),
        deletedAt: new Date(),
      },
    })
    const res = await request(app).get(`/api/projects/${SLUG}/releases`)
    expect(res.body).toHaveLength(0)
  })

  test('dự án chưa công bố thì 404, không phải mảng rỗng', async () => {
    await prisma.project.update({ where: { id: projectId }, data: { published: false } })
    const res = await request(app).get(`/api/projects/${SLUG}/releases`)
    await prisma.project.update({ where: { id: projectId }, data: { published: true } })
    expect(res.status).toBe(404)
  })

  test('/api/releases gộp theo dự án và chỉ gồm dự án CÓ bản phát hành', async () => {
    await prisma.projectRelease.create({
      data: {
        projectId,
        version: '1.0.0',
        platform: 'ANDROID',
        storageKey: 'r/a.apk',
        publishedAt: new Date(),
      },
    })
    const res = await request(app).get('/api/releases?limit=50')
    expect(res.status).toBe(200)
    const muc = res.body.find((x: { project: { slug: string } }) => x.project.slug === SLUG)
    expect(muc).toBeDefined()
    expect(muc.releases).toHaveLength(1)
    expect(JSON.stringify(res.body)).not.toContain('storageKey')
    // Mọi dự án trả về đều PHẢI có ít nhất một bản - đó là cả ý nghĩa của endpoint.
    for (const x of res.body) expect(x.releases.length).toBeGreaterThan(0)
  })
})

describe('đường tải', () => {
  test('tăng downloadCount rồi chuyển hướng 302 tới URL công khai', async () => {
    const r = await prisma.projectRelease.create({
      data: {
        projectId,
        version: '1.0.0',
        platform: 'ANDROID',
        storageKey: 'releases/app.apk',
        publishedAt: new Date(),
      },
    })
    expect(r.downloadCount).toBe(0)

    const res = await request(app).get(`/api/projects/${SLUG}/releases/${r.id}/download`)
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('https://cdn-test.example/tsudev-test/releases/app.apk')

    const sau = await prisma.projectRelease.findUnique({ where: { id: r.id } })
    expect(sau?.downloadCount).toBe(1)
  })

  test('nền tảng WEB/SOURCE chuyển hướng ra externalUrl', async () => {
    const r = await prisma.projectRelease.create({
      data: {
        projectId,
        version: '1.0.0',
        platform: 'SOURCE',
        externalUrl: 'https://github.test/tsudev/x/releases/tag/v1',
        publishedAt: new Date(),
      },
    })
    const res = await request(app).get(`/api/projects/${SLUG}/releases/${r.id}/download`)
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('https://github.test/tsudev/x/releases/tag/v1')
  })

  test('bản nháp KHÔNG tải được - cổng không chỉ ở đường liệt kê', async () => {
    const r = await prisma.projectRelease.create({
      data: { projectId, version: '9.9.9', platform: 'ANDROID', storageKey: 'r/n.apk' },
    })
    const res = await request(app).get(`/api/projects/${SLUG}/releases/${r.id}/download`)
    expect(res.status).toBe(404)
  })

  test('id của dự án KHÁC không tải được qua slug này', async () => {
    const khac = await prisma.project.create({
      data: { slug: `${SLUG}-khac`, name: 'Khác', summary: 'x', published: true },
    })
    const r = await prisma.projectRelease.create({
      data: {
        projectId: khac.id,
        version: '1.0.0',
        platform: 'ANDROID',
        storageKey: 'r/x.apk',
        publishedAt: new Date(),
      },
    })
    const res = await request(app).get(`/api/projects/${SLUG}/releases/${r.id}/download`)
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
      prisma.$executeRawUnsafe(`DELETE FROM "Project" WHERE id = '${khac.id}'`),
    ])
    expect(res.status).toBe(404)
  })
})

describe('xoá mềm', () => {
  test('DELETE đặt deletedAt, không xoá hàng', async () => {
    const r = await prisma.projectRelease.create({
      data: { projectId, version: '1.0.0', platform: 'ANDROID', storageKey: 'r/a.apk' },
    })
    const res = await request(app)
      .delete(`/api/admin/releases/${r.id}`)
      .set(await asUser(ADMIN))
    expect(res.status).toBe(200)

    const sau = await prisma.projectRelease.findUnique({ where: { id: r.id } })
    // Hàng VẪN CÒN: một bản đã công bố có thể đang được ai đó đối chiếu checksum.
    expect(sau).not.toBeNull()
    expect(sau?.deletedAt).not.toBeNull()
  })
})
