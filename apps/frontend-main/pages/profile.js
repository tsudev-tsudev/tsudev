import React from 'react';
import { Layout, Card } from '@tsudev/ui';

export default function Profile() {
  // placeholder - real data comes from user-service via REST
  const user = { name: 'Guest', email: 'guest@local' };
  return (
    <Layout>
      <Card className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-ink">Profile</h1>
        <p className="text-muted mt-2">Manage your account and settings.</p>
        <div className="mt-4">
          <div className="font-medium text-ink">{user.name}</div>
          <div className="text-sm text-muted">{user.email}</div>
        </div>
      </Card>
    </Layout>
  );
}
