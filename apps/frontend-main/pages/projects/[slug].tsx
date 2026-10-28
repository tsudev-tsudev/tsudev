import React, { useState } from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, Badge, Button, EmptyState, Icon } from '@tsudev/ui';
import DownloadModal from '../../components/DownloadModal';
import { api } from '../../lib/api';
import { renderMarkdown } from '../../lib/md';
import { KIND_LABEL, STATUS_LABEL, copyrightMeta } from '../../lib/projectLabels';
import type { GetServerSidePropsContext } from 'next';
import type { Project, ProjectRelease } from '../../lib/types';
import { routeParam } from '../../lib/identity';
import { formatDateVN } from '../../lib/format';

// Định dạng ngày dùng chung, không định nghĩa lại tại chỗ - xem lib/format.ts.
const fmt = formatDateVN;

type RowProps = { label: React.ReactNode; children?: React.ReactNode };

function Row({ label, children }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-line last:border-0">
      <dt className="text-sm text-fg-muted shrink-0">{label}</dt>
      <dd className="text-sm text-fg-secondary text-right">{children}</dd>
    </div>
  );
}

type ProjectDetailProps = {
  project: Project | null;
  releases: ProjectRelease[];
  failed: boolean;
  slug: string;
};

export default function ProjectDetail({ project, releases, failed, slug }: ProjectDetailProps) {
  const [moTai, setMoTai] = useState(false);
  if (failed)
    return (
      <Layout active="/projects">
        <EmptyState
          kind="failed"
          icon="warning"
          title="Không tải được dự án"
          explain={
            <>
              Dự án này có thể vẫn còn nguyên - lượt gọi tới máy chủ nội dung đã thất bại. Thử tải
              lại sau ít phút.
            </>
          }
          action={{ label: 'Về danh sách dự án', href: '/projects' }}
          className="my-10"
        />
      </Layout>
    );
  if (!project)
    return (
      <Layout active="/projects">
        <EmptyState
          icon="tag"
          title="Không tìm thấy dự án"
          explain="Đường dẫn này không trỏ tới dự án nào. Có thể nó đã được đổi slug."
          action={{ label: 'Về danh sách dự án', href: '/projects' }}
          className="my-10"
        />
      </Layout>
    );

  const cr = copyrightMeta(project.copyrightStatus);

  return (
    <Layout active="/projects" bare>
      <Seo
        title={project.name}
        path={`/projects/${slug}`}
        description={project.summary || undefined}
      />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <nav className="text-sm text-fg-muted mb-4">
          <a href="/projects" className="hover:text-link">
            Dự án
          </a>{' '}
          <span className="mx-1.5">/</span>{' '}
          <span className="text-fg-secondary">{project.name}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <Badge tone="neutral">{KIND_LABEL[project.kind] || project.kind}</Badge>
          <Badge tone="outline">{STATUS_LABEL[project.status] || project.status}</Badge>
          <Badge tone={cr.tone}>{cr.label}</Badge>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-fg text-balance leading-tight">
          {project.name}
        </h1>
        <p className="mt-3 text-lg text-fg-muted max-w-2xl">{project.summary}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          {project.repoUrl && (
            <Button as="a" href={project.repoUrl} rel="noopener noreferrer" target="_blank">
              Mã nguồn
            </Button>
          )}
          {project.homepageUrl && (
            <Button as="a" href={project.homepageUrl} variant="ghost">
              Trang giới thiệu
            </Button>
          )}
          {/* HAI đường tải, và thứ tự ưu tiên là có chủ đích.
              `releases` (bảng ProjectRelease) mô tả được nhiều nền tảng, nhiều
              phiên bản, kèm checksum - nên nó thắng. `project.downloadUrl` là DI
              SẢN: một chuỗi URL trần, giữ lại cho những dự án chỉ có đúng một
              đường tải và chưa được chuyển sang bảng mới. Hiện CẢ HAI cùng lúc là
              đặt hai nút "Tải về" cạnh nhau dẫn đi hai nơi khác nhau. */}
          {releases.length > 0 ? (
            <Button onClick={() => setMoTai(true)}>
              <Icon name="download" size={16} />
              Tải về · {releases.length} bản
            </Button>
          ) : (
            project.downloadUrl && (
              <Button as="a" href={project.downloadUrl} variant="ghost">
                Tải về
              </Button>
            )
          )}
        </div>

        {releases.length > 0 && (
          <DownloadModal
            open={moTai}
            onClose={() => setMoTai(false)}
            project={project}
            releases={releases}
          />
        )}

        <div className="mt-10 grid md:grid-cols-[1fr_18rem] gap-8 items-start">
          <div>
            {project.descriptionMd ? (
              <div
                className="prose-tsu"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(project.descriptionMd) }}
              />
            ) : (
              <p className="text-fg-muted">Chưa có mô tả chi tiết.</p>
            )}
          </div>

          <aside className="space-y-4">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-fg mb-2">Phát hành</h2>
              <dl>
                <Row label="Phiên bản">
                  {project.version ? (
                    <span className="font-mono">v{project.version}</span>
                  ) : (
                    'Chưa phát hành'
                  )}
                </Row>
                <Row label="Ngày phát hành">{fmt(project.releasedAt)}</Row>
                <Row label="Giấy phép">
                  {project.license ? (
                    <span className="font-mono">{project.license}</span>
                  ) : (
                    'Chưa công bố'
                  )}
                </Row>
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-fg mb-2">Bản quyền</h2>
              <dl>
                <Row label="Trạng thái">
                  <Badge tone={cr.tone}>{cr.label}</Badge>
                </Row>
                {project.copyrightStatus === 'REGISTERED' && (
                  <>
                    <Row label="Số giấy chứng nhận">
                      <span className="font-mono">{project.copyrightNo}</span>
                    </Row>
                    <Row label="Ngày cấp">{fmt(project.copyrightAt)}</Row>
                  </>
                )}
                {project.copyrightOwner && <Row label="Chủ sở hữu">{project.copyrightOwner}</Row>}
              </dl>
              {project.trustProgramSlug && (
                <a
                  href={`/trust/programs/${project.trustProgramSlug}`}
                  className="mt-3 inline-block text-sm text-link hover:underline"
                >
                  Chương trình dấu liên quan →
                </a>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </Layout>
  );
}

/// 🔴 BA MÃ TRẠNG THÁI, KHÔNG PHẢI MỘT. Đọc trước khi gộp lại cho gọn.
///
/// Bản trước gọi `api.project()` rồi render "Không tìm thấy dự án" cho MỌI trường
/// hợp nó trả về null - kể cả khi lượt gọi THẤT BẠI. Nghĩa là lúc content-service
/// hoặc database chết, một dự án đang tồn tại thật sẽ trả HTTP 200 kèm dòng chữ
/// "không tìm thấy". Với công cụ tìm kiếm đó là soft 404: nó gỡ URL khỏi chỉ mục,
/// và nó không đọc lại nữa vì ta đã trả lời 200 rất dứt khoát.
///
/// Đã xảy ra thật: ngày 28/10/2026 Neon treo compute và toàn bộ nội dung
/// tsudev.com biến mất khỏi mọi trang trong khi mọi trang vẫn 200 (xem
/// `lib/api.ts` § vì sao `Fetched` tồn tại).
///
///   gọi thất bại         -> 503, "không tải được"  -> crawler THỬ LẠI, không gỡ
///   gọi xong, null       -> 404, "không tìm thấy"  -> đúng, dự án này không có
///   gọi xong, có dữ liệu -> 200
export async function getServerSideProps({ params, res }: GetServerSidePropsContext) {
  const slug = routeParam(params, 'slug');
  // Hai lượt gọi SONG SONG. Tuần tự thì trang chi tiết dự án phải chờ hai vòng
  // mạng tới một backend ngủ sau 15 phút không request - tức cộng thêm cả một
  // lần cold start vào thời gian chờ của người đọc.
  const [r, rRel] = await Promise.all([api.project(slug), api.projectReleases(slug)]);
  const project = r.data;
  if (r.failed) res.statusCode = 503;
  else if (!project) res.statusCode = 404;
  // `rRel.failed` KHÔNG đổi mã trạng thái: dự án vẫn đọc được thì trang vẫn có
  // giá trị, chỉ thiếu khu tải về. Để nó hạ cả trang xuống 503 là đánh đổi sai.
  return { props: { failed: r.failed, project, releases: rRel.data, slug } };
}
