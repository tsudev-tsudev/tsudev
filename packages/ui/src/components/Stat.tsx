import React from 'react';

type StatProps = {
  value?: React.ReactNode;
  label?: React.ReactNode;
  className?: string;
};

export const Stat = ({ value, label, className = '' }: StatProps) => (
  <div className={className}>
    <div className="text-2xl md:text-3xl font-bold tracking-tight text-ink font-mono tabular-nums">
      {value}
    </div>
    <div className="text-xs uppercase tracking-wider text-muted mt-1">{label}</div>
  </div>
);

export default Stat;
