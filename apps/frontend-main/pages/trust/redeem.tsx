import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Input, Layout } from '@tsudev/ui';

import Seo from '../../components/Seo';
import { Notice } from '../../components/AuthShell';

/**
 * Đổi mã mời lấy quyền vào vùng Con dấu tín nhiệm.
 *
 * Trang này CỐ Ý không nói mã hợp lệ trông như thế nào, không đếm số ký tự cho
 * người gõ, và không phân biệt "mã sai" với "mã hết hạn" — auth-service đã gộp
 * ba trường hợp đó làm một, và mô tả kỹ hơn ở đây sẽ phá đúng thứ nó bảo vệ.
 *
 * Cổng thật KHÔNG nằm ở trang này. Nó nằm ở `requireRole('VIP')` phía service,
 * thứ đọc `User.role` từ DB và fail closed.
 */

type Msg = { kind: 'error' | 'ok'; text: string };

const ERRORS: Record<string, string> = {
  invite_invalid: 'Mã không dùng được. Kiểm tra lại, hoặc hỏi người đã gửi mã cho bạn.',
  invite_exhausted: 'Mã này đã hết lượt sử dụng.',
  rate_limited: 'Bạn đã thử quá nhiều lần. Chờ ít phút rồi thử lại.',
};

export default function RedeemInvitePage() {
  const { data: session, status, update } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  if (status === 'loading') {
    return (
      <Layout active="/trust">
        <p className="text-sm text-muted">Đang tải…</p>
      </Layout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <Layout active="/trust">
        <Seo title="Nhập mã mời — tsudev" path="/trust/redeem" noindex />
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-bold text-ink">Nhập mã mời</h1>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            Mã mời gắn với một tài khoản, nên phải đăng nhập trước khi đổi. Chưa có tài khoản thì
            đăng ký trước — mã vẫn dùng được sau đó.
          </p>
          <Button as="a" href="/login?callbackUrl=/trust/redeem" className="mt-5 w-full">
            Đăng nhập
          </Button>
        </div>
      </Layout>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/account/invite/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg({ kind: 'error', text: ERRORS[data.error || ''] || 'Không đổi được mã.' });
        return;
      }
      setCode('');
      setMsg({ kind: 'ok', text: 'Xong. Tài khoản của bạn đã được mở quyền vào vùng Con dấu.' });
      // Vai trò nằm trong JWT của next-auth, nên nó chỉ đổi ở lần làm mới token
      // kế tiếp. Không gọi update() thì điều hướng vẫn giấu mục Con dấu cho tới
      // lần tải trang sau — trông y hệt như việc đổi mã không có tác dụng.
      await update?.();
    } catch {
      setMsg({ kind: 'error', text: 'Không kết nối được máy chủ.' });
    } finally {
      setBusy(false);
    }
  };

  const role = (session?.user as { role?: string } | undefined)?.role;
  const alreadyIn = role === 'VIP' || role === 'MODERATOR' || role === 'ADMIN';

  return (
    <Layout active="/trust">
      <Seo title="Nhập mã mời — tsudev" path="/trust/redeem" noindex />
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold text-ink">Nhập mã mời</h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          Con dấu tín nhiệm chỉ mở cho tài khoản được mời. Nhập mã bạn nhận được để mở quyền truy
          cập.
        </p>

        {msg && (
          <div className="mt-5">
            <Notice kind={msg.kind}>{msg.text}</Notice>
          </div>
        )}

        {alreadyIn && !msg && (
          <div className="mt-5">
            <Notice kind="ok">
              Tài khoản của bạn đã có quyền vào vùng Con dấu.{' '}
              <a className="text-brandink hover:underline" href="/trust">
                Mở trang Con dấu
              </a>
            </Notice>
          </div>
        )}

        <form onSubmit={submit} className="mt-5">
          <Input
            id="invite-code"
            label="Mã mời"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="TSU-XXXXX-XXXXX-XXXXX"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          <Button type="submit" className="mt-4 w-full" disabled={busy || !code.trim()}>
            {busy ? 'Đang kiểm tra…' : 'Đổi mã'}
          </Button>
        </form>

        <p className="mt-6 text-xs text-muted leading-relaxed border-t border-hairline pt-4">
          Chưa có mã? Con dấu được cấp cho đối tác và khách hàng của tsudev — hãy liên hệ trực tiếp
          với tsudev để trao đổi.
        </p>
      </div>
    </Layout>
  );
}
