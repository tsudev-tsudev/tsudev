import React from 'react';
import Seo from '../../../components/Seo';
import { Layout, Badge, Button } from '@tsudev/ui';
import { trust, statusMeta, basisMeta, fmtDate } from '../../../lib/trust';
import type { GetServerSidePropsContext } from 'next';
import type { CertificateDetail } from '../../../lib/types';
import { routeParam } from '../../../lib/identity';

const TONE_CLASS: Record<string, string> = {
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  error: 'text-[var(--error)]',
  muted: 'text-muted',
};

type RowProps = { label: React.ReactNode; children?: React.ReactNode };

function Row({ label, children }: RowProps) {
  return (
    <div className="grid sm:grid-cols-[190px_1fr] gap-1 sm:gap-4 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm text-ink break-words">{children}</dd>
    </div>
  );
}

/**
 * Union phân biệt được theo `state`.
 *
 * Nhờ nó, sau `if (state !== 'found') return …` thì `cert` tự thu hẹp về
 * CertificateDetail - không còn ~40 phép kiểm null rải khắp phần render, và
 * quan trọng hơn: không thể vô tình render dữ liệu chứng chỉ ở nhánh mà
 * service báo "không kiểm tra được".
 */
type VerifyPageProps =
  | { state: 'found'; cert: CertificateDetail; serial: string }
  | { state: 'missing' | 'unavailable'; cert: null; serial: string };

export default function VerifyCertificate({ state, cert, serial }: VerifyPageProps) {
  if (state !== 'found') {
    const unavailable = state === 'unavailable';
    return (
      <Layout active="/trust" bare>
        <Seo title={`Tra cứu ${serial}`} path={`/trust/verify/${serial}`} noindex />
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="font-mono text-xs uppercase tracking-wider text-teal font-semibold mb-3">
            Xác thực con dấu
          </div>
          <h1
            className={`text-3xl font-bold ${
              unavailable ? 'text-[var(--warning)]' : 'text-[var(--error)]'
            }`}
          >
            {unavailable ? 'Chưa kiểm tra được' : 'Không tìm thấy chứng chỉ'}
          </h1>
          <p className="mt-3 text-inksoft">
            {unavailable ? (
              'Hệ thống tra cứu tạm thời không phản hồi. Đây KHÔNG có nghĩa là con dấu không hợp lệ - vui lòng thử lại sau.'
            ) : (
              <>
                Không có chứng chỉ nào mang số hiệu{' '}
                <span className="font-mono text-ink">{serial}</span>. Nếu bạn thấy huy hiệu tsudev
                gắn số hiệu này trên một website, rất có thể đó là huy hiệu giả mạo.
              </>
            )}
          </p>
          <div className="mt-8 flex gap-3">
            <Button as="a" href="/trust/verify">
              Tra số hiệu khác
            </Button>
            <Button as="a" href="/trust/directory" variant="secondary">
              Xem thư mục công khai
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const meta = statusMeta(cert.status);
  const basis = basisMeta(cert.basis);
  const sigOk = cert.signature && cert.signature.valid;

  return (
    <Layout active="/trust" bare>
      <Seo
        title={`${cert.serial} - ${meta.label}`}
        path={`/trust/verify/${serial}`}
        description={`Chứng chỉ ${cert.serial} cấp cho ${cert.hostname}: ${meta.label}. Chương trình ${cert.program?.name}.`}
      />

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="font-mono text-xs uppercase tracking-wider text-teal font-semibold mb-3">
          Xác thực con dấu
        </div>
        <h1 className={`text-3xl md:text-4xl font-bold ${TONE_CLASS[meta.tone]}`}>{meta.label}</h1>
        <p className="mt-2 text-inksoft">{meta.note}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg text-ink">{cert.serial}</span>
          <Badge tone="neutral" mono>
            {cert.program?.name}
          </Badge>
        </div>

        {cert.status === 'REVOKED' && cert.revokeReason && (
          <p
            className="mt-6 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--error) 12%, var(--panel))',
              color: 'var(--error)',
            }}
          >
            <strong>Lý do thu hồi:</strong> {cert.revokeReason} - thu hồi ngày{' '}
            {fmtDate(cert.revokedAt)}.
          </p>
        )}

        <div className="mt-10 border-t border-hairstrong">
          <dl className="divide-y divide-[color:var(--border)]">
            <Row label="Cấp cho tên miền">
              <span className="font-mono">{cert.hostname}</span>
            </Row>
            <Row label="Tổ chức">{cert.organization}</Row>
            <Row label="Phạm vi khẳng định">{cert.scope}</Row>
            <Row label="Cơ sở đánh giá">
              <span className="text-ink">{basis.label || cert.basis}</span>
              {basis.detail && <span className="block text-muted mt-0.5">{basis.detail}</span>}
            </Row>
            <Row label="Ngày cấp">{fmtDate(cert.issuedAt)}</Row>
            <Row label="Hiệu lực đến">{fmtDate(cert.expiresAt)}</Row>
            <Row label="Người cấp">{cert.issuedBy}</Row>
            {cert.lastCheckAt && (
              <Row label="Tái kiểm gần nhất">
                {fmtDate(cert.lastCheckAt)} -{' '}
                {cert.lastCheckPassed ? (
                  <span className="text-[var(--success)]">đạt</span>
                ) : (
                  <span className="text-[var(--warning)]">không đạt</span>
                )}
              </Row>
            )}
          </dl>
        </div>

        {/* Chữ ký số - cho phép người đọc tự kiểm chứng, không cần tin trang này */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-ink">Chữ ký số</h2>
          <p className="mt-1.5 text-sm text-muted">
            Nội dung chứng chỉ được ký bằng Ed25519. Bạn có thể tự xác minh bằng khoá công khai của
            tsudev mà không cần tin vào trang này.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className={sigOk ? 'text-[var(--success)]' : 'text-[var(--error)]'}>
              {sigOk
                ? '✓ Chữ ký hợp lệ'
                : `✕ Chữ ký không hợp lệ${
                    cert.signature?.reason ? ` - ${cert.signature.reason}` : ''
                  }`}
            </span>
            <span className="text-muted">·</span>
            <span className="font-mono text-xs text-muted">kid: {cert.signature?.keyId}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              as="a"
              href="/.well-known/tsudev-trust-jwks.json"
              variant="secondary"
              size="sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Khoá công khai (JWKS)
            </Button>
            <Button
              as="a"
              href={`/api/trust/verify/${cert.serial}`}
              variant="ghost"
              size="sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Dữ liệu JSON
            </Button>
          </div>
          <details className="mt-4">
            <summary className="text-sm text-inksoft cursor-pointer hover:text-brandink">
              Xem chuỗi JWS đã ký
            </summary>
            <pre className="mt-2 bg-panel2 rounded-lg p-3 text-[11px] text-muted overflow-x-auto whitespace-pre-wrap break-all">
              {cert.signature?.jws}
            </pre>
          </details>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-ink">Huy hiệu tương ứng</h2>
          <p className="mt-1.5 text-sm text-muted">
            Huy hiệu này do tsudev dựng tại thời điểm hiển thị, nên luôn phản ánh trạng thái ở trên.
          </p>
          <img
            className="mt-4"
            src={`/api/trust/seal/${cert.serial}.svg`}
            alt={`Huy hiệu ${cert.serial}`}
            width={188}
            height={62}
          />
        </div>

        <p className="mt-12 text-xs text-muted leading-relaxed border-t border-hairline pt-5">
          Con dấu chỉ khẳng định đúng phạm vi ghi ở trên, tại thời điểm đánh giá, theo bộ tiêu chí
          công bố của chương trình{' '}
          <a
            className="text-brandink hover:underline"
            href={`/trust/programs/${cert.program?.slug}`}
          >
            {cert.program?.name}
          </a>
          . Nó không phải là bảo đảm pháp lý cho toàn bộ hoạt động của website được cấp.
        </p>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ params, res }: GetServerSidePropsContext) {
  const serial = routeParam(params, 'serial');
  const result = await trust.verify(serial);
  // Trang tra cứu phải luôn cho biết sự thật: 404 thật khi không có chứng chỉ.
  if (result.state === 'missing') res.statusCode = 404;
  if (result.state === 'unavailable') res.statusCode = 503;
  // `certificate` CHỈ tồn tại ở nhánh 'found' của VerifyOutcome - union phân
  // biệt được buộc phải kiểm state trước, thay vì đọc bừa rồi nhận undefined.
  return {
    props: {
      state: result.state,
      cert: result.state === 'found' ? result.certificate : null,
      serial,
    },
  };
}
