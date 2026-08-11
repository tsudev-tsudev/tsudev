// Địa chỉ NỘI BỘ của các service — xem apps/frontend-main/lib/services.js.
// Hai app không dùng chung được file này: @tsudev/ui build cho cả trình duyệt,
// mà đây là giá trị chỉ dành cho phía server.
export const CONTENT = process.env.CONTENT_SERVICE_URL || 'http://localhost:4001';
export const USER = process.env.USER_SERVICE_URL || 'http://localhost:4000';

// Bộ ba service trên Render nằm ở URL công khai; khi INTERNAL_API_TOKEN được đặt
// thì chúng từ chối request thiếu header này. Không đặt (local, CI) → chuỗi rỗng
// và service bỏ qua. Mọi BFF phải trải header này vào request đi ra.
export const internalHeaders = () =>
  process.env.INTERNAL_API_TOKEN ? { 'x-internal-token': process.env.INTERNAL_API_TOKEN } : {};
