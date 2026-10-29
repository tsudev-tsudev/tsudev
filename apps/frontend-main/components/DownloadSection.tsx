import React, { useState } from 'react';
import { Card, Button, Badge, SectionHeading, Icon, EmptyState } from '@tsudev/ui';
import type { IconName } from '@tsudev/ui';

import DownloadModal from './DownloadModal';
import type { ProjectWithReleases, ReleasePlatform } from '../lib/types';

/**
 * Khối "Tải app" ở trang chủ.
 *
 * Một thẻ cho mỗi dự án CÓ bản phát hành, kèm dãy icon nền tảng để người ta thấy
 * ngay "cái này có bản Android không" mà không phải mở hộp thoại. Bấm thẻ mới mở
 * hộp thoại chi tiết (phiên bản, dung lượng, checksum, chữ ký).
 *
 * Vì sao hai tầng chứ không liệt kê phẳng mọi bản phát hành ngay trên trang chủ:
 * một dự án có 4 nền tảng × 2 kiến trúc là 8 hàng, và ba dự án như thế biến khu
 * này thành một bảng 24 hàng ở giữa trang chủ. Trang chủ trả lời câu "có gì tải
 * được", hộp thoại trả lời câu "tải bản nào".
 */

const ICON_NEN_TANG: Record<ReleasePlatform, { nhan: string; icon: IconName }> = {
  ANDROID: { nhan: 'Android', icon: 'android' },
  WINDOWS: { nhan: 'Windows', icon: 'windows' },
  MACOS: { nhan: 'macOS', icon: 'apple' },
  LINUX: { nhan: 'Linux', icon: 'linux' },
  WEB: { nhan: 'Trình duyệt', icon: 'web' },
  SOURCE: { nhan: 'Mã nguồn', icon: 'code' },
};

const THU_TU: ReleasePlatform[] = ['ANDROID', 'WINDOWS', 'MACOS', 'LINUX', 'WEB', 'SOURCE'];

export type DownloadSectionProps = {
  items: ProjectWithReleases[];
  failed: boolean;
};

export default function DownloadSection({ items, failed }: DownloadSectionProps) {
  const [mo, setMo] = useState<string | null>(null);

  // Khu này ẨN HOÀN TOÀN khi không có gì tải và lượt gọi KHÔNG thất bại.
  //
  // Đây là ngoại lệ có chủ đích với nguyên tắc "empty state phải nói ra": một
  // khu "Tải ứng dụng" trống ở giữa trang chủ nói với khách vãng lai rằng dự án
  // này không có sản phẩm nào - trong khi sự thật chỉ là chưa có bản đóng gói.
  // Nhưng khi lượt gọi THẤT BẠI thì vẫn phải hiện, vì lúc đó trống là LỖI và im
  // lặng chính là cái đã để sự cố 28/10/2026 sống hai tháng.
  if (!failed && items.length === 0) return null;

  return (
    <section className="py-6 reveal">
      <SectionHeading
        eyebrow="Tải về"
        title="Ứng dụng & công cụ"
        action={
          <Button as="a" href="/projects" variant="ghost" size="sm">
            Tất cả dự án →
          </Button>
        }
      />

      {failed ? (
        <EmptyState
          kind="failed"
          icon="warning"
          title="Không tải được danh sách bản phát hành"
          explain="Máy chủ nội dung không trả lời. Các bản đã phát hành vẫn còn nguyên; thử tải lại sau ít phút."
          action={{ label: 'Mở trang dự án', href: '/projects' }}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(({ project, releases }) => {
            // Nền tảng nào có bản, theo thứ tự cố định - không theo thứ tự dữ
            // liệu, để ba thẻ cạnh nhau không xếp icon lệch nhau.
            const nenTang = THU_TU.filter((p) => releases.some((r) => r.platform === p));
            // Phiên bản mới nhất: API đã sắp theo `publishedAt desc`.
            const banMoi = releases[0];
            const tongTai = releases.reduce((s, r) => s + (r.downloadCount || 0), 0);

            return (
              <Card key={project.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-fg leading-snug text-balance">
                    {project.name}
                  </h3>
                  {banMoi && (
                    <span className="font-mono text-xs text-fg-muted shrink-0 pt-0.5">
                      {banMoi.version}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-fg-muted flex-1">{project.summary}</p>

                {/* Dãy icon nền tảng. Mỗi icon có `label` nên trình đọc màn hình
                    đọc được tên nền tảng - một hàng icon không nhãn là một hàng
                    thông tin mà người dùng trình đọc không nhận được. */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {nenTang.map((p) => (
                    <span
                      key={p}
                      title={ICON_NEN_TANG[p].nhan}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-subtle"
                    >
                      <Icon name={ICON_NEN_TANG[p].icon} size={15} label={ICON_NEN_TANG[p].nhan} />
                    </span>
                  ))}
                  {releases.some((r) => r.sha256) && (
                    <Badge tone="teal" icon={<Icon name="signature" size={12} />}>
                      có checksum
                    </Badge>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <Button size="sm" onClick={() => setMo(project.slug)}>
                    <Icon name="download" size={15} />
                    Tải về
                  </Button>
                  {tongTai > 0 && <span className="text-xs text-fg-muted">{tongTai} lượt tải</span>}
                </div>

                <DownloadModal
                  open={mo === project.slug}
                  onClose={() => setMo(null)}
                  project={project}
                  releases={releases}
                />
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
