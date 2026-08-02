#!/usr/bin/env node
const { chromium } = require('/tmp/tsudev-playwright/node_modules/playwright');
const url = process.argv[2] || 'http://127.0.0.1:3000/';
const runs = parseInt(process.argv[3], 10) || 5;

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const results = [];
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    let response = null;
    let lastErr = null;
    const strategies = ['domcontentloaded', 'load', 'networkidle'];
    for (const strat of strategies) {
      try {
        response = await page.goto(url, { waitUntil: strat, timeout: 30000 });
        break;
      } catch (err) {
        lastErr = err;
        // small backoff before retrying
        await page.waitForTimeout(250);
      }
    }
    if (!response) {
      results.push({ run: i + 1, error: String(lastErr || 'navigation failed') });
      await page.waitForTimeout(500);
      continue;
    }
    const nav = await page.evaluate(() => {
      const e = performance.getEntriesByType('navigation')[0] || {};
      return {
        domContentLoaded:
          e.domContentLoadedEventEnd ||
          (performance.timing && performance.timing.domContentLoadedEventEnd),
        loadEventEnd: e.loadEventEnd || (performance.timing && performance.timing.loadEventEnd),
        responseEnd: e.responseEnd || (performance.timing && performance.timing.responseEnd),
        fetchStart: e.fetchStart || (performance.timing && performance.timing.fetchStart),
        duration:
          e.duration ||
          (performance.timing && performance.timing.loadEventEnd - performance.timing.fetchStart),
      };
    });
    const elapsed = Date.now() - start;
    results.push({ run: i + 1, status: response && response.status(), elapsed, nav });
    await page.waitForTimeout(500);
  }
  console.log(JSON.stringify({ url, runs, results }, null, 2));
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
