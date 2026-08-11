// Địa chỉ NỘI BỘ của các service. Một chỗ duy nhất trong app này — trước đây sáu
// file mỗi file tự khai một giá trị dự phòng riêng, sáu cơ hội lệch nhau.
//
// Không đọc thẳng config/topology.json ở đây: app này build cho Cloudflare
// Workers, nơi không có filesystem của repo. Giá trị dự phòng vì thế vẫn là
// literal — nhưng chỉ còn MỘT bản, và `npm run topology:check` vẫn kiểm số cổng.
// Ở production bốn biến môi trường dưới đây là bắt buộc.
export const CONTENT = process.env.CONTENT_SERVICE_URL || 'http://localhost:4001';
export const USER = process.env.USER_SERVICE_URL || 'http://localhost:4000';
export const STORAGE = process.env.STORAGE_SERVICE_URL || 'http://localhost:4002';
export const TRUST = process.env.TRUST_SERVICE_URL || 'http://localhost:4003';

// Bộ ba service trên Render nằm ở URL công khai; khi INTERNAL_API_TOKEN được đặt
// thì chúng từ chối request thiếu header này. Không đặt (local, CI) → chuỗi rỗng
// và service bỏ qua. Mọi BFF phải trải header này vào request đi ra.
export const internalHeaders = () =>
  process.env.INTERNAL_API_TOKEN ? { 'x-internal-token': process.env.INTERNAL_API_TOKEN } : {};
