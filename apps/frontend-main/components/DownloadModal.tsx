import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Badge, Icon } from '@tsudev/ui';
import type { IconName } from '@tsudev/ui';

import type { Project, ProjectRelease, ReleasePlatform } from '../lib/types';

/**
 * Hộp thoại tải về của một dự án.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ CHECKSUM VÀ CHỮ KÝ TRÊN MẶT TRANG, KHÔNG ẨN TRONG TRANG TÀI LIỆU
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Phát hành app ngoài store gặp hai rào cản thật, và cả hai đều là rào cản TÂM
 * LÝ của người tải: Windows SmartScreen cảnh báo mọi tệp không có chứng chỉ ký
 * mã, Android chặn "cài từ nguồn không xác định". Dự án cá nhân không mua được
 * chứng chỉ ký mã.
 *
 * Thứ duy nhất ta cho được là một checksum công khai và một chữ ký kiểm được -
 * và nó chỉ có giá trị nếu người ta THẤY nó ngay lúc đang do dự bấm nút, chứ
 * không phải nếu nó nằm trong một trang tài liệu nào đó.
 *
 * Repo này có sẵn hạ tầng: `@tsudev/trust-crypto` ký Ed25519, khoá công khai ở
 * `/.well-known/tsudev-trust-jwks.json`. Nên đây là hệ con dấu tín nhiệm của
 * tsudev tự áp lên chính binary của mình.
 */

/** Nhãn và icon của từng nền tảng. Icon lấy từ hệ thống, không vẽ inline. */
const NEN_TANG: Record<ReleasePlatform, { nhan: string; icon: IconName }> = {
  ANDROID: { nhan: 'Android', icon: 'android' },
  WINDOWS: { nhan: 'Windows', icon: 'windows' },
  MACOS: { nhan: 'macOS', icon: 'apple' },
  LINUX: { nhan: 'Linux', icon: 'linux' },
  WEB: { nhan: 'Trình duyệt', icon: 'web' },
  SOURCE: { nhan: 'Mã nguồn', icon: 'code' },
};

/** Thứ tự hiển thị các thẻ tab. Cố định, không theo thứ tự dữ liệu trả về. */
const THU_TU: ReleasePlatform[] = ['ANDROID', 'WINDOWS', 'MACOS', 'LINUX', 'WEB', 'SOURCE'];

/**
 * Đoán nền tảng của thiết bị đang xem, để chọn thẻ tab mặc định.
 *
 * ⚠️ CHỈ ĐỂ CHỌN MẶC ĐỊNH. Người dùng luôn đổi được bằng tay, và đó không phải
 * phép lịch sự mà là tính đúng đắn: phép đoán này SAI thường xuyên - máy Windows
 * tải file APK để chuyển sang điện thoại là việc hết sức bình thường, và một
 * trang chỉ hiện đúng nền tảng đoán được sẽ chặn đúng việc đó.
 *
 * Trả `null` khi không đoán được. Đừng đoán bừa thành WINDOWS: một mặc định sai
 * còn tệ hơn không có mặc định, vì nó trông như một lựa chọn đã được cân nhắc.
 */
function nenTangCuaThietBi(): ReleasePlatform | null {
  if (typeof navigator === 'undefined') return null;
  // `userAgentData` chính xác hơn nhưng chưa có ở Safari/Firefox, nên vẫn phải
  // đọc chuỗi UA làm đường dự phòng.
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const p = (nav.userAgentData?.platform || '').toLowerCase();
  const ua = navigator.userAgent.toLowerCase();

  // Android PHẢI kiểm trước Linux: chuỗi UA của Android cũng chứa "linux".
  if (p.includes('android') || ua.includes('android')) return 'ANDROID';
  if (p.includes('ios') || /iphone|ipad|ipod/.test(ua)) return 'WEB';
  if (p.includes('windows') || ua.includes('windows')) return 'WINDOWS';
  if (p.includes('macos') || ua.includes('mac os')) return 'MACOS';
  if (p.includes('linux') || ua.includes('linux')) return 'LINUX';
  return null;
}

/** Byte sang chuỗi người đọc được. Nhị phân (1024) vì đó là cách hệ điều hành đếm. */
function coTep(byte?: number | null): string {
  if (!byte || byte <= 0) return '';
  const bac = ['B', 'KB', 'MB', 'GB'];
  let n = byte;
  let i = 0;
  while (n >= 1024 && i < bac.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${bac[i]}`;
}

function OChecksum({ r }: { r: ProjectRelease }) {
  const [daCopy, setDaCopy] = useState(false);

  useEffect(() => {
    if (!daCopy) return undefined;
    const t = setTimeout(() => setDaCopy(false), 2000);
    return () => clearTimeout(t);
  }, [daCopy]);

  if (!r.sha256) {
    // NÓI RA việc thiếu, đừng ẩn khối đi. Một bản phát hành không có checksum là
    // một bản người tải không kiểm được, và đó là thông tin họ cần có để quyết
    // định - ẩn nó đi là để họ tưởng mọi bản đều như nhau.
    return (
      <p className="mt-4 text-xs text-fg-muted">
        Bản này chưa có checksum công bố, nên không kiểm được tính nguyên vẹn của tệp sau khi tải.
      </p>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.sha256 || '');
      setDaCopy(true);
    } catch {
      // Clipboard API cần ngữ cảnh an toàn (HTTPS) và quyền. Thất bại thì giá
      // trị vẫn đang hiện đầy đủ trên màn hình để chọn tay - nên không báo lỗi,
      // chỉ không đổi nhãn nút.
    }
  };

  return (
    <div className="mt-4 rounded-md border border-line bg-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg">
          <Icon name="hash" size={14} />
          SHA-256
        </span>
        <button
          type="button"
          onClick={copy}
          className="text-xs text-link hover:underline focus-visible:underline"
        >
          {daCopy ? 'Đã sao chép' : 'Sao chép'}
        </button>
      </div>

      {/* `break-all` chứ không `truncate`: một checksum bị cắt đuôi là một
          checksum vô dụng, và người ta sẽ không biết nó đã bị cắt. */}
      <code className="mt-2 block break-all font-mono text-[11px] leading-relaxed text-fg-secondary">
        {r.sha256}
      </code>

      <p className="mt-2 text-xs text-fg-muted">
        Đối chiếu sau khi tải: <code className="font-mono">sha256sum {r.fileName || 'tệp'}</code>
        {' · Windows: '}
        <code className="font-mono">certutil -hashfile {r.fileName || 'tệp'} SHA256</code>
      </p>

      {r.signature && (
        <div className="mt-3 border-t border-line pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg">
            <Icon name="signature" size={14} />
            Đã ký Ed25519
            {r.signingKid && <code className="font-mono text-fg-muted">kid={r.signingKid}</code>}
          </span>
          <p className="mt-1.5 text-xs text-fg-muted">
            Chữ ký của chuỗi SHA-256 ở trên. Khoá công khai để kiểm nằm ở{' '}
            <a href="/.well-known/tsudev-trust-jwks.json" className="text-link hover:underline">
              JWKS của tsudev
            </a>
            . Đây là cùng vòng khoá dùng cho Con dấu tín nhiệm.
          </p>
        </div>
      )}
    </div>
  );
}

export type DownloadModalProps = {
  open: boolean;
  onClose: () => void;
  project: Project;
  releases: ProjectRelease[];
};

export default function DownloadModal({ open, onClose, project, releases }: DownloadModalProps) {
  // Gom theo nền tảng MỘT LẦN. Bản nhiều phiên bản cùng nền tảng thì bản mới
  // nhất đứng đầu (API đã sắp theo `publishedAt desc`).
  const theoNenTang = useMemo(() => {
    const m = new Map<ReleasePlatform, ProjectRelease[]>();
    for (const r of releases) {
      const ds = m.get(r.platform) || [];
      ds.push(r);
      m.set(r.platform, ds);
    }
    return m;
  }, [releases]);

  const coSan = useMemo(
    () => THU_TU.filter((p) => (theoNenTang.get(p)?.length || 0) > 0),
    [theoNenTang]
  );

  const [dangChon, setDangChon] = useState<ReleasePlatform | null>(null);

  // Chọn mặc định khi MỞ, không phải lúc dựng component: phép đoán đọc
  // `navigator` nên nó chỉ chạy ở client, và chạy nó trong lần render đầu sẽ
  // làm server và client cho ra hai kết quả khác nhau (hydration mismatch).
  useEffect(() => {
    if (!open) return;
    const doan = nenTangCuaThietBi();
    setDangChon(doan && coSan.includes(doan) ? doan : coSan[0] ?? null);
  }, [open, coSan]);

  const dsHienTai = dangChon ? theoNenTang.get(dangChon) || [] : [];

  return (
    <Modal open={open} onClose={onClose} title={`Tải ${project.name}`}>
      {coSan.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Dự án này chưa công bố bản tải về nào. Mã nguồn và thông tin bản quyền vẫn xem được ở
          trang dự án.
        </p>
      ) : (
        <>
          {/* Thẻ tab nền tảng. `role="tablist"` + mũi tên trái/phải là bắt buộc:
              một hàng <button> trần thì trình đọc màn hình đọc thành sáu nút rời
              rạc, không nói rằng chúng là một nhóm chọn-một. */}
          <div
            role="tablist"
            aria-label="Nền tảng"
            className="flex flex-wrap gap-1.5 border-b border-line pb-3"
          >
            {coSan.map((p) => {
              const chon = p === dangChon;
              return (
                <button
                  key={p}
                  role="tab"
                  type="button"
                  aria-selected={chon}
                  onClick={() => setDangChon(p)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    chon
                      ? 'border-primary bg-subtle text-fg font-medium'
                      : 'border-line text-fg-muted hover:text-fg hover:border-line-strong'
                  }`}
                >
                  <Icon name={NEN_TANG[p].icon} size={15} />
                  {NEN_TANG[p].nhan}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-5">
            {dsHienTai.map((r) => (
              <div key={r.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-fg">{r.version}</span>
                  {r.channel !== 'STABLE' && <Badge tone="warning">{r.channel}</Badge>}
                  {r.arch && (
                    <Badge tone="outline" mono>
                      {r.arch}
                    </Badge>
                  )}
                  {r.fileSize ? (
                    <span className="text-xs text-fg-muted">{coTep(r.fileSize)}</span>
                  ) : null}
                  {typeof r.downloadCount === 'number' && r.downloadCount > 0 && (
                    <span className="text-xs text-fg-muted">{r.downloadCount} lượt tải</span>
                  )}
                </div>

                {r.minOsVersion && (
                  <p className="mt-1 text-xs text-fg-muted">Yêu cầu: {r.minOsVersion}</p>
                )}

                <div className="mt-3">
                  {/* Đường tải đi qua route đếm của chính site (`downloadPath`);
                      nền tảng WEB/SOURCE thì trỏ ra ngoài. Quyết định này do API
                      trả về, KHÔNG do giao diện suy ra - nếu để client chọn thì
                      một ngày nào đó nó sẽ gọi thẳng R2 và bộ đếm lặng lẽ chết. */}
                  {r.downloadPath ? (
                    <Button
                      as="a"
                      href={`/api/releases/${project.slug}/${r.id}`}
                      // Không `target="_blank"`: đây là một lượt tải, không phải
                      // một trang - mở tab mới chỉ để nó tự đóng là nhấp nháy vô ích.
                      download={r.fileName || undefined}
                    >
                      <Icon name="download" size={16} />
                      Tải {r.fileName ? `· ${r.fileName}` : NEN_TANG[r.platform].nhan}
                    </Button>
                  ) : r.externalUrl ? (
                    <Button as="a" href={r.externalUrl} variant="secondary" rel="noopener">
                      <Icon name="external" size={16} />
                      {r.platform === 'SOURCE' ? 'Xem mã nguồn' : 'Mở ứng dụng'}
                    </Button>
                  ) : (
                    <p className="text-sm text-warning">
                      Bản này thiếu cả tệp lẫn đường dẫn - dữ liệu chưa đầy đủ.
                    </p>
                  )}
                </div>

                {r.releaseNotesMd && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-link">
                      Có gì mới trong {r.version}
                    </summary>
                    {/* Hiện nguyên văn Markdown chứ không render: nội dung này do
                        trang quản trị nhập, và render HTML từ đó cần cùng đường
                        làm sạch mà `lib/md.ts` dùng cho thân bài. Chưa nối vào thì
                        hiện thô - thô thì an toàn, nửa vời thì là lỗ XSS. */}
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-relaxed text-fg-secondary">
                      {r.releaseNotesMd}
                    </pre>
                  </details>
                )}

                <OChecksum r={r} />
              </div>
            ))}
          </div>

          <p className="mt-5 border-t border-line pt-4 text-xs text-fg-muted">
            Tệp phát hành của tsudev không có chứng chỉ ký mã thương mại, nên Windows SmartScreen và
            Android có thể cảnh báo &quot;nguồn không xác định&quot;. Checksum ở trên là cách kiểm
            tệp bạn vừa tải đúng là tệp đã công bố.
          </p>
        </>
      )}
    </Modal>
  );
}
