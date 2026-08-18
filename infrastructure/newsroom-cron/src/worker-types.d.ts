// Khai kiểu tối thiểu của runtime Workers.
//
// CỐ Ý không cài `@cloudflare/workers-types`: Worker này dùng đúng hai kiểu
// riêng của Cloudflare, còn `fetch`/`Request`/`Response`/`URL`/`AbortSignal`
// đều có sẵn trong lib `webworker` của TypeScript. Thêm một dependency 2MB cho
// hai interface là chi phí không mua lại được gì - và nó còn kéo theo nguy cơ
// lệch phiên bản với `wrangler`.
//
// Cái giá đã biết: nếu Cloudflare đổi hình dạng hai kiểu này thì ta không được
// báo. Cả hai đều đã ổn định nhiều năm và chỉ dùng ở một tệp duy nhất.

interface ScheduledEvent {
  readonly scheduledTime: number;
  readonly cron: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
