import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Nút "Hồi sinh việc đã dừng" phải hiện theo MỘT điều kiện duy nhất: còn việc
 * chết hay không (`deadEvents > 0`).
 *
 * Bản đầu lồng nó vào thẻ cảnh báo `exhausted.length > 0`, và thế là nó chỉ hiện
 * khi HÔM NAY còn nhà cung cấp đang cạn hạn mức. Nhưng `exhaustedToday` chỉ đúng
 * khi có sự kiện `provider.exhausted` trong NGÀY UTC HIỆN TẠI
 * (`services/newsroom-service/src/llm/index.ts`), nên nút biến mất đúng lúc cần
 * nó nhất: hạn mức đã đặt lại lúc 00:00 UTC, hệ khoẻ trở lại, và giờ mới là lúc
 * đi dọn xác của hôm trước. Ngày 20/08/2026 nó đã xảy ra thật - production có
 * `deadEvents: 16` mà trang không vẽ cái nút nào.
 *
 * Không có gì báo lỗi khi hồi quy kiểu này: trang vẫn dựng, vẫn 200, chỉ thiếu
 * một nút. Nên phải canh bằng test quét NGUỒN - trang này không có test kết xuất.
 */

const SRC = join(__dirname, '..', 'pages', 'admin', 'newsroom.tsx');
const src = readFileSync(SRC, 'utf8');

const REVIVE_CALL = "act('revive', '/api/newsroom/admin/events/revive'";

/**
 * Cắt lấy nguyên khối JSX `{<mở> && ( … )}` bắt đầu tại `opener`, bằng cách cân
 * bằng ngoặc tròn. Trả về '' nếu không tìm thấy khối.
 */
function blockAfter(opener: string): string {
  const start = src.indexOf(opener);
  if (start === -1) return '';
  let depth = 0;
  for (let i = start + opener.length - 1; i < src.length; i += 1) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return src.slice(start);
}

describe('nút hồi sinh việc đã dừng', () => {
  it('vẫn còn trên trang', () => {
    expect(src).toContain(REVIVE_CALL);
  });

  it('KHÔNG nằm trong thẻ cảnh báo cạn hạn mức', () => {
    const block = blockAfter('{exhausted.length > 0 && (');
    expect(block).not.toBe('');
    expect(block).not.toContain(REVIVE_CALL);
  });

  it('nằm trong khối chỉ phụ thuộc deadEvents', () => {
    const block = blockAfter('{(state?.deadEvents ?? 0) > 0 && (');
    expect(block).toContain(REVIVE_CALL);
    // Điều kiện hạn mức không được lẻn vào lần nữa qua cửa sau.
    expect(block).not.toContain('exhausted');
  });
});
