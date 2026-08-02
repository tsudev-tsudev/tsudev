import React from 'react';
import Head from 'next/head';
import { Layout, Card, SectionHeading, Avatar, Badge } from '@tsudev/ui';
import { api } from '../../lib/api';

const ROLE_LABEL = {
  ADMIN: 'Quản trị',
  MODERATOR: 'Điều hành',
  VIP: 'VIP',
  MEMBER: 'Thành viên',
  GUEST: 'Khách',
};

export default function Members({ members }) {
  const [top, ...rest] = members;
  return (
    <Layout active="/members" bare>
      <Head>
        <title>Thành viên — tsudev</title>
      </Head>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <SectionHeading eyebrow="Cộng đồng" title="Bảng xếp hạng thành viên" />
        {top && (
          <Card
            as="a"
            href={`/members/${top.username}`}
            hover
            className="p-6 flex items-center gap-5 mb-4 relative overflow-hidden"
          >
            <div className="absolute inset-0 tsu-grid opacity-50" aria-hidden="true" />
            <div className="relative flex items-center gap-5 w-full">
              <span className="font-mono text-2xl font-bold text-teal">#1</span>
              <Avatar name={top.displayName || top.username} size={64} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-ink truncate">
                    {top.displayName || top.username}
                  </span>
                  <Badge tone="brand">{ROLE_LABEL[top.role] || top.role}</Badge>
                </div>
                <div className="text-sm text-muted mt-0.5">
                  {top.rank?.label} · {top.bio || '—'}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-bold text-brandink tabular-nums">
                  {top.reputation}
                </div>
                <div className="text-xs uppercase text-muted">uy tín</div>
              </div>
            </div>
          </Card>
        )}
        <Card className="p-2">
          {rest.map((m, i) => (
            <a
              key={m.id}
              href={`/members/${m.username}`}
              className="flex items-center gap-4 px-5 py-4 rounded-lg hover:bg-panel2 transition"
            >
              <span className="font-mono text-sm text-muted w-6 tabular-nums">{i + 2}</span>
              <Avatar name={m.displayName || m.username} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink truncate">{m.displayName || m.username}</div>
                <div className="text-xs text-muted">
                  {m.rank?.label} · {ROLE_LABEL[m.role] || m.role}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-semibold text-brandink tabular-nums">
                  {m.reputation}
                </div>
                <div className="text-[10px] uppercase text-muted">uy tín</div>
              </div>
            </a>
          ))}
        </Card>
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const members = await api.members(50);
  return { props: { members } };
}
