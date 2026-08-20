import React from 'react';
import '../src/tokens.css';
import '../src/storybook.css';

/**
 * Bộ chọn chế độ cho Storybook - Sáng / Ấm / Tối.
 *
 * Storybook KHÔNG nằm trong CI (xem ghi chú nợ ở next.config.js), nên đây thuần
 * là công cụ rà bằng mắt: cổng thật canh bảng màu là packages/ui/test/contrast.test.ts.
 * Nhưng rà bằng mắt vẫn cần thiết, và trước đây muốn xem chế độ khác thì phải
 * mở devtools sửa tay thuộc tính - đủ phiền để không ai làm, nên chế độ Ấm và
 * Tối chưa từng được nhìn qua ở tầng component.
 */
export const globalTypes = {
  theme: {
    name: 'Giao diện',
    description: 'Chế độ hiển thị',
    defaultValue: 'light',
    toolbar: {
      icon: 'paintbrush',
      items: [
        { value: 'light', title: 'Sáng' },
        { value: 'warm', title: 'Ấm' },
        { value: 'dark', title: 'Tối' },
      ],
      dynamicTitle: true,
    },
  },
};

// Đặt lên <html> chứ không lên khung của story: token khai ở `:root`, nên gắn
// vào thẻ nào thấp hơn thì khối `:root[data-theme=…]` không khớp và không có gì đổi.
const withTheme = (Story, context) => {
  document.documentElement.setAttribute('data-theme', context.globals.theme || 'light');
  return React.createElement(Story);
};

export const decorators = [withTheme];

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};
