import React from 'react';

type CardProps = {
  children?: React.ReactNode;
  className?: string;
  hover?: boolean;
  /** Thẻ/`component` được render. Giữ đa hình vì nơi gọi dùng cả 'div', 'li', Link. */
  as?: React.ElementType;
  [key: string]: unknown;
};

export const Card = ({ children, className = '', hover = false, as, ...props }: CardProps) => {
  const Tag = (as ?? 'div') as React.ElementType;
  return (
    <Tag
      // Viền hairline là BẮT BUỘC ở chế độ sáng, không phải trang trí: card
      // (--bg-surface, trắng) nằm trên nền trang (--bg-base, xanh rất nhạt), và hai
      // màu đó chênh nhau quá ít để mắt tự dựng ra được cạnh. Ở chế độ tối viền
      // gần như vô hình và thứ bậc vẫn do độ sáng nền đảm nhiệm, đúng như trước.
      //
      // rounded-lg: §2 xếp card cùng bậc với modal lớn và khung bảng - mềm góc,
      // không góc cạnh sắc. Bậc md dành cho button/input.
      className={`bg-surface border border-line rounded-lg ${
        hover
          ? 'transition-colors duration-fast ease-standard hover:bg-hovered hover:border-line-strong'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
};

export default Card;
