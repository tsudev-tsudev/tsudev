const { defineConfig } = require('@playwright/test');
const path = require('path');
const { loadTopology, publicUrl, internalUrl, node } = require('../scripts/topology/load');

// Cổng và URL lấy từ config/topology.json — giai đoạn 3 đổi hình trạng mạng thì
// bộ test đi theo mà không phải sửa dòng nào. Xem docs/refactor-network-topology.md.
const topo = loadTopology();
const MAIN = process.env.E2E_MAIN_URL || publicUrl(topo, 'main');
const ROOT = path.resolve(__dirname, '..');

// Chạy trong docker-compose thì frontend đã có sẵn, đừng để Playwright dựng lại.
const reuseExisting = process.env.E2E_NO_WEBSERVER === '1';

// Next dev khởi động lần đầu phải biên dịch cả app — 10-20s là bình thường,
// nên timeout rộng tay.
//
// KHÔNG còn E2E_BYPASS_KEYCLOAK. Bộ test nay đăng nhập bằng ĐÚNG luồng của
// người dùng thật: mật khẩu Argon2id trong DB, kiểm bởi auth-service. Tài khoản
// do `npm run db:seed:dev` đặt. Một bộ E2E đi qua cửa sau thì nó chứng minh cửa
// sau chạy được, không chứng minh cửa trước chạy được.
const IDENTITY_SECRET =
  process.env.INTERNAL_IDENTITY_SECRET || 'e2e-identity-secret-du-dai-cho-hmac-256!!';

const webServerEnv = {
  ...process.env,
  INTERNAL_IDENTITY_SECRET: IDENTITY_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'e2e-placeholder-secret',
  // Thứ đang được kiểm chính là nó: thiếu biến này thì cookie phiên bó vào
  // tsudev.localhost và forum.tsudev.localhost sẽ không thấy.
  ...(topo.dev.mode === 'proxy' ? { NEXTAUTH_COOKIE_DOMAIN: `.${topo.dev.domain}` } : {}),
};

// Tái dùng server đang chạy là OPT-IN, không phải mặc định.
//
// Với `reuseExistingServer: true`, một tiến trình cũ còn giữ cổng sẽ được dùng
// lại IM LẶNG — kể cả khi nó chạy mã từ trước thay đổi đang được kiểm. Triệu
// chứng là test đỏ ở chỗ không liên quan, và cách duy nhất phát hiện là đi soi
// `ss -ltnp`. Chuyện đó đã xảy ra hai lần trong một phiên.
//
// Mặc định nay là dựng mới; cổng bận thì Playwright báo lỗi ỒN ÀO. Đặt
// E2E_REUSE_SERVER=1 khi thật sự muốn bám vào stack đang chạy sẵn.
const reuseServers = process.env.E2E_REUSE_SERVER === '1';

const useProxy = topo.dev.mode === 'proxy';

// Ở chế độ proxy, URL công khai do dev-proxy phục vụ chứ không phải Next, nên
// phải chờ đúng cổng NỘI BỘ của từng app — chờ URL công khai sẽ treo cho tới khi
// proxy lên, mà proxy lại chờ app. NEXTAUTH_URL thì ngược lại: luôn là URL công
// khai, vì next-auth dựng callback từ đó.
const server = (id) => ({
  command: `npm --workspace ${node(topo, id).workspace} run dev`,
  url: useProxy ? internalUrl(topo, id) : publicUrl(topo, id),
  cwd: ROOT,
  env: { ...webServerEnv, NEXTAUTH_URL: publicUrl(topo, id) },
  reuseExistingServer: reuseServers,
  timeout: 120 * 1000,
});

const proxyServer = () => ({
  command: 'node scripts/dev-proxy.js',
  url: publicUrl(topo, 'main'),
  cwd: ROOT,
  reuseExistingServer: reuseServers,
  timeout: 60 * 1000,
});

// Service backend phải chạy thì blog/docs/trust mới có nội dung THẬT. Không có
// chúng, getServerSideProps nuốt lỗi và trả mảng rỗng — trang vẫn 200 nên test
// vẫn xanh mà chẳng chứng minh được gì.
const backend = (id) => ({
  command: `node ${node(topo, id).workspace}/dist/index.js`,
  url: `${internalUrl(topo, id)}/health`,
  cwd: ROOT,
  // KHÔNG còn AUTH_DEV_BYPASS: service kiểm khẳng định có chữ ký của BFF, và
  // hai bên phải dùng CÙNG một khoá.
  env: { ...process.env, BIND_HOST: '127.0.0.1', INTERNAL_IDENTITY_SECRET: IDENTITY_SECRET },
  reuseExistingServer: reuseServers,
  timeout: 60 * 1000,
});

const servers = [backend('content'), backend('identity'), backend('trust'), server('main')];
if (useProxy) servers.push(proxyServer());

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60 * 1000,
  expect: { timeout: 5000 },
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    headless: true,
    baseURL: MAIN,
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },
  webServer: reuseExisting ? undefined : servers,
  projects: [
    {
      // Lưới an toàn: chạy được trong CI mà không phải dựng cả compose.
      name: 'app',
      testMatch: /smoke\.spec\.js/,
    },
    {
      // Cần MinIO + storage-service + Keycloak ⇒ chỉ chạy khi có full stack
      // (docker-compose). Không đưa vào CI.
      name: 'full-stack',
      testMatch: /sso-upload\.spec\.js/,
    },
  ],
});
