import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@tsudev/ui';

import { AuthShell, Notice } from '../components/AuthShell';

/**
 * Xác minh email.
 *
 * Gọi API MỘT LẦN duy nhất. Token dùng một lần, nên một lần gọi thừa — React
 * StrictMode ở dev chạy effect hai lượt — sẽ tiêu token ở lượt đầu rồi báo "liên
 * kết đã dùng" ở lượt sau, cho người dùng thấy lỗi trong khi mọi thứ đã thành
 * công. `useRef` chặn lượt thứ hai.
 */
type State = 'checking' | 'ok' | 'failed';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [state, setState] = useState<State>('checking');
  const fired = useRef(false);

  useEffect(() => {
    if (!router.isReady || fired.current) return;
    const token = typeof router.query.token === 'string' ? router.query.token : '';
    if (!token) {
      setState('failed');
      return;
    }
    fired.current = true;
    (async () => {
      try {
        const res = await fetch('/api/identity/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        setState(res.ok ? 'ok' : 'failed');
      } catch {
        setState('failed');
      }
    })();
  }, [router.isReady, router.query.token]);

  if (state === 'checking') {
    return (
      <AuthShell title="Đang xác minh…">
        <p className="text-sm text-muted">Chờ một chút.</p>
      </AuthShell>
    );
  }

  if (state === 'ok') {
    return (
      <AuthShell title="Email đã được xác minh">
        <Notice kind="ok">Tài khoản của bạn đã sẵn sàng.</Notice>
        <Button as="a" href="/login" className="mt-4 w-full">
          Đăng nhập
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Không xác minh được">
      <Notice kind="error">
        Liên kết đã hết hạn hoặc đã được dùng. Đăng nhập rồi yêu cầu gửi lại thư xác minh.
      </Notice>
      <Button as="a" href="/login" variant="secondary" className="mt-4 w-full">
        Về trang đăng nhập
      </Button>
    </AuthShell>
  );
}
