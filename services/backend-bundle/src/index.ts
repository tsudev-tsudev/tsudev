'use strict'
// Một tiến trình, ba service. KHÔNG phải API gateway: không định tuyến lại,
// không đổi đường dẫn, không thêm lớp xác thực nào. Mỗi app con giữ nguyên
// middleware, cổng chặn và quy tắc auth của chính nó.
//
// Vì sao gộp: Render free tier cấp 750 giờ instance mỗi tháng cho CẢ tài khoản.
// Ba service chạy liên tục cần 2160 giờ nên không giữ ấm được cái nào, và mỗi
// khách đầu tiên sau 15 phút vắng phải chờ ~50s cold start. Một tiến trình cần
// 720 giờ - vừa đủ để ping giữ ấm. Lợi thêm: một pool kết nối Prisma thay vì
// ba, đáng kể với giới hạn kết nối của Neon free.
//
// Đặt TRƯỚC mọi require: ba service tự mở cổng riêng lúc nạp module nếu không
// thấy cờ này, và sẽ tranh cổng với tiến trình cha.
process.env.EMBEDDED = '1'

import express from 'express'
import type { RequestHandler } from 'express'

// Require theo TÊN PACKAGE, không phải đường dẫn tương đối vào src/. Ba service
// đã khai là dependency workspace nên npm dựng sẵn symlink; tên package đi qua
// trường "main" của chúng, nên khi mã nguồn chuyển từ src/*.js sang dist/*.js
// thì ba dòng này không phải sửa lại lần nữa.
import * as content from 'content-service'
import * as storage from 'storage-service'
import * as trust from 'trust-service'
import * as identity from 'auth-service'
import * as newsroom from 'newsroom-service'

// BẢNG SỞ HỮU ĐƯỜNG DẪN - cũng là tài liệu sống về ranh giới ba service.
// Thêm route mới vào service nào mà tiền tố chưa có ở đây thì route đó KHÔNG
// bao giờ được gọi tới ở chế độ gộp: nó rơi thẳng xuống 404. Sửa bảng này cùng
// lúc với việc thêm route.
const SERVICES = [
  {
    name: 'content',
    mod: content,
    prefixes: ['/api/posts', '/api/docs', '/api/projects', '/api/admin', '/debug'],
  },
  {
    name: 'storage',
    mod: storage,
    prefixes: ['/api/files', '/api/presign', '/api/upload'],
  },
  {
    name: 'trust',
    mod: trust,
    prefixes: ['/api/trust', '/.well-known'],
  },
  {
    name: 'identity',
    mod: identity,
    // '/api/identity', KHÔNG phải '/api/auth': '/api/auth/*' là vùng của
    // NextAuth ở apps/frontend-main. Hai thứ trùng tên nằm ở hai tầng khác nhau
    // là cách chắc chắn để một ngày nào đó gọi nhầm tầng.
    prefixes: ['/api/identity'],
  },
  {
    name: 'newsroom',
    mod: newsroom,
    // Toà soạn Agent AI. CỐ Ý không dùng '/api/admin/newsroom': tiền tố
    // '/api/admin' đã thuộc về content ở trên, nên request sẽ đi vào app đó
    // trước, dính cổng INTERNAL_API_TOKEN của nó, và trả 404 ở production
    // trong khi chạy service riêng ở dev vẫn sống.
    prefixes: ['/api/newsroom'],
  },
]

// Vì sao điều phối theo TIỀN TỐ chứ không `root.use(app)` ba lần:
//
// Mount thẳng thì một request `/api/trust/verify/<serial>` đi VÀO app content
// trước - chưa khớp route nào, nhưng đã chạy hết middleware của content, trong
// đó có cổng chặn INTERNAL_API_TOKEN và `app.use('/api', auth)`. Kết quả: huy
// hiệu SVG, trang xác minh và JWKS của trust - những thứ BẮT BUỘC công khai cho
// trình duyệt của bên thứ ba - trả 401. Không test nào bắt được, đúng kiểu bẫy
// mà CLAUDE.md cảnh báo về auth theo nhánh của trust-service.
//
// So khớp theo ranh giới đoạn đường dẫn, không phải startsWith trần: '/api/post'
// không được nuốt '/api/postsomething'.
const owns = (prefix: string, pathname: string): boolean =>
  pathname === prefix || pathname.startsWith(prefix + '/')

const dispatch =
  (prefixes: string[], app: express.Express): RequestHandler =>
  (req, res, next) =>
    prefixes.some((p) => owns(p, req.path)) ? app(req, res, next) : next()

const root = express()

// Header bảo mật ở TẦNG NGOÀI CÙNG.
//
// Ba app con đều tự đặt header của mình, nhưng `/health` bên dưới là route của
// CHÍNH bundle - nó không đi qua app con nào, nên middleware của chúng không
// chạm tới. Đặt ở đây thì mọi phản hồi của tiến trình gộp đều được phủ, kể cả
// các route tương lai thêm thẳng vào bundle.
root.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

// Đứng TRƯỚC các app con: cả ba đều khai /health của riêng mình, mount thẳng thì
// chỉ cái đầu tiên thắng và health check nói dối về hai cái còn lại.
root.get('/health', (req, res) =>
  res.json({
    status: 'ok',
    service: 'backend-bundle',
    bundled: SERVICES.map((s) => s.name),
  })
)

SERVICES.forEach((s) => root.use(dispatch(s.prefixes, s.mod.app)))

const port = Number(process.env.PORT) || 4000
const bindHost = process.env.BIND_HOST || '0.0.0.0'

async function startServer() {
  // Chuẩn bị của từng service: ensureBucket() của storage, bộ giám sát định kỳ
  // của trust. Bỏ qua là hỏng âm thầm, không phải hỏng ồn ào.
  for (const s of SERVICES) {
    // `init` là TUỲ CHỌN theo service: storage cần ensureBucket(), trust cần bộ
    // giám sát định kỳ, newsroom và identity thì không có gì để hâm nóng. Ép
    // kiểu ở đây thay vì bắt mọi service phải xuất một hàm rỗng - thêm service
    // mới không nên kéo theo mã nghi lễ.
    const mod = s.mod as { init?: () => Promise<void> }
    if (typeof mod.init === 'function') await mod.init()
  }
  root.listen(port, bindHost, () =>
    console.log(
      `backend-bundle listening on ${bindHost}:${port} - ${SERVICES.map((s) => s.name).join(', ')}`
    )
  )
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[bundle] failed to start', err && (err.stack || err))
    process.exit(1)
  })
}

export { root as app, startServer, SERVICES }
