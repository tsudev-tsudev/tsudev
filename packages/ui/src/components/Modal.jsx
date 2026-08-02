import React, { useEffect, useRef } from 'react';

// Hộp thoại. Ba thứ bắt buộc phải có mà bản trước thiếu, và đều chỉ ảnh hưởng
// người dùng bàn phím hoặc trình đọc màn hình nên rất dễ bị bỏ qua khi thử tay:
//
//   - Escape đóng được. Trước đây chỉ đóng được bằng chuột (bấm lớp phủ hoặc
//     nút Close), tức là người không dùng chuột có thể bị kẹt trong hộp thoại.
//   - role="dialog" + aria-modal để trình đọc màn hình thông báo đúng ngữ cảnh
//     và không đọc lẫn nội dung phía sau.
//   - Đưa con trỏ vào hộp thoại khi mở, trả về chỗ cũ khi đóng.
//
// Lớp phủ giữ onClick nhưng đánh aria-hidden: nó là nền trang trí, và đường
// thoát bằng bàn phím đã có Escape lẫn nút Close — không cần biến nó thành một
// điểm dừng tab thứ ba.
export const Modal = ({ open, onClose, title, children }) => {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    if (panelRef.current) panelRef.current.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (restoreRef.current && restoreRef.current.focus) restoreRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- nền trang trí; Escape và nút Close là đường thoát bằng bàn phím */}
      <div className="absolute inset-0 bg-black opacity-70" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || undefined}
        tabIndex={-1}
        className="bg-panel rounded-xl z-10 max-w-lg w-full p-4 outline-none"
      >
        {title && <h3 className="text-lg font-semibold text-ink mb-2">{title}</h3>}
        <div>{children}</div>
        <div className="mt-4 text-right">
          <button
            className="px-3 py-1 rounded-md bg-panel2 text-inksoft hover:text-ink transition-colors"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
