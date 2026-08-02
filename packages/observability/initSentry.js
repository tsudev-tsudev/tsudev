// Lightweight Sentry initializer (safe if @sentry/* packages are not installed)
function initServer(opts = {}) {
  const service = opts.service || process.env.SERVICE_NAME || 'unknown-service';
  if (!process.env.SENTRY_DSN) {
    console.log('[observability] SENTRY_DSN not set — skipping Sentry server init');
    return;
  }
  try {
    const pkg = '@' + 'sentry/node';
    // use a dynamic require so bundlers won't statically resolve this dependency
    const Sentry = require(pkg);
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE,
      serverName: service,
    });
    console.log('[observability] Sentry (server) initialized for', service);
  } catch (e) {
    console.warn(
      '[observability] @sentry/node not installed or failed to init:',
      e && e.message ? e.message : e
    );
  }
}

async function initBrowser() {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // client DSN not configured
    return;
  }
  try {
    // construct the module name so bundlers don't statically analyze and fail the build
    const pkg = '@' + 'sentry/browser';
    const Sentry = await import(pkg);
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      release: process.env.SENTRY_RELEASE,
      environment: process.env.NODE_ENV || 'development',
    });
    console.log('[observability] Sentry (browser) initialized');
  } catch (e) {
    // Import may fail if @sentry/browser is not installed — that's acceptable in skeleton mode
    console.warn(
      '[observability] @sentry/browser not installed or failed to init:',
      e && e.message ? e.message : e
    );
  }
}

module.exports = { initServer, initBrowser };
