// Hình dạng dữ liệu mà các service trả về, nhìn từ phía app.
//
// Đây là HỢP ĐỒNG ĐỌC, không phải bản sao schema Prisma: chỉ khai những trường
// app thực sự dùng tới. Service thêm trường mới thì file này không cần đổi;
// service ĐỔI hoặc BỎ một trường đang được khai ở đây thì trang dùng nó thành
// lỗi biên dịch — đúng lúc cần biết.
//
// Trước đây mọi thứ đi qua `getJSON()` đều là `any`, nên một lần đổi tên trường
// ở service chỉ lộ ra dưới dạng "undefined" hiện trên trang thật.

export type Author = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  contentMd?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  author?: Author | null;
  tags?: string[];
};

export type Doc = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  contentMd?: string | null;
  category?: string | null;
  updatedAt?: string | null;
};

export type Project = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  kind: string;
  status: string;
  version?: string | null;
  releasedAt?: string | null;
  license?: string | null;
  copyrightStatus?: string | null;
  copyrightNo?: string | null;
  copyrightAt?: string | null;
  copyrightOwner?: string | null;
  repoUrl?: string | null;
  homepageUrl?: string | null;
  downloadUrl?: string | null;
  descriptionMd?: string | null;
  trustProgramSlug?: string | null;
  featured?: boolean;
  published?: boolean;
  sortOrder?: number;
};

export type TrustProgram = {
  id: string;
  slug: string;
  name: string;
  summary?: string | null;
  descriptionMd?: string | null;
  badgeVariant?: string | null;
  validityDays?: number | null;
  feeCredits?: number | null;
  evidenceSpec?: EvidenceSpecItem[] | null;
  criteria?: ProgramCriterion[] | null;
  /** Số chứng chỉ đã cấp theo chương trình này. */
  issuedCount?: number;
};

export type EvidenceSpecItem = {
  kind: string;
  label?: string;
  required?: boolean;
  hint?: string;
};

/** Thẻ chứng chỉ do trust-service dựng (certCard). */
export type CertificateCard = {
  serial: string;
  status: string;
  storedStatus?: string;
  basis?: string | null;
  scope?: string | null;
  hostname?: string;
  organization?: string;
  organizationId?: string;
  program?: { slug: string; name: string; badgeVariant?: string | null } | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
  verifyUrl?: string;
};

export type CertificateDetail = CertificateCard & {
  issuedBy?: string | null;
  signature?: {
    valid: boolean;
    reason?: string | null;
    keyId?: string | null;
    jws?: string | null;
  };
  payload?: unknown;
  lastCheckAt?: string | null;
  lastCheckPassed?: boolean | null;
};

export type TrustDomainInfo = {
  id?: string;
  hostname: string;
  status?: string;
  method?: string;
  token?: string;
  verifiedAt?: string | null;
  lastError?: string | null;
};

/**
 * Hồ sơ uy tín công khai của một tổ chức.
 *
 * Hình dạng này chép đúng theo phần `res.json({...})` của
 * GET /api/trust/profile/:orgId trong trust-service — PHẲNG, không bọc trong
 * `organization`. Lần đầu viết file này tôi đã đoán sai theo hướng bọc, và
 * chính trình biên dịch chỉ ra sai lệch đó.
 */
export type TrustProfile = {
  id: string;
  name: string;
  legalName?: string | null;
  country?: string | null;
  websiteUrl?: string | null;
  createdAt?: string | null;
  reputation: {
    activeCertificates: number;
    revokedCertificates: number;
    verifiedDomains: number;
    firstIssuedAt?: string | null;
    checksTotal: number;
    checksPassed: number;
    /** null khi CHƯA CÓ lần kiểm nào — khác hẳn với 0%. */
    checkPassRate: number | null;
    lastCheckedAt?: string | null;
  };
  // Ba trường dưới KHÔNG optional: endpoint luôn phát ra (có thể là mảng rỗng).
  // Khai optional chỉ tạo ra hàng chục phép kiểm null vô nghĩa ở trang hồ sơ.
  domains: TrustDomainInfo[];
  certificates: CertificateCard[];
  /** Chứng chỉ không còn ACTIVE, tối đa 20 bản gần nhất. */
  history: CertificateCard[];
};

/** Kết quả tra cứu chứng chỉ. Ba trạng thái, không phải hai — xem lib/trust.ts. */
export type VerifyOutcome =
  | { state: 'found'; certificate: CertificateDetail }
  | { state: 'missing' }
  | { state: 'unavailable' };

// ---------------------------------------------------------------------------
// Hình dạng phía QUẢN TRỊ. Tách khỏi phần công khai bên trên vì chúng đi qua
// những endpoint khác (/api/trust/admin/*) và chỉ trang quản trị đọc tới.
// ---------------------------------------------------------------------------

export type TrustAdminSummary = {
  pending: number;
  needsInfo: number;
  active: number;
  expiringSoon: number;
  revoked: number;
};

export type AdminApplication = {
  id: string;
  status: string;
  scope?: string | null;
  program?: { slug: string; name: string } | null;
  hostname?: string;
  domainStatus?: string;
  organization?: string;
  contactEmail?: string | null;
  evidenceCount?: number;
  feeCharged?: number;
  submittedAt?: string | null;
  createdAt?: string | null;
};

export type EvidenceItem = {
  id?: string;
  kind: string;
  label?: string | null;
  note?: string | null;
  url?: string | null;
};

export type ProgramCriterion = { key?: string; label: string; detail?: string | null };

/**
 * Đơn kèm quan hệ, trả về khi mở CHI TIẾT một đơn.
 *
 * `organization` ở đây là OBJECT, còn ở danh sách đơn (AdminApplication) nó là
 * CHUỖI — hai endpoint dựng hai hình dạng khác nhau cho cùng một tên trường.
 * `Omit` làm sự khác biệt đó hiện ra thay vì để nó chờ gây "undefined" trên
 * giao diện. Thống nhất lại hai endpoint là việc của backend, không phải chỗ này.
 */
export type AdminApplicationDetail = Omit<AdminApplication, 'organization' | 'program'> & {
  organization?: { name: string; contactEmail?: string | null } | null;
  program?: { slug: string; name: string; criteria?: ProgramCriterion[] } | null;
  domain?: TrustDomainInfo | null;
  org?: { id: string; name: string; contactEmail?: string | null } | null;
  evidence?: EvidenceItem[];
};

export type AdminCertificate = {
  id?: string;
  serial: string;
  status: string;
  hostname?: string;
  organization?: string;
  program?: { slug: string; name: string } | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
};

export type AuditEntry = {
  id: string;
  action: string;
  actorName?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  note?: string | null;
  createdAt: string;
};

export type RecheckConfig = {
  enabled: boolean;
  intervalMin: number;
  staleAfterMin: number;
  batch: number;
  graceFailures: number;
};

/** Tổ chức do người dùng đang đăng nhập sở hữu, kèm tên miền của nó. */
export type OwnerOrg = {
  id: string;
  name: string;
  legalName?: string | null;
  contactEmail?: string | null;
  country?: string | null;
  status?: string;
  domains?: TrustDomainInfo[];
};

/** Hướng dẫn xác minh tên miền — ba phương thức cho ba hình dạng khác nhau. */
export type DomainInstructions = {
  title: string;
  note?: string;
  /** DNS_TXT */
  record?: { type: string; name: string; value: string };
  /** META_TAG và FILE */
  snippet?: string;
  /** FILE */
  path?: string;
};

/** Tổ chức trong cổng khách hàng — kèm cả tên miền lẫn chứng chỉ đã cấp. */
export type PortalOrg = OwnerOrg & {
  certificates?: CertificateCard[];
};

/** Đơn của chính người dùng, nhìn từ cổng khách hàng. */
export type PortalApplication = {
  id: string;
  status: string;
  scope?: string | null;
  note?: string | null;
  reviewNote?: string | null;
  feeCharged?: number;
  hostname?: string;
  program?: { slug: string; name: string } | null;
  /** Có khi đơn đã được duyệt và cấp chứng chỉ. */
  serial?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
};

/** Mã nhúng huy hiệu trả về cho khách. */
export type SealEmbed = {
  serial: string;
  html: string;
  sealUrl: string;
  note?: string | null;
};
