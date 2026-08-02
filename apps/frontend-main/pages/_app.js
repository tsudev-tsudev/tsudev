import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    (async () => {
      try {
        const obs = await import('../../../packages/observability/initSentry');
        obs && obs.initBrowser && obs.initBrowser();
      } catch (e) {
        // ignore if observability package or @sentry/browser not available
      }
    })();
  }, []);

  return (
    <SessionProvider session={pageProps.session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
