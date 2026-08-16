import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Button, Input } from '@tsudev/ui';

import { AuthShell, Notice } from '../components/AuthShell';

const MIN_PASSWORD_LEN = 12;

/**
 * Đặt lại mật khẩu bằng token trong email.
 *
 * Token đi qua query string, nên nó nằm trong lịch sử trình duyệt và trong log
 * của mọi proxy trên đường. Đó là lý do máy chủ cho nó hạn 1 giờ, dùng một lần,
 * và chỉ lưu hash — chứ không phải vì cẩn thận thừa.
 *
 * Đặt lại thành công sẽ ĐÁ MỌI PHIÊN đang mở (sessionVersion tăng ở phía
 * service). Nếu tài khoản đã bị chiếm thì kẻ chiếm đang giữ một phiên hợp lệ,
 * và đổi mật khẩu mà không thu hồi phiên thì không lấy lại được gì.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Hai lần nhập mật khẩu không khớp.');
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Mật khẩu phải dài ít nhất ${MIN_PASSWORD_LEN} ký tự.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/identity/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.error === 'invalid_token'
            ? 'Liên kết đã hết hạn hoặc đã được dùng. Hãy yêu cầu một liên kết mới.'
            : 'Không đặt lại được mật khẩu. Hãy thử lại.'
        );
        return;
      }
      setDone(true);
    } catch {
      setError('Không kết nối được máy chủ. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Đã đổi mật khẩu">
        <Notice kind="ok">Mọi phiên đăng nhập cũ đã bị đăng xuất, kể cả trên thiết bị khác.</Notice>
        <Button as="a" href="/login" className="mt-4 w-full">
          Đăng nhập lại
        </Button>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell title="Liên kết không hợp lệ">
        <Notice kind="error">
          Liên kết thiếu mã xác thực. Hãy mở lại đúng liên kết trong email, hoặc yêu cầu một liên
          kết mới.
        </Notice>
        <Button as="a" href="/forgot-password" variant="secondary" className="mt-4 w-full">
          Yêu cầu liên kết mới
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Đặt mật khẩu mới">
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          id="password"
          name="password"
          type="password"
          label="Mật khẩu mới"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          id="confirm"
          name="confirm"
          type="password"
          label="Nhập lại mật khẩu mới"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Đang đổi…' : 'Đổi mật khẩu'}
        </Button>
      </form>
    </AuthShell>
  );
}
