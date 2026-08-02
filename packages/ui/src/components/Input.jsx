import React from 'react';

export const Input = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  error,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-inksoft mb-1">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`rounded-lg border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted outline-none transition-colors ${
          error ? 'border-[color:var(--error)]' : 'border-hairline focus:border-brand'
        }`}
        {...props}
      />
      {error && <p className="text-sm text-[var(--error)] mt-1">{error}</p>}
    </div>
  );
};

export default Input;
