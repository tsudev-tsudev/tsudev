import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card } from '@tsudev/ui';

/**
 * Quản lý bí danh thư nội bộ `*@tsudev.com` (Cloudflare Email Routing).
 *
 * Điều quan trọng nhất mà giao diện này phải nói đúng: **Cloudflare là nguồn sự
 * thật, bảng của ta chỉ là bản sao**. Vì thế mỗi hàng có cờ "đang sống", và có
 * nút đối soát - hai bên lệch nhau là chuyện bình thường (ai đó sửa tay trên
 * bảng điều khiển Cloudflare), và hình dạng hỏng của nó là thư bị trả về mà
 * không có log nào ở phía ta ghi lại.
 */

type Alias = {
  id: string;
  localPart: string;
  address: string;
  destination: string;
  live: boolean;
  enabled: boolean;
  createdAt: string;
  user: { id: string; username: string } | null;
};

type SyncReport = {
  missingAtCloudflare: Alias[];
  unknownAtCloudflare: Array<{ address: string; destination: string }>;
  destinationMismatch: Array<Alias & { cloudflareDestination: string | null }>;
};

const inputCls =
  'w-full rounded-md border border-line bg-base px-3 py-2 text-sm text-fg ' +
  'placeholder:text-fg-muted focus:border-primary outline-none';
const labelCls = 'block text-sm font-medium text-fg-secondary mb-1.5';

const ERR: Record<string, string> = {
  invalid_local_part:
    'Phần trước @ chỉ được dùng chữ thường, số, dấu chấm/gạch, và không mở đầu hay kết thúc bằng dấu.',
  invalid_destination: 'Địa chỉ nhận chuyển tiếp không hợp lệ.',
  alias_taken: 'Bí danh này đã tồn tại.',
  not_found: 'Không tìm thấy.',
  not_configured: 'Chưa cấu hình Cloudflare.',
  cloudflare_failed: 'Cloudflare từ chối thao tác.',
};

async function call(action: string, body: Record<string, unknown> = {}) {
  const r = await fetch(`/api/account/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data } as const;
}

export function EmailAliases({ onMessage }: { onMessage: (tone: string, text: string) => void }) {
  const [rows, setRows] = useState<Alias[]>([]);
  const [domain, setDomain] = useState('tsudev.com');
  const [configProblem, setConfigProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState<SyncReport | null>(null);
  const [form, setForm] = useState({ localPart: '', destination: '' });

  const fail = (data: { error?: string; detail?: string }) =>
    onMessage('danger', ERR[data?.error || ''] || data?.detail || 'Có lỗi xảy ra.');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await call('alias/list', { page_size: 200 });
    setLoading(false);
    if (!r.ok) return;
    const b = r.data as {
      data?: Alias[];
      domain?: string;
      configProblem?: string | null;
    };
    setRows(Array.isArray(b.data) ? b.data : []);
    if (b.domain) setDomain(b.domain);
    setConfigProblem(b.configProblem ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await call('alias/create', form);
    setBusy(false);
    if (!r.ok) return fail(r.data);
    onMessage('success', `Đã tạo ${form.localPart}@${domain}.`);
    setForm({ localPart: '', destination: '' });
    load();
  }

  async function remove(a: Alias) {
    if (!confirm(`Xoá bí danh ${a.address}? Thư gửi tới địa chỉ này sẽ bị trả về.`)) return;
    const r = await call('alias/delete', { id: a.id });
    if (!r.ok) return fail(r.data);
    onMessage('success', `Đã xoá ${a.address}.`);
    load();
  }

  async function runSync() {
    setBusy(true);
    const r = await call('alias/sync');
    setBusy(false);
    if (!r.ok) return fail(r.data);
    const rep = r.data as SyncReport;
    setSync(rep);
    const lech =
      rep.missingAtCloudflare.length +
      rep.unknownAtCloudflare.length +
      rep.destinationMismatch.length;
    onMessage(
      lech === 0 ? 'success' : 'warning',
      lech === 0 ? 'Khớp hoàn toàn với Cloudflare.' : `Phát hiện ${lech} điểm lệch.`
    );
  }

  return (
    <Card className="mt-6 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-fg">Email nội bộ @{domain}</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Bí danh chuyển tiếp qua Cloudflare Email Routing. Cloudflare là nơi thư thật sự đi qua -
            bảng này chỉ là bản sao, nên hãy đối soát khi có nghi ngờ.
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled={busy || !!configProblem} onClick={runSync}>
          Đối soát với Cloudflare
        </Button>
      </div>

      {configProblem && (
        <div className="mb-4 rounded-md border border-warning bg-surface p-3 text-sm">
          <strong className="text-warning">Chưa dùng được:</strong>{' '}
          <span className="text-fg-secondary">{configProblem}</span>
          <div className="mt-1 text-fg-muted">
            Đặt biến ở Render (phía máy chủ), <strong>không</strong> đặt ở Cloudflare Worker - khoá
            API đặt ở Worker sẽ lộ ra trong bản dựng.
          </div>
        </div>
      )}

      <form onSubmit={create} className="mb-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className={labelCls}>Bí danh</span>
          <div className="flex items-center gap-1">
            <input
              className={inputCls}
              value={form.localPart}
              onChange={(e) => setForm({ ...form, localPart: e.target.value.toLowerCase() })}
              placeholder="lien-he"
              autoComplete="off"
            />
            <span className="whitespace-nowrap text-sm text-fg-muted">@{domain}</span>
          </div>
        </label>
        <label className="block">
          <span className={labelCls}>Chuyển tiếp tới</span>
          <input
            className={inputCls}
            type="email"
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
            placeholder="hop-thu-that@gmail.com"
            autoComplete="off"
          />
        </label>
        <Button type="submit" disabled={busy || !!configProblem}>
          {busy ? 'Đang tạo…' : 'Tạo bí danh'}
        </Button>
      </form>

      <p className="mb-3 text-xs text-fg-muted">
        Cloudflare chỉ giao thư tới hộp thư <strong>đã xác minh</strong> ở phía họ. Địa chỉ chưa xác
        minh vẫn tạo được quy tắc nhưng thư sẽ không tới nơi.
      </p>

      <div className="divide-y divide-line">
        {loading && <p className="py-6 text-sm text-fg-muted">Đang tải…</p>}
        {!loading && rows.length === 0 && (
          <p className="py-6 text-sm text-fg-muted">Chưa có bí danh nào.</p>
        )}
        {rows.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
            <span className="font-medium text-fg">{a.address}</span>
            <span className="text-fg-muted">→ {a.destination}</span>
            {a.user && <Badge tone="neutral">@{a.user.username}</Badge>}
            {!a.live && (
              // Không gộp vào `enabled`: "tắt" là quyết định của người vận hành,
              // còn cái này là hai bên lệch nhau - hai chuyện khác hẳn.
              <Badge tone="danger">không có bên Cloudflare</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => remove(a)}
              disabled={busy}
            >
              Xoá
            </Button>
          </div>
        ))}
      </div>

      {sync && (
        <div className="mt-5 rounded-md border border-line bg-subtle p-4 text-sm">
          <h3 className="mb-2 font-semibold text-fg">Kết quả đối soát</h3>
          {sync.missingAtCloudflare.length === 0 &&
          sync.unknownAtCloudflare.length === 0 &&
          sync.destinationMismatch.length === 0 ? (
            <p className="text-fg-secondary">Hai bên khớp nhau hoàn toàn.</p>
          ) : (
            <ul className="space-y-1.5 text-fg-secondary">
              {sync.missingAtCloudflare.map((a) => (
                <li key={a.id}>
                  <strong className="text-danger">Thiếu bên Cloudflare:</strong> {a.address} - thư
                  gửi tới địa chỉ này đang bị trả về.
                </li>
              ))}
              {sync.unknownAtCloudflare.map((r) => (
                <li key={r.address}>
                  <strong className="text-warning">Chỉ có bên Cloudflare:</strong> {r.address} →{' '}
                  {r.destination} - đang nhận thư thật mà trang này không quản.
                </li>
              ))}
              {sync.destinationMismatch.map((a) => (
                <li key={a.id}>
                  <strong className="text-warning">Lệch đích:</strong> {a.address} - ở đây ghi{' '}
                  {a.destination}, Cloudflare đang chuyển tới {a.cloudflareDestination}.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
