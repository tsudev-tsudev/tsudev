import React, { useEffect, useRef, useState } from 'react';
import { Badge, Button } from '@tsudev/ui';

/**
 * Thanh lọc của bảng quản trị tài khoản.
 *
 * Hai quy tắc của `SEARCH_AND_FILTER.md` mục 6.3 định hình toàn bộ file này:
 * mọi trục lọc chạy CÙNG một truy vấn với ô từ khoá, và trạng thái lọc phải nằm
 * trong URL để chia sẻ được liên kết. Vì thế component này không giữ trạng thái
 * nào của riêng nó ngoài ô nhập đang gõ dở - chủ sở hữu thật của bộ lọc là
 * trang, và trang đồng bộ nó lên URL.
 */

export type AccountFilter = {
  q: string;
  role: string[];
  loginMethods: string[];
  country: string[];
  status: string[];
  ip: string;
  createdFrom: string;
  createdTo: string;
  lastLoginFrom: string;
  lastLoginTo: string;
};

export const EMPTY_FILTER: AccountFilter = {
  q: '',
  role: [],
  loginMethods: [],
  country: [],
  status: [],
  ip: '',
  createdFrom: '',
  createdTo: '',
  lastLoginFrom: '',
  lastLoginTo: '',
};

export type Facets = {
  role: Array<{ value: string; count: number }>;
  country: Array<{ value: string; count: number }>;
};

const ROLE_LABEL: Record<string, string> = {
  GUEST: 'Khách',
  MEMBER: 'Thành viên',
  VIP: 'VIP',
  AUTHOR: 'Đăng bài',
  MODERATOR: 'Điều hành',
  ADMIN: 'Quản trị',
  OWNER: 'Chủ sở hữu',
};

/**
 * Lọc theo NĂNG LỰC đăng nhập, không theo lần đăng nhập cuối.
 *
 * "Tài khoản GitHub" nghĩa là đăng nhập được bằng GitHub, kể cả người lần cuối
 * vào bằng mật khẩu. Hiểu theo nghĩa kia thì bộ lọc bỏ sót đúng nhóm người dùng
 * cả hai cách - và danh sách trả về vẫn trông hoàn toàn hợp lý.
 */
const METHOD_LABEL: Record<string, string> = {
  password: 'Mật khẩu',
  passkey: 'Passkey',
  github: 'GitHub',
  google: 'Google',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Đang hoạt động',
  unverified: 'Chưa xác minh email',
  locked: 'Đang bị khoá',
  deactivated: 'Đã vô hiệu hoá',
  scheduled_deletion: 'Hẹn xoá',
};

/** Cờ quốc gia từ mã ISO hai chữ cái - thuần Unicode, không cần tệp ảnh nào. */
const flagOf = (cc: string): string =>
  /^[A-Z]{2}$/.test(cc)
    ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : '🏳';

const inputCls =
  'w-full rounded-md border border-line-control bg-base px-3 py-2 text-sm text-fg ' +
  'placeholder:text-fg-muted focus:border-primary outline-none';
const labelCls = 'block text-xs font-medium text-fg-muted mb-1';

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ' +
        (active
          ? 'border-primary bg-primary text-on-primary'
          : 'border-line-control text-fg-secondary hover:bg-hovered')
      }
    >
      {children}
    </button>
  );
}

const toggle = (list: string[], v: string): string[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

export const isFilterEmpty = (f: AccountFilter): boolean =>
  !f.q &&
  !f.ip &&
  !f.createdFrom &&
  !f.createdTo &&
  !f.lastLoginFrom &&
  !f.lastLoginTo &&
  f.role.length === 0 &&
  f.loginMethods.length === 0 &&
  f.country.length === 0 &&
  f.status.length === 0;

export function AccountFilters({
  value,
  onChange,
  facets,
  busy,
}: {
  value: AccountFilter;
  onChange: (next: AccountFilter) => void;
  facets: Facets;
  busy: boolean;
}) {
  // Ô từ khoá là thứ DUY NHẤT có trạng thái cục bộ: gõ phải hiện ra ngay, còn
  // truy vấn thì chờ người dùng ngừng gõ (§2.2). Các trục khác là bấm-một-phát
  // nên đi thẳng lên trang.
  const [q, setQ] = useState(value.q);
  const [ip, setIp] = useState(value.ip);
  const [open, setOpen] = useState(false);
  const first = useRef(true);

  // Bộ lọc bị xoá từ ngoài (nút "Xoá lọc", hoặc mở một liên kết chia sẻ) thì hai
  // ô này phải theo. Không có nhánh này thì ô vẫn còn chữ trong khi kết quả đã
  // là của bộ lọc rỗng - người dùng đọc ô nhập, không đọc URL.
  useEffect(() => setQ(value.q), [value.q]);
  useEffect(() => setIp(value.ip), [value.ip]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (q === value.q && ip === value.ip) return;
    const t = setTimeout(() => onChange({ ...value, q, ip }), 350);
    return () => clearTimeout(t);
    // `value`/`onChange` cố ý ngoài deps: chúng đổi định danh mỗi lần dựng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, ip]);

  const set = (patch: Partial<AccountFilter>) => onChange({ ...value, ...patch });
  const dirty = !isFilterEmpty(value);

  return (
    <div className="space-y-3" aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[16rem] flex-1">
          <label className="sr-only" htmlFor="acc-q">
            Tìm theo tên đăng nhập, email hoặc tên hiển thị
          </label>
          <input
            id="acc-q"
            className={inputCls}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tên đăng nhập, email, tên hiển thị…"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Ẩn bộ lọc' : 'Bộ lọc nâng cao'}
        </Button>
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_FILTER })}>
            Xoá lọc
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {facets.role.map((r) => (
          <Chip
            key={r.value}
            active={value.role.includes(r.value)}
            onClick={() => set({ role: toggle(value.role, r.value) })}
          >
            {ROLE_LABEL[r.value] || r.value}
            <span className="opacity-70">{r.count.toLocaleString('vi-VN')}</span>
          </Chip>
        ))}
      </div>

      {open && (
        <div className="grid gap-4 rounded-md border border-line bg-subtle p-4 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Đăng nhập được bằng</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(METHOD_LABEL).map(([v, label]) => (
                <Chip
                  key={v}
                  active={value.loginMethods.includes(v)}
                  onClick={() => set({ loginMethods: toggle(value.loginMethods, v) })}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <span className={labelCls}>Trạng thái</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STATUS_LABEL).map(([v, label]) => (
                <Chip
                  key={v}
                  active={value.status.includes(v)}
                  onClick={() => set({ status: toggle(value.status, v) })}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <span className={labelCls}>
              Quốc gia đăng nhập gần nhất
              {facets.country.length === 0 && ' - chưa có dữ liệu'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {facets.country.map((c) => (
                <Chip
                  key={c.value}
                  active={value.country.includes(c.value)}
                  onClick={() => set({ country: toggle(value.country, c.value) })}
                >
                  <span aria-hidden>{flagOf(c.value)}</span>
                  {c.value}
                  <span className="opacity-70">{c.count.toLocaleString('vi-VN')}</span>
                </Chip>
              ))}
            </div>
          </div>

          <label className="block">
            <span className={labelCls}>Địa chỉ IP (khớp tiền tố)</span>
            <input
              className={inputCls}
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="vd: 203.0.113. cho cả dải"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={labelCls}>Tạo từ ngày</span>
              <input
                type="date"
                className={inputCls}
                value={value.createdFrom}
                onChange={(e) => set({ createdFrom: e.target.value })}
              />
            </label>
            <label className="block">
              <span className={labelCls}>đến ngày</span>
              <input
                type="date"
                className={inputCls}
                value={value.createdTo}
                onChange={(e) => set({ createdTo: e.target.value })}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <label className="block">
              <span className={labelCls}>Đăng nhập gần nhất từ</span>
              <input
                type="date"
                className={inputCls}
                value={value.lastLoginFrom}
                onChange={(e) => set({ lastLoginFrom: e.target.value })}
              />
            </label>
            <label className="block">
              <span className={labelCls}>đến</span>
              <input
                type="date"
                className={inputCls}
                value={value.lastLoginTo}
                onChange={(e) => set({ lastLoginTo: e.target.value })}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/** Nhãn gọn cho một phương pháp đăng nhập, dùng ở cột của bảng. */
export const methodLabel = (m: string): string => METHOD_LABEL[m] || m;

/** Huy hiệu quốc gia + IP cho một hàng. */
export function OriginCell({ ip, country }: { ip: string | null; country: string | null }) {
  if (!ip && !country) {
    // Trống KHÔNG có nghĩa là "không biết gì": tài khoản chưa đăng nhập lần nào
    // kể từ khi dấu vết được ghi cũng rơi vào đây. Nói "chưa có" thay vì để dấu
    // gạch trần, vì gạch trần đọc như dữ liệu bị mất.
    return <span className="text-fg-muted">chưa có</span>;
  }
  return (
    <span className="whitespace-nowrap">
      {country && (
        <Badge tone="neutral">
          <span aria-hidden>{flagOf(country)}</span> {country}
        </Badge>
      )}
      {ip && <span className="ml-1.5 font-mono text-xs text-fg-muted">{ip}</span>}
    </span>
  );
}
