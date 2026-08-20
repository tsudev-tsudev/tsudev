import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { getProviders, signIn, useSession } from 'next-auth/react';
import type { GetServerSideProps } from 'next';
import { startAuthentication } from '@simplewebauthn/browser';
import { Button, Input } from '@tsudev/ui';

import { AuthShell, Notice } from '../components/AuthShell';

/**
 * Đăng nhập.
 *
 * Thay trang mặc định của next-auth (`/api/auth/signin`), thứ vốn liệt kê mọi
 * provider đang bật dưới dạng một danh sách nút không có nhãn tiếng Việt.
 *
 * KHÔNG có "đăng nhập bằng bất kỳ username nào với devpass" ở đây, kể cả ở dev.
 * Tài khoản dev do `npm run db:seed:dev` đặt và đi qua đúng đường này.
 */

type OAuthProvider = { id: string; name: string };

type LoginProps = {
  /** Chỉ các provider OAuth ĐÃ cấu hình đủ biến môi trường. */
  oauth: OAuthProvider[];
};

/**
 * Thông điệp lỗi.
 *
 * next-auth trả về mã lỗi qua query `?error=`. Mọi mã liên quan tới thông tin
 * đăng nhập đều gộp về MỘT câu - không phân biệt "không có tài khoản" với "sai
 * mật khẩu", vì phân biệt được nghĩa là dò được ai có tài khoản ở đây.
 */
const ERROR_TEXT: Record<string, string> = {
  CredentialsSignin: 'Tên đăng nhập hoặc mật khẩu không đúng.',
  totp_invalid: 'Mã xác thực không đúng hoặc đã hết hạn. Hãy thử mã mới nhất.',
  OAuthAccountNotLinked:
    'Địa chỉ email này đã có tài khoản đăng nhập bằng cách khác. Hãy đăng nhập theo cách đó rồi liên kết trong phần cài đặt.',
  SessionRequired: 'Bạn cần đăng nhập để mở trang đó.',
};

const GITHUB_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.47c.52.1.71-.23.71-.5v-1.76c-2.92.64-3.54-1.4-3.54-1.4-.48-1.22-1.17-1.55-1.17-1.55-.95-.65.07-.64.07-.64 1.06.08 1.61 1.09 1.61 1.09.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.19 0-1.15.41-2.09 1.08-2.83-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.88 1.08a10 10 0 0 1 5.24 0c2-1.36 2.88-1.08 2.88-1.08.57 1.45.21 2.52.1 2.79.67.74 1.08 1.68 1.08 2.83 0 4.03-2.46 4.92-4.8 5.18.38.33.72.97.72 1.96v2.9c0 .28.19.61.72.5A10.5 10.5 0 0 0 12 1.5Z" />
  </svg>
);

// Bốn mã hex dưới đây là NGOẠI LỆ có chủ đích với luật "chỉ dùng token": đó là
// màu thương hiệu của Google trong logo chính thức của họ, và điều kiện sử dụng
// nhãn hiệu không cho phép tô lại. Chúng cố định ở cả ba chế độ - đúng như logo
// Google xuất hiện ở mọi nơi khác. Đừng thay bằng token.
const GOOGLE_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.35Z"
    />
    <path
      fill="#34A853"
      d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
    />
    <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.35-2.59Z" />
    <path
      fill="#EA4335"
      d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A10 10 0 0 0 3.06 7.49l3.35 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
    />
  </svg>
);

const ICONS: Record<string, React.ReactNode> = { github: GITHUB_ICON, google: GOOGLE_ICON };

export default function LoginPage({ oauth }: LoginProps) {
  const router = useRouter();
  const { status } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  // Ô nhập mã 2FA chỉ hiện SAU khi mật khẩu đã đúng. Hỏi trước là tiết lộ tài
  // khoản nào có bật 2FA cho bất kỳ ai gõ tên đăng nhập vào.
  const [needTotp, setNeedTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const totpRef = useRef<HTMLInputElement>(null);

  // Chuyển tiêu điểm sang ô mã KHI VÀ CHỈ KHI bước hai vừa xuất hiện. Dùng
  // `autoFocus` sẽ giành tiêu điểm ở mọi lần vẽ lại - kể cả khi người dùng đang
  // gõ ở ô khác - và quy tắc a11y chặn nó vì đúng lý do đó.
  useEffect(() => {
    if (needTotp) totpRef.current?.focus();
  }, [needTotp]);

  const rawNext = typeof router.query.callbackUrl === 'string' ? router.query.callbackUrl : '/';
  // CHỈ chấp nhận đường dẫn tương đối trong site. `callbackUrl` đến từ URL, nên
  // một giá trị như `https://ke-tan-cong.example` biến trang đăng nhập thành
  // bàn đạp chuyển hướng mở - người dùng thấy tên miền tsudev.com trong thanh
  // địa chỉ rồi bị đẩy sang nơi khác ngay sau khi đăng nhập.
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const queryError = typeof router.query.error === 'string' ? router.query.error : '';
  const shown =
    error || (queryError ? ERROR_TEXT[queryError] ?? 'Đăng nhập không thành công.' : '');

  if (status === 'authenticated') {
    // Đã đăng nhập rồi thì trang này không còn việc gì.
    if (typeof window !== 'undefined') router.replace(next);
    return null;
  }

  /**
   * Đăng nhập bằng passkey.
   *
   * Không hỏi tên đăng nhập trước: khoá khám phá được (`residentKey`) cho phép
   * trình duyệt tự chọn danh tính. Một bước bấm, không có gì để gõ, và không có
   * gì để gõ nhầm vào trang giả mạo.
   */
  const onPasskey = async () => {
    setBusy(true);
    setError('');
    try {
      const optRes = await fetch('/api/identity/passkey/login-options', { method: 'POST' });
      if (!optRes.ok) throw new Error('options');
      const { options, challengeId } = await optRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });
      const res = await signIn('passkey', {
        challengeId,
        response: JSON.stringify(assertion),
        redirect: false,
      });
      if (res?.error) {
        setError('Passkey không được chấp nhận. Hãy thử lại hoặc dùng mật khẩu.');
        return;
      }
      router.push(next);
    } catch (err) {
      // Người dùng bấm huỷ trên hộp thoại của hệ điều hành cũng rơi vào đây.
      // Đó KHÔNG phải lỗi, nên không hiện thông báo đỏ cho nó.
      const name = (err as { name?: string })?.name;
      if (name !== 'NotAllowedError' && name !== 'AbortError') {
        setError('Không dùng được passkey trên thiết bị này.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await signIn('credentials', { identifier, password, totp, redirect: false });
    setBusy(false);

    if (res?.error) {
      // next-auth gói thông điệp của authorize() vào chuỗi lỗi; tìm mã trong đó
      // thay vì so khớp nguyên văn, vì phần bao quanh khác nhau giữa các bản.
      if (res.error.includes('totp_required')) {
        setNeedTotp(true);
        setError('');
        return;
      }
      if (res.error.includes('totp_invalid')) {
        setNeedTotp(true);
        setError(ERROR_TEXT.totp_invalid as string);
        return;
      }
      setError(ERROR_TEXT.CredentialsSignin as string);
      return;
    }
    router.push(next);
  };

  return (
    <AuthShell
      title="Đăng nhập"
      description="Dùng tài khoản tsudev của bạn."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <a className="text-link hover:underline" href="/signup">
            Đăng ký
          </a>
        </>
      }
    >
      {shown && <Notice kind="error">{shown}</Notice>}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          id="identifier"
          name="identifier"
          label="Tên đăng nhập hoặc email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          required
        />
        <div>
          <Input
            id="password"
            name="password"
            type="password"
            label="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="mt-1.5 text-right">
            <a className="text-sm text-fg-muted hover:text-link" href="/forgot-password">
              Quên mật khẩu?
            </a>
          </div>
        </div>
        {needTotp && (
          <Input
            id="totp"
            name="totp"
            label="Mã xác thực hai bước"
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            // one-time-code để trình duyệt và iOS tự điền mã từ tin nhắn/ứng dụng.
            autoComplete="one-time-code"
            inputMode="numeric"
            placeholder="6 chữ số, hoặc một mã dự phòng"
            inputRef={totpRef}
            required
          />
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Đang kiểm tra…' : needTotp ? 'Xác nhận' : 'Đăng nhập'}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-fg-muted">
        <span className="h-px flex-1 bg-line" />
        hoặc
        <span className="h-px flex-1 bg-line" />
      </div>

      <Button variant="secondary" className="w-full" onClick={onPasskey} disabled={busy}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="9.5" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M3.5 20c0-3.2 2.7-5.2 6-5.2 1 0 2 .2 2.8.6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M20.5 13.2a2.6 2.6 0 1 0-4 2.2V21l1.4-1.2 1.4 1.2v-5.6c.7-.5 1.2-1.3 1.2-2.2Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
        Đăng nhập bằng passkey
      </Button>

      {oauth.length > 0 && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-fg-muted">
            <span className="h-px flex-1 bg-line" />
            hoặc
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="flex flex-col gap-2">
            {oauth.map((p) => (
              <Button
                key={p.id}
                variant="secondary"
                className="w-full"
                onClick={() => signIn(p.id, { callbackUrl: next })}
              >
                {ICONS[p.id]}
                Tiếp tục với {p.name}
              </Button>
            ))}
          </div>
        </>
      )}
    </AuthShell>
  );
}

/**
 * Danh sách provider lấy phía SERVER.
 *
 * `getProviders()` ở client cũng làm được, nhưng khi đó nút OAuth xuất hiện trễ
 * một nhịp sau khi form đã hiện - người dùng bấm "Đăng nhập" trước khi thấy nút
 * "Tiếp tục với GitHub" mà họ vẫn dùng.
 */
export const getServerSideProps: GetServerSideProps<LoginProps> = async () => {
  // getProviders() khai kiểu trả về là Record<string, ClientSafeProvider> | null,
  // nhưng Object.values trên đó ra `unknown[]` với cấu hình strict của repo -
  // nên nói rõ hình dạng thay vì rải `any`.
  const providers = ((await getProviders()) ?? {}) as Record<
    string,
    { id: string; name: string; type: string }
  >;
  const oauth = Object.values(providers)
    .filter((p) => p.type === 'oauth')
    .map((p) => ({ id: p.id, name: p.name }));
  return { props: { oauth } };
};
