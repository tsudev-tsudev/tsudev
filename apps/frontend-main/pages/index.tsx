import React from 'react';
import Seo from '../components/Seo';
import DownloadSection from '../components/DownloadSection';
import { useScrollReveal } from '../lib/useScrollReveal';
import { Layout, Button, Card, Badge, SectionHeading, Avatar, EmptyState, Icon } from '@tsudev/ui';
import type { IconName } from '@tsudev/ui';
import { api } from '../lib/api';
import { KIND_LABEL, STATUS_LABEL, copyrightMeta } from '../lib/projectLabels';
import type { Post, Project, ProjectWithReleases } from '../lib/types';

/**
 * Bốn phân hệ ở khối "Hệ sinh thái".
 *
 * Trước đây mỗi mục mang một chuỗi `d` SVG viết tay cộng một `tone` luân phiên
 * brand/teal. Hai vấn đề, và cái thứ hai mới là vấn đề thật:
 *
 *   1. Bốn icon nằm NGOÀI `@tsudev/ui`, nên chúng không đi qua bảng màu theo
 *      vai trò và không cổng tương phản nào canh chúng ở ba chế độ.
 *   2. `tone` luân phiên theo VỊ TRÍ, không theo nghĩa. Con dấu tín nhiệm là
 *      mục duy nhất thật sự thuộc nhóm "trust", nhưng nó nhận màu brand chỉ vì
 *      nó đứng thứ ba. Màu như thế là trang trí, không phải tín hiệu.
 *
 * Nay mỗi mục khai một `IconName` và màu do VAI TRÒ của icon quyết định: con
 * dấu ra ngọc vì nó là trust, dự án ra xanh lá vì `package` thuộc nhóm create
 * (thứ tạo ra và phát hành được). Đó là cùng một dải màu, nhưng lần này nó nói
 * đúng.
 */
const ECOSYSTEM: { title: string; desc: string; href: string; icon: IconName }[] = [
  {
    title: 'Blog',
    desc: 'Bài viết kỹ thuật, hướng dẫn và góc nhìn công nghệ.',
    href: '/blog',
    icon: 'list',
  },
  {
    title: 'Tài liệu',
    desc: 'Kho tri thức chuẩn hoá, guide và API reference.',
    href: '/docs',
    icon: 'book',
  },
  {
    title: 'Con dấu tín nhiệm',
    desc: 'Chứng nhận website dùng mã nguồn hoặc do tsudev thực hiện.',
    href: '/trust',
    icon: 'seal',
  },
  {
    title: 'Dự án',
    desc: 'Ứng dụng, công cụ và thư viện do tsudev phát triển, kèm bản quyền.',
    href: '/projects',
    icon: 'package',
  },
];

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

type HomeProps = {
  posts: Post[];
  postsFailed: boolean;
  projects: Project[];
  projectsFailed: boolean;
  downloads: ProjectWithReleases[];
  downloadsFailed: boolean;
};

export default function Home({
  posts,
  postsFailed,
  projects,
  projectsFailed,
  downloads,
  downloadsFailed,
}: HomeProps) {
  // Bật scroll-reveal cho các khối mang class `reveal` bên dưới. Hook này tự tắt
  // dưới `prefers-reduced-motion` và KHÔNG ẩn gì khi JavaScript không chạy -
  // xem lý do ở lib/useScrollReveal.ts.
  useScrollReveal();

  return (
    <Layout active="/" bare>
      <Seo
        path="/"
        description="Dự án & bản quyền, blog kỹ thuật, tài liệu và con dấu tín nhiệm - website dự án cá nhân của tsudev."
      />

      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="absolute inset-0 tsu-grid"
          // `#000` ở đây KHÔNG phải màu hiển thị mà là kênh alpha của mặt nạ -
          // nó quyết định phần nào của lưới còn nhìn thấy. Không thay bằng token
          // được, và cũng không cần: nó không bao giờ được vẽ ra màn hình.
          style={{
            maskImage: 'radial-gradient(80% 80% at 60% 0%, #000 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(80% 80% at 60% 0%, #000 30%, transparent 75%)',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute -top-40 right-0 h-96 w-96 rounded-full blur-3xl animate-pulse-glow"
          style={{ background: 'var(--glow)' }}
          aria-hidden="true"
        />
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          <div className="animate-fade-up">
            <Badge tone="teal" mono className="mb-5">
              {'// tsudev ecosystem v0.1'}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-fg text-balance leading-[1.05]">
              Giải mã tương lai qua
              <br />
              <span className="text-link">từng dòng code</span>.
            </h1>
            <p className="mt-6 text-lg text-fg-secondary max-w-xl">
              Dự án cá nhân của tsudev - tri thức kỹ thuật được chuẩn hoá, mã nguồn dùng được, và
              con dấu tín nhiệm cho những website mang dấu ấn tsudev.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as="a" href="/trust" size="lg">
                Con dấu tín nhiệm
              </Button>
              <Button as="a" href="/blog" variant="secondary" size="lg">
                Đọc blog
              </Button>
            </div>
          </div>

          {/* terminal-style card */}
          <div className="animate-fade-up hidden lg:block" style={{ animationDelay: '.1s' }}>
            <Card className="p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-subtle">
                {/* Chấm cửa sổ - dùng token trạng thái, không phải mã hex của
                    macOS: hex cắm cứng không đổi theo ba chế độ, nên ở chế độ Ấm
                    ba chấm bão hoà đó là ba vệt duy nhất phá tông sepia. */}
                <span className="h-3 w-3 rounded-full bg-danger" />
                <span className="h-3 w-3 rounded-full bg-warning" />
                <span className="h-3 w-3 rounded-full bg-success" />
                <span className="ml-2 font-mono text-xs text-fg-muted">tsudev@ecosystem: ~</span>
              </div>
              <pre className="p-5 font-mono text-sm leading-relaxed text-fg-secondary overflow-x-auto">
                {/* KHÔNG in số cổng nội bộ ở đây. Hai lý do, cả hai đều thật:
                    (1) chúng SAI ở production - bốn service backend đã gộp thành
                    MỘT tiến trình (services/backend-bundle), nên bảng cổng bốn
                    dòng chỉ còn đúng ở máy dev; (2) tsudev đối ngoại chỉ có MỘT
                    địa chỉ, và in cổng nội bộ lên trang chủ là tự mâu thuẫn với
                    chính quy ước đó. Cổng chặn: khẳng định D của
                    scripts/topology/check.js. Xem docs/url-convention.md. */}
                <span className="text-accent">$</span> tsudev status --all{'\n'}
                <span className="text-success-ink">✔</span> content{' '}
                <span className="text-fg-muted">healthy</span>
                {'\n'}
                <span className="text-success-ink">✔</span> storage{' '}
                <span className="text-fg-muted">healthy</span>
                {'\n'}
                <span className="text-success-ink">✔</span> database{' '}
                <span className="text-fg-muted">connected</span>
                {'\n'}
                <span className="text-accent">$</span> _
              </pre>
            </Card>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        {/* ---------- ECOSYSTEM ---------- */}
        <section className="py-16 reveal">
          <SectionHeading eyebrow="Hệ sinh thái" title="Bốn phân hệ, một tài khoản" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ECOSYSTEM.map((e) => (
              <a
                key={e.title}
                href={e.href}
                className="p-5 block group rounded-md transition-colors hover:bg-surface"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg mb-4 bg-glow">
                  <Icon name={e.icon} size={22} />
                </span>
                <h3 className="font-semibold text-fg group-hover:text-link transition-colors">
                  {e.title}
                </h3>
                <p className="mt-1.5 text-sm text-fg-muted">{e.desc}</p>
              </a>
            ))}
          </div>
        </section>

        {/* ---------- TẢI VỀ ----------
            Đặt TRƯỚC khu "Dự án": thứ người lạ vào tsudev.com muốn làm được
            ngay là TẢI một thứ về dùng, không phải đọc mô tả dự án. Khu này tự
            ẩn khi chưa có bản phát hành nào - xem DownloadSection. */}
        <DownloadSection items={downloads} failed={downloadsFailed} />

        {/* ---------- PROJECTS ---------- */}
        <section className="py-6 reveal">
          <SectionHeading
            eyebrow="Sản phẩm"
            title="Dự án của tsudev"
            action={
              <Button as="a" href="/projects" variant="ghost" size="sm">
                Xem tất cả →
              </Button>
            }
          />
          <div className="grid md:grid-cols-3 gap-4">
            {/* `projectsFailed` phải được kiểm TRƯỚC `length === 0`: khi lượt gọi
                thất bại thì `projects` cũng rỗng, nên đảo thứ tự là nhánh lỗi
                không bao giờ chạy tới - đúng kiểu hỏng im lặng mà cả đợt này ra
                đời để chấm dứt. */}
            {projectsFailed ? (
              <div className="md:col-span-3">
                <EmptyState
                  kind="failed"
                  icon="warning"
                  title="Không tải được danh sách dự án"
                  explain="Máy chủ nội dung không trả lời. Danh sách dự án vẫn còn nguyên."
                  action={{ label: 'Mở trang dự án', href: '/projects' }}
                />
              </div>
            ) : (
              projects.length === 0 && (
                <div className="md:col-span-3">
                  <EmptyState
                    icon="tag"
                    title="Chưa có dự án nào"
                    explain="Dự án do chủ dự án đăng - agent AI của toà soạn cố ý KHÔNG được tạo dự án mới, vì mỗi dự án mang phiên bản, giấy phép và trạng thái bản quyền."
                  />
                </div>
              )
            )}
            {projects.slice(0, 3).map((p: Project) => {
              const cr = copyrightMeta(p.copyrightStatus);
              return (
                <a
                  key={p.id}
                  href={`/projects/${p.slug}`}
                  className="p-5 flex flex-col group rounded-md transition-colors hover:bg-surface"
                >
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge tone="neutral">{KIND_LABEL[p.kind] || p.kind}</Badge>
                    <Badge tone="outline">{STATUS_LABEL[p.status] || p.status}</Badge>
                  </div>
                  <h3 className="font-semibold text-fg text-lg leading-snug group-hover:text-link transition-colors text-balance">
                    {p.name}
                  </h3>
                  <p className="mt-2 text-sm text-fg-muted flex-1">{p.summary}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                    <Badge tone={cr.tone}>{cr.label}</Badge>
                    {p.license && <span className="font-mono">{p.license}</span>}
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* ---------- FEATURED POSTS ---------- */}
        <section className="py-6 reveal">
          <SectionHeading
            eyebrow="Mới nhất"
            title="Bài viết nổi bật"
            action={
              <Button as="a" href="/blog" variant="ghost" size="sm">
                Xem tất cả →
              </Button>
            }
          />
          <div className="grid md:grid-cols-3 gap-4">
            {postsFailed ? (
              <div className="md:col-span-3">
                <EmptyState
                  kind="failed"
                  icon="warning"
                  title="Không tải được bài viết"
                  explain="Máy chủ nội dung không trả lời. Các bài đã đăng vẫn còn nguyên."
                  action={{ label: 'Mở trang blog', href: '/blog' }}
                />
              </div>
            ) : (
              posts.length === 0 && (
                <div className="md:col-span-3">
                  <EmptyState
                    icon="doc"
                    title="Chưa có bài viết"
                    explain="Toà soạn Agent AI đăng theo nhịp mỗi giờ và có trần số bài mỗi ngày cho từng kênh, nên khoảng trống giữa hai bài là bình thường."
                    action={{ label: 'Xem toàn bộ blog', href: '/blog' }}
                  />
                </div>
              )
            )}
            {posts.slice(0, 3).map((p: Post) => (
              <a
                key={p.id}
                href={`/blog/${p.slug}`}
                className="p-5 flex flex-col group rounded-md transition-colors hover:bg-surface"
              >
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(p.tags || []).slice(0, 2).map((t: string) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                </div>
                <h3 className="font-semibold text-fg text-lg leading-snug group-hover:text-link transition-colors text-balance">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-fg-muted flex-1">{p.excerpt}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-fg-muted">
                  <Avatar name={p.author?.displayName || 'tsudev'} size={22} />
                  <span>{p.author?.displayName || 'tsudev'}</span>
                  <span>·</span>
                  <span>{timeAgo(p.createdAt)}</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="pb-20">
          <div className="p-10 md:p-14 text-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-fg text-balance">
                Website của bạn dùng mã nguồn tsudev?
              </h2>
              <p className="mt-3 text-fg-secondary max-w-lg mx-auto">
                Con dấu tín nhiệm nay cấp theo lời mời: chứng chỉ ký số, xác minh quyền sở hữu tên
                miền và giám sát định kỳ, dành cho tài khoản đã có mã mời.
              </p>
              <div className="mt-7 flex justify-center gap-3">
                <Button as="a" href="/trust" size="lg">
                  Tìm hiểu con dấu
                </Button>
                <Button as="a" href="/docs" variant="secondary" size="lg">
                  Tài liệu
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  // KHÔNG gọi trust-service ở đây nữa. Trang chủ là trang công khai và Con dấu
  // nay chạy ở chế độ mời: số chứng chỉ và danh sách website đã cấp dấu là dữ
  // liệu chỉ VIP mới được thấy (docs/refactor-trust-invite-access.md, Phần A).
  // Gọi mà không có danh tính thì chỉ nhận 401 rồi rơi về [] - một lời gọi mạng
  // vô nghĩa ở MỌI lượt tải trang chủ.
  // Lấy đúng số mục mà trang này VẼ RA (mỗi khu ba cái). Bản trước lấy 6 bài,
  // 100 dự án và toàn bộ tài liệu chỉ để đếm cho hàng số liệu ở hero - mà phép
  // đếm đó đếm nhầm: nó đếm số bản ghi VỪA TẢI VỀ chứ không phải số bản ghi
  // trên site, nên "Bài viết" đứng yên ở 6 trong khi blog có 48. Hàng số liệu
  // đã bỏ; đừng dựng lại bằng `.length` của một truy vấn có trần.
  const [rPosts, rProjects, rDownloads] = await Promise.all([
    api.posts(3),
    api.projects(3),
    // Trần 6: trang chủ vẽ tối đa hai hàng ba thẻ. Lấy 20 rồi cắt ở client là
    // trả tiền băng thông cho thứ không hiện ra - đúng lỗi mà khối số liệu hero
    // cũ đã mắc (lấy 100 dự án chỉ để đếm).
    api.releases(6),
  ]);

  // Hai khu độc lập nhau nên hai cờ RIÊNG, không gộp thành một `failed` chung:
  // blog chết không có nghĩa là danh sách dự án cũng chết, và nói nó chết là nói
  // sai với người đọc.
  return {
    props: {
      posts: rPosts.data,
      postsFailed: rPosts.failed,
      projects: rProjects.data,
      projectsFailed: rProjects.failed,
      downloads: rDownloads.data,
      downloadsFailed: rDownloads.failed,
    },
  };
}
