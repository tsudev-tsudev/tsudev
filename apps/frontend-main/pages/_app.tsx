import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
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
