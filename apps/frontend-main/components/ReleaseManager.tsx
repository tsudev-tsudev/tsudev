import React, { useCallback, useEffect, useState } from 'react';
import { Button, Badge, Input, Icon } from '@tsudev/ui';

import { formatDateTimeVN } from '../lib/format';
import type { ReleaseChannel, ReleasePlatform } from '../lib/types';

/**
 * Quản lý bản phát hành của MỘT dự án, nhúng trong trang `/admin/projects`.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * VÌ SAO LÀ MỘT KHỐI GẬP MỞ CHỨ KHÔNG PHẢI MỘT TRANG RIÊNG
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Bản phát hành không có nghĩa khi đứng rời khỏi dự án của nó: mọi câu hỏi vận
 * hành ("dự án này đã có bản Android chưa", "bản 1.0 đã công bố chưa") đều hỏi
 * về MỘT dự án. Một trang `/admin/releases` phẳng sẽ buộc người dùng tự ghép lại
 * mối quan hệ đó bằng mắt.
 *
 * Gập lại theo mặc định và chỉ gọi API khi MỞ: trang quản trị dự án hiện 10 dự
 * án một lượt, và nạp sẵn phát hành của cả 10 là 10 lượt truy vấn database cho
 * một khối mà người ta có thể không mở cái nào. Database này tính tiền theo thời
 * gian compute còn thức (xem docs/free-tier.md).
 */

const NEN_TANG: { v: ReleasePlatform; nhan: string }[] = [
  { v: 'ANDROID', nhan: 'Android' },
  { v: 'WINDOWS', nhan: 'Windows' },
  { v: 'MACOS', nhan: 'macOS' },
  { v: 'LINUX', nhan: 'Linux' },
  { v: 'WEB', nhan: 'Trình duyệt' },
  { v: 'SOURCE', nhan: 'Mã nguồn' },
];

const KENH: ReleaseChannel[] = ['STABLE', 'BETA', 'ALPHA'];

/** Hình dạng admin trả về - GỒM `storageKey`, khác đường đọc công khai. */
type AdminRelease = {
  id: string;
  version: string;
  channel: ReleaseChannel;
  platform: ReleasePlatform;
  arch: string;
  storageKey: string | null;
  externalUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  sha256: string | null;
  signature: string | null;
  signingKid: string | null;
  minOsVersion: string | null;
  releaseNotesMd: string;
  downloadCount: number;
  publishedAt: string | null;
  deletedAt: string | null;
};

type Form = {
  version: string;
  platform: ReleasePlatform;
  channel: ReleaseChannel;
  arch: string;
  storageKey: string;
  externalUrl: string;
  fileName: string;
  fileSize: string;
  sha256: string;
  signature: string;
  signingKid: string;
  minOsVersion: string;
  releaseNotesMd: string;
  published: boolean;
};

const TRONG: Form = {
  version: '',
  platform: 'ANDROID',
  channel: 'STABLE',
  arch: '',
  storageKey: '',
  externalUrl: '',
  fileName: '',
  fileSize: '',
  sha256: '',
  signature: '',
  signingKid: '',
  minOsVersion: '',
  releaseNotesMd: '',
  published: false,
};

export type ReleaseManagerProps = {
  slug: string;
  /// Báo lên trang cha để dùng CHUNG một vùng thông báo. Hai vùng thông báo trên
  /// cùng một trang thì người dùng không biết nhìn vào đâu.
  onMessage: (tone: string, text: string) => void;
};

export default function ReleaseManager({ slug, onMessage }: ReleaseManagerProps) {
  const [mo, setMo] = useState(false);
  const [dsach, setDsach] = useState<AdminRelease[] | null>(null);
  const [form, setForm] = useState<Form>(TRONG);
  const [busy, setBusy] = useState(false);
  const [hienForm, setHienForm] = useState(false);

  const nap = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/admin/projects/${slug}/releases`);
      if (!res.ok) {
        // ĐỌC mã trạng thái và NÓI RA. Bản đầu của trang toà soạn từng gọi fetch
        // rồi vứt phản hồi đi, nên 401/404/500 trông y hệt thành công - bài học
        // đã ghi trong pages/admin/newsroom.tsx.
        onMessage('danger', `Không đọc được danh sách bản phát hành (HTTP ${res.status})`);
        setDsach([]);
        return;
      }
      setDsach(await res.json());
    } catch {
      onMessage('danger', 'Không kết nối được máy chủ nội dung');
      setDsach([]);
    }
  }, [slug, onMessage]);

  // Chỉ nạp khi MỞ, và nạp lại nếu đóng rồi mở lại (dữ liệu có thể đã đổi).
  useEffect(() => {
    if (mo) void nap();
  }, [mo, nap]);

  const set =
    (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const t = e.target as HTMLInputElement;
      setForm((f) => ({ ...f, [k]: t.type === 'checkbox' ? t.checked : t.value }));
    };

  const guiTao = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Gửi chuỗi rỗng thành `undefined` để backend không ghi '' vào cột nullable.
      // `arch` là ngoại lệ: cột đó NOT NULL default '' (xem schema.prisma), nên
      // chuỗi rỗng là giá trị hợp lệ và đúng nghĩa.
      const than: Record<string, unknown> = {
        version: form.version.trim(),
        platform: form.platform,
        channel: form.channel,
        arch: form.arch.trim(),
        published: form.published,
      };
      for (const k of [
        'storageKey',
        'externalUrl',
        'fileName',
        'sha256',
        'signature',
        'signingKid',
        'minOsVersion',
        'releaseNotesMd',
      ] as const) {
        const v = form[k].trim();
        if (v) than[k] = v;
      }
      if (form.fileSize.trim()) than.fileSize = parseInt(form.fileSize.trim(), 10);

      const res = await fetch(`/api/content/admin/projects/${slug}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(than),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Hiện NGUYÊN VĂN lỗi của backend. Những phép kiểm ở đó rất cụ thể
        // ("signature phải đi kèm signingKid") và dịch chúng thành "Lưu thất bại"
        // là vứt đi đúng phần thông tin người dùng cần để sửa.
        onMessage('danger', body.error || `Tạo thất bại (HTTP ${res.status})`);
        return;
      }
      onMessage('success', `Đã tạo bản ${than.version} cho ${form.platform}`);
      setForm(TRONG);
      setHienForm(false);
      await nap();
    } finally {
      setBusy(false);
    }
  };

  const doiCongBo = async (r: AdminRelease) => {
    const res = await fetch(`/api/content/admin/releases/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !r.publishedAt }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return onMessage('danger', body.error || `Thất bại (HTTP ${res.status})`);
    onMessage('success', r.publishedAt ? `Đã rút bản ${r.version}` : `Đã công bố bản ${r.version}`);
    await nap();
  };

  const xoa = async (r: AdminRelease) => {
    // Hỏi lại, nhưng nói rõ đây là XOÁ MỀM - người ta quyết định khác nhau giữa
    // "mất vĩnh viễn" và "ẩn đi, còn trong database".
    if (
      !window.confirm(
        `Xoá mềm bản ${r.version} (${r.platform})?\n\nHàng vẫn còn trong database - một bản đã công bố có thể đang được ai đó đối chiếu checksum.`
      )
    )
      return;
    const res = await fetch(`/api/content/admin/releases/${r.id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return onMessage('danger', body.error || `Thất bại (HTTP ${res.status})`);
    onMessage('success', `Đã xoá mềm bản ${r.version}`);
    await nap();
  };

  const canTep = form.platform !== 'WEB' && form.platform !== 'SOURCE';

  return (
    <div className="w-full border-t border-line pt-3 mt-1">
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        aria-expanded={mo}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline"
      >
        <Icon name={mo ? 'chevron-down' : 'chevron'} size={14} />
        Bản phát hành
        {dsach && <span className="text-fg-muted font-normal">({dsach.length})</span>}
      </button>

      {mo && (
        <div className="mt-3">
          {dsach === null ? (
            <p className="text-sm text-fg-muted">Đang tải…</p>
          ) : dsach.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Dự án này chưa có bản phát hành nào. Thêm một bản để nó xuất hiện ở khối &quot;Tải
              về&quot; trên trang chủ.
            </p>
          ) : (
            <div className="space-y-2">
              {dsach.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-md border border-line p-3 ${r.deletedAt ? 'opacity-50' : ''}`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold text-fg">{r.version}</span>
                    <Badge tone="neutral">{r.platform}</Badge>
                    {r.arch && (
                      <Badge tone="outline" mono>
                        {r.arch}
                      </Badge>
                    )}
                    {r.channel !== 'STABLE' && <Badge tone="warning">{r.channel}</Badge>}
                    {r.deletedAt ? (
                      <Badge tone="danger">Đã xoá</Badge>
                    ) : r.publishedAt ? (
                      <Badge tone="success">Đã công bố</Badge>
                    ) : (
                      <Badge tone="warning">Bản nháp</Badge>
                    )}
                    {r.sha256 ? (
                      <Badge tone="teal" icon={<Icon name="hash" size={11} />}>
                        checksum
                      </Badge>
                    ) : (
                      // NÓI RA việc thiếu checksum ở trang quản trị: đây là nơi
                      // duy nhất người ta còn sửa được nó.
                      <Badge tone="outline">thiếu checksum</Badge>
                    )}
                    {r.signature && (
                      <Badge tone="teal" icon={<Icon name="signature" size={11} />}>
                        đã ký
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-fg-muted">
                      {r.downloadCount} lượt tải
                    </span>
                  </div>

                  <div className="mt-1.5 font-mono text-xs text-fg-muted break-all">
                    {r.storageKey || r.externalUrl}
                  </div>
                  {r.publishedAt && (
                    <div className="text-xs text-fg-muted">
                      Công bố {formatDateTimeVN(r.publishedAt)}
                    </div>
                  )}

                  {!r.deletedAt && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => doiCongBo(r)}>
                        {r.publishedAt ? 'Rút khỏi công khai' : 'Công bố'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => xoa(r)}>
                        Xoá mềm
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!hienForm ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => setHienForm(true)}
            >
              <Icon name="plus" size={14} />
              Thêm bản phát hành
            </Button>
          ) : (
            <form onSubmit={guiTao} className="mt-3 rounded-md border border-line bg-subtle p-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  label="Phiên bản (semver)"
                  value={form.version}
                  onChange={set('version')}
                  placeholder="1.0.0"
                  required
                />
                <label className="block">
                  <span className="block text-sm font-medium text-fg mb-1">Nền tảng</span>
                  <select
                    value={form.platform}
                    onChange={set('platform')}
                    className="w-full rounded-md border border-line-control bg-surface px-3 py-2 text-fg"
                  >
                    {NEN_TANG.map((p) => (
                      <option key={p.v} value={p.v}>
                        {p.nhan}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-fg mb-1">Kênh</span>
                  <select
                    value={form.channel}
                    onChange={set('channel')}
                    className="w-full rounded-md border border-line-control bg-surface px-3 py-2 text-fg"
                  >
                    {KENH.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Kiến trúc (bỏ trống = không phân biệt)"
                  value={form.arch}
                  onChange={set('arch')}
                  placeholder="arm64"
                />

                {/* Hai đường dẫn LOẠI TRỪ NHAU, và form nói ra điều đó bằng cách
                    chỉ hiện một ô theo nền tảng. Backend vẫn kiểm lại - giao diện
                    dẫn đường, backend mới là cổng. */}
                {canTep ? (
                  <>
                    <Input
                      label="Khoá object trong R2"
                      value={form.storageKey}
                      onChange={set('storageKey')}
                      placeholder="releases/app-1.0.0.apk"
                      required
                    />
                    <Input
                      label="Tên tệp hiển thị"
                      value={form.fileName}
                      onChange={set('fileName')}
                      placeholder="app-1.0.0.apk"
                    />
                    <Input
                      label="Dung lượng (byte)"
                      value={form.fileSize}
                      onChange={set('fileSize')}
                      placeholder="2418176"
                    />
                    <Input
                      label="Yêu cầu hệ điều hành"
                      value={form.minOsVersion}
                      onChange={set('minOsVersion')}
                      placeholder="Android 8.0+"
                    />
                    <Input
                      label="SHA-256 (64 ký tự hex)"
                      value={form.sha256}
                      onChange={set('sha256')}
                      placeholder="3f7a1c…"
                      className="sm:col-span-2"
                    />
                    <Input
                      label="Chữ ký Ed25519 (cần cả kid)"
                      value={form.signature}
                      onChange={set('signature')}
                    />
                    <Input
                      label="kid của khoá đã ký"
                      value={form.signingKid}
                      onChange={set('signingKid')}
                      placeholder="tsu-2026-08-efdb94"
                    />
                  </>
                ) : (
                  <Input
                    label="Đường dẫn ngoài"
                    value={form.externalUrl}
                    onChange={set('externalUrl')}
                    placeholder={form.platform === 'SOURCE' ? 'https://github.com/…' : '/trust'}
                    required
                    className="sm:col-span-2"
                  />
                )}

                <label className="block sm:col-span-2">
                  <span className="block text-sm font-medium text-fg mb-1">
                    Có gì mới (Markdown)
                  </span>
                  <textarea
                    value={form.releaseNotesMd}
                    onChange={set('releaseNotesMd')}
                    rows={3}
                    className="w-full rounded-md border border-line-control bg-surface px-3 py-2 font-mono text-sm text-fg"
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-sm text-fg sm:col-span-2">
                  <input type="checkbox" checked={form.published} onChange={set('published')} />
                  Công bố ngay (bỏ trống = lưu dạng bản nháp, không hiện ra công khai)
                </label>
              </div>

              <div className="mt-3 flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? 'Đang lưu…' : 'Tạo bản phát hành'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setHienForm(false);
                    setForm(TRONG);
                  }}
                >
                  Huỷ
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
