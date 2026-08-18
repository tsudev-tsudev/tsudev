// Truy vấn trust-service từ phía server (getServerSideProps).
//
// Khác lib/api.js: ở đây KHÔNG nuốt lỗi thành mảng rỗng. Trang xác thực mà âm
// thầm hiện "không tìm thấy" khi thực chất service chết là sai lệch nguy hiểm -
// người đọc sẽ tưởng con dấu giả. Nên hàm verify phân biệt rõ ba trường hợp:
// tìm thấy / không tồn tại / không kiểm tra được.

// Không gửi x-internal-token: trust-service cố ý đứng ngoài cổng chặn đó vì
// nhiều endpoint của nó phải công khai cho bên thứ ba (huy hiệu SVG, trang
// xác minh, JWKS). Xem docs/trust-seal.md.
import { TRUST } from './services';
import type { CertificateCard, TrustProfile, TrustProgram, VerifyOutcome } from './types';

async function getJSON<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${TRUST}${path}`);
    if (!res.ok) return fallback;
    return await res.json();
  } catch (e) {
    return fallback;
  }
}

export const trust = {
  programs: () => getJSON<TrustProgram[]>('/api/trust/programs', []),
  program: (slug: string) =>
    getJSON<TrustProgram | null>(`/api/trust/programs/${encodeURIComponent(slug)}`, null),
  directory: (params = '') => getJSON<CertificateCard[]>(`/api/trust/directory${params}`, []),
  profile: (orgId: string) =>
    getJSON<TrustProfile | null>(`/api/trust/profile/${encodeURIComponent(orgId)}`, null),

  /**
   * Ba trạng thái, không phải hai. Union phân biệt được khiến việc đọc
   * `.certificate` mà chưa kiểm `state === 'found'` thành lỗi biên dịch - trước
   * đây trang xác thực có thể vô tình coi "service chết" là "chứng chỉ giả".
   */
  async verify(serial: string): Promise<VerifyOutcome> {
    try {
      const res = await fetch(`${TRUST}/api/trust/verify/${encodeURIComponent(serial)}`);
      if (res.status === 404) return { state: 'missing' };
      if (!res.ok) return { state: 'unavailable' };
      return { state: 'found', certificate: await res.json() };
    } catch (e) {
      return { state: 'unavailable' };
    }
  },
};

/** Nhãn + tông màu cho từng trạng thái chứng chỉ. */
export const STATUS_META = {
  ACTIVE: {
    label: 'Đang hiệu lực',
    tone: 'success',
    note: 'Chứng chỉ còn hiệu lực tại thời điểm tra cứu.',
  },
  SUSPENDED: {
    label: 'Tạm đình chỉ',
    tone: 'warning',
    note: 'Chứng chỉ đang bị tạm dừng, chưa bị thu hồi.',
  },
  REVOKED: {
    label: 'Đã thu hồi',
    tone: 'error',
    note: 'Chứng chỉ đã bị thu hồi và không còn giá trị.',
  },
  EXPIRED: { label: 'Hết hạn', tone: 'muted', note: 'Chứng chỉ đã quá hạn hiệu lực.' },
};

export const BASIS_META = {
  SELF_DECLARED: {
    label: 'Tổ chức tự khai',
    detail: 'tsudev chưa thẩm định bằng chứng độc lập cho nội dung này.',
  },
  EVIDENCE_REVIEWED: {
    label: 'Đã thẩm định bằng chứng',
    detail: 'tsudev đã xem xét bằng chứng do tổ chức cung cấp.',
  },
  AUDITED: {
    label: 'Đã kiểm định',
    detail: 'tsudev đã kiểm định trực tiếp theo bộ tiêu chí của chương trình.',
  },
};

/** Kiểu chung của một mục trong STATUS_META. */
export type StatusMeta = { label: string; tone: string; note: string };

/**
 * Tra STATUS_META an toàn.
 *
 * `status` tới từ API nên là chuỗi tự do - tra bảng bằng nó cho ra
 * `undefined` với mọi trạng thái chưa biết, và các trang trước đây viết
 * `STATUS_META[c.status] || {}` rồi đọc `.label` trên object rỗng, tức là hiện
 * "undefined" thay vì trạng thái. Hàm này luôn trả một mục đọc được.
 */
export const statusMeta = (status: string | null | undefined): StatusMeta =>
  STATUS_META[status as keyof typeof STATUS_META] ?? {
    label: status || 'Không rõ',
    tone: 'neutral',
    note: 'Trạng thái không nằm trong danh mục đã biết.',
  };

export type BasisMeta = { label: string; detail: string };

export const basisMeta = (basis: string | null | undefined): BasisMeta =>
  BASIS_META[basis as keyof typeof BASIS_META] ?? {
    label: basis || 'Không rõ',
    detail: '',
  };

export const fmtDate = (d: string | number | Date | null | undefined): string =>
  d
    ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';
