import React from 'react';
import Seo from '../../components/Seo';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, SectionHeading, Badge } from '@tsudev/ui';

// Bảng điều khiển quản trị. Trước đây trang này lấy số liệu từ /api/mod/summary
// (báo cáo chờ, tài khoản bị cấm, bài đã gỡ, chủ đề bị khoá) - toàn bộ là số đo
// của diễn đàn. Diễn đàn không còn nên hệ kiểm duyệt cũng không còn đối tượng;
// trang chuyển thành cổng vào các khu quản trị đang có.
const AREAS = [
  {
    href: '/admin/trust',
    title: 'Con dấu tín nhiệm',
    desc: 'Thẩm định hồ sơ, cấp/đình chỉ/thu hồi chứng chỉ, tái kiểm tên miền.',
    ready: true,
  },
  {
    href: '/admin/newsroom',
    title: 'Toà soạn Agent AI',
    desc: 'Sàn làm việc của đội ngũ AI, luồng sản xuất bài viết, nhật ký kiểm toán và mức tự chủ theo chuyên mục.',
    ready: true,
  },
  {
    href: '/admin/projects',
    title: 'Dự án & bản quyền',
    desc: 'Quản lý dự án, phiên bản phát hành, giấy phép và trạng thái đăng ký bản quyền.',
    ready: true,
  },
  {
    href: '/admin/accounts',
    title: 'Tài khoản & phân quyền',
    desc: 'Tạo tài khoản, phân quyền, thu hồi vai trò và phiên. Chỉ chủ sở hữu (tsudev).',
    ready: true,
    // Chỉ OWNER thấy thẻ này. Trang tự gác lại (requireOwner ở auth-service) nên
    // đây thuần tuý là UX - không phải cổng bảo mật.
    ownerOnly: true,
  },
  {
    href: '/admin/security',
    title: 'Nhật ký bảo mật',
    desc: 'Sự kiện bảo mật xuyên tài khoản: đăng nhập, đổi mật khẩu/email, 2FA, passkey, đổi vai trò.',
    ready: true,
    ownerOnly: true,
  },
];

export default function AdminHome() {
  const { data: session, status } = useSession();

  // `noindex` phải có ở CẢ hai nhánh chưa-đăng-nhập. Trình thu thập của công cụ
  // tìm kiếm KHÔNG BAO GIỜ có phiên, nên trạng thái duy nhất nó nhìn thấy chính
  // là hai nhánh này - đặt thẻ ở nhánh đã đăng nhập là đặt đúng chỗ không ai đọc.
  if (status === 'loading')
    return (
      <Layout>
        <Seo title="Quản trị" path="/admin" noindex />
        <Card className="p-8 text-center text-fg-muted">Đang tải…</Card>
      </Layout>
    );

  if (!session)
    return (
      <Layout>
        <Seo title="Quản trị" path="/admin" noindex />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-fg mb-2">Khu vực quản trị</h1>
          <p className="text-fg-muted mb-4">
            Đăng nhập bằng tài khoản quản trị (ví dụ{' '}
            <code className="font-mono text-link">tsudev</code>).
          </p>
          <Button onClick={() => signIn()}>Đăng nhập</Button>
        </div>
      </Layout>
    );

  return (
    <Layout active="/admin" bare>
      <Seo title="Quản trị" path="/admin" noindex />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <SectionHeading
          eyebrow="Bảng điều khiển"
          title="Quản trị hệ thống"
          action={
            <Badge tone="brand" mono>
              {session.user?.name}
            </Badge>
          }
        />

        <div className="grid md:grid-cols-2 gap-4">
          {AREAS.filter(
            (a) =>
              !(a as { ownerOnly?: boolean }).ownerOnly ||
              (session.user as { role?: string } | undefined)?.role === 'OWNER'
          ).map((a) =>
            a.ready ? (
              <Card key={a.href} as="a" href={a.href} hover className="p-5 block group">
                <h3 className="font-semibold text-fg group-hover:text-link transition-colors">
                  {a.title} →
                </h3>
                <p className="text-sm text-fg-muted mt-1">{a.desc}</p>
              </Card>
            ) : (
              <Card key={a.href} className="p-5 opacity-60">
                <h3 className="font-semibold text-fg">{a.title}</h3>
                <p className="text-sm text-fg-muted mt-1">{a.desc}</p>
                <span className="inline-block mt-2 text-xs uppercase tracking-wider text-fg-muted">
                  Sắp có
                </span>
              </Card>
            )
          )}
        </div>
      </div>
    </Layout>
  );
}
