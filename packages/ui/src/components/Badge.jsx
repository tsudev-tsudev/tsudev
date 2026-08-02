import React from 'react';

const TONES = {
  brand: 'bg-[var(--glow)] text-brandink border-transparent',
  teal: 'text-teal border-current bg-transparent',
  neutral: 'bg-panel2 text-inksoft border-transparent',
  outline: 'bg-transparent text-muted border-hairstrong',
  success: 'text-[var(--success)] border-current bg-transparent',
  warning: 'text-[var(--warning)] border-current bg-transparent',
};

export const Badge = ({ children, tone = 'neutral', className = '', mono = false }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
      mono ? 'font-mono' : ''
    } ${TONES[tone] || TONES.neutral} ${className}`}
  >
    {children}
  </span>
);

export default Badge;
