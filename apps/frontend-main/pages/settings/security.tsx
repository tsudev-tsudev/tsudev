import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { startRegistration } from '@simplewebauthn/browser';
import { Button, Input, Layout } from '@tsudev/ui';

import Seo from '../../components/Seo';
import { Notice } from '../../components/AuthShell';

/**
 * Bảo mật tài khoản: bật 2FA và quản lý passkey.
 *
 * Không có trang này thì hai cơ chế kia tồn tại ở tầng API mà không ai bật
 * được - tức là chúng là mã chết trông như lớp phòng thủ.
 */

type Passkey = { id: string; label: string | null; createdAt: string; lastUsedAt: string | null };

const post = async (path: string, body?: unknown) => {
  const res = await fetch(`/api/account/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data } as { ok: boolean; data: Record<string, unknown> };
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-lg border border-hairline bg-panel p-5 sm:p-6">
    <h2 className="text-base font-semibold text-ink">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

export default function SecurityPage() {
  const { status } = useSession();
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  // --- 2FA ---
  const [setupUri, setSetupUri] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePw, setDisablePw] = useState('');

  // --- Passkey ---
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [label, setLabel] = useState('');

  const refreshKeys = useCallback(async () => {
    const { ok, data } = await post('passkey/list');
    if (ok && Array.isArray(data)) setKeys(data as unknown as Passkey[]);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') refreshKeys();
  }, [status, refreshKeys]);

  if (status === 'loading') {
    return (
      <Layout active="/settings">
        <p className="text-sm text-muted">Đang tải…</p>
      </Layout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <Layout active="/settings">
        <Seo title="Bảo mật - tsudev" noindex />
        <div className="mx-auto max-w-md">
          <Notice kind="error">Bạn cần đăng nhập để mở trang này.</Notice>
          <Button as="a" href="/login?callbackUrl=/settings/security" className="mt-4 w-full">
            Đăng nhập
          </Button>
        </div>
      </Layout>
    );
  }

  const startTotp = async () => {
    const { ok, data } = await post('totp/setup');
    if (!ok) {
      setMsg({ kind: 'error', text: 'Không bắt đầu được. Có thể 2FA đã bật rồi.' });
      return;
    }
    setSetupUri(String(data.uri || ''));
    setSetupSecret(String(data.secret || ''));
    setMsg(null);
  };

  const confirmTotp = async () => {
    const { ok, data } = await post('totp/confirm', { code });
    if (!ok) {
      setMsg({ kind: 'error', text: 'Mã không đúng. Hãy thử mã mới nhất trên ứng dụng.' });
      return;
    }
    setBackupCodes((data.backupCodes as string[]) || []);
    setSetupUri('');
    setSetupSecret('');
    setCode('');
    setMsg({ kind: 'ok', text: 'Đã bật xác thực hai bước.' });
  };

  const disableTotp = async () => {
    const { ok } = await post('totp/disable', { password: disablePw });
    setDisablePw('');
    setMsg(
      ok
        ? { kind: 'ok', text: 'Đã tắt xác thực hai bước.' }
        : { kind: 'error', text: 'Mật khẩu không đúng.' }
    );
  };

  const addPasskey = async () => {
    try {
      const { ok, data } = await post('passkey/register-options');
      if (!ok) throw new Error('options');
      const attestation = await startRegistration({
        optionsJSON: data.options as Parameters<typeof startRegistration>[0]['optionsJSON'],
      });
      const verify = await post('passkey/register-verify', {
        challengeId: data.challengeId,
        response: attestation,
        label,
      });
      if (!verify.ok) throw new Error('verify');
      setLabel('');
      setMsg({ kind: 'ok', text: 'Đã thêm passkey.' });
      refreshKeys();
    } catch (err) {
      const name = (err as { name?: string })?.name;
      // Huỷ trên hộp thoại hệ điều hành không phải lỗi.
      if (name !== 'NotAllowedError' && name !== 'AbortError') {
        setMsg({ kind: 'error', text: 'Không thêm được passkey trên thiết bị này.' });
      }
    }
  };

  const removePasskey = async (id: string) => {
    await post('passkey/delete', { id });
    refreshKeys();
  };

  return (
    <Layout active="/settings">
      <Seo title="Bảo mật - tsudev" noindex />
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-ink">Bảo mật tài khoản</h1>
        <p className="mt-1.5 text-sm text-muted">
          Passkey chống được trang giả mạo; mật khẩu và mã 2FA thì không, vì cả hai đều gõ lại được
          vào một trang giả.
        </p>

        {msg && (
          <div className="mt-5">
            <Notice kind={msg.kind}>{msg.text}</Notice>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-5">
          <Section title="Passkey">
            {keys.length === 0 ? (
              <p className="text-sm text-muted">Chưa có passkey nào.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline">
                {keys.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{k.label || 'Không đặt tên'}</p>
                      <p className="text-xs text-muted">
                        Thêm ngày {new Date(k.createdAt).toLocaleDateString('vi-VN')}
                        {k.lastUsedAt
                          ? ` · dùng lần cuối ${new Date(k.lastUsedAt).toLocaleDateString('vi-VN')}`
                          : ' · chưa dùng lần nào'}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removePasskey(k.id)}>
                      Xoá
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-end gap-2">
              <Input
                id="passkey-label"
                label="Tên thiết bị"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="MacBook cơ quan"
                className="flex-1"
              />
              <Button onClick={addPasskey}>Thêm passkey</Button>
            </div>
          </Section>

          <Section title="Xác thực hai bước (TOTP)">
            {backupCodes.length > 0 ? (
              <>
                <Notice kind="ok">
                  Lưu mười mã dự phòng này ở nơi an toàn. Chúng chỉ hiện MỘT LẦN, và chúng là thứ
                  duy nhất cứu được tài khoản nếu bạn mất điện thoại.
                </Notice>
                <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm text-ink">
                  {backupCodes.map((c) => (
                    <li key={c} className="rounded-md bg-panel2 px-2.5 py-1.5">
                      {c}
                    </li>
                  ))}
                </ul>
              </>
            ) : setupUri ? (
              <>
                <p className="text-sm text-inksoft">
                  Quét mã trong ứng dụng xác thực, hoặc nhập tay khoá bên dưới, rồi nhập mã 6 chữ số
                  để xác nhận.
                </p>
                <p className="mt-2 break-all rounded-md bg-panel2 px-3 py-2 font-mono text-xs text-inksoft">
                  {setupSecret}
                </p>
                <p className="mt-2 break-all text-xs text-muted">{setupUri}</p>
                <div className="mt-4 flex items-end gap-2">
                  <Input
                    id="totp-code"
                    label="Mã 6 chữ số"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="flex-1"
                  />
                  <Button onClick={confirmTotp}>Xác nhận</Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-inksoft">
                  Thêm một mã dùng một lần từ ứng dụng xác thực khi đăng nhập bằng mật khẩu.
                </p>
                <Button variant="secondary" className="mt-4" onClick={startTotp}>
                  Bật xác thực hai bước
                </Button>
                <div className="mt-6 border-t border-hairline pt-4">
                  <p className="text-sm text-muted">Đã bật rồi và muốn tắt?</p>
                  <div className="mt-2 flex items-end gap-2">
                    <Input
                      id="disable-pw"
                      type="password"
                      label="Mật khẩu hiện tại"
                      value={disablePw}
                      onChange={(e) => setDisablePw(e.target.value)}
                      autoComplete="current-password"
                      className="flex-1"
                    />
                    <Button variant="ghost" onClick={disableTotp}>
                      Tắt 2FA
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Section>
        </div>
      </div>
    </Layout>
  );
}
