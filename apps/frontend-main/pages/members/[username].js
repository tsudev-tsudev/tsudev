import React from 'react';
import Head from 'next/head';
import { Layout, Card, Avatar, Badge, Stat } from '@tsudev/ui';
import { api } from '../../lib/api';

const ROLE_LABEL = {
  ADMIN: 'Quản trị',
  MODERATOR: 'Điều hành',
  VIP: 'VIP',
  MEMBER: 'Thành viên',
  GUEST: 'Khách',
};

export default function Profile({ user }) {
  if (!user)
    return (
      <Layout>
        <Card className="p-8 text-center text-muted">Không tìm thấy thành viên.</Card>
      </Layout>
    );
  return (
    <Layout active="/members" bare>
      <Head>
        <title>{user.displayName || user.username} — tsudev</title>
      </Head>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <nav className="text-sm text-muted mb-4">
          <a href="/members" className="hover:text-brandink">
            Thành viên
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-inksoft">{user.username}</span>
        </nav>
        <Card className="relative overflow-hidden">
          <div
            className="h-24 tsu-grid"
            style={{ background: 'linear-gradient(120deg, var(--glow), transparent)' }}
            aria-hidden="true"
          />
          <div className="px-6 pb-6 -mt-10">
            <div className="flex items-end gap-4">
              <span className="ring-4 ring-[color:var(--panel)] rounded-full">
                <Avatar name={user.displayName || user.username} size={80} />
              </span>
              <div className="pb-2 flex items-center gap-2">
                <h1 className="text-2xl font-bold text-ink">{user.displayName || user.username}</h1>
                <Badge tone="brand">{ROLE_LABEL[user.role] || user.role}</Badge>
                <Badge tone="teal" mono>
                  {user.rank?.label}
                </Badge>
              </div>
            </div>
            <p className="mt-3 text-inksoft">{user.bio || 'Thành viên cộng đồng tsudev.'}</p>
            <div className="mt-6 grid grid-cols-4 gap-4 pt-5">
              <Stat value={user.reputation} label="Uy tín" />
              <Stat value={user.credits} label="Tín dụng" />
              <Stat value={user.stats?.threads ?? 0} label="Chủ đề" />
              <Stat value={user.stats?.posts ?? 0} label="Bài viết" />
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ params }) {
  const user = await api.member(params.username);
  return { props: { user } };
}
