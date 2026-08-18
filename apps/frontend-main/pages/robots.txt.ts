import { MAIN_URL } from '@tsudev/ui';
import type { GetServerSidePropsContext } from 'next';

// Sinh động thay vì để tĩnh trong public/ chỉ vì một lý do: dòng Sitemap phải
// mang URL TUYỆT ĐỐI, mà origin thật chỉ biết được từ NEXT_PUBLIC_MAIN_URL lúc
// build. File tĩnh sẽ phải hardcode tên miền - đúng thứ config/topology.json
// sinh ra để dẹp.
//
// ⚠️ KHÔNG `Disallow` các khu vực riêng tư (/admin, /trust, /settings). Nghe
// ngược, nhưng `Disallow` TRIỆT TIÊU chính thẻ `noindex` mà những trang đó đang
// đặt: bot bị chặn thu thập thì không tải trang, không tải trang thì không đọc
// được thẻ - và URL vẫn lọt vào kết quả tìm kiếm qua liên kết từ bên ngoài, chỉ
// khác là không có mô tả. Chuẩn là chọn MỘT trong hai, và `noindex` mạnh hơn vì
// nó gỡ URL khỏi chỉ mục thật sự. Chủ dự án chốt hướng này ngày 18/08/2026.
//
// Hệ quả bắt buộc: mọi trang riêng tư PHẢI có `<Seo … noindex />` ở TẤT CẢ các
// nhánh render, kể cả nhánh `status === 'loading'` và nhánh chưa đăng nhập -
// trình thu thập không bao giờ có phiên nên nó chỉ nhìn thấy hai nhánh đó.

export async function getServerSideProps({ res }: GetServerSidePropsContext) {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Chỉ chặn API. Khu vực riêng tư dùng thẻ noindex, xem ghi chú đầu tệp.',
    'Disallow: /api/',
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
