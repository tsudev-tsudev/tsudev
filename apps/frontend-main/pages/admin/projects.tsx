import React, { useCallback, useEffect, useState } from 'react';
import Seo from '../../components/Seo';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, Input, Badge, Icon, SectionHeading } from '@tsudev/ui';
import {
  KIND_LABEL,
  STATUS_LABEL,
  COPYRIGHT,
  KINDS,
  STATUSES,
  COPYRIGHT_STATUSES,
  copyrightMeta,
} from '../../lib/projectLabels';
import type { Project } from '../../lib/types';

/** Thông báo hiện cho người quản trị, kèm tông màu. */
type AdminMessage = { tone: string; text: string };

/**
 * Trạng thái của biểu mẫu. Mọi ô nhập là CHUỖI kể cả khi cột trong DB là số
 * hoặc ngày - đó là cách <input> hoạt động, và giả vờ ngược lại chỉ đẩy việc ép
 * kiểu sang chỗ khác. `sortOrder` được parse một lần lúc gửi đi.
 */
type ProjectForm = {
  slug: string;
  name: string;
  summary: string;
  descriptionMd: string;
  kind: string;
  status: string;
  version: string;
  releasedAt: string;
  repoUrl: string;
  homepageUrl: string;
  downloadUrl: string;
  license: string;
  copyrightStatus: string;
  copyrightNo: string;
  copyrightAt: string;
  copyrightOwner: string;
  trustProgramSlug: string;
  featured: boolean;
  published: boolean;
  sortOrder: number | string;
};

const EMPTY: ProjectForm = {
  slug: '',
  name: '',
  summary: '',
  descriptionMd: '',
  kind: 'TOOL',
  status: 'WIP',
  version: '',
  releasedAt: '',
  repoUrl: '',
  homepageUrl: '',
  downloadUrl: '',
  license: '',
  copyrightStatus: 'NONE',
  copyrightNo: '',
  copyrightAt: '',
  copyrightOwner: '',
  trustProgramSlug: '',
  featured: false,
  published: true,
  sortOrder: 0,
};

const dateInput = (d: string | Date | null | undefined): string =>
  d ? new Date(d).toISOString().slice(0, 10) : '';

type SelectProps = {
  id: string;
  label: React.ReactNode;
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  options: string[];
  /** Nhãn hiển thị: hoặc chuỗi trực tiếp, hoặc object có `.label`. */
  labels?: Record<string, string | { label: string }>;
};

function Select({ id, label, value, onChange, options, labels }: SelectProps) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-sm font-medium text-fg-secondary mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        className="rounded-md border border-line bg-base px-3 py-2.5 text-sm text-fg outline-none focus:border-primary"
      >
        {options.map((o) => {
          const raw = labels?.[o];
          const text = typeof raw === 'string' ? raw : raw?.label ?? o;
          return (
            <option key={o} value={o}>
              {text}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export default function AdminProjects() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<ProjectForm>(EMPTY);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [msg, setMsg] = useState<AdminMessage | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/content/admin/projects');
    if (!res.ok) {
      setMsg({ tone: 'error', text: 'Không tải được danh sách dự án.' });
      return;
    }
    setProjects(await res.json());
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  const set =
    (k: keyof ProjectForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const target = e.target as HTMLInputElement;
      const v = target.type === 'checkbox' ? target.checked : target.value;
      setForm((f) => ({ ...f, [k]: v }));
    };

  const startEdit = (p: Project) => {
    setEditingSlug(p.slug);
    // `...p` mang theo cả những trường KHÔNG thuộc biểu mẫu (id, createdAt…).
    // Trước đây chúng lặng lẽ nằm trong state rồi được gửi ngược lên API lúc
    // lưu. Ép về ProjectForm ở đây khiến phần thừa bị bỏ đi ngay tại nguồn.
    const merged: ProjectForm = {
      ...EMPTY,
      ...(p as Partial<ProjectForm>),
      version: p.version || '',
      releasedAt: dateInput(p.releasedAt),
      copyrightAt: dateInput(p.copyrightAt),
      repoUrl: p.repoUrl || '',
      homepageUrl: p.homepageUrl || '',
      downloadUrl: p.downloadUrl || '',
      license: p.license || '',
      copyrightNo: p.copyrightNo || '',
      copyrightOwner: p.copyrightOwner || '',
      trustProgramSlug: p.trustProgramSlug || '',
      descriptionMd: p.descriptionMd || '',
    };
    setForm(merged);
    setMsg(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    setEditingSlug(null);
    setForm(EMPTY);
    setMsg(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const url = editingSlug
      ? `/api/content/admin/projects/${editingSlug}`
      : '/api/content/admin/projects';
    const res = await fetch(url, {
      method: editingSlug ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ tone: 'error', text: data.error || 'Lưu không thành công.' });
      return;
    }
    setMsg({ tone: 'ok', text: editingSlug ? 'Đã cập nhật.' : 'Đã tạo dự án.' });
    reset();
    load();
  };

  const remove = async (slug: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Xoá dự án "${slug}"?`)) return;
    const res = await fetch(`/api/content/admin/projects/${slug}`, { method: 'DELETE' });
    if (!res.ok) {
      setMsg({ tone: 'error', text: 'Xoá không thành công.' });
      return;
    }
    if (editingSlug === slug) reset();
    load();
  };

  // `noindex` phải có ở CẢ hai nhánh chưa-đăng-nhập. Trình thu thập của công cụ
  // tìm kiếm KHÔNG BAO GIỜ có phiên, nên trạng thái duy nhất nó nhìn thấy chính
  // là hai nhánh này - đặt thẻ ở nhánh đã đăng nhập là đặt đúng chỗ không ai đọc.
  if (status === 'loading')
    return (
      <Layout>
        <Seo title="Quản lý dự án" path="/admin/projects" noindex />
        <Card className="p-8 text-center text-fg-muted">Đang tải…</Card>
      </Layout>
    );

  if (!session)
    return (
      <Layout>
        <Seo title="Quản lý dự án" path="/admin/projects" noindex />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-fg mb-2">Quản lý dự án</h1>
          <p className="text-fg-muted mb-4">Cần đăng nhập bằng tài khoản quản trị.</p>
          <Button onClick={() => signIn()}>Đăng nhập</Button>
        </div>
      </Layout>
    );

  return (
    <Layout active="/admin" bare>
      <Seo title="Quản lý dự án" path="/admin/projects" noindex />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <SectionHeading
          eyebrow="Quản trị"
          title="Dự án & bản quyền"
          action={
            <Badge tone="brand" mono>
              {projects.length} dự án
            </Badge>
          }
        />
        <nav className="-mt-2 mb-6 text-sm text-fg-muted">
          <a href="/admin" className="hover:text-link">
            Bảng điều khiển
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-fg-secondary">Dự án</span>
        </nav>

        {msg && (
          <Card
            className={`p-4 mb-6 text-sm ${
              msg.tone === 'error' ? 'text-danger-ink' : 'text-success-ink'
            }`}
          >
            {msg.text}
          </Card>
        )}

        <Card className="p-6 mb-8">
          <h2 className="font-semibold text-fg mb-4">
            {editingSlug ? `Sửa: ${editingSlug}` : 'Thêm dự án mới'}
          </h2>
          <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
            <Input id="slug" label="Slug" value={form.slug} onChange={set('slug')} required />
            <Input id="name" label="Tên" value={form.name} onChange={set('name')} required />
            <Input
              id="summary"
              label="Tóm tắt"
              value={form.summary}
              onChange={set('summary')}
              required
              className="md:col-span-2"
            />

            <div className="flex flex-col md:col-span-2">
              <label htmlFor="descriptionMd" className="text-sm font-medium text-fg-secondary mb-1">
                Mô tả (Markdown)
              </label>
              <textarea
                id="descriptionMd"
                rows={6}
                value={form.descriptionMd}
                onChange={set('descriptionMd')}
                className="rounded-md border border-line bg-base px-3 py-2.5 text-sm text-fg font-mono outline-none focus:border-primary"
              />
            </div>

            <Select
              id="kind"
              label="Loại"
              value={form.kind}
              onChange={set('kind')}
              options={KINDS}
              labels={KIND_LABEL}
            />
            <Select
              id="status"
              label="Trạng thái"
              value={form.status}
              onChange={set('status')}
              options={STATUSES}
              labels={STATUS_LABEL}
            />

            <Input
              id="version"
              label="Phiên bản"
              value={form.version}
              onChange={set('version')}
              placeholder="1.0.0"
            />
            <Input
              id="releasedAt"
              label="Ngày phát hành"
              type="date"
              value={form.releasedAt}
              onChange={set('releasedAt')}
            />
            <Input
              id="license"
              label="Giấy phép (SPDX)"
              value={form.license}
              onChange={set('license')}
              placeholder="MIT"
            />
            <Input id="repoUrl" label="Mã nguồn" value={form.repoUrl} onChange={set('repoUrl')} />
            <Input
              id="homepageUrl"
              label="Trang giới thiệu"
              value={form.homepageUrl}
              onChange={set('homepageUrl')}
            />
            <Input
              id="downloadUrl"
              label="Tải về"
              value={form.downloadUrl}
              onChange={set('downloadUrl')}
            />

            <Select
              id="copyrightStatus"
              label="Bản quyền"
              value={form.copyrightStatus}
              onChange={set('copyrightStatus')}
              options={COPYRIGHT_STATUSES}
              labels={COPYRIGHT}
            />
            <Input
              id="copyrightNo"
              label="Số giấy chứng nhận"
              value={form.copyrightNo}
              onChange={set('copyrightNo')}
              required={form.copyrightStatus === 'REGISTERED'}
            />
            <Input
              id="copyrightAt"
              label="Ngày cấp bản quyền"
              type="date"
              value={form.copyrightAt}
              onChange={set('copyrightAt')}
            />
            <Input
              id="copyrightOwner"
              label="Chủ sở hữu"
              value={form.copyrightOwner}
              onChange={set('copyrightOwner')}
            />
            <Input
              id="trustProgramSlug"
              label="Chương trình dấu liên quan"
              value={form.trustProgramSlug}
              onChange={set('trustProgramSlug')}
              placeholder="copyright-verified"
            />
            <Input
              id="sortOrder"
              label="Thứ tự"
              type="number"
              value={form.sortOrder}
              onChange={set('sortOrder')}
            />

            <div className="flex items-center gap-6 md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-fg-secondary">
                <input type="checkbox" checked={form.featured} onChange={set('featured')} />
                Nổi bật
              </label>
              <label className="flex items-center gap-2 text-sm text-fg-secondary">
                <input type="checkbox" checked={form.published} onChange={set('published')} />
                Công bố
              </label>
            </div>

            <div className="flex gap-3 md:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'Đang lưu…' : editingSlug ? 'Cập nhật' : 'Tạo dự án'}
              </Button>
              {editingSlug && (
                <Button type="button" variant="ghost" onClick={reset}>
                  Huỷ
                </Button>
              )}
            </div>
          </form>
        </Card>

        <div className="space-y-3">
          {projects.length === 0 && <Card className="p-6 text-fg-muted">Chưa có dự án nào.</Card>}
          {projects.map((p) => {
            const cr = copyrightMeta(p.copyrightStatus);
            return (
              <Card key={p.id} className="p-5 flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-[16rem]">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className="font-semibold text-fg">{p.name}</span>
                    <span className="font-mono text-xs text-fg-muted">{p.slug}</span>
                    {!p.published && <Badge tone="warning">Chưa công bố</Badge>}
                    {p.featured && <Badge tone="brand">Nổi bật</Badge>}
                  </div>
                  <p className="text-sm text-fg-muted">{p.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">{KIND_LABEL[p.kind] || p.kind}</Badge>
                    <Badge tone="outline">{STATUS_LABEL[p.status] || p.status}</Badge>
                    <Badge tone={cr.tone}>{cr.label}</Badge>
                    {p.copyrightNo && (
                      <span className="font-mono text-xs text-fg-muted">{p.copyrightNo}</span>
                    )}
                  </div>
                </div>
                {/* Nút hành động KHÔNG có nền và viền riêng. Ở một danh sách,
                    mỗi hàng có hai nút đặc là hai mảng màu lặp lại xuống hết
                    trang - chúng át cả nội dung mà chúng phục vụ. Màu icon (hổ
                    phách = sửa, đỏ = xoá) đã mang đủ tín hiệu; nền chỉ xuất hiện
                    khi rê chuột. */}
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                    <Icon name="edit" />
                    Sửa
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.slug)}>
                    <Icon name="trash" />
                    Xoá
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
