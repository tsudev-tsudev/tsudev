// Khai báo kiểu viết tay cho singleton Prisma. `src/index.js` là CommonJS thuần
// và cố ý giữ nguyên như vậy — file này chỉ mô tả hình dạng của nó cho
// TypeScript, không sinh ra mã và không đổi hành vi lúc chạy.
//
// Nhờ nó mà ba service nhận kiểu Prisma đầy đủ (tên bảng, tên cột, kiểu trả về)
// thay vì `any`. Đổi lại: `@prisma/client` PHẢI được generate trước khi chạy
// `tsc`, nên mọi job CI có bước kiểm kiểu đều phải chạy `npm run db:generate`
// trước. Đó cũng là lý do `tsc -b` không nằm trong hook `prepare`.
import { PrismaClient } from '@prisma/client';

export declare const prisma: PrismaClient;
export { PrismaClient };

declare const _default: PrismaClient;
export default _default;
