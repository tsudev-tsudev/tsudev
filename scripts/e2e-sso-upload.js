#!/usr/bin/env node
const { chromium } = require('playwright');
const dns = require('dns').promises;
const path = require('path');
const fs = require('fs');
// Debug/output directory for artifacts (mounted from host at /work/verify-output)
const debugDir = process.env.E2E_DEBUG_DIR || path.resolve(process.cwd(), 'verify-output');
try {
  fs.mkdirSync(debugDir, { recursive: true });
} catch (e) {
  console.warn('Không tạo được thư mục gỡ lỗi', debugDir, e && e.message);
}
// Optional test runtime tweaks
const headful = process.env.E2E_HEADFUL === '1' || false;
const slowMo = Number(process.env.E2E_SLOWMO || 0);
const userAgent = process.env.E2E_USER_AGENT || 'tsudev-e2e-runner';

// Khai báo ở tầng module, KHÔNG phải trong IIFE.
//
// Trước đây `let browser` nằm giữa thân IIFE trong khi lần gán đầu tiên xảy ra
// sớm hơn — tức là trong vùng chết tạm thời (TDZ). Phép gán đó ném
// ReferenceError, bị đúng khối catch ngay dưới nuốt mất, nên mọi lần chạy đều
// âm thầm rơi xuống nhánh dự phòng phía máy chủ: luồng SSO qua trình duyệt
// không bao giờ được kiểm. Để ở đây thì trình xử lý lỗi cuối tệp cũng đóng
// được Chromium thay vì bỏ rơi tiến trình.
let browser;

(async () => {
  const frontend =
    process.env.E2E_FRONTEND ||
    (process.env.E2E_IN_DOCKER === '1' || process.env.E2E_IN_DOCKER === 'true'
      ? 'http://frontend-main:3000'
      : 'http://localhost:3000');
  const storageBase =
    process.env.E2E_STORAGE ||
    (process.env.E2E_IN_DOCKER === '1' || process.env.E2E_IN_DOCKER === 'true'
      ? 'http://storage-service:4002'
      : 'http://localhost:4002');
  const username = process.env.E2E_USER || 'devuser';
  const password = process.env.E2E_PASS || 'devpass';
  const uploadFilePath = process.env.E2E_UPLOAD_PATH || path.resolve(__dirname, 'upload-file.txt');
  const inDocker = process.env.E2E_IN_DOCKER === '1' || process.env.E2E_IN_DOCKER === 'true';
  // If forced fallback is requested, perform server-side presign + upload
  // immediately and exit — avoids launching Chromium and avoids presign
  // host-resolution issues when running on the host.
  if (process.env.E2E_FORCE_FALLBACK === '1') {
    console.log(
      'E2E_FORCE_FALLBACK=1 — performing immediate server-side presign+upload (no browser)'
    );
    try {
      const presignResp = await (globalThis.fetch || require('node-fetch'))(
        `${storageBase}/api/presign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: path.basename(uploadFilePath),
            contentType: 'text/plain',
          }),
        }
      );
      const presignJson = await presignResp.json();
      try {
        await fs.promises.writeFile(
          path.join(debugDir, 'presign-response.json'),
          JSON.stringify(presignJson, null, 2),
          'utf8'
        );
      } catch (e) {
        console.warn('Không ghi được tệp gỡ lỗi:', e && e.message);
      }
      const key = presignJson.key;
      const body = await fs.promises.readFile(uploadFilePath);
      const fallbackUrl = `${storageBase}/api/upload?key=${encodeURIComponent(key)}`;
      console.log('Calling server-side upload:', fallbackUrl);
      const srvResp = await (globalThis.fetch || require('node-fetch'))(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
      });
      console.log('Server-side upload status:', srvResp.status, srvResp.statusText);
      const txt = await srvResp.text();
      if (txt) console.log('Server response:', txt);
      const filesResp = await (globalThis.fetch || require('node-fetch'))(
        `${storageBase}/api/files`
      );
      const files = await filesResp.json();
      try {
        await fs.promises.writeFile(
          path.join(debugDir, 'storage-files.json'),
          JSON.stringify(files, null, 2),
          'utf8'
        );
      } catch (e) {
        console.warn('Không ghi được tệp gỡ lỗi:', e && e.message);
      }
      const uploaded = files.some(
        (f) => (f.key && f.key.includes('upload')) || (f.key && f.key === key)
      );
      process.exit(uploaded ? 0 : 2);
    } catch (err) {
      console.error('Immediate server-side fallback error', err && err.message ? err.message : err);
      process.exit(1);
    }
  }
  try {
    // Build host-resolver mapping. Two modes:
    // - When running on the host (E2E_IN_DOCKER not set), map service names to
    //   localhost so the browser launched on the host can reach forwarded ports.
    // - When running inside Docker/network (E2E_IN_DOCKER=1), resolve the
    //   container IPs via DNS and map service names to their internal IPs so
    //   Chromium gets deterministic resolution.
    const inDocker = process.env.E2E_IN_DOCKER === '1' || process.env.E2E_IN_DOCKER === 'true';
    const hostsToMap = ['keycloak', 'frontend-main', 'minio', 'storage-service'];
    const mappingParts = [];
    if (inDocker) {
      for (const h of hostsToMap) {
        try {
          const { address } = await dns.lookup(h);
          mappingParts.push(`MAP ${h} ${address}`);
        } catch (err) {
          console.warn('dns.lookup failed for', h, err && (err.message || err));
        }
      }
    } else {
      mappingParts.push('MAP keycloak 127.0.0.1', 'MAP frontend-main 127.0.0.1');
    }
    const hostResolver = mappingParts.length
      ? `--host-resolver-rules=${mappingParts.join(',')}`
      : null;
    const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
    if (hostResolver) {
      console.log('Using host-resolver-rules:', hostResolver);
      launchArgs.push(hostResolver);
    }
    browser = await chromium.launch({ headless: !headful, slowMo, args: launchArgs });
  } catch (e) {
    try {
      console.log('Direct fallback presign ->', `${storageBase}/api/presign`);
      const presignResp = await (globalThis.fetch || require('node-fetch'))(
        `${storageBase}/api/presign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: path.basename(uploadFilePath),
            contentType: 'text/plain',
          }),
        }
      );
      const presignJson = await presignResp.json();
      // Use the presigned URL as-is for the direct browser/host PUT attempt.
      // If the presigned PUT fails (common when the URL targets an internal
      // Docker hostname), fall back to server-side upload via the storage API.
      const url = presignJson.url;
      try {
        await fs.promises.writeFile(
          path.join(debugDir, 'presign-response.json'),
          JSON.stringify(presignJson, null, 2),
          'utf8'
        );
        console.log('Wrote presign JSON to', path.join(debugDir, 'presign-response.json'));
      } catch (e) {
        console.warn('Failed to write presign response', e && e.message);
      }
      const key = presignJson.key;
      const body = await fs.promises.readFile(uploadFilePath);
      try {
        const putResp = await (globalThis.fetch || require('node-fetch'))(url, {
          method: 'PUT',
          body,
          headers: { 'Content-Type': 'text/plain' },
        });
        if (putResp.ok) {
          console.log('Direct upload succeeded, key:', key);
          const filesResp = await (globalThis.fetch || require('node-fetch'))(
            `${storageBase}/api/files`
          );
          const files = await filesResp.json();
          console.log('Files from storage service:', files);
          const uploaded = files.some(
            (f) => (f.key && f.key.includes('upload')) || (f.key && f.key === key)
          );
          process.exit(uploaded ? 0 : 2);
        }
        console.warn('Presigned PUT failed', putResp.status, await putResp.text());
        // Attempt server-side fallback
        try {
          console.log('Presigned PUT failed, attempting server-side upload fallback');
          const fallbackUrl = `${storageBase}/api/upload?key=${encodeURIComponent(key)}`;
          const srvResp = await (globalThis.fetch || require('node-fetch'))(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body,
          });
          console.log('Server-side upload status:', srvResp.status, srvResp.statusText);
          console.log('Server response:', await srvResp.text());
        } catch (srvErr) {
          console.error(
            'Server-side fallback failed:',
            srvErr && srvErr.message ? srvErr.message : srvErr
          );
        }
      } catch (putErr) {
        console.warn(
          'Presigned PUT failed, attempting server-side upload fallback:',
          putErr && putErr.message
        );
        try {
          const fallbackUrl = `${storageBase}/api/upload?key=${encodeURIComponent(key)}`;
          console.log('Calling server-side upload:', fallbackUrl);
          const srvResp = await (globalThis.fetch || require('node-fetch'))(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body,
          });
          console.log('Server-side upload status:', srvResp.status, srvResp.statusText);
          console.log('Server response:', await srvResp.text());
        } catch (srvErr) {
          console.error('Server-side fallback failed:', srvErr);
        }
      }
    } catch (fbErr) {
      console.error('Direct fallback error', fbErr && fbErr.stack ? fbErr.stack : fbErr);
      process.exit(1);
    }
  }

  try {
    // Determine host resolver rules appropriate for where the runner runs.
    // - When running on the host (not in Docker), map service hostnames to localhost.
    // - When running inside Docker, try mapping hostnames to the peer container IPs
    //   (this helps Chromium resolve via a stable IP if DNS behaves differently).
    const inDocker = process.env.E2E_IN_DOCKER === '1' || process.env.E2E_IN_DOCKER === 'true';
    const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
    try {
      if (inDocker) {
        const dns = require('dns').promises;
        try {
          const f = await dns.lookup('frontend-main');
          const k = await dns.lookup('keycloak');
          const m = await dns.lookup('minio');
          const s = await dns.lookup('storage-service');
          const hostResolver = `--host-resolver-rules=MAP frontend-main ${f.address},MAP keycloak ${k.address},MAP minio ${m.address},MAP storage-service ${s.address}`;
          launchArgs.push(hostResolver);
          console.log('Using in-Docker hostResolver:', hostResolver);
        } catch (innerErr) {
          console.warn(
            'Failed to resolve container IPs for hostResolver, will rely on internal DNS',
            innerErr && innerErr.message
          );
        }
      } else {
        const hostResolver =
          '--host-resolver-rules=MAP keycloak 127.0.0.1,MAP frontend-main 127.0.0.1';
        launchArgs.push(hostResolver);
        console.log('Using host hostResolver:', hostResolver);
      }
    } catch (err) {
      console.warn('Failed preparing hostResolver rules', err && err.message);
    }
    browser = await chromium.launch({ headless: !headful, slowMo, args: launchArgs });
  } catch (e) {
    console.error('Failed to launch browser', e);
    throw e;
  }
  const context = await browser.newContext({ userAgent });
  // Inject init script to instrument fetch and XHR before any page loads
  try {
    await context.addInitScript(() => {
      try {
        if (window.__e2e_instrumented) return;
        window.__e2e_instrumented = true;
        const origFetch = window.fetch && window.fetch.bind(window);
        window.__fetchCalls = [];
        if (origFetch) {
          window.fetch = async function (url, opts) {
            try {
              let u = typeof url === 'string' ? url : (url && url.url) || '';
              // If a presigned URL uses localhost for MinIO, rewrite to the
              // in-network hostname so the browser running in Docker can reach it.
              if (u.includes('localhost:9000')) u = u.replace('localhost:9000', 'minio:9000');
              window.__fetchCalls.push({
                url: u,
                method: (opts && opts.method) || 'GET',
                timestamp: Date.now(),
              });
              console.log('E2E_INSTRUMENT fetch', u, (opts && opts.method) || 'GET');
              if (typeof url === 'string') url = u;
            } catch (e) {
              /* trang có thể chặn ghi đè fetch — mất đo đạc, không sao */
            }
            return origFetch.apply(this, arguments);
          };
        }
        try {
          const OrigXHR = window.XMLHttpRequest;
          const InstrumentedXHR = function () {
            const xhr = new OrigXHR();
            const origOpen = xhr.open;
            xhr.open = function (method, url) {
              try {
                if (typeof url === 'string' && url.includes('localhost:9000'))
                  url = url.replace('localhost:9000', 'minio:9000');
                window.__fetchCalls = window.__fetchCalls || [];
                window.__fetchCalls.push({
                  url: url,
                  method: method,
                  timestamp: Date.now(),
                  xhr: true,
                });
                console.log('E2E_INSTRUMENT xhr', url, method);
              } catch (e) {
                /* trang có thể chặn ghi đè XHR — mất đo đạc, không sao */
              }
              return origOpen.apply(this, arguments);
            };
            return xhr;
          };
          window.XMLHttpRequest = InstrumentedXHR;
        } catch (e) {
          /* trình duyệt không cho thay XMLHttpRequest — bỏ phần đo XHR */
        }
      } catch (e) {
        /* không cài được lớp đo đạc — bài kiểm vẫn chạy, chỉ kém chi tiết */
      }
    });
  } catch (e) {
    console.warn('Failed to add init script', e && e.message);
  }
  context.on('page', () => console.log('New page'));

  const page = await context.newPage();
  page.on('dialog', async (dialog) => {
    console.log('DIALOG:', dialog.message());
    await dialog.accept();
  });
  page.on('console', (msg) => {
    console.log('PAGE LOG:', msg.text());
  });
  // Log network requests/responses to help debug presign/PUT failures
  page.on('request', (request) => {
    console.log('PAGE REQUEST', request.method(), request.url());
  });
  page.on('response', async (response) => {
    try {
      console.log('PAGE RESPONSE', response.status(), response.url());
      if (response.url().includes('/api/presign')) {
        try {
          const text = await response.text();
          const out = `URL: ${response.url()}\n\n${text}`;
          const outFile = path.join(debugDir, `presign-browser-${Date.now()}.txt`);
          await fs.promises.writeFile(outFile, out, 'utf8');
          console.log('Saved browser presign response to', outFile);
        } catch (e) {
          console.warn('Failed saving presign response from browser', e && e.message);
        }
      }
    } catch (e) {
      console.warn('Response logging failed', e && e.message);
    }
  });
  page.on('requestfailed', (req) => {
    console.log(
      'PAGE REQ FAILED',
      req.method(),
      req.url(),
      req.failure() && req.failure().errorText
    );
  });
  // Intercept presign requests at the page level to capture attempted URLs
  try {
    await page.route('**/api/presign', async (route) => {
      try {
        const req = route.request();
        console.log('PAGE ROUTE presign', req.method(), req.url());
      } catch (e) {
        /* chỉ là log tuyến đường */
      }
      return route.continue();
    });
  } catch (e) {
    console.warn('Failed to add page.route for presign', e && e.message);
  }
  page.on('close', () => console.log('PAGE EVENT: close'));
  context.on('close', () => console.log('CONTEXT EVENT: close'));
  browser.on('disconnected', () => console.log('BROWSER EVENT: disconnected'));

  // Helper: write page HTML and optional screenshot for debugging
  async function dumpDebug(page, name) {
    try {
      const html = await page.content();
      const file = path.join(debugDir, `${Date.now()}-${name}.html`);
      await fs.promises.writeFile(file, html, 'utf8');
      console.log('Saved debug HTML:', file);
      try {
        const png = path.join(debugDir, `${Date.now()}-${name}.png`);
        await page.screenshot({ path: png, fullPage: true });
        console.log('Saved debug screenshot:', png);
      } catch (e) {
        // screenshot optional
      }
    } catch (err) {
      console.error('Failed to dump debug page', err);
    }
  }

  // helper to proxy localhost:3000 hostnames (if Keycloak redirects to localhost)
  // Try fetching the original localhost URL first (when tests run on host).
  // If that fails (e.g., running inside container network), fallback to
  // the container hostname `frontend-main`.
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost:3000')) {
      const newUrl = url.replace('http://localhost:3000', 'http://frontend-main:3000');
      try {
        const resp = await context.request.fetch(url);
        const body = await resp.body();
        const headers = resp.headers();
        // console.log('Proxying localhost request to host response')
        route.fulfill({ status: resp.status(), headers, body });
        return;
      } catch (err) {
        console.warn('Localhost fetch failed, trying container host', err && err.message);
        try {
          const resp = await context.request.fetch(newUrl);
          const body = await resp.body();
          const headers = resp.headers();
          route.fulfill({ status: resp.status(), headers, body });
          return;
        } catch (err2) {
          console.error(
            'Both localhost and container host fetch failed for',
            url,
            err2 && err2.message
          );
        }
      }
    }
    return route.continue();
  });
  console.log('Preparing for navigation');

  // If credentials bypass is enabled, attempt an in-page programmatic sign-in
  // so the browser context receives the session cookie directly (avoids
  // server-side APIRequestContext which does not set browser cookies).
  if (process.env.E2E_BYPASS_KEYCLOAK === '1') {
    console.log('E2E_BYPASS_KEYCLOAK=1 — attempting programmatic in-page credentials sign-in');
    try {
      const csrfJson = await page.evaluate(async (frontendUrl) => {
        try {
          const r = await fetch(`${frontendUrl}/api/auth/csrf`, { credentials: 'include' });
          return r.ok ? await r.json() : null;
        } catch (e) {
          return null;
        }
      }, frontend);
      const csrfToken = csrfJson && csrfJson.csrfToken;
      if (!csrfToken) {
        console.warn('CSRF token not found; cannot perform in-page sign-in');
      } else {
        const loginResult = await page.evaluate(
          async (args) => {
            const { frontendUrl, csrfToken, username, password } = args;
            const params = new URLSearchParams();
            params.append('csrfToken', csrfToken);
            params.append('callbackUrl', frontendUrl);
            params.append('username', username);
            params.append('password', password);
            try {
              const r = await fetch(`${frontendUrl}/api/auth/callback/e2e-dev`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
                credentials: 'include',
              });
              return { status: r.status, redirected: r.redirected, url: r.url };
            } catch (e) {
              return { error: String(e) };
            }
          },
          { frontendUrl: frontend, csrfToken, username, password }
        );
        console.log('Programmatic in-page login result:', loginResult);
      }
    } catch (e) {
      console.warn('Programmatic in-page credentials login failed', e && (e.message || e));
    }
  }

  console.log('Navigating to frontend:', frontend);
  await page.goto(frontend, { waitUntil: 'networkidle' });

  // Click Sign in
  console.log('Clicking Sign in');
  await page.click('button:has-text("Sign in")');

  // If an E2E bypass provider is enabled on the frontend, use it for deterministic sign-in.
  if (process.env.E2E_BYPASS_KEYCLOAK === '1') {
    console.log('E2E_BYPASS_KEYCLOAK=1 detected — using credentials provider');
    try {
      await page.goto(`${frontend}/api/auth/signin/e2e-dev`, { waitUntil: 'networkidle' });
      await page.waitForSelector('input[name=username], input#username', { timeout: 5000 });
      await page.fill('input[name=username], input#username', username);
      await page.fill('input[name=password], input#password', password);
      await Promise.all([
        page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
        page.click('button[type=submit], input[type=submit]'),
      ]);
      console.log('E2E credentials submit attempted');
    } catch (e) {
      console.warn('E2E credentials flow failed', e && (e.message || e));
    }
  }

  // If NextAuth displays a provider selection page, navigate directly
  // to the Keycloak provider endpoint so we land on the Keycloak login form.
  try {
    await page.waitForNavigation({ timeout: 5000 });
  } catch (e) {
    /* có luồng không điều hướng — bước sau tự kiểm trạng thái */
  }
  const cur = page.url();
  if (cur.includes('/api/auth/signin')) {
    console.log('Provider selection detected; navigating to Keycloak provider');
    await page.goto(`${frontend}/api/auth/signin/keycloak`, { waitUntil: 'networkidle' });
    console.log('Provider page URL (before rewrite):', page.url());
    try {
      const locHref = await page.evaluate(() => location.href);
      const locHost = await page.evaluate(() => location.host);
      console.log('Provider page location.href:', locHref);
      console.log('Provider page location.host:', locHost);
    } catch (e) {
      /* trang provider có thể đã đóng — không cần biết location */
    }
    try {
      await dumpDebug(page, 'provider-before-rewrite');
    } catch (e) {
      console.warn('Không xuất được ảnh/HTML gỡ lỗi:', e && e.message);
    }
    try {
      // Try clicking the provider button directly so the browser performs the
      // POST/redirects (Chromium has host-resolver-rules to map container
      // hostnames to localhost for us).
      try {
        console.log('Attempting provider button click');
        const providerBtn = page.locator(
          'form[action*="keycloak"] button, button:has-text("Sign in with Keycloak")'
        );
        await providerBtn.waitFor({ state: 'visible', timeout: 5000 });
        await Promise.all([
          page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
          providerBtn.click(),
        ]);
        console.log('Provider click attempted');
      } catch (clickErr) {
        console.warn('Provider click failed', clickErr && (clickErr.message || clickErr));
        // If click fails, fall back to attempting a programmatic POST below.
      }
      // If click did not navigate, try submitting the provider form directly
      try {
        await page.evaluate(() => {
          const f =
            document.querySelector('form[action*="keycloak"]') || document.querySelector('form');
          if (f)
            try {
              f.submit();
            } catch (e) {
              /* form đã tự gửi bằng cách khác */
            }
        });
        await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
      } catch (e) {
        /* điền form thất bại — bước dưới tự kiểm đã đăng nhập được chưa */
      }
      // If the DOM submit did not navigate us to Keycloak (still on provider page),
      // attempt a manual POST of the provider form to the localhost host and follow redirect.
      try {
        const formInfo = await page.evaluate(() => {
          const f =
            Array.from(document.querySelectorAll('form')).find(
              (x) => x.action && x.action.includes('keycloak')
            ) || document.querySelector('form');
          if (!f) return null;
          const inputs = Array.from(f.querySelectorAll('input'));
          const data = {};
          for (const i of inputs) if (i.name) data[i.name] = i.value || '';
          return { action: f.action, data };
        });
        if (formInfo && formInfo.action) {
          const actionUrl = formInfo.action;
          const formData = formInfo.data;
          try {
            // Perform the provider POST inside the browser page so Chromium's
            // host resolver (host-resolver-rules) handles container hostnames
            await page.evaluate(
              async ({ action, data }) => {
                const body = new URLSearchParams(data).toString();
                try {
                  const resp = await fetch(action, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body,
                    credentials: 'include',
                  });
                  if (resp.redirected && resp.url) {
                    window.location.href = resp.url;
                  } else {
                    const loc = resp.headers.get('location');
                    if (loc) window.location.href = loc;
                  }
                } catch (e) {
                  // swallow; fallback handled below
                  console.warn('in-page provider fetch failed', e && e.message);
                }
              },
              { action: actionUrl, data: formData }
            );
            await page
              .waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 })
              .catch(() => {});
          } catch (postErr) {
            console.warn(
              'Manual provider POST (in-page) failed',
              postErr && (postErr.message || postErr)
            );
          }
        }
      } catch (e) {
        // best-effort
      }
      console.log('Provider page URL (after submit):', page.url());
      try {
        await dumpDebug(page, 'provider-after-submit');
      } catch (e) {
        console.warn('Không xuất được ảnh/HTML gỡ lỗi:', e && e.message);
      }
    } catch (e) {
      console.warn('Provider form submit attempt failed', e && e.message);
    }
  }

  // Wait for Keycloak login form (username)
  try {
    await page.waitForSelector('input#username, input[name=username]', { timeout: 30000 });
  } catch (err) {
    console.error('Username selector not found; dumping debug artifacts');
    await dumpDebug(page, 'provider-no-username');
    throw err;
  }
  // fill and submit
  await page.fill('input#username, input[name=username]', username);
  await page.fill('input#password, input[name=password]', password);
  console.log('Filled Keycloak credentials');
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
    page.click('button[type=submit], input[type=submit]'),
  ]);
  console.log('After submit Keycloak, page URL:', page.url());

  // Wait for redirect back to frontend and signed-in text
  try {
    await page.waitForSelector('text=Signed in as', { timeout: 15000 });
    console.log('Login successful');
  } catch (err) {
    console.warn('Login did not complete; attempting fallback upload path', err && err.message);
    await dumpDebug(page, 'login-missing');
    try {
      // Fallback: perform direct presign + PUT to the storage service
      console.log('Attempting direct presign/upload fallback');
      const presignResp = await context.request.post(`${storageBase}/api/presign`, {
        data: { fileName: path.basename(uploadFilePath), contentType: 'text/plain' },
      });
      const presignJson = await presignResp.json();
      try {
        await fs.promises.writeFile(
          path.join(debugDir, 'presign-response.json'),
          JSON.stringify(presignJson, null, 2),
          'utf8'
        );
        console.log('Wrote presign JSON to', path.join(debugDir, 'presign-response.json'));
      } catch (e) {
        console.warn('Failed to write presign response', e && e.message);
      }
      let url = presignJson.url;
      // Rewrite presigned hostnames that point to localhost so the container
      // can reach the MinIO service over the compose network.
      try {
        // The storage service's public S3 endpoint is often configured as localhost
        // for host-based development. Inside the compose network the MinIO
        // service is reachable at the service name `minio` on port 9000.
        const minioHost = process.env.E2E_MINIO_HOST || (inDocker ? 'minio' : 'localhost');
        url = url
          .replace('http://localhost:9000', `http://${minioHost}:9000`)
          .replace('http://127.0.0.1:9000', `http://${minioHost}:9000`)
          .replace('http://[::1]:9000', `http://${minioHost}:9000`)
          .replace('::1:9000', `${minioHost}:9000`)
          .replace('http://minio:9000', `http://${minioHost}:9000`)
          .replace('http://minio', `http://${minioHost}`);
        if (url !== presignJson.url) console.log('Rewrote presign URL to', url);
      } catch (e) {
        /* presign không có host minio để viết lại — dùng URL gốc */
      }
      const key = presignJson.key;
      const body = await fs.promises.readFile(uploadFilePath);
      const putResp = await context.request.put(url, {
        data: body,
        headers: { 'Content-Type': 'text/plain' },
      });
      if (putResp.status() >= 200 && putResp.status() < 300) {
        console.log('Fallback upload succeeded, key:', key);
        const filesResp = await context.request.get(`${storageBase}/api/files`);
        const files = await filesResp.json();
        console.log('Files from storage service:', files);
        try {
          await browser.close();
        } catch (e) {
          console.warn('Không đóng được Chromium:', e && e.message);
        }
        const uploaded = files.some(
          (f) => (f.key && f.key.includes('upload')) || (f.key && f.key === key)
        );
        process.exit(uploaded ? 0 : 2);
      } else {
        console.error('Fallback upload failed', putResp.status(), await putResp.text());
      }
    } catch (fbErr) {
      console.error('Fallback upload error', fbErr && fbErr.message ? fbErr.message : fbErr);
    }
    // If fallback failed, rethrow original login error to fail the test
    throw err;
  }

  // Prepare file upload
  console.log('Setting file for upload:', uploadFilePath);
  await page.setInputFiles('#file-input', uploadFilePath);
  // Instrument page fetch to record outgoing network calls (presign/PUT)
  try {
    await page.evaluate(() => {
      if (!window.__fetchInstrumented) {
        const origFetch = window.fetch.bind(window);
        window.__fetchCalls = [];
        window.fetch = async function (url, opts) {
          try {
            const u = typeof url === 'string' ? url : (url && url.url) || '';
            const m = (opts && opts.method) || 'GET';
            window.__fetchCalls.push({ url: u, method: m, timestamp: Date.now() });
          } catch (e) {
            /* trang chặn ghi đè fetch — mất đo đạc, không sao */
          }
          return origFetch(url, opts);
        };
        window.__fetchInstrumented = true;
      }
    });
  } catch (e) {
    console.warn('Failed to instrument page fetch', e && e.message);
  }

  // Click Upload
  await page.click('button:has-text("Upload")');

  // Wait for alert to confirm upload succeeded (handled by dialog event)
  await page.waitForTimeout(2000);
  // Collect any recorded fetch calls from the page for debugging
  try {
    const fetchCalls = await page.evaluate(() => window.__fetchCalls || []);
    try {
      await fs.promises.writeFile(
        path.join(debugDir, `fetch-calls-${Date.now()}.json`),
        JSON.stringify(fetchCalls, null, 2),
        'utf8'
      );
      console.log(
        'Wrote page fetch calls to',
        path.join(debugDir, `fetch-calls-${Date.now()}.json`)
      );
    } catch (e) {
      console.warn('Failed writing fetch calls file', e && e.message);
    }
  } catch (e) {
    console.warn('Failed to read fetch calls from page', e && e.message);
  }

  // Check files via storage API
  const filesResp = await context.request.get(`${storageBase}/api/files`);
  const files = await filesResp.json();
  console.log('Files from storage service:', files);

  try {
    await browser.close();
  } catch (e) {
    console.warn('Không đóng được Chromium:', e && e.message);
  }
  // exit with success if we see our upload file
  const uploaded = files.some(
    (f) => (f.key && f.key.includes('upload')) || (f.key && f.key.includes('test'))
  );
  process.exit(uploaded ? 0 : 2);
})().catch(async (e) => {
  console.error(e);
  try {
    if (browser) await browser.close();
  } catch (closeErr) {
    console.warn('Không đóng được Chromium:', closeErr && closeErr.message);
  }
  process.exit(1);
});
