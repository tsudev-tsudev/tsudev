import React from 'react';

export const Container = ({ children, className = '' }) => (
  <div className={`max-w-6xl mx-auto px-4 ${className}`}>{children}</div>
);

export default Container;
