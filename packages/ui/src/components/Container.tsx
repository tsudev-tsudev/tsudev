import React from 'react';

type ContainerProps = {
  children?: React.ReactNode;
  className?: string;
};

export const Container = ({ children, className = '' }: ContainerProps) => (
  <div className={`max-w-6xl mx-auto px-4 ${className}`}>{children}</div>
);

export default Container;
