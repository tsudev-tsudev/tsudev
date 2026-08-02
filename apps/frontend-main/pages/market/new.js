import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button } from '@tsudev/ui';

export default function NewListing() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [f, setF] = useState({ title: '', description: '', priceCredits: '', category: 'general' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch('/api/market/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, priceCredits: Number(f.priceCredits) }),
    });
    const d = await r.json();
    if (r.ok) router.push('/market/orders');
    else {
      setErr(d.error || 'Lỗi');
      setBusy(false);
    }
  }

  return (
    <Layout active="/market" bare>
      <Head>
        <title>Đăng tin — Chợ tsudev</title>
      </Head>
      <div className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-ink mb-1">Đăng tin mới</h1>
        <p className="text-muted mb-6">Tin đăng sẽ được kiểm duyệt trước khi hiển thị công khai.</p>
        {status !== 'loading' && !session ? (
          <Card className="p-8 text-center">
            <p className="text-inksoft mb-4">Bạn cần đăng nhập.</p>
            <Button onClick={() => signIn()}>Đăng nhập</Button>
          </Card>
        ) : (
          <Card className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label
                  htmlFor="market-title"
                  className="block text-sm font-medium text-inksoft mb-1.5"
                >
                  Tiêu đề
                </label>
                <input
                  id="market-title"
                  value={f.title}
                  onChange={set('title')}
                  required
                  minLength={3}
                  className="w-full rounded-lg border border-hairline bg-surface p-2.5 text-sm text-ink focus:border-brand outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="market-desc"
                  className="block text-sm font-medium text-inksoft mb-1.5"
                >
                  Mô tả
                </label>
                <textarea
                  id="market-desc"
                  value={f.description}
                  onChange={set('description')}
                  rows={5}
                  className="w-full rounded-lg border border-hairline bg-surface p-3 text-sm text-ink focus:border-brand outline-none resize-y"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="market-price"
                    className="block text-sm font-medium text-inksoft mb-1.5"
                  >
                    Giá (tín dụng)
                  </label>
                  <input
                    id="market-price"
                    type="number"
                    min="0"
                    value={f.priceCredits}
                    onChange={set('priceCredits')}
                    required
                    className="w-full rounded-lg border border-hairline bg-surface p-2.5 text-sm text-ink focus:border-brand outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="market-category"
                    className="block text-sm font-medium text-inksoft mb-1.5"
                  >
                    Danh mục
                  </label>
                  <input
                    id="market-category"
                    value={f.category}
                    onChange={set('category')}
                    className="w-full rounded-lg border border-hairline bg-surface p-2.5 text-sm text-ink focus:border-brand outline-none"
                  />
                </div>
              </div>
              {err && <p className="text-[var(--error)] text-sm">{err}</p>}
              <div className="flex justify-end gap-2">
                <Button as="a" href="/market" variant="ghost">
                  Huỷ
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Đang đăng…' : 'Đăng tin'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </Layout>
  );
}
