const { test, expect } = require('@playwright/test');
const path = require('path');
const { loadTopology, publicUrl } = require('../../scripts/topology/load');

// Cần full stack (MinIO + storage-service + Keycloak) — chạy qua docker-compose,
// không nằm trong CI. Xem project `full-stack` trong playwright.config.js.
test('SSO credentials sign-in (E2E) and upload', async ({ page }) => {
  const base = process.env.E2E_BASE_URL || publicUrl(loadTopology(), 'main');

  // Navigate to frontend and open sign-in
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.click('a[href="/api/auth/signin"], button:has-text("Sign in")');

  // Try credentials provider page (e2e-dev) first for deterministic sign-in
  try {
    await page.goto(`${base}/api/auth/signin/e2e-dev`, { waitUntil: 'networkidle' });
    await page.fill('input[name="username"], input#username', process.env.E2E_USER || 'devuser');
    await page.fill('input[name="password"], input#password', process.env.E2E_PASS || 'devpass');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
      page.click('button[type="submit"], input[type="submit"], button:has-text("Sign in")'),
    ]);
  } catch (e) {
    // fallback: continue, the app may redirect to OIDC provider
  }

  // Ensure we have a session by checking for text on homepage
  await page.goto(base, { waitUntil: 'networkidle' });
  await expect(page.locator('text=Signed in as')).toBeVisible({ timeout: 7000 });

  // Prepare upload file and perform upload via the Upload component
  const filePath = path.resolve(__dirname, '../test-files/sample.txt');
  const input = page.locator('input[type=file]');
  await input.setInputFiles(filePath);

  // Wait for alert dialog that indicates upload completion
  const [dialog] = await Promise.all([
    page.waitForEvent('dialog', { timeout: 20000 }),
    page.click('button:has-text("Upload")'),
  ]);
  expect(dialog.message()).toContain('Upload complete');
  await dialog.accept();
});
