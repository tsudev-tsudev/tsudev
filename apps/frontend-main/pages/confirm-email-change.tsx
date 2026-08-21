import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@tsudev/ui';

import { AuthShell, Notice } from '../components/AuthShell';

/**
 * Xác nhận đổi email.
 *
 * Cùng khuôn với verify-email: gọi API MỘT LẦN (token dùng một lần, StrictMode ở
 * dev chạy effect hai lượt nên `useRef` chặn lượt hai). Khi thành công, email đã
 * đổi và mọi phiên cũ bị đá ra (sessionVersion tăng) - nên đích đến là trang đăng
 * nhập, đăng nhập lại bằng địa chỉ mới.
 */
type State = 'checking' | 'ok' | 'taken' | 'failed';

export default function ConfirmEmailChangePage() {
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
        const res = await fetch('/api/identity/confirm-email-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (res.ok) setState('ok');
        else if (res.status === 409) setState('taken');
        else setState('failed');
      } catch {
        setState('failed');
      }
    })();
  }, [router.isReady, router.query.token]);

  if (state === 'checking') {
    return (
      <AuthShell title="Đang xác nhận…">
        <p className="text-sm text-fg-muted">Chờ một chút.</p>
      </AuthShell>
    );
  }

  if (state === 'ok') {
    return (
      <AuthShell title="Đã đổi email">
        <Notice kind="ok">
          Email của tài khoản đã được cập nhật và đã xác minh. Mọi thiết bị khác đã bị đăng xuất -
          hãy đăng nhập lại bằng địa chỉ mới.
        </Notice>
        <Button as="a" href="/login" className="mt-4 w-full">
          Đăng nhập
        </Button>
      </AuthShell>
    );
  }

  if (state === 'taken') {
    return (
      <AuthShell title="Địa chỉ đã có người dùng">
        <Notice kind="error">
          Địa chỉ email mới đã được một tài khoản khác đăng ký trong lúc chờ xác nhận. Email của bạn
          không thay đổi. Hãy thử lại với một địa chỉ khác.
        </Notice>
        <Button as="a" href="/settings/profile" variant="secondary" className="mt-4 w-full">
          Về trang hồ sơ
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Không xác nhận được">
      <Notice kind="error">
        Liên kết đã hết hạn hoặc đã được dùng. Vào trang hồ sơ và yêu cầu đổi email lại.
      </Notice>
      <Button as="a" href="/settings/profile" variant="secondary" className="mt-4 w-full">
        Về trang hồ sơ
      </Button>
    </AuthShell>
  );
}
