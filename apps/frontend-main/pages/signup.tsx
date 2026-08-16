import React, { useState } from 'react';
import { Button, Input } from '@tsudev/ui';

import { AuthShell, Notice } from '../components/AuthShell';

/**
 * Đăng ký.
 *
 * Chính sách mật khẩu được nhắc TRƯỚC khi gõ, không phải sau khi gửi form: bắt
 * người ta đoán rồi báo lỗi là cách chắc chắn nhất để họ chọn mật khẩu vừa đủ
 * qua cửa.
 *
 * Máy chủ vẫn kiểm lại toàn bộ. Kiểm ở client chỉ để đỡ một vòng mạng — nó
 * KHÔNG phải một lớp bảo vệ, vì bất kỳ ai cũng gọi thẳng API được.
 */

const MIN_PASSWORD_LEN = 12;

const ERROR_TEXT: Record<string, string> = {
  invalid_username:
    'Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch ngang, gạch dưới; dài 3–32 ký tự và không bắt đầu/kết thúc bằng dấu.',
  invalid_email: 'Địa chỉ email không hợp lệ.',
  weak_password: `Mật khẩu phải dài ít nhất ${MIN_PASSWORD_LEN} ký tự và không nằm trong danh sách mật khẩu phổ biến.`,
  username_taken: 'Tên đăng nhập này đã có người dùng.',
};

export default function SignupPage() {
  const [form, setForm] = useState({ username: '', email: '', displayName: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < MIN_PASSWORD_LEN) {
      setError(ERROR_TEXT.weak_password as string);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/identity/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERROR_TEXT[data?.error] ?? 'Không tạo được tài khoản. Hãy thử lại.');
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
      <AuthShell
        title="Kiểm tra hộp thư"
        description="Chúng tôi đã gửi một liên kết xác minh tới địa chỉ email của bạn."
        footer={
          <a className="text-brandink hover:underline" href="/login">
            Về trang đăng nhập
          </a>
        }
      >
        <Notice kind="ok">
          Liên kết có hiệu lực trong 24 giờ. Nếu không thấy thư, hãy kiểm tra mục spam.
        </Notice>
        <p className="text-sm text-muted">
          Bạn vẫn đăng nhập được ngay bây giờ; xác minh email cần cho các thao tác nhạy cảm.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Tạo tài khoản"
      description="Miễn phí. Chỉ cần một địa chỉ email còn dùng được."
      footer={
        <>
          Đã có tài khoản?{' '}
          <a className="text-brandink hover:underline" href="/login">
            Đăng nhập
          </a>
        </>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          id="username"
          name="username"
          label="Tên đăng nhập"
          value={form.username}
          onChange={set('username')}
          autoComplete="username"
          required
        />
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
          required
        />
        <Input
          id="displayName"
          name="displayName"
          label="Tên hiển thị"
          value={form.displayName}
          onChange={set('displayName')}
          autoComplete="name"
          placeholder="Để trống thì dùng tên đăng nhập"
        />
        <div>
          <Input
            id="password"
            name="password"
            type="password"
            label="Mật khẩu"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            required
          />
          <p className="mt-1.5 text-xs text-muted">
            Ít nhất {MIN_PASSWORD_LEN} ký tự. Một cụm từ dễ nhớ thường vừa mạnh hơn vừa dễ gõ hơn
            một chuỗi ký tự đặc biệt.
          </p>
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Đang tạo…' : 'Tạo tài khoản'}
        </Button>
      </form>

      <p className="mt-5 text-xs text-muted">
        Tạo tài khoản nghĩa là bạn đồng ý với{' '}
        <a className="text-brandink hover:underline" href="/terms">
          Điều khoản
        </a>{' '}
        và{' '}
        <a className="text-brandink hover:underline" href="/privacy">
          Chính sách riêng tư
        </a>
        .
      </p>
    </AuthShell>
  );
}
