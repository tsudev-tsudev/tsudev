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
import { identityHeaders } from '../../../lib/identity';
import { SESSION_COOKIE_NAME } from '../../../lib/sessionCookie';

/**
 * Xác thực do codebase tự quản lý.
 *
 * KHÔNG CÒN PROVIDER `e2e-dev`. Nó nhận BẤT KỲ username nào với mật khẩu
 * `devpass`, và chỉ được gác sau một cờ môi trường bỏ qua xác thực. Ngày
 * 16/08/2026 bản production đã từng mang theo cờ đó - ai cũng đăng nhập được
 * vào tài khoản ADMIN, site vẫn chạy bình thường, không có gì báo lỗi. Một đường đăng nhập
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
 * kiểm nằm ở auth-service, và ràng buộc hạ tầng đó trùng với ranh giới đúng -
 * hash mật khẩu không nên đi qua tầng biên.
 */
async function verifyWithIdentityService(
  identifier: string,
  password: string,
  totp: string,
  ip: string
) {
  const res = await fetch(`${IDENTITY}/api/identity/verify-credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...internalHeaders(),
      // Giới hạn tần suất theo IP nằm ở auth-service; nó cần IP THẬT của người
      // dùng, không phải IP của tiến trình Next.
      ...(ip ? { 'x-forwarded-for': ip } : {}),
    },
    body: JSON.stringify({ identifier, password, totp }),
  });
  // Mã lỗi được TRẢ RA NGUYÊN VĂN cho tầng trên, không nuốt thành null: trang
  // /login cần phân biệt "sai mật khẩu" với "cần nhập mã 2FA" để biết hiện ô
  // nào. Đây là ranh giới duy nhất mà sự phân biệt đó an toàn - người gọi đã
  // qua được bước mật khẩu.
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body?.error === 'totp_required' || body?.error === 'totp_invalid') {
      throw new Error(body.error);
    }
    return null;
  }
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

/**
 * Provider passkey.
 *
 * Cũng là CredentialsProvider, nhưng "thông tin đăng nhập" ở đây là một chữ ký
 * WebAuthn đã được auth-service kiểm - không phải mật khẩu. Dùng lại cơ chế
 * credentials của next-auth để tránh dựng một luồng phiên thứ hai chạy song
 * song với luồng đã có.
 */
const passkeyProvider = CredentialsProvider({
  id: 'passkey',
  name: 'Passkey',
  credentials: {
    challengeId: { label: 'challengeId', type: 'text' },
    response: { label: 'response', type: 'text' },
  },
  async authorize(credentials) {
    if (!credentials?.challengeId || !credentials?.response) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(credentials.response);
    } catch {
      return null;
    }
    const res = await fetch(`${IDENTITY}/api/identity/passkey/login-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...internalHeaders() },
      body: JSON.stringify({ challengeId: credentials.challengeId, response: parsed }),
    });
    if (!res.ok) return null;
    const user = (await res.json()) as {
      id: string;
      username: string;
      email: string;
      role: string;
      sessionVersion: number;
    };
    return {
      id: user.id,
      name: user.username,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion,
    };
  },
});

const providers: Provider[] = [
  CredentialsProvider({
    id: 'credentials',
    name: 'Mật khẩu',
    credentials: {
      identifier: { label: 'Tên đăng nhập hoặc email', type: 'text' },
      password: { label: 'Mật khẩu', type: 'password' },
      totp: { label: 'Mã xác thực hai bước', type: 'text' },
    },
    async authorize(credentials, req) {
      if (!credentials?.identifier || !credentials?.password) return null;
      const fwd = req?.headers?.['x-forwarded-for'];
      const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || '';
      const user = await verifyWithIdentityService(
        credentials.identifier,
        credentials.password,
        credentials.totp || '',
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
  passkeyProvider,
];

// Nhà cung cấp bên thứ ba: chỉ thêm khi ĐÃ cấu hình đủ. next-auth vẫn dựng ra
// một provider khi thiếu biến - chỉ là nó không bao giờ đăng nhập được, và
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

/**
 * Vai trò hiện tại trong DB, cho callback `jwt` khi client gọi `update()`.
 *
 * Trả về null khi có bất kỳ trục trặc nào - token giữ nguyên giá trị cũ. Đó là
 * hướng an toàn: giá trị cũ luôn là vai trò THẤP HƠN hoặc bằng (vai trò chỉ
 * được nâng qua đường này), nên hỏng mạng dẫn tới ít quyền hơn chứ không nhiều
 * hơn. Ném lỗi ở đây thì người dùng bị đăng xuất.
 */
async function freshSessionState(
  token: import('next-auth/jwt').JWT
): Promise<{ role: string; sessionVersion: number } | null> {
  try {
    const res = await fetch(`${IDENTITY}/api/identity/session-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders(),
        ...(await identityHeaders(token)),
      },
      body: '{}',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { role?: unknown; sessionVersion?: unknown };
    if (typeof data.role !== 'string' || typeof data.sessionVersion !== 'number') return null;
    return { role: data.role, sessionVersion: data.sessionVersion };
  } catch {
    return null;
  }
}

/**
 * Đổi một danh tính OAuth (GitHub/Google) lấy User tsudev chính tắc.
 *
 * Chạy phía server (BFF trên Worker), gọi auth-service - nơi DUY NHẤT chạm
 * Postgres. Trả về null khi không liên kết được (không email, email đã thuộc
 * người khác, hoặc service lỗi); người gọi từ chối đăng nhập khi đó.
 */
async function upsertOAuthUser(
  provider: string,
  providerAccountId: string,
  data: { email: string | null; name: string | null; emailVerified: boolean }
): Promise<{
  id: string;
  username: string;
  email: string;
  role: string;
  sessionVersion: number;
} | null> {
  try {
    const res = await fetch(`${IDENTITY}/api/identity/oauth/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...internalHeaders() },
      body: JSON.stringify({
        provider,
        providerAccountId,
        email: data.email,
        name: data.name,
        emailVerified: data.emailVerified,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      id: string;
      username: string;
      email: string;
      role: string;
      sessionVersion: number;
    };
  } catch {
    return null;
  }
}

/** Email của bên thứ ba đã được họ xác minh chưa? Google nói rõ; GitHub luôn trả
 *  primary đã verified. */
function oauthEmailVerified(provider: string, profile: unknown): boolean {
  if (provider === 'google') {
    return (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
  }
  return provider === 'github';
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
    // OAuth: liên kết / tạo User tsudev TRƯỚC khi phát phiên. Credentials và
    // passkey đã tự resolve trong authorize() nên đi thẳng qua.
    async signIn({ user, account, profile }) {
      if (!account || account.provider === 'credentials' || account.provider === 'passkey') {
        return true;
      }
      if (account.provider === 'github' || account.provider === 'google') {
        const linked = await upsertOAuthUser(account.provider, account.providerAccountId, {
          email: user.email ?? null,
          name: user.name ?? null,
          emailVerified: oauthEmailVerified(account.provider, profile),
        });
        // Từ chối sạch: đẩy về /login với mã lỗi đã có thông điệp tiếng Việt.
        if (!linked) return '/login?error=OAuthAccountNotLinked';
        // Ghi danh tính CHÍNH TẮC vào `user` để callback jwt bên dưới đọc lại:
        // username thay cho tên hiển thị của bên thứ ba, kèm role + sessionVersion.
        user.id = linked.id;
        user.name = linked.username;
        user.email = linked.email;
        (user as { role?: string }).role = linked.role;
        (user as { sessionVersion?: number }).sessionVersion = linked.sessionVersion;
        return true;
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      // `user` chỉ có mặt ở lần đăng nhập đầu; các lần sau token đã mang sẵn.
      if (user) {
        token.role = (user as { role?: string }).role;
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 0;
        return token;
      }
      // Client gọi `update()` từ useSession. Vai trò đọc lại từ DB qua
      // auth-service - KHÔNG bao giờ từ tham số mà client truyền vào, vì tham
      // số đó là dữ liệu người dùng và token này là thứ quyết định họ là ai.
      //
      // Cần thiết vì `token.role` chỉ được ghi ở lần đăng nhập đầu: đổi mã mời
      // xong thì DB nói VIP còn phiên vẫn nói MEMBER, và điều hướng tiếp tục
      // giấu mục Con dấu - trông y hệt như đổi mã không có tác dụng.
      if (trigger === 'update') {
        const fresh = await freshSessionState(token);
        if (fresh) {
          token.role = fresh.role;
          token.sessionVersion = fresh.sessionVersion;
        }
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
      // Cùng hằng với mọi nơi đọc phiên. Khai lại chuỗi ở đây là mở đúng
      // khoảng cách đã làm hỏng toàn bộ đường ghi trên production - xem
      // lib/sessionCookie.ts.
      name: SESSION_COOKIE_NAME,
      options: {
        // httpOnly PHẢI khai tường minh ở đây.
        //
        // next-auth gộp cấu hình cookie NÔNG, ở cấp tên cookie:
        //   cookies: { ...defaultCookies(secure), ...authOptions.cookies }
        // Khai `sessionToken` là thay thế TRỌN GÓI mặc định, kể cả
        // `httpOnly: true` nằm bên trong `options`. Trước dòng này, cookie phiên
        // của tsudev.com ĐỌC ĐƯỢC BẰNG JAVASCRIPT - nghĩa là bất kỳ lỗ XSS nào
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
