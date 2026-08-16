// Nạp .env TRƯỚC mọi import khác. Đây là lý do phải dùng require chứ không phải
// import: `import` bị nâng lên đầu module, nên biến môi trường sẽ chưa có mặt
// khi next-auth đọc chúng ở thân module.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import NextAuth from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import type { Provider } from 'next-auth/providers/index';

import { IDENTITY, internalHeaders } from '../../../lib/services';

/**
 * Xác thực do codebase tự quản lý.
 *
 * KHÔNG CÒN PROVIDER `e2e-dev`. Nó nhận BẤT KỲ username nào với mật khẩu
 * `devpass`, và chỉ được gác sau `E2E_BYPASS_KEYCLOAK=1`. Ngày 16/08/2026 bản
 * production đã từng mang theo cờ đó — ai cũng đăng nhập được vào tài khoản
 * ADMIN, site vẫn chạy bình thường, không có gì báo lỗi. Một đường đăng nhập
 * mà độ an toàn phụ thuộc vào việc một biến môi trường KHÔNG được đặt là một
 * đường đăng nhập đang chờ tới lượt hỏng.
 *
 * Dev và production nay dùng CÙNG một luồng: mật khẩu Argon2id trong DB, kiểm
 * bởi auth-service. Tài khoản dev sinh ra bằng `npm run db:seed`.
 */

/**
 * Mật khẩu KHÔNG được kiểm ở đây.
 *
 * App này chạy trên Cloudflare Workers: không có kết nối Postgres và không nạp
 * được native module, nên Argon2id không thể chạy trong tiến trình này. Việc
 * kiểm nằm ở auth-service, và ràng buộc hạ tầng đó trùng với ranh giới đúng —
 * hash mật khẩu không nên đi qua tầng biên.
 */
async function verifyWithIdentityService(identifier: string, password: string, ip: string) {
  const res = await fetch(`${IDENTITY}/api/identity/verify-credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...internalHeaders(),
      // Giới hạn tần suất theo IP nằm ở auth-service; nó cần IP THẬT của người
      // dùng, không phải IP của tiến trình Next.
      ...(ip ? { 'x-forwarded-for': ip } : {}),
    },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    id: string;
    username: string;
    email: string;
    displayName: string | null;
    role: string;
    sessionVersion: number;
    emailVerified: boolean;
  };
}

const providers: Provider[] = [
  CredentialsProvider({
    id: 'credentials',
    name: 'Mật khẩu',
    credentials: {
      identifier: { label: 'Tên đăng nhập hoặc email', type: 'text' },
      password: { label: 'Mật khẩu', type: 'password' },
    },
    async authorize(credentials, req) {
      if (!credentials?.identifier || !credentials?.password) return null;
      const fwd = req?.headers?.['x-forwarded-for'];
      const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || '';
      const user = await verifyWithIdentityService(
        credentials.identifier,
        credentials.password,
        ip
      );
      if (!user) return null;
      return {
        id: user.id,
        name: user.username,
        email: user.email,
        role: user.role,
        sessionVersion: user.sessionVersion,
      };
    },
  }),
];

// Nhà cung cấp bên thứ ba: chỉ thêm khi ĐÃ cấu hình đủ. next-auth vẫn dựng ra
// một provider khi thiếu biến — chỉ là nó không bao giờ đăng nhập được, và
// người dùng thấy một nút bấm không làm gì cả.
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  );
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: {
    // Trang đăng nhập của chính site, không phải trang mặc định của next-auth.
    signIn: '/login',
    error: '/login',
  },
  debug: process.env.NODE_ENV !== 'production',
  callbacks: {
    async jwt({ token, user }) {
      // `user` chỉ có mặt ở lần đăng nhập đầu; các lần sau token đã mang sẵn.
      if (user) {
        token.role = (user as { role?: string }).role;
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role =
          typeof token.role === 'string' ? token.role : undefined;
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: process.env.NEXTAUTH_COOKIE_NAME || 'next-auth.session-token',
      options: {
        // httpOnly PHẢI khai tường minh ở đây.
        //
        // next-auth gộp cấu hình cookie NÔNG, ở cấp tên cookie:
        //   cookies: { ...defaultCookies(secure), ...authOptions.cookies }
        // Khai `sessionToken` là thay thế TRỌN GÓI mặc định, kể cả
        // `httpOnly: true` nằm bên trong `options`. Trước dòng này, cookie phiên
        // của tsudev.com ĐỌC ĐƯỢC BẰNG JAVASCRIPT — nghĩa là bất kỳ lỗ XSS nào
        // cũng nâng cấp thành chiếm tài khoản.
        httpOnly: true,
        domain: process.env.NEXTAUTH_COOKIE_DOMAIN || process.env.COOKIE_DOMAIN || undefined,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};

export default NextAuth(authOptions);
