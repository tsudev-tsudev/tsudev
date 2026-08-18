// Địa chỉ NỘI BỘ của các service. Một chỗ duy nhất trong app này - trước đây sáu
// file mỗi file tự khai một giá trị dự phòng riêng, sáu cơ hội lệch nhau.
//
// Không đọc thẳng config/topology.json ở đây: app này build cho Cloudflare
// Workers, nơi không có filesystem của repo. Giá trị dự phòng vì thế vẫn là
// literal - nhưng chỉ còn MỘT bản, và `npm run topology:check` vẫn kiểm số cổng.
// Ở production ba biến môi trường dưới đây là bắt buộc.
export const CONTENT = process.env.CONTENT_SERVICE_URL || 'http://localhost:4001';
export const STORAGE = process.env.STORAGE_SERVICE_URL || 'http://localhost:4002';
export const TRUST = process.env.TRUST_SERVICE_URL || 'http://localhost:4003';
export const IDENTITY = process.env.AUTH_SERVICE_URL || 'http://localhost:4004';
export const NEWSROOM = process.env.NEWSROOM_SERVICE_URL || 'http://localhost:4005';

// Ba service trên Render nằm ở URL công khai; khi INTERNAL_API_TOKEN được đặt
// thì chúng từ chối request thiếu header này. Không đặt (local, CI) → chuỗi rỗng
// và service bỏ qua. Mọi BFF phải trải header này vào request đi ra.
// Kiểu trả về khai TƯỜNG MINH là Record<string, string>. Không có nó, TypeScript
// suy ra một union trong đó một nhánh có `'x-internal-token'?: undefined`, và
// union đó không gán được vào `HeadersInit` của fetch - biểu hiện là lỗi
// "No overload matches this call" ở mọi nơi gọi, rất khó lần ra nguồn.
export const internalHeaders = (): Record<string, string> =>
  process.env.INTERNAL_API_TOKEN ? { 'x-internal-token': process.env.INTERNAL_API_TOKEN } : {};
