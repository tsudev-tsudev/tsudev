import React from 'react';

export const Stat = ({ value, label, className = '' }) => (
  <div className={className}>
    <div className="text-2xl md:text-3xl font-bold tracking-tight text-ink font-mono tabular-nums">
      {value}
    </div>
    <div className="text-xs uppercase tracking-wider text-muted mt-1">{label}</div>
  </div>
);

export default Stat;
