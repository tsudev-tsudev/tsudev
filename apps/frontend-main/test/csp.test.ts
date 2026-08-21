import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * CSP nay ĐƯỢC ÉP THẬT (không còn Report-Only) và dựa vào BĂM SHA-256 của
 * THEME_SCRIPT thay cho `'unsafe-inline'`. Chuỗi phải khớp qua ba mắt xích, mỗi
 * cái hỏng một kiểu im lặng:
 *
 *  1. `next.config.js` băm THEME_SCRIPT (đọc từ nguồn) và đưa vào `script-src`.
 *  2. `_document.tsx` là nơi THEME_SCRIPT sống - đúng nội dung đó được vẽ ra HTML.
 *  3. Không đâu còn `'unsafe-inline'` cho script, và không còn Report-Only.
 *
 * Nếu THEME_SCRIPT đổi mà băm không đổi theo (ai hard-code lại băm, hay regex
 * trích trong next.config vỡ), thì trên PRODUCTION script bị chặn: trang nháy
 * màu, không hydrate, và KHÔNG có gì đỏ ở CI. Test này chặn đúng chỗ đó: nó tự
 * băm THEME_SCRIPT bằng một đường độc lập rồi đối chứng với băm mà next.config
 * thật sự phát ra.
 *
 * Vì sao đo được ở đây mà không cần dựng server: `headers()` của next.config là
 * hàm thuần, gọi thẳng được. Đã nghiệm thu thêm bằng `next build && next start`:
 * trang tĩnh (/signup) lẫn động (/blog) cùng nhúng THEME_SCRIPT có băm khớp header.
 */

const DIR = join(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(DIR, ...p), 'utf8');

/** Băm THEME_SCRIPT bằng đường ĐỘC LẬP với next.config (đối chứng chéo). */
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

type HeaderKV = { key: string; value: string };

// `headers()` đọc NODE_ENV lúc GỌI (không phải lúc require), nên require một lần
// rồi đổi env trước mỗi lần gọi là đủ - không cần đụng require.cache.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require('../next.config.js');

/** Lấy mảng header của route `/:path*` từ next.config, ở một NODE_ENV cho trước. */
async function headersAt(env: string): Promise<HeaderKV[]> {
  const original = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = env;
  try {
    const groups = await nextConfig.headers();
    return groups[0].headers as HeaderKV[];
  } finally {
    (process.env as Record<string, string>).NODE_ENV = original as string;
  }
}

function scriptSrcOf(csp: string): string {
  const dir = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('script-src'));
  if (!dir) throw new Error(`CSP thiếu script-src: ${csp}`);
  return dir;
}

describe('CSP production: ép thật, băm THEME_SCRIPT, không unsafe-inline', () => {
  let csp: HeaderKV;

  beforeAll(async () => {
    const headers = await headersAt('production');
    const found = headers.find((h) => /^content-security-policy$/i.test(h.key));
    if (!found) throw new Error('production không phát Content-Security-Policy');
    csp = found;
  });

  test('là header ÉP THẬT, không phải Report-Only', () => {
    expect(csp.key).toBe('Content-Security-Policy');
  });

  test('script-src có self + đúng băm THEME_SCRIPT, KHÔNG unsafe-inline', () => {
    const dir = scriptSrcOf(csp.value);
    expect(dir).toContain("'self'");
    expect(dir).toContain(`'${independentThemeHash()}'`);
    expect(dir).not.toContain("'unsafe-inline'");
  });

  // Cloudflare Web Analytics chèn beacon ở tầng edge (không có trong HTML local),
  // nên phải allowlist thủ công - nếu không, ép CSP là chặn beacon trên prod.
  test('script-src allowlist beacon Cloudflare Web Analytics', () => {
    expect(scriptSrcOf(csp.value)).toContain('https://static.cloudflareinsights.com');
  });

  test('giữ các directive an toàn khác', () => {
    for (const d of [
      "default-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp.value).toContain(d);
    }
    // style-src và connect-src cố ý nới (Next/Tailwind + presign R2).
    expect(csp.value).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp.value).toContain("connect-src 'self' https:");
  });
});

describe('CSP không được ép ở dev (HMR cần eval/inline)', () => {
  test('dev KHÔNG phát bất kỳ header Content-Security-Policy nào', async () => {
    const headers = await headersAt('development');
    expect(headers.some((h) => /content-security-policy/i.test(h.key))).toBe(false);
  });
});
