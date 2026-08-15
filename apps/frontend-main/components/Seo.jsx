import React from 'react';
import Head from 'next/head';
import { MAIN_URL } from '@tsudev/ui';

// Thẻ meta dùng chung cho mọi trang công khai. Gom về một chỗ vì ba lý do:
//
// 1. Thẻ canonical BẮT BUỘC là URL tuyệt đối — đây là một trong số ít chỗ thật
//    sự cần MAIN_URL (xem packages/ui/src/lib/siteUrls.js). Rải rác ra từng
//    trang thì sớm muộn có trang quên, và Google gộp nhầm hai URL thành một.
// 2. NEXT_PUBLIC_MAIN_URL được Next nội suy LÚC BUILD. Bản dựng production lấy
//    giá trị từ apps/frontend-main/.env.production (sinh từ config/topology.json).
//    Thiếu file đó thì mọi canonical trỏ về tsudev.localhost.
// 3. Ảnh og:image phải là URL tuyệt đối — đường dẫn tương đối bị các trình đọc
//    link bỏ qua trong im lặng, và không có cách nào biết ngoài việc đi thử.

const SITE_NAME = 'tsudev';
const DEFAULT_DESCRIPTION =
  'Website dự án cá nhân: dự án & bản quyền, blog kỹ thuật, tài liệu và con dấu tín nhiệm.';
const DEFAULT_IMAGE = '/og-image.png';

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = DEFAULT_IMAGE,
  type = 'website',
  publishedAt,
  noindex = false,
}) {
  const fullTitle = title
    ? `${title} — ${SITE_NAME}`
    : `${SITE_NAME} — Dự án, bản quyền và con dấu tín nhiệm`;
  const canonical = `${MAIN_URL}${path === '/' ? '' : path}`;
  const imageUrl = /^https?:\/\//.test(image) ? image : `${MAIN_URL}${image}`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:locale" content="vi_VN" />
      {publishedAt && (
        <meta property="article:published_time" content={new Date(publishedAt).toISOString()} />
      )}

      {/* summary_large_image: ảnh 1200×630 do packages/brand sinh ra. Để mặc
          định `summary` thì nền tảng cắt thành ô vuông nhỏ và mất chữ. */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      <link
        rel="alternate"
        type="application/rss+xml"
        title="Blog tsudev"
        href={`${MAIN_URL}/feed.xml`}
      />
    </Head>
  );
}
