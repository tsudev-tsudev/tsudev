import React, { useCallback, useEffect, useState } from 'react';
import Seo from '../../components/Seo';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, Badge, SectionHeading } from '@tsudev/ui';
import type { BadgeTone } from '@tsudev/ui';
import { formatDateTimeVN } from '../../lib/format';
import { emailGraceRemainingMs } from '@tsudev/types';

// Trang quản lý tài khoản & phân quyền - CHỈ tài khoản OWNER (tsudev) dùng được.
//
// Cổng thật nằm ở auth-service (requireOwner, đọc User.role từ DB, fail closed);
// trang này chỉ là giao diện. Vì thế gating ở đây bám theo PHẢN HỒI của backend
// (401/403) chứ không tin `session.role` - `token.role` của next-auth chỉ ghi ở
// lần đăng nhập đầu nên có thể cũ (xem gotcha ở CLAUDE.md). Backend luôn là nơi
// quyết định; giao diện chỉ hiển thị cho đúng.

// OWNER cố ý VẮNG MẶT khỏi danh sách cấp được: bậc cao nhất chỉ đến từ seed/DB.
const ASSIGNABLE: { value: string; label: string }[] = [
  { value: 'MEMBER', label: 'Thành viên' },
  { value: 'AUTHOR', label: 'Đăng bài' },
  { value: 'VIP', label: 'VIP · Con dấu' },
  { value: 'MODERATOR', label: 'Điều hành' },
  { value: 'ADMIN', label: 'Quản trị' },
];

const ROLE_LABEL: Record<string, string> = {
  GUEST: 'Khách',
  MEMBER: 'Thành viên',
  AUTHOR: 'Đăng bài',
  VIP: 'VIP · Con dấu',
  MODERATOR: 'Điều hành',
  ADMIN: 'Quản trị',
  OWNER: 'Chủ sở hữu',
};

const ROLE_TONE: Record<string, BadgeTone> = {
  GUEST: 'neutral',
  MEMBER: 'neutral',
  AUTHOR: 'success',
  VIP: 'teal',
  MODERATOR: 'info',
  ADMIN: 'warning',
  OWNER: 'brand',
};

interface AccountRow {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

const inputCls =
  'w-full rounded-md border border-line bg-base px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-primary outline-none';
const labelCls = 'block text-sm font-medium text-fg-secondary mb-1.5';

const ERR: Record<string, string> = {
  invalid_username: 'Tên đăng nhập không hợp lệ (3-32 ký tự, chữ thường/số/._-).',
  invalid_email: 'Email không hợp lệ.',
  invalid_role: 'Vai trò không hợp lệ.',
  invalid_displayName: 'Tên hiển thị không được trống.',
  weak_password: 'Mật khẩu chưa đủ mạnh.',
  username_taken: 'Tên đăng nhập đã có người dùng.',
  email_taken: 'Email đã được đăng ký.',
  cannot_change_self: 'Không thể tự đổi vai trò của chính mình.',
  cannot_delete_self: 'Không thể tự xoá tài khoản của chính mình.',
  cannot_target_owner: 'Không thao tác được lên tài khoản chủ sở hữu.',
  has_linked_records: 'Tài khoản có dữ liệu liên kết - hãy thu hồi vai trò và phiên thay vì xoá.',
  not_found: 'Không tìm thấy tài khoản.',
  forbidden: 'Chỉ tài khoản chủ sở hữu mới vào được trang này.',
};

async function call(action: string, body: Record<string, unknown>) {
  const r = await fetch(`/api/account/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data } as const;
}

export default function AdminAccounts() {
  const { status } = useSession();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ tone: BadgeTone; text: string } | null>(null);

  // Form tạo tài khoản
  const [form, setForm] = useState({
    username: '',
    email: '',
    displayName: '',
    password: '',
    role: 'AUTHOR',
  });
  const [creating, setCreating] = useState(false);

  const flash = (tone: BadgeTone, text: string) => setMsg({ tone, text });
  const flashErr = (data: { error?: string; detail?: string }) =>
    flash('danger', ERR[data?.error || ''] || data?.detail || data?.error || 'Có lỗi xảy ra.');

  const load = useCallback(async () => {
    const r = await call('useradmin/list', {});
    setLoading(false);
    if (r.status === 401 || r.status === 403) {
      setDenied(true);
      return;
    }
    if (Array.isArray(r.data)) setRows(r.data as AccountRow[]);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
    if (status === 'unauthenticated') setLoading(false);
  }, [status, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const r = await call('useradmin/create', form);
    setCreating(false);
    if (!r.ok) return flashErr(r.data);
    flash('success', `Đã tạo tài khoản "${form.username}".`);
    setForm({ username: '', email: '', displayName: '', password: '', role: 'AUTHOR' });
    load();
  }

  async function changeRole(u: AccountRow, role: string) {
    if (role === u.role) return;
    const r = await call('useradmin/role', { id: u.id, role });
    if (!r.ok) return flashErr(r.data);
    flash('success', `Vai trò của "${u.username}" → ${ROLE_LABEL[role]}.`);
    load();
  }

  async function revoke(u: AccountRow) {
    if (
      !confirm(
        `Thu hồi mọi phiên của "${u.username}"? Tài khoản sẽ bị đăng xuất khỏi mọi thiết bị.`
      )
    )
      return;
    const r = await call('useradmin/revoke', { id: u.id });
    if (!r.ok) return flashErr(r.data);
    flash('success', `Đã thu hồi phiên của "${u.username}".`);
  }

  async function remove(u: AccountRow) {
    if (!confirm(`Xoá vĩnh viễn tài khoản "${u.username}"? Không thể hoàn tác.`)) return;
    const r = await call('useradmin/delete', { id: u.id });
    if (!r.ok) return flashErr(r.data);
    flash('success', `Đã xoá tài khoản "${u.username}".`);
    load();
  }

  if (status === 'loading' || loading)
    return (
      <Layout>
        <Seo title="Quản lý tài khoản" path="/admin/accounts" noindex />
        <Card className="p-8 text-center text-fg-muted">Đang tải…</Card>
      </Layout>
    );

  if (status === 'unauthenticated')
    return (
      <Layout>
        <Seo title="Quản lý tài khoản" path="/admin/accounts" noindex />
        <Card className="mx-auto max-w-md p-8 text-center">
          <p className="mb-4 text-fg-secondary">Bạn cần đăng nhập để tiếp tục.</p>
          <Button onClick={() => signIn()} size="lg">
            Đăng nhập
          </Button>
        </Card>
      </Layout>
    );

  if (denied)
    return (
      <Layout>
        <Seo title="Quản lý tài khoản" path="/admin/accounts" noindex />
        <Card className="mx-auto max-w-md p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold text-fg">Không có quyền</h1>
          <p className="text-fg-secondary">Trang này chỉ dành cho tài khoản chủ sở hữu (tsudev).</p>
        </Card>
      </Layout>
    );

  return (
    <Layout>
      <Seo title="Quản lý tài khoản" path="/admin/accounts" noindex />
      <SectionHeading eyebrow="Chủ sở hữu" title="Quản lý tài khoản" />
      <p className="mt-2 text-sm text-fg-muted">
        Tạo tài khoản, phân quyền, thu hồi vai trò và phiên. Chỉ chủ sở hữu (tsudev) dùng được.
      </p>

      {msg && (
        <div className="mt-4">
          <Badge tone={msg.tone}>{msg.text}</Badge>
        </div>
      )}

      {/* Tạo tài khoản mới */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-base font-semibold text-fg">Tạo tài khoản mới</h2>
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Tên đăng nhập</span>
            <input
              className={inputCls}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="vd: tacgia01"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Email</span>
            <input
              className={inputCls}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="vd: tacgia@tsudev.com"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Tên hiển thị</span>
            <input
              className={inputCls}
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="Để trống = dùng tên đăng nhập"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Vai trò</span>
            <select
              className={inputCls}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ASSIGNABLE.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className={labelCls}>Mật khẩu ban đầu</span>
            <input
              className={inputCls}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Người dùng có thể tự đổi sau khi đăng nhập"
              autoComplete="new-password"
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating}>
              {creating ? 'Đang tạo…' : 'Tạo tài khoản'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Danh sách tài khoản */}
      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-fg-muted">
              <th className="px-4 py-3 font-medium">Tài khoản</th>
              <th className="px-4 py-3 font-medium">Vai trò</th>
              <th className="px-4 py-3 font-medium">Tạo lúc</th>
              <th className="px-4 py-3 font-medium">Đăng nhập gần nhất</th>
              <th className="px-4 py-3 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isOwner = u.role === 'OWNER';
              return (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-fg">{u.displayName || u.username}</div>
                    <div className="text-fg-muted">
                      @{u.username} · {u.email}
                      {!u.emailVerified &&
                        (emailGraceRemainingMs(null, u.createdAt) > 0
                          ? ' · chưa xác minh (còn ân hạn)'
                          : ' · chưa xác minh (quá hạn)')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isOwner ? (
                      <Badge tone={ROLE_TONE.OWNER}>{ROLE_LABEL.OWNER}</Badge>
                    ) : (
                      <select
                        className={inputCls + ' w-auto py-1.5'}
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value)}
                      >
                        {ASSIGNABLE.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-fg-secondary">{formatDateTimeVN(u.createdAt)}</td>
                  <td className="px-4 py-3 text-fg-secondary">
                    {u.lastLoginAt ? formatDateTimeVN(u.lastLoginAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {isOwner ? (
                      <span className="text-fg-muted">—</span>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => revoke(u)}>
                          Thu hồi phiên
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => remove(u)}>
                          Xoá
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                  Chưa có tài khoản nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </Layout>
  );
}
