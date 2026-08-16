import React, { useState } from 'react';
import { Button, Input } from '@tsudev/ui';

import { AuthShell, Notice } from '../components/AuthShell';

/**
 * Quên mật khẩu.
 *
 * Màn hình xác nhận GIỐNG HỆT NHAU dù địa chỉ có tồn tại hay không — máy chủ
 * cũng trả về cùng một phản hồi. Nói "không tìm thấy email này" biến form này
 * thành công cụ dò xem ai có tài khoản ở đây, và đó là bước đầu của mọi chiến
 * dịch nhắm mục tiêu.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch('/api/identity/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Kể cả khi mạng hỏng cũng hiện màn hình như nhau: một thông báo lỗi ở
      // đây cho biết request đã ĐI TỚI ĐÂU, và chênh lệch đó cũng dò được.
    } finally {
      setBusy(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="Kiểm tra hộp thư"
        footer={
          <a className="text-brandink hover:underline" href="/login">
            Về trang đăng nhập
          </a>
        }
      >
        <Notice kind="ok">
          Nếu <strong>{email}</strong> có tài khoản tsudev, chúng tôi vừa gửi tới đó một liên kết
          đặt lại mật khẩu.
        </Notice>
        <p className="text-sm text-muted">
          Liên kết có hiệu lực trong 1 giờ và chỉ dùng được một lần.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Quên mật khẩu"
      description="Nhập email của bạn, chúng tôi sẽ gửi liên kết đặt lại."
      footer={
        <a className="text-brandink hover:underline" href="/login">
          Về trang đăng nhập
        </a>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}
        </Button>
      </form>
    </AuthShell>
  );
}
