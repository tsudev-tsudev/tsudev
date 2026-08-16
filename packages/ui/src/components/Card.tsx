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
      // (--panel, trắng) nằm trên nền trang (--surface, xanh rất nhạt), và hai
      // màu đó chênh nhau quá ít để mắt tự dựng ra được cạnh. Ở chế độ tối viền
      // gần như vô hình và thứ bậc vẫn do độ sáng nền đảm nhiệm, đúng như trước.
      //
      // rounded-md, không phải rounded-xl: khung vuông vắn đọc như giao diện sản
      // phẩm; bo tròn nhiều đọc như trang tiếp thị.
      className={`bg-panel border border-hairline rounded-md ${
        hover ? 'transition-colors hover:bg-panel2 hover:border-hairstrong' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
};

export default Card;
