import React, { useCallback, useEffect, useState } from 'react';
import Seo from '../components/Seo';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, Input, Badge, Icon, SectionHeading, RecordFooter } from '@tsudev/ui';
import { viWordCount } from '@tsudev/search';
import { formatDateTimeVN } from '../lib/format';
import { renderMarkdown } from '../lib/md';
import type { PageMeta } from '@tsudev/types';

import { useUrlPaging, useUrlPagingSync } from '../lib/useUrlPaging';

/** Một nguồn tham khảo {nhãn, đường dẫn}. */
interface PostRef {
  label: string;
  url: string;
}

/** Bài của chính tác giả, như `/api/author/posts` trả về (gồm bản chưa công bố). */
interface AuthorPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentMd: string;
  tags: string[];
  published: boolean;
  publishedAt: string | null;
  references: PostRef[];
  coverImageUrl: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

type AuthorMessage = { tone: 'ok' | 'error'; text: string };

/**
 * Trạng thái biểu mẫu. Các ô văn bản là CHUỖI (kể cả `tags` nhập bằng dấu phẩy);
 * `references` là mảng dòng để thêm/bớt được. `publishedAt` là chuỗi của
 * `<input type="datetime-local">` ('' = đăng ngay khi tạo / giữ nguyên khi sửa).
 */
type PostForm = {
  slug: string;
  title: string;
  excerpt: string;
  tags: string;
  contentMd: string;
  published: boolean;
  publishedAt: string;
  coverImageUrl: string;
  metaDescription: string;
  references: PostRef[];
};

const EMPTY: PostForm = {
  slug: '',
  title: '',
  excerpt: '',
  tags: '',
  contentMd: '',
  published: true,
  publishedAt: '',
  coverImageUrl: '',
  metaDescription: '',
  references: [],
};

/** ISO (UTC) → giá trị `datetime-local` theo giờ máy ('YYYY-MM-DDTHH:mm'). */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** `datetime-local` (giờ máy) → ISO để gửi backend; rỗng ⇒ null. */
function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const isFuture = (iso: string | null): boolean => !!iso && new Date(iso).getTime() > Date.now();

export default function AuthorEditor() {
  const { data: session, status } = useSession();
  const [posts, setPosts] = useState<AuthorPost[]>([]);
  const [form, setForm] = useState<PostForm>(EMPTY);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [msg, setMsg] = useState<AuthorMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const paging = useUrlPaging('author-posts');
  const { page, setPage, pageSize, setPageSize, meta } = paging;
  useUrlPagingSync([paging]);

  const load = useCallback(async () => {
    if (!paging.ready) return;
    setLoading(true);
    const res = await fetch(`/api/content/author/posts?page=${page}&page_size=${pageSize}`);
    setLoading(false);
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
    const body = (await res.json()) as { data?: AuthorPost[]; meta?: PageMeta };
    if (Array.isArray(body?.data)) setPosts(body.data);
    if (body?.meta) paging.setMeta(body.meta);
    // `paging` cố ý không nằm trong deps: nó là object mới mỗi lần dựng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, paging.ready]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  const set =
    (k: keyof PostForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const target = e.target as HTMLInputElement;
      const v = target.type === 'checkbox' ? target.checked : target.value;
      setForm((f) => ({ ...f, [k]: v }));
    };

  // --- Nguồn tham khảo: thêm/sửa/bớt dòng ---
  const addRef = () =>
    setForm((f) => ({ ...f, references: [...f.references, { label: '', url: '' }] }));
  const setRef = (i: number, k: keyof PostRef, v: string) =>
    setForm((f) => ({
      ...f,
      references: f.references.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)),
    }));
  const removeRef = (i: number) =>
    setForm((f) => ({ ...f, references: f.references.filter((_, idx) => idx !== i) }));

  // --- Tải ảnh/video lên object storage rồi lấy URL công khai để nhúng ---
  const uploadFile = async (file: File): Promise<string | null> => {
    const res = await fetch(`/api/storage/upload?key=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'x-filename': file.name,
      },
      body: file,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { publicUrl?: string } | null;
    return data?.publicUrl ?? null;
  };

  // Chèn ảnh/video vào nội dung (Markdown). Video (đuôi mp4/webm/ogg) vẫn dùng cú
  // pháp `![]()` - renderMarkdown tự nhận đuôi và xuất <video>.
  const onInsertMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setMsg(null);
    const url = await uploadFile(file);
    setUploading(false);
    if (!url) {
      setMsg({ tone: 'error', text: 'Tải tệp lên không thành công.' });
      return;
    }
    const alt = file.name.replace(/\.[^.]+$/, '');
    setForm((f) => ({ ...f, contentMd: `${f.contentMd}\n\n![${alt}](${url})\n` }));
  };

  const onUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setMsg(null);
    const url = await uploadFile(file);
    setUploading(false);
    if (!url) {
      setMsg({ tone: 'error', text: 'Tải ảnh bìa lên không thành công.' });
      return;
    }
    setForm((f) => ({ ...f, coverImageUrl: url }));
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
      publishedAt: toLocalInput(p.publishedAt),
      coverImageUrl: p.coverImageUrl || '',
      metaDescription: p.metaDescription || '',
      references: p.references?.length ? p.references.map((r) => ({ ...r })) : [],
    });
    setMsg(null);
    setPreview(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    setEditingSlug(null);
    setForm(EMPTY);
    setMsg(null);
    setPreview(false);
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
      // Rỗng khi TẠO ⇒ bỏ qua (backend đặt = now). Rỗng khi SỬA ⇒ null (xoá lịch).
      publishedAt: form.publishedAt
        ? fromLocalInput(form.publishedAt)
        : editingSlug
        ? null
        : undefined,
      coverImageUrl: form.coverImageUrl.trim() || null,
      metaDescription: form.metaDescription.trim() || null,
      references: form.references
        .map((r) => ({ label: r.label.trim(), url: r.url.trim() }))
        .filter((r) => r.url),
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

  const wordCount = viWordCount(form.contentMd);
  const scheduled = isFuture(fromLocalInput(form.publishedAt));

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-fg">
              {editingSlug ? `Sửa: ${editingSlug}` : 'Viết bài mới'}
            </h2>
            <Button
              type="button"
              size="sm"
              variant={preview ? 'primary' : 'ghost'}
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? 'Đang xem trước' : 'Xem trước'}
            </Button>
          </div>

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

            {/* Thời gian đăng + lên lịch */}
            <div className="flex flex-col">
              <label htmlFor="publishedAt" className="text-sm font-medium text-fg-secondary mb-1">
                Thời gian đăng
                {scheduled && (
                  <Badge tone="warning" className="ml-2">
                    Đã lên lịch
                  </Badge>
                )}
              </label>
              <input
                id="publishedAt"
                type="datetime-local"
                value={form.publishedAt}
                onChange={set('publishedAt')}
                className="rounded-md border border-line bg-base px-3 py-2.5 text-sm text-fg outline-none focus:border-primary"
              />
              <p className="text-xs text-fg-muted mt-1">
                Đặt tương lai để hẹn lịch (bài ẩn tới giờ). Bỏ trống khi tạo = đăng ngay.
              </p>
            </div>

            {/* Ảnh bìa: dán URL hoặc tải trực tiếp lên object storage */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  id="coverImageUrl"
                  label="Ảnh bìa (URL)"
                  value={form.coverImageUrl}
                  onChange={set('coverImageUrl')}
                  placeholder="https://… hoặc bấm Tải lên"
                />
              </div>
              <label className="shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onUploadCover}
                  className="hidden"
                  disabled={uploading}
                />
                <span className="inline-flex items-center gap-1 rounded-md border border-line-control px-3 py-2.5 text-sm text-fg-secondary cursor-pointer hover:border-primary">
                  <Icon name="plus" />
                  {uploading ? 'Đang tải…' : 'Tải lên'}
                </span>
              </label>
            </div>

            {/* Mô tả SEO */}
            <div className="flex flex-col">
              <label
                htmlFor="metaDescription"
                className="text-sm font-medium text-fg-secondary mb-1"
              >
                Mô tả SEO / mạng xã hội
              </label>
              <textarea
                id="metaDescription"
                rows={2}
                maxLength={320}
                value={form.metaDescription}
                onChange={set('metaDescription')}
                placeholder="Bỏ trống để dùng phần tóm tắt"
                className="rounded-md border border-line bg-base px-3 py-2.5 text-sm text-fg outline-none focus:border-primary"
              />
            </div>

            {/* Nội dung */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="contentMd" className="text-sm font-medium text-fg-secondary">
                  Nội dung (Markdown)
                </label>
                <div className="flex items-center gap-3">
                  <label>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={onInsertMedia}
                      className="hidden"
                      disabled={uploading}
                    />
                    <span className="inline-flex items-center gap-1 text-xs text-link cursor-pointer hover:underline">
                      <Icon name="plus" />
                      {uploading ? 'Đang tải…' : 'Chèn ảnh/video'}
                    </span>
                  </label>
                  <span className="text-xs text-fg-muted">{wordCount} từ</span>
                </div>
              </div>
              <textarea
                id="contentMd"
                rows={16}
                value={form.contentMd}
                onChange={set('contentMd')}
                required
                className="rounded-md border border-line bg-base px-3 py-2.5 text-sm text-fg font-mono outline-none focus:border-primary"
              />
            </div>

            {/* Nguồn tham khảo */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-fg-secondary">Nguồn tham khảo</span>
                <Button type="button" size="sm" variant="ghost" onClick={addRef}>
                  <Icon name="plus" />
                  Thêm nguồn
                </Button>
              </div>
              {form.references.length === 0 && (
                <p className="text-xs text-fg-muted">Chưa có nguồn nào. Thêm nhãn + đường dẫn.</p>
              )}
              {form.references.map((r, i) => (
                <div key={i} className="flex flex-wrap gap-2 items-center">
                  <input
                    aria-label={`Nhãn nguồn ${i + 1}`}
                    value={r.label}
                    onChange={(e) => setRef(i, 'label', e.target.value)}
                    placeholder="Nhãn (vd: Tài liệu Next.js)"
                    className="flex-1 min-w-[10rem] rounded-md border border-line bg-base px-3 py-2 text-sm text-fg outline-none focus:border-primary"
                  />
                  <input
                    aria-label={`Đường dẫn nguồn ${i + 1}`}
                    value={r.url}
                    onChange={(e) => setRef(i, 'url', e.target.value)}
                    placeholder="https://…"
                    className="flex-[2] min-w-[12rem] rounded-md border border-line bg-base px-3 py-2 text-sm text-fg font-mono outline-none focus:border-primary"
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeRef(i)}>
                    <Icon name="trash" />
                  </Button>
                </div>
              ))}
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

        {/* Xem trước: dùng CHÍNH renderMarkdown của trang blog (đã chống XSS) */}
        {preview && (
          <Card className="p-6 mb-8">
            <div className="text-xs uppercase tracking-wide text-fg-muted mb-3">Xem trước</div>
            {form.coverImageUrl && (
              <img
                src={form.coverImageUrl}
                alt=""
                className="w-full rounded-md mb-4 max-h-72 object-cover"
              />
            )}
            <h1 className="text-2xl font-bold text-fg mb-2">{form.title || '(chưa có tiêu đề)'}</h1>
            <div
              className="prose-tsu min-w-0"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(form.contentMd || '') }}
            />
            {form.references.filter((r) => r.url).length > 0 && (
              <div className="mt-6 pt-4 border-t border-line">
                <h2 className="text-sm font-semibold text-fg mb-2">Nguồn tham khảo</h2>
                <ul className="list-disc pl-5 space-y-1">
                  {form.references
                    .filter((r) => r.url)
                    .map((r, i) => (
                      <li key={i} className="text-sm">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline break-all"
                        >
                          {r.label || r.url}
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        <div className="space-y-3">
          {!loading && posts.length === 0 && (
            <Card className="p-6 text-fg-muted">Bạn chưa có bài nào.</Card>
          )}
          {posts.map((p) => (
            <Card key={p.id} className="p-5 flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-[16rem]">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <span className="font-semibold text-fg">{p.title}</span>
                  <span className="font-mono text-xs text-fg-muted">{p.slug}</span>
                  {!p.published ? (
                    <Badge tone="warning">Nháp</Badge>
                  ) : isFuture(p.publishedAt) ? (
                    <Badge tone="warning">Đã lên lịch</Badge>
                  ) : (
                    <Badge tone="success">Đã công bố</Badge>
                  )}
                </div>
                {p.excerpt && <p className="text-sm text-fg-muted">{p.excerpt}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {p.tags.map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                  {p.references?.length > 0 && (
                    <span className="text-xs text-fg-muted">· {p.references.length} nguồn</span>
                  )}
                  <span className="text-xs text-fg-muted">
                    {isFuture(p.publishedAt)
                      ? `Lên lịch ${formatDateTimeVN(p.publishedAt as string)}`
                      : `Sửa lần cuối ${formatDateTimeVN(p.updatedAt)}`}
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
          <RecordFooter
            meta={meta}
            pageSize={pageSize}
            loading={loading}
            label="bài viết"
            onPageSize={(size, nextPage) => {
              setPageSize(size);
              setPage(nextPage);
            }}
            onPage={setPage}
          />
        </div>
      </div>
    </Layout>
  );
}
