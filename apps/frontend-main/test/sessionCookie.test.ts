/**
 * Cookie phiên: hai phía PHẢI khai cùng một tên, và cả cây chỉ được đọc phiên
 * qua đúng một đường.
 *
 * Đây là bất biến đã bị vi phạm ở production và làm hỏng **toàn bộ** đường ghi
 * đã xác thực trong nhiều ngày - upload, ghi nội dung admin, toà soạn, mọi route
 * tài khoản, và các trang `/trust/*` đá cả VIP về `/login`.
 *
 * Cơ chế: `[...nextauth].ts` khai tên cookie tường minh để đặt được `domain`,
 * nên nó KHÔNG theo quy ước `__Secure-` mà next-auth tự thêm trên HTTPS.
 * `getToken()` thì đi theo quy ước đó. Ở dev (`http://`) hai bên trùng nhau;
 * ở production (`https://`) chúng lệch, `getToken` trả `null`, và mọi nơi gọi
 * hiểu đó là "chưa đăng nhập".
 *
 * ⚠️ Vì sao phải canh bằng test quét NGUỒN chứ không bằng test hành vi: lỗi này
 * **chỉ tồn tại trên HTTPS**. Bộ E2E chạy trên `http://localhost` nên 20 test
 * của nó xanh trong khi production hỏng hoàn toàn. Không có môi trường test nào
 * ở đây tái hiện được điều kiện đó, nên thứ duy nhất canh được là hình dạng của
 * mã nguồn.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { SESSION_COOKIE_NAME } from '../lib/sessionCookie';

const ROOT = join(__dirname, '..');
const SCAN = ['pages', 'lib'];
/** Đường DUY NHẤT được phép gọi `getToken`. */
const ALLOWED = join('lib', 'sessionCookie.ts');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });

const sourceFiles = SCAN.flatMap((d) => walk(join(ROOT, d)));

describe('cookie phiên - một tên, một đường đọc', () => {
  test('có quét được tệp nguồn (kẻo test tự nhiên xanh vì rỗng)', () => {
    expect(sourceFiles.length).toBeGreaterThan(10);
  });

  test('KHÔNG tệp nào gọi thẳng getToken ngoài lib/sessionCookie.ts', () => {
    const offenders = sourceFiles
      .filter((f) => !f.endsWith(ALLOWED))
      .filter((f) => /\bgetToken\s*\(/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(ROOT.length + 1));

    // Gọi thẳng nghĩa là để `getToken` tự suy ra tên cookie - đúng cái đã hỏng.
    expect(offenders).toEqual([]);
  });

  test('cấu hình NextAuth dùng chính hằng đó, không viết lại chuỗi', () => {
    const cfg = readFileSync(join(ROOT, 'pages/api/auth/[...nextauth].ts'), 'utf8');
    expect(cfg).toContain('SESSION_COOKIE_NAME');
    // Chuỗi trần ở đây nghĩa là hai phía lại có thể trôi xa nhau.
    const cookieBlock = cfg.slice(cfg.indexOf('cookies:'), cfg.indexOf('cookies:') + 400);
    expect(cookieBlock).not.toMatch(/name:\s*['"`]/);
  });

  test('tên cookie KHÔNG mang tiền tố __Secure-', () => {
    // Nếu một ngày đổi sang có tiền tố thì phải đổi ở hằng này, và lúc đó mọi
    // phiên đang mở bị đăng xuất một lần - phải là quyết định có ý thức.
    expect(SESSION_COOKIE_NAME).not.toMatch(/^__Secure-/);
    expect(SESSION_COOKIE_NAME).toBe('next-auth.session-token');
  });
});
