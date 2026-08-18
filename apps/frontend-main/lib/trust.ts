// Truy vấn trust-service từ phía server (getServerSideProps).
//
// Khác lib/api.js: ở đây KHÔNG nuốt lỗi thành mảng rỗng. Trang xác thực mà âm
// thầm hiện "không tìm thấy" khi thực chất service chết là sai lệch nguy hiểm -
// người đọc sẽ tưởng con dấu giả. Nên hàm verify phân biệt rõ ba trường hợp:
// tìm thấy / không tồn tại / không kiểm tra được.

// Không gửi x-internal-token: trust-service cố ý đứng ngoài cổng chặn đó vì
// endpoint JWKS của nó phải công khai cho bên thứ ba. Xem docs/trust-seal.md.
//
// ⚠️ MỌI hàm ở đây nay BẮT BUỘC nhận `auth` - khẳng định danh tính của người
// đang xem, do `trustAccess()` ký. Từ đợt chế độ mời, `/api/trust/*` đòi vai trò
// VIP đọc từ DB, nên một lời gọi SSR không mang danh tính chỉ nhận 401 và rơi về
// giá trị mặc định. Tham số bắt buộc (không phải tuỳ chọn) chính là để chỗ gọi
// quên nó thành lỗi BIÊN DỊCH thay vì một trang trống ở production.
import { TRUST } from './services';
import type { CertificateCard, TrustProfile, TrustProgram, VerifyOutcome } from './types';

/** Header danh tính do `lib/trustGate.ts` dựng. */
export type TrustAuth = Record<string, string>;

async function getJSON<T>(path: string, auth: TrustAuth, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${TRUST}${path}`, { headers: auth });
    if (!res.ok) return fallback;
    return await res.json();
  } catch (e) {
    return fallback;
  }
}

export const trust = {
  programs: (auth: TrustAuth) => getJSON<TrustProgram[]>('/api/trust/programs', auth, []),
  program: (slug: string, auth: TrustAuth) =>
    getJSON<TrustProgram | null>(`/api/trust/programs/${encodeURIComponent(slug)}`, auth, null),
  directory: (auth: TrustAuth, params = '') =>
    getJSON<CertificateCard[]>(`/api/trust/directory${params}`, auth, []),
  profile: (orgId: string, auth: TrustAuth) =>
    getJSON<TrustProfile | null>(`/api/trust/profile/${encodeURIComponent(orgId)}`, auth, null),

  /**
   * Ba trạng thái, không phải hai. Union phân biệt được khiến việc đọc
   * `.certificate` mà chưa kiểm `state === 'found'` thành lỗi biên dịch - trước
   * đây trang xác thực có thể vô tình coi "service chết" là "chứng chỉ giả".
   */
  async verify(serial: string, auth: TrustAuth): Promise<VerifyOutcome> {
    try {
      const res = await fetch(`${TRUST}/api/trust/verify/${encodeURIComponent(serial)}`, {
        headers: auth,
      });
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
