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
  className?: string;
  [key: string]: unknown;
};

export const Input = ({
  id,
  inputRef,
  label,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  error,
  className = '',
  ...props
}: InputProps) => {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-inksoft mb-1">
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
        className={`rounded-md border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted outline-none transition-colors ${
          error ? 'border-error' : 'border-hairline focus:border-brand'
        }`}
        {...props}
      />
      {error && <p className="text-sm text-error mt-1">{error}</p>}
    </div>
  );
};

export default Input;
