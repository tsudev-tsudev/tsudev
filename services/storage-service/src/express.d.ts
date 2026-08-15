// Mở rộng Request của Express để mang người dùng đã xác thực.
//
// Trước đây `req.user` được gán tự do trong authMiddleware và đọc rải rác ở các
// route — không có gì bảo đảm hai bên hiểu giống nhau về hình dạng của nó. Khai
// một lần ở đây biến sự đồng thuận ngầm đó thành hợp đồng được kiểm.
//
// Ba service có ba bản gần trùng nhau của file này, cùng lý do với ba bản
// authMiddleware.js (xem CLAUDE.md). Cả hai nhóm được gộp ở pha siết bảo mật.
import type { JWTPayload } from 'jose'

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }

  /** Payload JWT của Keycloak, kèm các claim mà mã trong repo thực sự đọc tới. */
  type AuthenticatedUser = JWTPayload & {
    preferred_username?: string
    realm_access?: { roles?: string[] }
    resource_access?: Record<string, { roles?: string[] }>
    scope?: string
  }
}

export {}
