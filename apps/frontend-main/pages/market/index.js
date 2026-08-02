import React from 'react';
import Head from 'next/head';
import { Layout, Card, Button, Badge, SectionHeading, Avatar } from '@tsudev/ui';
import { api } from '../../lib/api';

export default function Market({ listings }) {
  return (
    <Layout active="/market" bare>
      <Head>
        <title>Chợ — tsudev</title>
      </Head>
      <div className="max-w-6xl mx-auto px-4 py-10">
        <SectionHeading
          eyebrow="Marketplace"
          title="Chợ cộng đồng"
          action={
            <div className="flex gap-2">
              <Button as="a" href="/market/orders" variant="ghost" size="sm">
                Đơn của tôi
              </Button>
              <Button as="a" href="/market/new" size="sm">
                + Đăng tin
              </Button>
            </div>
          }
        />
        <p className="text-muted -mt-3 mb-6 text-sm">
          Trao đổi hàng hoá &amp; dịch vụ hợp pháp bằng tín dụng nội bộ. Mọi tin đăng được kiểm
          duyệt; thanh toán giữ ký quỹ đến khi người mua xác nhận.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.length === 0 && (
            <Card className="p-8 text-muted lg:col-span-3 text-center">
              Chưa có tin đăng nào được duyệt.
            </Card>
          )}
          {listings.map((l) => (
            <Card
              key={l.id}
              as="a"
              href={`/market/${l.id}`}
              hover
              className="p-5 flex flex-col group"
            >
              <div className="flex items-center gap-2 mb-3">
                <Badge tone="neutral" mono>
                  {l.category}
                </Badge>
              </div>
              <h3 className="font-semibold text-ink text-lg leading-snug group-hover:text-brandink transition-colors">
                {l.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted flex-1 line-clamp-2">{l.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Avatar name={l.sellerName} size={22} />
                  {l.sellerName}
                </div>
                <span className="font-mono font-bold text-brandink">
                  {l.priceCredits} <span className="text-xs text-muted">tín dụng</span>
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const listings = await api.listings('ACTIVE');
  return { props: { listings } };
}
