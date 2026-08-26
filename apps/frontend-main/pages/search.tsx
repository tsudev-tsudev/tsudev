import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Seo from '../components/Seo';
import { Layout, Card, Badge, Avatar, RecordFooter, usePageSize } from '@tsudev/ui';
import { DEFAULT_PAGE_SIZE, normalizePage } from '@tsudev/types';
import { findMatchRanges } from '@tsudev/search';
import { api } from '../lib/api';
import type { PostSearchResult, SearchHit } from '../lib/types';
import type { GetServerSidePropsContext } from 'next';
import { formatDateVN } from '../lib/format';

type SortKey = 'relevance' | 'newest' | 'oldest';
const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'relevance', label: 'Liên quan' },
  { key: 'newest', label: 'Mới nhất' },
  { key: 'oldest', label: 'Cũ nhất' },
];

/**
 * Trục lọc "loại nội dung" (SEARCH_AND_FILTER §6.1). Chuẩn ghi là chọn NHIỀU;
 * với đúng hai loại thì "Tất cả / Bài viết / Tài liệu" biểu diễn trọn vẹn cùng
 * tập lựa chọn đó mà đỡ một lớp thao tác. Thêm loại thứ ba thì đổi sang chọn
 * nhiều thật - `type` của API đã nhận danh sách ngăn cách bằng dấu phẩy sẵn.
 */
type TypeKey = 'all' | 'post' | 'doc';
const TYPES: Array<{ key: TypeKey; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'post', label: 'Bài viết' },
  { key: 'doc', label: 'Tài liệu' },
];

const MIN_QUERY = 2;
const DEBOUNCE_MS = 350;

const EMPTY_RESULT: PostSearchResult = {
  data: [],
  meta: {
    total: 0,
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_pages: 1,
    query_normalized: '',
  },
  facets: { tag: [], category: [], type: [] },
};

/** Đường dẫn đích của một hàng kết quả. Một chỗ duy nhất, vì cả thẻ, phím Enter
 *  và thuộc tính href đều cần nó - lệch nhau là bàn phím đi một nơi, chuột đi
 *  một nẻo. */
const hrefOf = (h: SearchHit) => (h.kind === 'post' ? `/blog/${h.slug}` : `/docs/${h.slug}`);

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
  initialType: TypeKey;
  initialTag: string | null;
  initialCategory: string | null;
  initialSort: SortKey;
  initialPage: number;
  initial: PostSearchResult;
  /// Toàn bộ thẻ đang có, để DUYỆT khi chưa gõ gì. Khác `facets.tag` của kết quả:
  /// facet chỉ tồn tại KHI đã có truy vấn, nên nếu chỉ dựa vào nó thì trang này
  /// mở ra trống trơn và không gợi ý được gì. Thanh duyệt này là thứ dời sang từ
  /// /blog ngày 26/08/2026.
  allTags: string[];
};

export default function SearchPage({
  initialQ,
  initialType,
  initialTag,
  initialCategory,
  initialSort,
  initialPage,
  initial,
  allTags,
}: SearchProps) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState<TypeKey>(initialType);
  const [tag, setTag] = useState<string | null>(initialTag);
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = usePageSize('search', router.query.page_size);
  const [result, setResult] = useState<PostSearchResult>(initial);
  const [loading, setLoading] = useState(false);
  /**
   * Chân vùng chỉ dựng SAU khi gắn vào DOM.
   *
   * `usePageSize` đọc `localStorage` ngay ở lần dựng đầu, mà trang này render
   * phía máy chủ - máy chủ không có `localStorage` nên nó trả mốc mặc định.
   * Dựng thẳng thì giá trị của `<select>` ở máy chủ và ở trình duyệt khác nhau
   * và React báo lệch hydrat. Các bảng khác không gặp vì chúng dựng phía máy
   * khách hoàn toàn.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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

  const runSearch = useCallback(
    async (
      query: string,
      ty: TypeKey,
      tg: string | null,
      cat: string | null,
      srt: SortKey,
      pg: number,
      size: number
    ) => {
      const enough = query.trim().length >= MIN_QUERY;
      if (!enough && !tg && !cat) {
        setResult(EMPTY_RESULT);
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
        if (ty !== 'all') params.set('type', ty);
        if (tg) params.set('tag', tg);
        if (cat) params.set('category', cat);
        params.set('sort', srt);
        // Đổi mốc PHẢI tải lại từ máy chủ (DATA_TABLE.md mục 4) - cắt ở máy
        // khách thì mốc 10 không tiết kiệm được gì.
        params.set('page', String(pg));
        params.set('page_size', String(size));
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
    },
    []
  );

  // Đổi từ khoá / loại / thẻ / chuyên mục / cách sắp xếp là ĐỔI TẬP KẾT QUẢ, nên
  // phải về trang 1: giữ nguyên trang 7 của truy vấn cũ thì truy vấn mới gần như
  // luôn rỗng và trông y hệt "không tìm thấy gì".
  const resetKey = [q, type, tag ?? '', category ?? '', sort].join('\u0000');
  const prevResetKey = useRef(resetKey);
  useEffect(() => {
    if (prevResetKey.current === resetKey) return;
    prevResetKey.current = resetKey;
    setPage(1);
  }, [resetKey]);

  // Debounce khi truy vấn/bộ lọc/trang/mốc đổi + đồng bộ URL (chia sẻ được, nút
  // back trả đúng).
  useEffect(() => {
    const handle = setTimeout(() => {
      runSearch(q, type, tag, category, sort, page, pageSize);
      const params = new URLSearchParams();
      if (q.trim().length >= MIN_QUERY) params.set('q', q.trim());
      if (type !== 'all') params.set('type', type);
      if (tag) params.set('tag', tag);
      if (category) params.set('category', category);
      if (sort !== 'relevance') params.set('sort', sort);
      if (page !== 1) params.set('page', String(page));
      params.set('page_size', String(pageSize));
      router.replace(`/search${params.toString() ? `?${params}` : ''}`, undefined, {
        shallow: true,
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // router cố ý không nằm trong deps: nó đổi định danh mỗi lần replace shallow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, tag, category, sort, page, pageSize, runSearch]);

  const results = result.data;
  const go = (h: SearchHit) => router.push(hrefOf(h));

  // Thẻ là trục của bài viết, chuyên mục là trục của tài liệu - máy chủ loại trừ
  // loại không mang trục đang lọc. Dọn luôn ở đây để người dùng không tự đưa mình
  // vào tổ hợp cho ra 0 kết quả (ví dụ type=doc kèm một thẻ).
  const pickType = (k: TypeKey) => {
    setType(k);
    if (k === 'doc') setTag(null);
    if (k === 'post') setCategory(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      const hit = active >= 0 ? results[active] : undefined;
      if (hit) go(hit);
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

  const hasQuery = q.trim().length >= MIN_QUERY || !!tag || !!category;
  const countOf = (slug: string) => result.facets.type.find((f) => f.slug === slug)?.count ?? 0;
  const postCount = countOf('post');
  const docCount = countOf('doc');

  return (
    <Layout active="/blog" bare>
      <Seo
        title="Tìm kiếm"
        path="/search"
        description="Tìm bài viết và tài liệu trên tsudev."
        noindex
      />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-fg mb-1">Tìm kiếm</h1>
        <p className="text-sm text-fg-muted mb-5">
          Bài viết và tài liệu. Gõ không dấu vẫn ra kết quả có dấu. Từ {MIN_QUERY} ký tự trở lên.
        </p>

        <div className="relative">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={active >= 0 ? `result-${active}` : undefined}
            aria-label="Tìm kiếm bài viết và tài liệu"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ví dụ: tuong tac, kien truc, seo…"
            className="w-full rounded-md border border-line-control bg-base px-4 py-3 text-fg outline-none focus:border-primary"
          />
        </div>

        {/* Duyệt theo thẻ khi CHƯA có truy vấn nào.
            Thanh này thay chỗ thanh thẻ đã gỡ khỏi /blog: ở đó nó lọc bài viết,
            ở đây nó nằm cùng chỗ với chuyên mục và loại nội dung, tức cùng một
            bộ lọc cho cả bài viết lẫn tài liệu. Ẩn đi khi đã có truy vấn, vì lúc
            đó `facets.tag` bên dưới nói được nhiều hơn - nó kèm số lượng và chỉ
            liệt kê thẻ THỰC SỰ có trong kết quả. */}
        {!hasQuery && allTags.length > 0 && (
          <div className="mt-4">
            <span className="text-xs text-fg-muted">Hoặc duyệt theo thẻ:</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(t)}
                  aria-label={`Lọc theo thẻ ${t}`}
                >
                  <Badge tone="neutral">{t}</Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loại nội dung */}
        <div className="flex flex-wrap items-center gap-2 mt-3" aria-label="Lọc theo loại nội dung">
          <span className="text-xs text-fg-muted">Loại:</span>
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pickType(t.key)}
              aria-pressed={type === t.key}
              className={`text-xs rounded-sm px-2 py-1 border ${
                type === t.key
                  ? 'border-primary text-link'
                  : 'border-line-control text-fg-muted hover:text-fg'
              }`}
            >
              {t.label}
              {hasQuery && (
                <span className="ml-1 tabular-nums">
                  {' · '}
                  {(t.key === 'all'
                    ? postCount + docCount
                    : t.key === 'post'
                    ? postCount
                    : docCount
                  ).toLocaleString('vi-VN')}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sắp xếp */}
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
              Thẻ: <span className="text-fg font-medium">{tag}</span>
              {' · '}
              <button
                type="button"
                onClick={() => setTag(null)}
                className="text-link hover:underline"
              >
                bỏ
              </button>
            </span>
          )}
          {category && (
            <span className="ml-2 text-xs text-fg-muted">
              Chuyên mục: <span className="text-fg font-medium">{category}</span>
              {' · '}
              <button
                type="button"
                onClick={() => setCategory(null)}
                className="text-link hover:underline"
              >
                bỏ
              </button>
            </span>
          )}
        </div>

        {type !== 'doc' && result.facets.tag.length > 0 && (
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

        {type !== 'post' && result.facets.category.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3" aria-label="Lọc theo chuyên mục tài liệu">
            {result.facets.category.map((f) => (
              <button
                key={f.slug}
                type="button"
                onClick={() => setCategory(f.slug === category ? null : f.slug)}
                aria-pressed={f.slug === category}
              >
                <Badge tone={f.slug === category ? 'brand' : 'neutral'}>
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
            <p className="text-sm text-fg-muted">
              Nhập từ khoá, hoặc chọn một thẻ / chuyên mục để bắt đầu.
            </p>
          ) : results.length === 0 ? (
            <Card className="p-6 text-sm text-fg-muted">
              Không tìm thấy kết quả phù hợp với “{q || tag || category}”. Thử kiểm tra chính tả,
              dùng từ khoá khác, hoặc nới bộ lọc loại nội dung.
            </Card>
          ) : (
            <>
              {/* §6.4: nói rõ số kết quả THEO TỪNG LOẠI, không chỉ tổng. */}
              <p className="text-xs text-fg-muted mb-3">
                {type !== 'doc' && `${postCount.toLocaleString('vi-VN')} bài viết`}
                {type === 'all' && ', '}
                {type !== 'post' && `${docCount.toLocaleString('vi-VN')} tài liệu`}
              </p>
              <ul id="listbox" role="listbox" ref={listRef} className="space-y-3">
                {results.map((h, i) => (
                  <li
                    key={`${h.kind}-${h.id}`}
                    id={`result-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={i === active}
                  >
                    <Card
                      as="a"
                      href={hrefOf(h)}
                      hover
                      className={`p-5 block ${i === active ? 'border-primary' : ''}`}
                      onMouseEnter={() => setActive(i)}
                    >
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <Badge tone={h.kind === 'doc' ? 'info' : 'brand'}>
                          {h.kind === 'doc' ? 'Tài liệu' : 'Bài viết'}
                        </Badge>
                        {h.kind === 'post'
                          ? (h.tags || []).map((t) => (
                              <Badge key={t} tone={t === tag ? 'brand' : 'neutral'}>
                                {t}
                              </Badge>
                            ))
                          : h.category && (
                              <Badge tone={h.category === category ? 'brand' : 'neutral'}>
                                {h.category}
                              </Badge>
                            )}
                      </div>
                      <h2 className="text-lg font-bold text-fg leading-snug">
                        <Highlight text={h.title} query={q} />
                      </h2>
                      {h.excerpt && (
                        <p className="mt-1 text-sm text-fg-muted">
                          <Highlight text={h.excerpt} query={q} />
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2 text-xs text-fg-muted">
                        {h.kind === 'post' ? (
                          <>
                            <Avatar name={h.author?.displayName || 'tsudev'} size={20} />
                            {h.author?.displayName || 'tsudev'}
                            {' · '}
                            {formatDateVN(h.publishedAt || h.createdAt)}
                          </>
                        ) : (
                          <>Cập nhật {formatDateVN(h.updatedAt)}</>
                        )}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              {mounted && (
                <RecordFooter
                  meta={result.meta}
                  pageSize={pageSize}
                  loading={loading}
                  label="kết quả"
                  onPageSize={(size, nextPage) => {
                    setPageSize(size);
                    setPage(nextPage);
                  }}
                  onPage={setPage}
                />
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ query }: GetServerSidePropsContext) {
  const initialQ = typeof query.q === 'string' ? query.q : '';
  const initialType: TypeKey = query.type === 'post' || query.type === 'doc' ? query.type : 'all';
  const initialTag = typeof query.tag === 'string' && query.tag.trim() ? query.tag.trim() : null;
  const initialCategory =
    typeof query.category === 'string' && query.category.trim() ? query.category.trim() : null;
  const initialSort: SortKey =
    query.sort === 'newest' || query.sort === 'oldest' ? query.sort : 'relevance';
  const initialPage = normalizePage(query.page);

  const params = new URLSearchParams();
  if (initialQ.trim().length >= MIN_QUERY) params.set('q', initialQ.trim());
  if (initialType !== 'all') params.set('type', initialType);
  if (initialTag) params.set('tag', initialTag);
  if (initialCategory) params.set('category', initialCategory);
  params.set('sort', initialSort);
  // Chuyển tiếp NGUYÊN VĂN: máy chủ quy về mốc hợp lệ bằng `normalizePageSize`,
  // nên trang dựng sẵn khớp đúng liên kết được chia sẻ.
  params.set('page', String(initialPage));
  if (typeof query.page_size === 'string' && query.page_size) {
    params.set('page_size', query.page_size);
  }

  const initial =
    initialQ.trim().length >= MIN_QUERY || initialTag || initialCategory
      ? await api.searchPosts(params.toString())
      : EMPTY_RESULT;

  // Nguồn thẻ để DUYỆT. Lấy từ danh sách bài mới nhất, đúng cách /blog từng dựng
  // thanh thẻ của nó - giữ nguyên tập thẻ mà người dùng đã quen thấy.
  const recent = await api.posts(50);
  const allTags = [...new Set(recent.flatMap((p) => p.tags || []))].sort((a, b) =>
    a.localeCompare(b, 'vi')
  );

  return {
    props: {
      initialQ,
      initialType,
      initialTag,
      initialCategory,
      initialSort,
      initialPage,
      initial,
      allTags,
    },
  };
}
