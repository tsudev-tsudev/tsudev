import React from 'react';
import { Layout } from '@tsudev/ui';

import Seo from './Seo';

/**
 * Khung chung cho năm trang xác thực (/login, /signup, /forgot-password,
 * /reset-password, /verify-email).
 *
 * Một cột hẹp, căn giữa, không có gì khác trên màn hình. Trang xác thực là nơi
 * người dùng dễ bị dẫn dụ nhất, nên nó cố ý KHÔNG có điều hướng phụ, banner hay
 * ô tìm kiếm - càng ít thứ bấm được thì càng ít thứ để giả mạo.
 */
type AuthShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export const AuthShell = ({ title, description, children, footer }: AuthShellProps) => (
  <Layout active="/login">
    <Seo title={`${title} - tsudev`} description={description} />
    <div className="mx-auto w-full max-w-[26rem] py-6">
      <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-fg-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-4 text-center text-sm text-fg-muted">{footer}</div>}
    </div>
  </Layout>
);

/**
 * Ô thông báo lỗi/thành công.
 *
 * `role="alert"` để trình đọc màn hình đọc ngay khi nó xuất hiện - không có nó
 * thì người dùng bàn phím gửi form, không nghe thấy gì, và không biết vì sao
 * trang không đi tiếp.
 */
export const Notice = ({ kind, children }: { kind: 'error' | 'ok'; children: React.ReactNode }) => (
  <div
    role="alert"
    className={`mb-4 rounded-md border px-3 py-2.5 text-sm ${
      kind === 'error' ? 'border-danger text-danger' : 'border-line bg-subtle text-fg'
    }`}
  >
    {children}
  </div>
);

export default AuthShell;
