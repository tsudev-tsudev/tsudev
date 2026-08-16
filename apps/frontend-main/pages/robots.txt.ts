import { MAIN_URL } from '@tsudev/ui';
import type { GetServerSidePropsContext } from 'next';

// Sinh động thay vì để tĩnh trong public/ chỉ vì một lý do: dòng Sitemap phải
// mang URL TUYỆT ĐỐI, mà origin thật chỉ biết được từ NEXT_PUBLIC_MAIN_URL lúc
// build. File tĩnh sẽ phải hardcode tên miền — đúng thứ config/topology.json
// sinh ra để dẹp.

export async function getServerSideProps({ res }: GetServerSidePropsContext) {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Khu vực riêng tư và các endpoint không dành cho bộ máy tìm kiếm.',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /trust/apply',
    'Disallow: /trust/portal',
    '',
    `Sitemap: ${MAIN_URL}/sitemap.xml`,
    '',
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400');
  res.write(body);
  res.end();
  return { props: {} };
}

export default function Robots() {
  return null;
}
