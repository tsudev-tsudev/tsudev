import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import { NextRequest } from 'next/server';

// middleware đọc NODE_ENV lúc GỌI, nên require một lần rồi đổi env trước mỗi lần
// gọi là đủ (không cần require lại/xoá cache).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { proxy: middleware } = require('../proxy') as {
  proxy: (r: NextRequest) => Response;
};

/**
 * CSP ép thật (không Report-Only) đặt ở `proxy.ts` (trước 27/08/2026 là `middleware.ts`), kết hợp BĂM + NONCE:
 *
 *  - THEME_SCRIPT (inline, cố định) → phủ bằng BĂM SHA-256. Băm đúng trên cả
 *    trang prerender TĨNH (nonce thì không - HTML tĩnh không mang được nonce lượt
 *    tải).
 *  - Script JSD của Cloudflare Bot Fight Mode (chèn ở edge, tham số đổi mỗi
 *    request) → phủ bằng NONCE mà Cloudflare tự đọc từ CSP response header và gắn.
 *
 * Mỗi mắt xích hỏng một kiểu im lặng, nên test này gọi THẲNG middleware và soi
 * header (không chỉ đọc mã 200):
 *   1. Băm trong middleware phải KHỚP THEME_SCRIPT thật (drift-guard tính lại từ
 *      nguồn `_document.tsx` - middleware chạy Edge, không đọc file được nên băm
 *      hard-code, dễ trôi lệch).
 *   2. Có nonce, đổi mỗi request (nonce hằng = vô nghĩa, và CF cần nó tươi).
 *   3. Không `'unsafe-inline'`, không Report-Only.
 *   4. Dev KHÔNG ép CSP (HMR cần eval/inline).
 */

const DIR = join(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(DIR, ...p), 'utf8');

/** Băm THEME_SCRIPT bằng đường ĐỘC LẬP với middleware (đối chứng chéo). */
function independentThemeHash(): string {
  const src = read('pages', '_document.tsx');
  const hex = (name: string): string => {
    const m = src.match(new RegExp(`const ${name} = '([^']+)'`));
    if (!m) throw new Error(`_document.tsx thiếu ${name}`);
    return m[1] as string;
  };
  const tpl = src.match(/const THEME_SCRIPT = `([\s\S]*?)`;/);
  if (!tpl) throw new Error('_document.tsx thiếu THEME_SCRIPT');
  const body = (tpl[1] as string)
    .replace(/\$\{LIGHT_BASE\}/g, hex('LIGHT_BASE'))
    .replace(/\$\{WARM_BASE\}/g, hex('WARM_BASE'))
    .replace(/\$\{DARK_BASE\}/g, hex('DARK_BASE'));
  return `sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`;
}

function scriptSrcOf(csp: string): string {
  const dir = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('script-src'));
  if (!dir) throw new Error(`CSP thiếu script-src: ${csp}`);
  return dir;
}

const NONCE_RE = /'nonce-([A-Za-z0-9+/_-]+={0,2})'/;

describe('middleware ép CSP (băm + nonce) ở production', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;
  const ORIGINAL_URL = process.env.NEXTAUTH_URL;

  beforeAll(() => {
    // middleware đọc NODE_ENV + NEXTAUTH_URL lúc GỌI, nên đặt ở đây là đủ để đi
    // vào nhánh production với host chính tắc (không redirect).
    (process.env as Record<string, string>).NODE_ENV = 'production';
    process.env.NEXTAUTH_URL = 'https://tsudev.com';
  });

  afterAll(() => {
    (process.env as Record<string, string>).NODE_ENV = ORIGINAL_ENV as string;
    if (ORIGINAL_URL === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = ORIGINAL_URL;
  });

  function callOnCanonicalHost(): Response {
    const req = new NextRequest('https://tsudev.com/login', {
      headers: { host: 'tsudev.com', accept: 'text/html' },
    });
    return middleware(req);
  }

  function cspOf(res: Response): string {
    const csp = res.headers.get('content-security-policy');
    if (!csp) throw new Error('phản hồi thiếu Content-Security-Policy');
    return csp;
  }

  test('CSP ép thật, KHÔNG phải Report-Only', () => {
    const res = callOnCanonicalHost();
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('content-security-policy-report-only')).toBeNull();
  });

  test('script-src có self + BĂM THEME_SCRIPT khớp nguồn + nonce + beacon CF, KHÔNG unsafe-inline', () => {
    const dir = scriptSrcOf(cspOf(callOnCanonicalHost()));
    expect(dir).toContain("'self'");
    expect(dir).toContain(`'${independentThemeHash()}'`);
    expect(dir).toMatch(NONCE_RE);
    expect(dir).toContain('https://static.cloudflareinsights.com');
    expect(dir).not.toContain("'unsafe-inline'");
  });

  test('băm hard-code trong proxy.ts khớp THEME_SCRIPT (drift-guard)', () => {
    expect(read('proxy.ts')).toContain(independentThemeHash());
  });

  test('nonce đổi mỗi request', () => {
    const a = (cspOf(callOnCanonicalHost()).match(NONCE_RE) as RegExpMatchArray)[1];
    const b = (cspOf(callOnCanonicalHost()).match(NONCE_RE) as RegExpMatchArray)[1];
    expect(a).not.toBe(b);
  });

  test('giữ các directive an toàn khác', () => {
    const csp = cspOf(callOnCanonicalHost());
    for (const d of [
      "default-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https:",
    ]) {
      expect(csp).toContain(d);
    }
  });

  test('bí danh trong tên miền vẫn 308 (redirect không kèm CSP)', () => {
    const req = new NextRequest('https://www.tsudev.com/login', {
      headers: { host: 'www.tsudev.com', accept: 'text/html' },
    });
    const res = middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get('content-security-policy')).toBeNull();
  });
});

describe('CSP không được ép ở dev (HMR cần eval/inline)', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;

  afterAll(() => {
    (process.env as Record<string, string>).NODE_ENV = ORIGINAL_ENV as string;
  });

  test('dev: middleware KHÔNG đặt Content-Security-Policy', () => {
    (process.env as Record<string, string>).NODE_ENV = 'development';
    // Dev không cấu hình cookie-domain ⇒ pass-through trần, không CSP.
    const prevCookie = process.env.NEXTAUTH_COOKIE_DOMAIN;
    delete process.env.NEXTAUTH_COOKIE_DOMAIN;
    const res = middleware(
      new NextRequest('http://tsudev.localhost/login', { headers: { accept: 'text/html' } })
    );
    if (prevCookie !== undefined) process.env.NEXTAUTH_COOKIE_DOMAIN = prevCookie;
    expect(res.headers.get('content-security-policy')).toBeNull();
  });
});

describe('next.config.js không còn tự đặt CSP', () => {
  test('không có key Content-Security-Policy trong next.config', () => {
    const cfg = read('next.config.js');
    expect(cfg).not.toMatch(/key:\s*['"]Content-Security-Policy/);
  });
});
