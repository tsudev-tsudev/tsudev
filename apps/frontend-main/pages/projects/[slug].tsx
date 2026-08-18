import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, Badge, Button } from '@tsudev/ui';
import { api } from '../../lib/api';
import { renderMarkdown } from '../../lib/md';
import { KIND_LABEL, STATUS_LABEL, copyrightMeta } from '../../lib/projectLabels';
import type { GetServerSidePropsContext } from 'next';
import type { Project } from '../../lib/types';
import { routeParam } from '../../lib/identity';

const fmt = (d: string | Date | null | undefined): string =>
  d ? new Date(d).toLocaleDateString('vi-VN') : '-';

type RowProps = { label: React.ReactNode; children?: React.ReactNode };

function Row({ label, children }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-hairline last:border-0">
      <dt className="text-sm text-muted shrink-0">{label}</dt>
      <dd className="text-sm text-inksoft text-right">{children}</dd>
    </div>
  );
}

type ProjectDetailProps = { project: Project | null; slug: string };

export default function ProjectDetail({ project, slug }: ProjectDetailProps) {
  if (!project)
    return (
      <Layout active="/projects">
        <Card className="p-8 text-center text-muted">Không tìm thấy dự án.</Card>
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
        <nav className="text-sm text-muted mb-4">
          <a href="/projects" className="hover:text-brandink">
            Dự án
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-inksoft">{project.name}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <Badge tone="neutral">{KIND_LABEL[project.kind] || project.kind}</Badge>
          <Badge tone="outline">{STATUS_LABEL[project.status] || project.status}</Badge>
          <Badge tone={cr.tone}>{cr.label}</Badge>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-ink text-balance leading-tight">
          {project.name}
        </h1>
        <p className="mt-3 text-lg text-muted max-w-2xl">{project.summary}</p>

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
          {project.downloadUrl && (
            <Button as="a" href={project.downloadUrl} variant="ghost">
              Tải về
            </Button>
          )}
        </div>

        <div className="mt-10 grid md:grid-cols-[1fr_18rem] gap-8 items-start">
          <div>
            {project.descriptionMd ? (
              <div
                className="prose-tsu"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(project.descriptionMd) }}
              />
            ) : (
              <p className="text-muted">Chưa có mô tả chi tiết.</p>
            )}
          </div>

          <aside className="space-y-4">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-ink mb-2">Phát hành</h2>
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
              <h2 className="text-sm font-semibold text-ink mb-2">Bản quyền</h2>
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
                  className="mt-3 inline-block text-sm text-brandink hover:underline"
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

export async function getServerSideProps({ params }: GetServerSidePropsContext) {
  const project = await api.project(routeParam(params, 'slug'));
  return { props: { project, slug: routeParam(params, 'slug') } };
}
