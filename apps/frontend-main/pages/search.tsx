import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Seo from '../components/Seo';
import { Layout, Card, Badge, Avatar } from '@tsudev/ui';
import { findMatchRanges } from '@tsudev/search';
import { api } from '../lib/api';
import type { Post, PostSearchResult } from '../lib/types';
import type { GetServerSidePropsContext } from 'next';
import { formatDateVN } from '../lib/format';

type SortKey = 'relevance' | 'newest' | 'oldest';
const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'relevance', label: 'Liên quan' },
  { key: 'newest', label: 'Mới nhất' },
  { key: 'oldest', label: 'Cũ nhất' },
];

const MIN_QUERY = 2;
const DEBOUNCE_MS = 350;

/** Tô sáng đoạn khớp, ánh xạ NGƯỢC về chuỗi gốc (chuẩn §2.3) - đúng cả khi gõ
 *  không dấu mà tiêu đề có dấu. Từ khoá là dữ liệu người dùng nhưng ta chèn qua
 *  React (tự thoát), không innerHTML ⇒ không XSS. */
function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = query ? findMatchRanges(text, query) : [];
  if (ranges.length === 0) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let last = 0;
  ranges.forEach(([s, e], i) => {
    if (s > last) out.push(text.slice(last, s));
    out.push(
      <mark key={i} className="bg-warning-tint text-warning-ink rounded-sm px-0.5">
        {text.slice(s, e)}
      </mark>
    );
    last = e;
  });
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

type SearchProps = {
  initialQ: string;
  initialTag: string | null;
  initialSort: SortKey;
  initial: PostSearchResult;
};

export default function SearchPage({ initialQ, initialTag, initialSort, initial }: SearchProps) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [tag, setTag] = useState<string | null>(initialTag);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [result, setResult] = useState<PostSearchResult>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(-1);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Ô tìm kiếm là mục đích chính của trang: đưa con trỏ vào ngay (làm bằng JS,
  // không dùng thuộc tính autoFocus - a11y).
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runSearch = useCallback(async (query: string, tg: string | null, srt: SortKey) => {
    const enough = query.trim().length >= MIN_QUERY;
    if (!enough && !tg) {
      setResult({
        data: [],
        meta: { total: 0, page: 1, page_size: 20, query_normalized: '' },
        facets: { tag: [] },
      });
      setLoading(false);
      setError(false);
      return;
    }
    // Huỷ yêu cầu cũ đang chờ để tránh tranh chấp thứ tự (§2.2).
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (enough) params.set('q', query.trim());
      if (tg) params.set('tag', tg);
      params.set('sort', srt);
      const res = await fetch(`/api/search?${params.toString()}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('bad status');
      setResult(await res.json());
      setActive(-1);
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      setError(true);
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, []);

  // Debounce khi q/tag/sort đổi + đồng bộ URL (chia sẻ được, nút back trả đúng).
  useEffect(() => {
    const handle = setTimeout(() => {
      runSearch(q, tag, sort);
      const params = new URLSearchParams();
      if (q.trim().length >= MIN_QUERY) params.set('q', q.trim());
      if (tag) params.set('tag', tag);
      if (sort !== 'relevance') params.set('sort', sort);
      router.replace(`/search${params.toString() ? `?${params}` : ''}`, undefined, {
        shallow: true,
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // router cố ý không nằm trong deps: nó đổi định danh mỗi lần replace shallow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tag, sort, runSearch]);

  const results = result.data;
  const go = (p: Post) => router.push(`/blog/${p.slug}`);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (active >= 0 && results[active]) go(results[active]);
    } else if (e.key === 'Escape') {
      setQ('');
    }
  };

  // Cuộn mục đang chọn vào vùng nhìn thấy khi danh sách dài (§2.4).
  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${active}"]`);
    (el as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const hasQuery = q.trim().length >= MIN_QUERY || !!tag;

  return (
    <Layout active="/blog" bare>
      <Seo title="Tìm kiếm" path="/search" description="Tìm bài viết trên tsudev." noindex />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-fg mb-1">Tìm kiếm bài viết</h1>
        <p className="text-sm text-fg-muted mb-5">
          Gõ không dấu vẫn ra kết quả có dấu. Từ {MIN_QUERY} ký tự trở lên.
        </p>

        <div className="relative">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={active >= 0 ? `result-${active}` : undefined}
            aria-label="Tìm kiếm bài viết"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ví dụ: tuong tac, kien truc, seo…"
            className="w-full rounded-md border border-line-control bg-base px-4 py-3 text-fg outline-none focus:border-primary"
          />
        </div>

        {/* Sắp xếp + facet thẻ */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-fg-muted">Sắp xếp:</span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={`text-xs rounded-sm px-2 py-1 border ${
                sort === s.key
                  ? 'border-primary text-link'
                  : 'border-line-control text-fg-muted hover:text-fg'
              }`}
            >
              {s.label}
            </button>
          ))}
          {tag && (
            <span className="ml-2 text-xs text-fg-muted">
              Thẻ: <span className="text-fg font-medium">{tag}</span> ·{' '}
              <button
                type="button"
                onClick={() => setTag(null)}
                className="text-link hover:underline"
              >
                bỏ
              </button>
            </span>
          )}
        </div>

        {result.facets.tag.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3" aria-label="Lọc theo thẻ">
            {result.facets.tag.map((f) => (
              <button
                key={f.slug}
                type="button"
                onClick={() => setTag(f.slug === tag ? null : f.slug)}
                aria-pressed={f.slug === tag}
              >
                <Badge tone={f.slug === tag ? 'brand' : 'neutral'}>
                  {f.slug} · {f.count}
                </Badge>
              </button>
            ))}
          </div>
        )}

        {/* Kết quả */}
        <div className="mt-6" id="search-results">
          {error ? (
            <Card className="p-6 text-danger-ink text-sm">
              Có lỗi khi tìm kiếm. Thử lại sau giây lát.
            </Card>
          ) : loading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 rounded-md bg-subtle animate-pulse" />
              ))}
            </div>
          ) : !hasQuery ? (
            <p className="text-sm text-fg-muted">Nhập từ khoá hoặc chọn một thẻ để bắt đầu.</p>
          ) : results.length === 0 ? (
            <Card className="p-6 text-sm text-fg-muted">
              Không tìm thấy kết quả phù hợp với “{q || tag}”. Thử kiểm tra chính tả hoặc dùng từ
              khoá khác.
            </Card>
          ) : (
            <>
              <p className="text-xs text-fg-muted mb-3">{result.meta.total} bài viết</p>
              <ul id="listbox" role="listbox" ref={listRef} className="space-y-3">
                {results.map((p, i) => (
                  <li
                    key={p.id}
                    id={`result-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={i === active}
                  >
                    <Card
                      as="a"
                      href={`/blog/${p.slug}`}
                      hover
                      className={`p-5 block ${i === active ? 'border-primary' : ''}`}
                      onMouseEnter={() => setActive(i)}
                    >
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(p.tags || []).map((t) => (
                          <Badge key={t} tone={t === tag ? 'brand' : 'neutral'}>
                            {t}
                          </Badge>
                        ))}
                      </div>
                      <h2 className="text-lg font-bold text-fg leading-snug">
                        <Highlight text={p.title} query={q} />
                      </h2>
                      {p.excerpt && (
                        <p className="mt-1 text-sm text-fg-muted">
                          <Highlight text={p.excerpt} query={q} />
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2 text-xs text-fg-muted">
                        <Avatar name={p.author?.displayName || 'tsudev'} size={20} />
                        {p.author?.displayName || 'tsudev'} ·{' '}
                        {formatDateVN(p.publishedAt || p.createdAt)}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ query }: GetServerSidePropsContext) {
  const initialQ = typeof query.q === 'string' ? query.q : '';
  const initialTag = typeof query.tag === 'string' && query.tag.trim() ? query.tag.trim() : null;
  const initialSort: SortKey =
    query.sort === 'newest' || query.sort === 'oldest' ? query.sort : 'relevance';

  const params = new URLSearchParams();
  if (initialQ.trim().length >= MIN_QUERY) params.set('q', initialQ.trim());
  if (initialTag) params.set('tag', initialTag);
  params.set('sort', initialSort);

  const initial =
    initialQ.trim().length >= MIN_QUERY || initialTag
      ? await api.searchPosts(params.toString())
      : {
          data: [],
          meta: { total: 0, page: 1, page_size: 20, query_normalized: '' },
          facets: { tag: [] },
        };

  return { props: { initialQ, initialTag, initialSort, initial } };
}
