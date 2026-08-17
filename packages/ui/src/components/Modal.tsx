import React, { useEffect, useRef } from 'react';

type ModalProps = {
  open?: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
};

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
// thoát bằng bàn phím đã có Escape lẫn nút Close - không cần biến nó thành một
// điểm dừng tab thứ ba.
export const Modal = ({ open, onClose, title, children }: ModalProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  // document.activeElement trả Element, không phải HTMLElement - chỉ HTMLElement
  // mới có focus(). Thu hẹp ngay tại chỗ gán thay vì đoán ở chỗ dùng.
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement;
    restoreRef.current = active instanceof HTMLElement ? active : null;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- nền trang trí; Escape và nút Close là đường thoát bằng bàn phím */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || undefined}
        tabIndex={-1}
        // Ba vùng tách bằng đường kẻ (tiêu đề / thân / hành động) thay vì một
        // khối đệm đều. Đó là cấu trúc mà hộp thoại của giao diện sản phẩm dùng:
        // mắt biết ngay đâu là nội dung và đâu là chỗ bấm, kể cả khi thân dài
        // phải cuộn.
        className="bg-panel border border-hairline rounded-md z-10 max-w-lg w-full outline-none shadow-lg"
      >
        {title && (
          <div className="border-b border-hairline px-5 py-3.5">
            <h3 className="text-base font-semibold text-ink">{title}</h3>
          </div>
        )}
        {/* max-h + overflow: thân dài phải cuộn TRONG hộp thoại, không đẩy phần
            hành động ra ngoài màn hình. */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm text-inksoft">
          {children}
        </div>
        <div className="flex justify-end border-t border-hairline px-5 py-3">
          <button
            className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-inksoft transition-colors hover:bg-panel2 hover:text-ink"
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
