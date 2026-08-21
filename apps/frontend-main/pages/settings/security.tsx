import React, { useCallback, useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { startRegistration } from '@simplewebauthn/browser';
import { Button, Input, Layout } from '@tsudev/ui';

import Seo from '../../components/Seo';
import { Notice } from '../../components/AuthShell';
import { formatDateVN } from '../../lib/format';
import { SecurityEventList, type SecurityEvent } from '../../components/SecurityEventList';

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
  <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
    <h2 className="text-base font-semibold text-fg">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

export default function SecurityPage() {
  const { status, update } = useSession();
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  // --- 2FA ---
  const [setupUri, setSetupUri] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePw, setDisablePw] = useState('');

  // --- Passkey ---
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [label, setLabel] = useState('');

  // --- Nhật ký bảo mật ---
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  // --- Vùng nguy hiểm ---
  const [dangerPw, setDangerPw] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshKeys = useCallback(async () => {
    const { ok, data } = await post('passkey/list');
    if (ok && Array.isArray(data)) setKeys(data as unknown as Passkey[]);
  }, []);

  const refreshEvents = useCallback(async () => {
    const { ok, data } = await post('security/events');
    if (ok && Array.isArray(data)) setEvents(data as unknown as SecurityEvent[]);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      refreshKeys();
      refreshEvents();
    }
  }, [status, refreshKeys, refreshEvents]);

  // `noindex` phải có ở CẢ hai nhánh chưa-đăng-nhập. Trình thu thập của công cụ
  // tìm kiếm KHÔNG BAO GIỜ có phiên, nên trạng thái duy nhất nó nhìn thấy chính
  // là hai nhánh này - đặt thẻ ở nhánh đã đăng nhập là đặt đúng chỗ không ai đọc.
  if (status === 'loading') {
    return (
      <Layout active="/settings">
        <Seo title="Bảo mật" path="/settings/security" noindex />
        <p className="text-sm text-fg-muted">Đang tải…</p>
      </Layout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <Layout active="/settings">
        <Seo title="Bảo mật" path="/settings/security" noindex />
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
    refreshEvents();
  };

  const disableTotp = async () => {
    const { ok } = await post('totp/disable', { password: disablePw });
    setDisablePw('');
    setMsg(
      ok
        ? { kind: 'ok', text: 'Đã tắt xác thực hai bước.' }
        : { kind: 'error', text: 'Mật khẩu không đúng.' }
    );
    if (ok) refreshEvents();
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
      refreshEvents();
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
    refreshEvents();
  };

  const revokeAll = async () => {
    if (
      !confirm(
        'Đăng xuất khỏi mọi thiết bị? Thiết bị này cũng sẽ cần đăng nhập lại ở lần sau; các phiên khác mất hiệu lực ngay.'
      )
    )
      return;
    setRevoking(true);
    const { ok } = await post('security/revoke-all');
    // BẮT BUỘC làm mới phiên hiện tại: revoke-all tăng sessionVersion nên token
    // của chính tab này cũng thành cũ - không update() thì tab này bị đá ra ngay,
    // trông như thao tác hỏng. update() đọc lại sessionVersion mới từ DB.
    if (ok) await update();
    setRevoking(false);
    setMsg(
      ok
        ? { kind: 'ok', text: 'Đã đăng xuất khỏi mọi thiết bị khác.' }
        : { kind: 'error', text: 'Không thực hiện được. Hãy thử lại.' }
    );
    refreshEvents();
  };

  const deactivate = async () => {
    if (
      !confirm(
        'Vô hiệu hoá tài khoản? Bạn sẽ bị đăng xuất; đăng nhập lại bất cứ lúc nào để khôi phục.'
      )
    )
      return;
    setBusy(true);
    const { ok, data } = await post('account/deactivate', { password: dangerPw });
    setBusy(false);
    if (!ok) {
      setMsg({
        kind: 'error',
        text:
          data.error === 'invalid_credentials' ? 'Mật khẩu không đúng.' : 'Không thực hiện được.',
      });
      return;
    }
    await signOut({ callbackUrl: '/' });
  };

  const deleteAccount = async () => {
    if (
      !confirm(
        'XOÁ VĨNH VIỄN tài khoản? Tài khoản bị vô hiệu hoá ngay và sẽ bị xoá sau 30 ngày. Đăng nhập lại trước hạn để huỷ.'
      )
    )
      return;
    setBusy(true);
    const { ok, data } = await post('account/delete', { password: dangerPw });
    setBusy(false);
    if (!ok) {
      setMsg({
        kind: 'error',
        text:
          data.error === 'invalid_credentials'
            ? 'Mật khẩu không đúng.'
            : data.error === 'owner_cannot_self_delete'
            ? 'Tài khoản chủ sở hữu không tự xoá được.'
            : 'Không thực hiện được.',
      });
      return;
    }
    await signOut({ callbackUrl: '/' });
  };

  return (
    <Layout active="/settings">
      <Seo title="Bảo mật" path="/settings/security" noindex />
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-fg">Bảo mật tài khoản</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
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
              <p className="text-sm text-fg-muted">Chưa có passkey nào.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {keys.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-fg">{k.label || 'Không đặt tên'}</p>
                      <p className="text-xs text-fg-muted">
                        Thêm ngày {formatDateVN(k.createdAt)}
                        {k.lastUsedAt
                          ? ` · dùng lần cuối ${formatDateVN(k.lastUsedAt)}`
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
                <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm text-fg">
                  {backupCodes.map((c) => (
                    <li key={c} className="rounded-md bg-subtle px-2.5 py-1.5">
                      {c}
                    </li>
                  ))}
                </ul>
              </>
            ) : setupUri ? (
              <>
                <p className="text-sm text-fg-secondary">
                  Quét mã trong ứng dụng xác thực, hoặc nhập tay khoá bên dưới, rồi nhập mã 6 chữ số
                  để xác nhận.
                </p>
                <p className="mt-2 break-all rounded-md bg-subtle px-3 py-2 font-mono text-xs text-fg-secondary">
                  {setupSecret}
                </p>
                <p className="mt-2 break-all text-xs text-fg-muted">{setupUri}</p>
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
                <p className="text-sm text-fg-secondary">
                  Thêm một mã dùng một lần từ ứng dụng xác thực khi đăng nhập bằng mật khẩu.
                </p>
                <Button variant="secondary" className="mt-4" onClick={startTotp}>
                  Bật xác thực hai bước
                </Button>
                <div className="mt-6 border-t border-line pt-4">
                  <p className="text-sm text-fg-muted">Đã bật rồi và muốn tắt?</p>
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

          <Section title="Phiên đăng nhập">
            <p className="text-sm text-fg-muted">
              Nghi ngờ ai đó còn đăng nhập trên thiết bị của bạn? Đăng xuất khỏi tất cả - các phiên
              khác mất hiệu lực ngay, thiết bị này vẫn được giữ.
            </p>
            <Button variant="secondary" className="mt-4" onClick={revokeAll} disabled={revoking}>
              {revoking ? 'Đang xử lý…' : 'Đăng xuất khỏi mọi thiết bị'}
            </Button>
          </Section>

          <Section title="Hoạt động gần đây">
            <p className="mb-3 text-sm text-fg-muted">
              Các sự kiện bảo mật của tài khoản (đăng nhập, đổi mật khẩu/email, 2FA, passkey). Thấy
              hoạt động lạ thì đổi mật khẩu ngay - nó sẽ đăng xuất mọi thiết bị.
            </p>
            <SecurityEventList events={events} />
          </Section>

          <section className="rounded-lg border border-danger bg-surface p-5 sm:p-6">
            <h2 className="text-base font-semibold text-danger">Vùng nguy hiểm</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Cả hai thao tác đòi mật khẩu hiện tại và sẽ đăng xuất bạn ngay.
            </p>
            <div className="mt-4 max-w-sm">
              <Input
                id="danger-pw"
                type="password"
                label="Mật khẩu hiện tại"
                value={dangerPw}
                onChange={(e) => setDangerPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <p className="text-sm font-medium text-fg">Vô hiệu hoá tài khoản</p>
                <p className="mt-0.5 text-sm text-fg-muted">
                  Ẩn tài khoản tạm thời. Đăng nhập lại bất cứ lúc nào để khôi phục.
                </p>
                <Button
                  variant="secondary"
                  className="mt-2"
                  onClick={deactivate}
                  disabled={busy || !dangerPw}
                >
                  Vô hiệu hoá
                </Button>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-danger">Xoá vĩnh viễn</p>
                <p className="mt-0.5 text-sm text-fg-muted">
                  Hẹn xoá sau 30 ngày. Đăng nhập lại trước hạn để huỷ; quá hạn không khôi phục được.
                </p>
                <Button
                  variant="ghost"
                  className="mt-2 text-danger"
                  onClick={deleteAccount}
                  disabled={busy || !dangerPw}
                >
                  Xoá tài khoản
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
