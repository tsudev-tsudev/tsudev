import React, { useCallback, useEffect, useState } from 'react';
import Seo from '../components/Seo';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, Input, Badge, Icon, SectionHeading } from '@tsudev/ui';
import { formatDateTimeVN } from '../lib/format';

/** Bài của chính tác giả, như `/api/author/posts` trả về (gồm bản chưa công bố). */
interface AuthorPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentMd: string;
  tags: string[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

type AuthorMessage = { tone: 'ok' | 'error'; text: string };

/**
 * Trạng thái biểu mẫu. Mọi ô là CHUỖI kể cả `tags` (nhập bằng dấu phẩy) - việc
 * tách mảng dồn về đúng một chỗ lúc gửi đi, thay vì rải khắp các ô nhập.
 */
type PostForm = {
  slug: string;
  title: string;
  excerpt: string;
  tags: string;
  contentMd: string;
  published: boolean;
};

const EMPTY: PostForm = {
  slug: '',
  title: '',
  excerpt: '',
  tags: '',
  contentMd: '',
  published: true,
};

export default function AuthorEditor() {
  const { data: session, status } = useSession();
  const [posts, setPosts] = useState<AuthorPost[]>([]);
  const [form, setForm] = useState<PostForm>(EMPTY);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [msg, setMsg] = useState<AuthorMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/content/author/posts');
    if (res.status === 403) {
      // Backend là nơi quyết định quyền (đọc User.role từ DB). `session.role` có
      // thể cũ vì token next-auth chỉ ghi vai trò ở lần đăng nhập đầu, nên ta bám
      // theo PHẢN HỒI của backend chứ không theo phiên.
      setDenied(true);
      return;
    }
    if (!res.ok) {
      setMsg({ tone: 'error', text: 'Không tải được danh sách bài.' });
      return;
    }
    setDenied(false);
    setPosts(await res.json());
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  const set =
    (k: keyof PostForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const target = e.target as HTMLInputElement;
      const v = target.type === 'checkbox' ? target.checked : target.value;
      setForm((f) => ({ ...f, [k]: v }));
    };

  const startEdit = (p: AuthorPost) => {
    setEditingSlug(p.slug);
    setForm({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt || '',
      tags: p.tags.join(', '),
      contentMd: p.contentMd,
      published: p.published,
    });
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
    const body = {
      title: form.title,
      // slug rỗng khi tạo mới ⇒ backend tự suy từ title. Khi sửa thì gửi slug.
      slug: form.slug || undefined,
      excerpt: form.excerpt,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      contentMd: form.contentMd,
      published: form.published,
    };
    const url = editingSlug
      ? `/api/content/author/posts/${editingSlug}`
      : '/api/content/author/posts';
    const res = await fetch(url, {
      method: editingSlug ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ tone: 'error', text: data.error || 'Lưu không thành công.' });
      return;
    }
    setMsg({ tone: 'ok', text: editingSlug ? 'Đã cập nhật.' : 'Đã đăng bài.' });
    reset();
    load();
  };

  const remove = async (slug: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Xoá bài "${slug}"?`)) return;
    const res = await fetch(`/api/content/author/posts/${slug}`, { method: 'DELETE' });
    if (!res.ok) {
      setMsg({ tone: 'error', text: 'Xoá không thành công.' });
      return;
    }
    if (editingSlug === slug) reset();
    load();
  };

  // `noindex` phải có ở MỌI nhánh chưa đăng nhập/không đủ quyền: trình thu thập
  // không bao giờ có phiên nên chỉ nhìn thấy các nhánh này.
  if (status === 'loading')
    return (
      <Layout>
        <Seo title="Soạn bài" path="/author" noindex />
        <Card className="p-8 text-center text-fg-muted">Đang tải…</Card>
      </Layout>
    );

  if (!session)
    return (
      <Layout>
        <Seo title="Soạn bài" path="/author" noindex />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-fg mb-2">Soạn bài</h1>
          <p className="text-fg-muted mb-4">Cần đăng nhập bằng tài khoản có quyền đăng bài.</p>
          <Button onClick={() => signIn()}>Đăng nhập</Button>
        </div>
      </Layout>
    );

  if (denied)
    return (
      <Layout>
        <Seo title="Soạn bài" path="/author" noindex />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-fg mb-2">Soạn bài</h1>
          <p className="text-fg-muted">
            Tài khoản của bạn chưa có quyền đăng bài (cần vai trò Đăng bài trở lên).
          </p>
        </div>
      </Layout>
    );

  return (
    <Layout active="/author" bare>
      <Seo title="Soạn bài" path="/author" noindex />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <SectionHeading
          eyebrow="Tác giả"
          title="Bài viết của tôi"
          action={
            <Badge tone="brand" mono>
              {posts.length} bài
            </Badge>
          }
        />

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
            {editingSlug ? `Sửa: ${editingSlug}` : 'Viết bài mới'}
          </h2>
          <form onSubmit={submit} className="grid gap-4">
            <Input id="title" label="Tiêu đề" value={form.title} onChange={set('title')} required />
            <Input
              id="slug"
              label="Slug"
              value={form.slug}
              onChange={set('slug')}
              placeholder="Bỏ trống để tự suy từ tiêu đề"
            />
            <Input
              id="excerpt"
              label="Tóm tắt"
              value={form.excerpt}
              onChange={set('excerpt')}
              placeholder="Một hai câu giới thiệu (tuỳ chọn)"
            />
            <Input
              id="tags"
              label="Thẻ (phân cách bằng dấu phẩy)"
              value={form.tags}
              onChange={set('tags')}
              placeholder="rust, wasm, hạ tầng"
            />
            <div className="flex flex-col">
              <label htmlFor="contentMd" className="text-sm font-medium text-fg-secondary mb-1">
                Nội dung (Markdown)
              </label>
              <textarea
                id="contentMd"
                rows={16}
                value={form.contentMd}
                onChange={set('contentMd')}
                required
                className="rounded-md border border-line bg-base px-3 py-2.5 text-sm text-fg font-mono outline-none focus:border-primary"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-fg-secondary">
              <input type="checkbox" checked={form.published} onChange={set('published')} />
              Công bố (bỏ chọn để lưu nháp)
            </label>

            <div className="flex gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? 'Đang lưu…' : editingSlug ? 'Cập nhật' : 'Đăng bài'}
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
          {posts.length === 0 && <Card className="p-6 text-fg-muted">Bạn chưa có bài nào.</Card>}
          {posts.map((p) => (
            <Card key={p.id} className="p-5 flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-[16rem]">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <span className="font-semibold text-fg">{p.title}</span>
                  <span className="font-mono text-xs text-fg-muted">{p.slug}</span>
                  {p.published ? (
                    <Badge tone="success">Đã công bố</Badge>
                  ) : (
                    <Badge tone="warning">Nháp</Badge>
                  )}
                </div>
                {p.excerpt && <p className="text-sm text-fg-muted">{p.excerpt}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {p.tags.map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                  <span className="text-xs text-fg-muted">
                    Sửa lần cuối {formatDateTimeVN(p.updatedAt)}
                  </span>
                </div>
              </div>
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
          ))}
        </div>
      </div>
    </Layout>
  );
}
