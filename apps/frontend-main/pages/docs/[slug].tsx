import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Badge, TableOfContents, EmptyState } from '@tsudev/ui';
import type { TocItem } from '@tsudev/ui';
import { api } from '../../lib/api';
import { extractHeadings, renderMarkdown } from '../../lib/md';
import type { GetServerSidePropsContext } from 'next';
import type { Doc } from '../../lib/types';
import { routeParam } from '../../lib/identity';

type DocPageProps = {
  doc: Doc | null;
  failed: boolean;
  slug: string;
  toc: TocItem[];
};

export default function DocPage({ doc, failed, slug, toc }: DocPageProps) {
  if (failed)
    return (
      <Layout active="/docs">
        <Seo title="Không tải được tài liệu" path={`/docs/${slug}`} noindex />
        <EmptyState
          kind="failed"
          icon="warning"
          title="Không tải được tài liệu"
          explain={
            <>
              Tài liệu này có thể vẫn còn nguyên - lượt gọi tới máy chủ nội dung đã thất bại. Thử
              tải lại sau ít phút.
            </>
          }
          action={{ label: 'Về mục lục tài liệu', href: '/docs' }}
          className="my-10"
        />
      </Layout>
    );
  if (!doc)
    return (
      <Layout active="/docs">
        <Seo title="Không tìm thấy tài liệu" path={`/docs/${slug}`} noindex />
        <EmptyState
          icon="doc"
          title="Không tìm thấy tài liệu"
          explain="Đường dẫn này không trỏ tới tài liệu nào. Có thể nó đã được đổi slug."
          action={{ label: 'Về mục lục tài liệu', href: '/docs' }}
          className="my-10"
        />
      </Layout>
    );
  return (
    <Layout active="/docs" bare>
      <Seo title={doc.title} path={`/docs/${slug}`} type="article" />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <nav className="text-sm text-fg-muted mb-4">
          <a href="/docs" className="hover:text-link">
            Tài liệu
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-fg-secondary">{doc.title}</span>
        </nav>
        <Badge tone="teal" mono className="mb-3">
          {doc.category}
        </Badge>
        <h1 className="text-3xl font-extrabold text-fg text-balance leading-tight mb-8">
          {doc.title}
        </h1>
        {/* Hai cột từ lg trở lên: thân bài giữ bề rộng đọc được, mục lục bám
            dính bên phải. Dưới lg thì mục lục nằm TRÊN thân bài - trên màn hình
            hẹp nó phải là thứ người đọc gặp trước, không phải thứ họ cuộn qua
            hết bài mới thấy. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
          <div
            className="prose-tsu order-2 lg:order-1 min-w-0"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.contentMd || '') }}
          />
          <aside className="order-1 lg:order-2 lg:sticky lg:top-20">
            <TableOfContents items={toc} />
          </aside>
        </div>
      </div>
    </Layout>
  );
}

/// 🔴 BA MÃ TRẠNG THÁI, KHÔNG PHẢI MỘT. Đọc trước khi gộp lại cho gọn.
///
/// Bản trước gọi `api.doc()` rồi render "Không tìm thấy tài liệu" cho MỌI trường
/// hợp nó trả về null - kể cả khi lượt gọi THẤT BẠI. Nghĩa là lúc content-service
/// hoặc database chết, một tài liệu đang tồn tại thật sẽ trả HTTP 200 kèm dòng chữ
/// "không tìm thấy". Với công cụ tìm kiếm đó là soft 404: nó gỡ URL khỏi chỉ mục,
/// và nó không đọc lại nữa vì ta đã trả lời 200 rất dứt khoát.
///
/// Đã xảy ra thật: ngày 28/10/2026 Neon treo compute và toàn bộ nội dung
/// tsudev.com biến mất khỏi mọi trang trong khi mọi trang vẫn 200 (xem
/// `lib/api.ts` § vì sao `Fetched` tồn tại).
///
///   gọi thất bại         -> 503, "không tải được"  -> crawler THỬ LẠI, không gỡ
///   gọi xong, null       -> 404, "không tìm thấy"  -> đúng, tài liệu này không có
///   gọi xong, có dữ liệu -> 200
export async function getServerSideProps({ params, res }: GetServerSidePropsContext) {
  const r = await api.doc(routeParam(params, 'slug'));
  const doc = r.data;
  if (r.failed) res.statusCode = 503;
  else if (!doc) res.statusCode = 404;
  // Mục lục dựng ở SERVER: dựng ở client thì nó nháy vào sau khi bài đã hiện,
  // và bố cục hai cột nhảy một nhịp ở mỗi lần tải trang.
  const toc = extractHeadings(doc?.contentMd || '');
  return { props: { failed: r.failed, doc, slug: routeParam(params, 'slug'), toc } };
}
