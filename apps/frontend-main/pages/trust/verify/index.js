import React, { useState } from 'react';
import Seo from '../../../components/Seo';
import { useRouter } from 'next/router';
import { Layout, Button } from '@tsudev/ui';

export default function VerifySearch() {
  const router = useRouter();
  const [serial, setSerial] = useState('');
  const go = (e) => {
    e.preventDefault();
    const s = serial.trim().toUpperCase();
    if (s) router.push(`/trust/verify/${encodeURIComponent(s)}`);
  };
  return (
    <Layout active="/trust" bare>
      <Seo
        title="Tra cứu con dấu"
        path="/trust/verify"
        description="Tra cứu và xác minh chứng chỉ con dấu tín nhiệm tsudev theo số serial."
      />
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="font-mono text-xs uppercase tracking-wider text-teal font-semibold mb-3">
          Xác thực
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-ink">Tra cứu con dấu tín nhiệm</h1>
        <p className="mt-3 text-inksoft">
          Nhập số hiệu ghi trên huy hiệu để kiểm tra chứng chỉ còn hiệu lực hay không. Bấm trực tiếp
          vào huy hiệu trên website cũng dẫn tới đây.
        </p>
        <form onSubmit={go} className="mt-8 flex flex-col sm:flex-row gap-3">
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="TSU-CV-2026-000001"
            aria-label="Số hiệu chứng chỉ"
            className="flex-1 rounded-lg border border-hairline bg-surface px-4 py-3 font-mono text-sm text-ink placeholder:text-muted focus:border-brand outline-none transition-colors"
          />
          <Button type="submit" size="lg">
            Tra cứu
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted">
          Không có số hiệu? Xem{' '}
          <a className="text-brandink hover:underline" href="/trust/directory">
            thư mục công khai
          </a>{' '}
          các website đang được cấp dấu.
        </p>
      </div>
    </Layout>
  );
}
