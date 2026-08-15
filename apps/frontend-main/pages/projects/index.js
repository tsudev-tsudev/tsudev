import React, { useMemo, useState } from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, Badge, SectionHeading } from '@tsudev/ui';
import { api } from '../../lib/api';
import { KIND_LABEL, STATUS_LABEL, COPYRIGHT } from '../../lib/projectLabels';

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'APP', label: 'Ứng dụng' },
  { key: 'TOOL', label: 'Công cụ' },
  { key: 'LIBRARY', label: 'Thư viện' },
  { key: 'SERVICE', label: 'Dịch vụ' },
];

export default function ProjectsIndex({ projects }) {
  const [kind, setKind] = useState('all');
  const shown = useMemo(
    () => (kind === 'all' ? projects : projects.filter((p) => p.kind === kind)),
    [kind, projects]
  );
  const registered = projects.filter((p) => p.copyrightStatus === 'REGISTERED').length;

  return (
    <Layout active="/projects" bare>
      <Seo
        title="Dự án"
        path="/projects"
        description="Dự án, công cụ và phần mềm do tsudev phát triển, kèm giấy phép và trạng thái đăng ký bản quyền."
      />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <SectionHeading
          eyebrow="Dự án"
          title="Dự án, công cụ & phần mềm"
          action={
            registered > 0 ? (
              <Badge tone="success" mono>
                {registered} đã đăng ký bản quyền
              </Badge>
            ) : null
          }
        />
        <p className="-mt-2 mb-6 text-sm text-muted max-w-2xl">
          Mỗi dự án ghi rõ giấy phép mã nguồn và trạng thái đăng ký quyền tác giả. Dự án đã đăng ký
          là căn cứ để cấp con dấu cho website sử dụng nó.
        </p>

        <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Lọc theo loại">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setKind(f.key)}
              aria-pressed={kind === f.key}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                kind === f.key
                  ? 'border-transparent bg-panel2 text-brandink'
                  : 'border-hairline text-muted hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {shown.length === 0 && (
            <Card className="p-6 text-muted md:col-span-2">Chưa có dự án nào trong mục này.</Card>
          )}
          {shown.map((p) => {
            const cr = COPYRIGHT[p.copyrightStatus] || COPYRIGHT.NONE;
            return (
              <Card
                key={p.id}
                as="a"
                href={`/projects/${p.slug}`}
                hover
                className="p-6 flex flex-col group"
              >
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <Badge tone="neutral">{KIND_LABEL[p.kind] || p.kind}</Badge>
                  <Badge tone="outline">{STATUS_LABEL[p.status] || p.status}</Badge>
                  {p.featured && <Badge tone="brand">Nổi bật</Badge>}
                </div>
                <h2 className="text-xl font-bold text-ink leading-snug group-hover:text-brandink transition-colors text-balance">
                  {p.name}
                </h2>
                <p className="mt-2 text-sm text-muted flex-1">{p.summary}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
                  <Badge tone={cr.tone}>{cr.label}</Badge>
                  {p.license && <span className="font-mono">{p.license}</span>}
                  {p.version && <span className="font-mono">v{p.version}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const projects = await api.projects(100);
  return { props: { projects } };
}
