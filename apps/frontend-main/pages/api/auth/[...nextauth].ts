// Nạp .env TRƯỚC mọi import khác. Đây là lý do phải dùng require chứ không phải
// import: `import` bị nâng lên đầu module, nên biến môi trường sẽ chưa có mặt
// khi next-auth đọc chúng ở thân module.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import NextAuth from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { Provider } from 'next-auth/providers/index';

const providers: Provider[] = [];

// Add a test-only credentials provider when running E2E in CI/docker.
if (process.env.E2E_BYPASS_KEYCLOAK === '1') {
  providers.push(
    CredentialsProvider({
      id: 'e2e-dev',
      name: 'E2E-Dev',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials || !credentials.username) return null;
        // Dev-only: accept any username with the shared dev password so you can
        // sign in as seeded accounts (e.g. `tsudev` admin) to test roles/mod tools.
        const okPass = process.env.E2E_PASS || 'devpass';
        if (credentials.password !== okPass) return null;
        return {
          id: credentials.username,
          name: credentials.username,
          email: `${credentials.username}@tsudev.local`,
        };
      },
    })
  );
}

// Keycloak là đường đăng nhập DUY NHẤT ở production. Thiếu bất kỳ biến nào
// trong ba biến dưới, next-auth vẫn dựng ra một provider — chỉ là nó không bao
// giờ đăng nhập được, và không có gì báo lỗi. Người dùng thấy một nút bấm không
// làm gì cả.
const KEYCLOAK_VARS = ['KEYCLOAK_CLIENT_ID', 'KEYCLOAK_CLIENT_SECRET', 'KEYCLOAK_ISSUER'] as const;
const missing = KEYCLOAK_VARS.filter((k) => !process.env[k]);

if (missing.length) {
  const message = `[auth] THIẾU cấu hình Keycloak: ${missing.join(
    ', '
  )} — đăng nhập sẽ không hoạt động.`;
  // `next build` chạy mà KHÔNG có secret thật (job "Build frontends" của CI chỉ
  // đặt NEXTAUTH_SECRET), nên chỉ cảnh báo lúc dựng. Ở tiến trình đang PHỤC VỤ
  // thì thiếu cấu hình là lỗi chết người — chết ồn ào còn hơn một nút bấm câm.
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  if (process.env.NODE_ENV === 'production' && !isBuildPhase) throw new Error(message);
  console.warn(message);
}

// Always include Keycloak provider (so dev UI still shows it)
providers.push(
  KeycloakProvider({
    clientId: process.env.KEYCLOAK_CLIENT_ID ?? '',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? '',
    issuer: process.env.KEYCLOAK_ISSUER,
  })
);

export default NextAuth({
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  debug: process.env.NODE_ENV !== 'production',
  cookies: {
    sessionToken: {
      name: process.env.NEXTAUTH_COOKIE_NAME || 'next-auth.session-token',
      options: {
        domain: process.env.NEXTAUTH_COOKIE_DOMAIN || process.env.COOKIE_DOMAIN || undefined,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
});
