import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Input, Layout } from '@tsudev/ui';

import Seo from '../../components/Seo';
import { Notice } from '../../components/AuthShell';

/**
 * Hồ sơ của chính mình.
 *
 * Trước trang này KHÔNG có đường nào để người dùng sửa hồ sơ của họ:
 * `displayName` đặt một lần lúc đăng ký rồi thôi, dù nó là thứ hiển thị công
 * khai dưới mỗi bài viết; `bio` là cột chết, không nơi nào đọc lẫn ghi.
 *
 * `/settings/security` (2FA, passkey) cố ý ở trang riêng: nó là nơi thao tác khi
 * nghi ngờ tài khoản bị xâm nhập, và trộn nó với ô sửa tiểu sử làm loãng đúng
 * lúc cần rõ ràng nhất.
 */

type Profile = {
  username: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  role: string;
  hasPassword: boolean;
  emailVerified: boolean;
};

const post = async (path: string, body?: unknown) => {
  const res = await fetch(`/api/account/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  // `status` được trả ra chứ không nuốt: 401 và "sai mật khẩu" là HAI chuyện
  // khác nhau, và gộp chúng vào một thông điệp đã khiến một sự cố phiên bị chẩn
  // thành lỗi mật khẩu.
  return { ok: res.ok, status: res.status, data } as {
    ok: boolean;
    status: number;
    data: Record<string, unknown>;
  };
};

/**
 * Dịch lỗi thành câu người dùng đọc được - và KHÔNG nói dối.
 *
 * Bản đầu của trang này gộp mọi lỗi chưa nhận ra thành "Mật khẩu hiện tại không
 * đúng". Khi phiên bị từ chối ở tầng proxy (401), người dùng nhận đúng câu đó và
 * gõ lại mật khẩu ĐÚNG nhiều lần trong khi vấn đề nằm ở chỗ hoàn toàn khác. Một
 * thông điệp lỗi đoán bừa còn tệ hơn một thông điệp chung chung.
 */
const SESSION_EXPIRED = 'Phiên đăng nhập không còn hợp lệ. Hãy đăng nhập lại rồi thử lại.';

const saveError = (status: number): string =>
  status === 401 ? SESSION_EXPIRED : 'Không lưu được. Hãy thử lại.';

const passwordError = (status: number, code: string): string => {
  if (code === 'no_password_set') {
    return 'Tài khoản này chưa từng đặt mật khẩu. Hãy dùng "Quên mật khẩu" để đặt lần đầu.';
  }
  if (code === 'weak_password') {
    return 'Mật khẩu mới chưa đủ mạnh. Cần ít nhất 12 ký tự và không nằm trong danh sách phổ biến.';
  }
  // 401 có HAI nguồn nói hai chuyện khác nhau: `invalid_credentials` là
  // auth-service đã kiểm mật khẩu và từ chối; mọi 401 khác nghĩa là request chưa
  // bao giờ tới được chỗ kiểm mật khẩu.
  if (status === 401) {
    return code === 'invalid_credentials' ? 'Mật khẩu hiện tại không đúng.' : SESSION_EXPIRED;
  }
  return 'Không đổi được mật khẩu. Hãy thử lại.';
};

const Section = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-lg border border-hairline bg-panel p-5 sm:p-6">
    <h2 className="text-base font-semibold text-ink">{title}</h2>
    {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

/** Chỉ đọc: những thứ trang này CỐ Ý không cho sửa. */
const ReadOnlyRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
    <span className="text-sm text-muted">{label}</span>
    <span className="text-sm text-ink">{value}</span>
  </div>
);

const MAX_BIO = 500;

export default function ProfilePage() {
  const { status, update } = useSession();
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await post('profile/get');
    if (!ok) return;
    const p = data as unknown as Profile;
    setProfile(p);
    setDisplayName(p.displayName ?? '');
    setBio(p.bio ?? '');
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  // `noindex` phải có ở CẢ hai nhánh chưa-đăng-nhập. Trình thu thập KHÔNG BAO
  // GIỜ có phiên, nên hai nhánh này là trạng thái duy nhất nó nhìn thấy - đặt
  // thẻ ở nhánh đã đăng nhập là đặt đúng chỗ không ai đọc.
  if (status === 'loading') {
    return (
      <Layout active="/settings">
        <Seo title="Hồ sơ" path="/settings/profile" noindex />
        <p className="text-sm text-muted">Đang tải…</p>
      </Layout>
    );
  }

  if (status !== 'authenticated') {
    return (
      <Layout active="/settings">
        <Seo title="Hồ sơ" path="/settings/profile" noindex />
        <div className="mx-auto max-w-md">
          <Notice kind="error">Bạn cần đăng nhập để mở trang này.</Notice>
          <Button as="a" href="/login?callbackUrl=/settings/profile" className="mt-4 w-full">
            Đăng nhập
          </Button>
        </div>
      </Layout>
    );
  }

  const saveProfile = async () => {
    setSaving(true);
    // Đặt tên khác `status` của useSession có chủ đích: hai thứ này khác nhau
    // hoàn toàn, và để chúng cùng tên trong một hàm là mời một lỗi đọc nhầm.
    const { ok, status: httpStatus } = await post('profile/update', { displayName, bio });
    setSaving(false);
    if (!ok) {
      setMsg({ kind: 'error', text: saveError(httpStatus) });
      return;
    }
    setMsg({ kind: 'ok', text: 'Đã lưu hồ sơ.' });
    load();
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMsg({ kind: 'error', text: 'Hai ô mật khẩu mới không khớp nhau.' });
      return;
    }
    setChanging(true);
    const {
      ok,
      status: httpStatus,
      data,
    } = await post('password/change', { currentPassword, newPassword });
    setChanging(false);

    if (!ok) {
      setMsg({ kind: 'error', text: passwordError(httpStatus, String(data.error || '')) });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    // BẮT BUỘC. Đổi mật khẩu tăng `sessionVersion` để đá mọi phiên khác ra, mà
    // phiên đang thao tác cũng mang số cũ - không nâng nó lên thì chính người
    // vừa đổi thành công bị đăng xuất ngay, trông y hệt như thao tác đã hỏng.
    // Đọc lại TỪ DB qua session-state, không lấy từ tham số truyền vào.
    await update();

    setMsg({
      kind: 'ok',
      text: 'Đã đổi mật khẩu. Mọi thiết bị khác đang đăng nhập đã bị đăng xuất.',
    });
    load();
  };

  return (
    <Layout active="/settings">
      <Seo title="Hồ sơ" path="/settings/profile" noindex />

      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink">Hồ sơ</h1>
        <p className="mt-1 text-sm text-muted">
          Tên hiển thị và giới thiệu là thông tin CÔNG KHAI - chúng xuất hiện dưới mỗi bài viết bạn
          đăng.
        </p>

        {msg && (
          <div className="mt-4">
            <Notice kind={msg.kind}>{msg.text}</Notice>
          </div>
        )}

        <div className="mt-6 space-y-6">
          <Section title="Thông tin công khai">
            <div className="space-y-4">
              <Input
                label="Tên hiển thị"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={profile?.username ?? ''}
                maxLength={60}
              />
              <div className="flex flex-col">
                <label htmlFor="bio" className="mb-1 text-sm font-medium text-inksoft">
                  Giới thiệu
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  maxLength={MAX_BIO}
                  className="rounded-md border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-brand"
                />
                <p className="mt-1 text-sm text-muted">
                  {bio.length}/{MAX_BIO} ký tự
                </p>
              </div>
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
              </Button>
            </div>
          </Section>

          <Section
            title="Đổi mật khẩu"
            hint="Phải nhập mật khẩu hiện tại. Một phiên bị đánh cắp không được phép đủ để đổi mật khẩu."
          >
            {profile && !profile.hasPassword ? (
              <div>
                <p className="text-sm text-muted">
                  Tài khoản này đăng nhập bằng passkey và chưa từng đặt mật khẩu.
                </p>
                <Button as="a" href="/forgot-password" variant="secondary" className="mt-3">
                  Đặt mật khẩu lần đầu
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  label="Mật khẩu hiện tại"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <Input
                  label="Mật khẩu mới"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <Input
                  label="Nhập lại mật khẩu mới"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <Button onClick={changePassword} disabled={changing}>
                  {changing ? 'Đang đổi…' : 'Đổi mật khẩu'}
                </Button>
              </div>
            )}
          </Section>

          <Section
            title="Không đổi được ở đây"
            hint="Ba thứ này cố ý nằm ngoài trang hồ sơ - lý do ghi ngay bên cạnh."
          >
            <div className="divide-y divide-hairline">
              <ReadOnlyRow label="Tên đăng nhập" value={profile?.username ?? '…'} />
              <ReadOnlyRow label="Email" value={profile?.email ?? '…'} />
              <ReadOnlyRow label="Vai trò" value={profile?.role ?? '…'} />
            </div>
            <p className="mt-4 text-sm text-muted">
              Đổi email phải xác minh địa chỉ mới TRƯỚC khi thay - thay trước rồi mới gửi thư là mở
              một đường chiếm tài khoản. Vai trò chỉ nâng được bằng mã mời.
            </p>
            <Button as="a" href="/settings/security" variant="secondary" className="mt-4">
              Bảo mật: 2FA và passkey
            </Button>
          </Section>
        </div>
      </div>
    </Layout>
  );
}
