import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload, JWTVerifyOptions } from 'jose';
import { URL } from 'url';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '@tsudev/db';
import type { User } from '@prisma/client';
import { hasAtLeastRole } from '@tsudev/types';
import type { Role } from '@tsudev/types';

export type { Role };

declare global {
  // Mở rộng interface của Express BẮT BUỘC dùng namespace — đó là hình dạng mà
  // @types/express khai. Không có cú pháp module ES2015 tương đương.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }

  /** Payload JWT của Keycloak, kèm các claim mà mã trong repo thực sự đọc tới. */
  type AuthenticatedUser = JWTPayload & {
    preferred_username?: string;
  };
}

const ISSUER =
  process.env.KEYCLOAK_ISSUER || 'http://auth.tsudev.localhost:8080/realms/tsudev-local';
const AUDIENCE = process.env.KEYCLOAK_CLIENT_ID || undefined;

const jwksUri = `${ISSUER}/protocol/openid-connect/certs`;
const JWKS = createRemoteJWKSet(new URL(jwksUri));

// Header có thể tới dưới dạng mảng khi client gửi trùng tên. Gộp về một chuỗi
// ngay tại cửa vào thay vì để `string | string[]` lan xuống dưới.
const firstHeader = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/**
 * Middleware xác thực JWT của Keycloak.
 *
 * `service` chỉ dùng cho tiền tố log — ba service trước đây có ba bản gần trùng
 * nhau mà khác biệt thật sự chỉ là chuỗi đó.
 */
export function createAuthMiddleware(service: string): RequestHandler {
  return async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
    // Đường tắt CHỈ dành cho phát triển: đặt AUTH_DEV_BYPASS=true rồi gửi
    // `x-dev-user`. Bật ở production nghĩa là ai cũng khai mình là ai cũng được.
    if (process.env.AUTH_DEV_BYPASS === 'true') {
      try {
        const devUser = req.get('x-dev-user') || firstHeader(req.headers['x-dev-user']);
        const user = devUser || process.env.DEV_DEFAULT_USER || 'dev';
        req.user = { sub: user, preferred_username: user };
        return next();
      } catch (e) {
        /* header dev hỏng — rơi xuống nhánh xác thực thật bên dưới */
      }
    }
    try {
      const authHeader = req.get('authorization') || firstHeader(req.headers.authorization);
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }
      const token = authHeader.slice(7);
      // Khai kiểu ngay lúc dựng: gán `audience` vào một object literal chưa khai
      // trường đó là lỗi biên dịch, và nó quyết định token của client khác có
      // được nhận hay không.
      const verifyOpts: JWTVerifyOptions = { issuer: ISSUER };
      if (AUDIENCE) verifyOpts.audience = AUDIENCE;

      const { payload } = await jwtVerify(token, JWKS, verifyOpts);
      req.user = payload as AuthenticatedUser;
      return next();
    } catch (err) {
      try {
        console.error(`[${service}] auth middleware error`, err instanceof Error ? err.stack : err);
      } catch (e) {
        /* console cũng hỏng thì cũng không làm gì hơn được */
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

/**
 * Tài khoản trong DB tương ứng với người gọi, TẠO NẾU CHƯA CÓ.
 *
 * Upsert chứ không phải findUnique: người dùng đã qua được Keycloak là người
 * thật, và để họ nhận 401 chỉ vì service chưa từng thấy họ là sai. Vai trò mặc
 * định là MEMBER — mức thấp nhất có danh tính, không phải mức có đặc quyền.
 */
export async function resolveUser(req: Request): Promise<User | null> {
  const username = req.user?.preferred_username || req.user?.sub;
  if (!username) return null;
  return prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      email: `${username}@tsudev.local`,
      displayName: username,
      role: 'MEMBER',
    },
  });
}

/** Chỉ tra cứu, KHÔNG tạo. Dùng cho đường ghi nhạy cảm của trang quản trị. */
export async function lookupUser(req: Request): Promise<User | null> {
  const username = req.user?.preferred_username || req.user?.sub;
  if (!username) return null;
  return prisma.user.findUnique({ where: { username } });
}

/**
 * Chặn route nếu người gọi chưa đạt vai trò tối thiểu.
 *
 * FAIL CLOSED, và không có biến môi trường nào tắt được. Bản trước gác sau
 * `REQUIRE_ROLE_ENFORCEMENT` mặc định TẮT, nghĩa là mọi route "được bảo vệ" đều
 * mở ở mọi môi trường — trong khi mã nguồn đọc vào thì trông như đã có bảo vệ.
 *
 * `role` là union `Role` (từ @tsudev/types) chứ không phải string tự do: gõ sai
 * là lỗi biên dịch, không phải một cổng lặng lẽ cho qua.
 */
export function requireRole(role: Role): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await resolveUser(req);
      if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' });
      if (!hasAtLeastRole(user.role, role)) {
        return res.status(403).json({ error: `Yêu cầu vai trò tối thiểu: ${role}` });
      }
      return next();
    } catch (e) {
      // Lỗi DB không được biến thành "cho qua".
      console.error('[auth] requireRole lỗi:', e instanceof Error ? e.message : e);
      return res.status(503).json({ error: 'Không kiểm tra được quyền' });
    }
  };
}
