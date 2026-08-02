import React from 'react';

export const Card = ({ children, className = '', hover = false, as = 'div', ...props }) => {
  const Tag = as;
  return (
    <Tag
      className={`bg-panel rounded-xl ${
        hover ? 'transition-colors hover:bg-panel2' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
};

export default Card;
