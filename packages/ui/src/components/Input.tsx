import React from 'react';

type InputProps = {
  id?: string;
  /**
   * Tham chiếu tới chính thẻ <input>.
   *
   * Khai TƯỜNG MINH thay vì dựa vào `ref` đi lọt qua `...props`. React 19 có
   * truyền `ref` như một prop thường, nên cách đó CHẠY ĐƯỢC - nhưng nó là một
   * tai nạn của việc trải props, không phải một hợp đồng: đổi thứ tự destructure
   * hoặc hạ React xuống 18 là nó im lặng ngừng hoạt động, và triệu chứng chỉ là
   * "con trỏ không nhảy vào ô" - thứ không ai viết test cho.
   */
  inputRef?: React.Ref<HTMLInputElement>;
  label?: React.ReactNode;
  type?: string;
  value?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  error?: React.ReactNode;
  /** Chú thích dưới ô, cho hướng dẫn không phải lỗi. */
  hint?: React.ReactNode;
  className?: string;
  [key: string]: unknown;
};

/**
 * Ô nhập - DESIGN_SYSTEM.md §5: cao 36px (token mật độ), nền `bg-surface`, viền
 * `border`, radius-md; focus viền `primary` + vòng focus; lỗi viền `danger` kèm
 * dòng báo lỗi 13px bên dưới.
 *
 * Nền là `bg-surface` chứ không phải `bg-base`: ô nhập là một bề mặt NỔI trên
 * nền trang, cùng tầng với card. Dùng `bg-base` thì ở chế độ Sáng ô nhập tiệp
 * hẳn vào nền và chỉ còn cái viền để nhận ra - đó là lúc người ta không thấy
 * chỗ để gõ.
 *
 * `aria-invalid` + `aria-describedby` chứ không chỉ đổi màu viền: viền đỏ là
 * thông tin chỉ truyền được bằng mắt, và §1 cấm để màu đứng một mình.
 */
export const Input = ({
  id,
  inputRef,
  label,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  error,
  hint,
  className = '',
  ...props
}: InputProps) => {
  const msgId = id ? `${id}-msg` : undefined;
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label htmlFor={id} className="mb-1 text-sm font-medium text-fg-secondary">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={(error || hint) && msgId ? msgId : undefined}
        className={`h-control rounded-md border bg-surface px-3 text-sm text-fg placeholder:text-fg-muted transition-colors duration-fast ease-standard focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? 'border-danger' : 'border-line-control focus:border-primary'
        }`}
        {...props}
      />
      {(error || hint) && (
        <p
          id={msgId}
          // 13px = --fs-sm, bậc dành cho dòng phụ dưới ô nhập. Không nhỏ hơn 12px
          // ở bất kỳ đâu, kể cả chú thích (§4).
          className={`mt-1 text-sm ${error ? 'text-danger-ink' : 'text-fg-muted'}`}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
};

export default Input;
