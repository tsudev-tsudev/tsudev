// Giữ tệp là MODULE - xem chú thích ở test/reviveDead.test.ts.
export {}

// Cổng canh "kênh nào đang im lặng".
//
// Vì sao cổng này tồn tại: ngày 27/08/2026 `/docs` được đóng sau khi gỡ BA tầng
// chồng nhau (thiếu nguồn · van toàn cục bỏ đói kênh · 403 vì IP dùng chung của
// Render). Cả ba sống nhiều ngày mà không có gì đỏ lên, vì mọi cổng đang có đều
// hỏi "toà soạn có chạy không" - và câu trả lời luôn là CÓ, toà soạn chạy đầy đủ
// cho BLOG suốt thời gian đó. Không cổng nào hỏi "KÊNH NÀY đã bao lâu không ra bài".
//
// Test ở đây dựng thẳng các ca biên bằng dữ liệu giả: logic được tách khỏi
// database chính là để làm được điều đó. Ba ca quan trọng nhất là ba ca ĐÃ XẢY RA
// trên production, và chúng được dựng lại bằng đúng số đo hôm đó.
import { canhMotKenh, canhToaSoan, datCong, NGUONG_MAC_DINH } from '../src/channelHealth'
import type { KenhCanh, NguonTin } from '../src/channelHealth'

const NAY = new Date('2026-08-27T10:00:00Z')
const truoc = (ngay: number) => new Date(NAY.getTime() - ngay * 24 * 60 * 60 * 1000)
const truocGio = (gio: number) => new Date(NAY.getTime() - gio * 60 * 60 * 1000)

const nguon = (p: Partial<NguonTin> = {}): NguonTin => ({
  label: 'Nguồn thử',
  kind: 'rss',
  enabled: true,
  lastScanAt: truocGio(1),
  lastError: null,
  createdAt: truoc(30),
  ...p,
})

const kenh = (p: Partial<KenhCanh> = {}): KenhCanh => ({
  target: 'BLOG',
  enabled: true,
  sources: [nguon()],
  lastPublishedAt: truocGio(2),
  ...p,
})

describe('kênh khoẻ và kênh cố ý tắt', () => {
  test('ra bài đều ⇒ XANH', () => {
    expect(canhMotKenh(kenh(), NAY).trangThai).toBe('XANH')
  })

  test('kênh tắt ⇒ TAT, không phải ĐỎ', () => {
    // Tắt là một quyết định, không phải một sự cố. Báo đỏ ở đây thì cổng kêu
    // vĩnh viễn và người ta sẽ ngừng đọc nó - đó là cách một cổng chết.
    expect(canhMotKenh(kenh({ enabled: false }), NAY).trangThai).toBe('TAT')
  })

  test('nguồn mới thêm, chưa ra bài ⇒ XANH chứ không đỏ vội', () => {
    const k = kenh({
      lastPublishedAt: null,
      sources: [nguon({ createdAt: truoc(1), lastScanAt: truocGio(1) })],
    })
    expect(canhMotKenh(k, NAY).ma).toBe('CON_MOI')
  })

  test('nguồn vừa tạo, chưa kịp quét ⇒ chưa đỏ (ân hạn)', () => {
    // Nhịp mỗi giờ, mỗi nhịp quét tối đa 3 nguồn, nên nguồn mới phải chờ vài
    // nhịp. Đỏ ngay thì cổng báo động giả mỗi lần thêm nguồn.
    const k = kenh({
      lastPublishedAt: null,
      sources: [nguon({ createdAt: truocGio(2), lastScanAt: null })],
    })
    expect(canhMotKenh(k, NAY).trangThai).toBe('XANH')
  })
})

describe('ba ca ĐÃ XẢY RA trên production', () => {
  test('tầng 2 - nguồn DOC chưa từng được quét (bị van toàn cục bỏ đói)', () => {
    // Số đo thật 27/08/2026: nguồn tạo 26/08, `lastScanAt` NULL, `TopicIdea`
    // kênh DOC = 0. Cổng phải chỉ thẳng vào nguồn chưa được quét, vì đó là mắt
    // xích đứt - không phải "kênh im lặng", vốn chỉ là hệ quả.
    const k = kenh({
      target: 'DOC',
      lastPublishedAt: null,
      sources: [nguon({ label: 'Kho mã tsudev', createdAt: truoc(9), lastScanAt: null })],
    })
    const r = canhMotKenh(k, NAY)
    expect(r.trangThai).toBe('DO')
    expect(r.ma).toBe('NGUON_CHUA_QUET')
    expect(r.lyDo).toContain('Kho mã tsudev')
  })

  test('cổng SẼ bắt được ngay NGÀY ĐẦU, không phải sau khi đã muộn', () => {
    // Dựng lại đúng số đo sáng 27/08/2026: nguồn DOC tạo 13:16 ngày 26/08, tới
    // 09:28 hôm sau vẫn `lastScanAt = null` - tức mới 20 giờ. Đây là phép thử
    // giá trị NHẤT của cổng: nếu ân hạn đặt theo NGÀY thì nó im lặng suốt tuần
    // đầu và sự cố vẫn sống y như cũ. Ân hạn 6 giờ bắt được ở 20 giờ.
    const k = kenh({
      target: 'DOC',
      lastPublishedAt: null,
      sources: [nguon({ label: 'Kho mã tsudev', createdAt: truocGio(20), lastScanAt: null })],
    })
    const r = canhMotKenh(k, NAY)
    expect(r.trangThai).toBe('DO')
    expect(r.ma).toBe('NGUON_CHUA_QUET')
  })

  test('tầng 2b - Genk kẹt 8 ngày TRONG KHI BLOG vẫn đăng đều ⇒ VÀNG, không ĐỎ', () => {
    // Số đo thật 27/08/2026: Genk và Tuổi Trẻ `lastScanAt` = 19/08, mà BLOG có
    // 64 bài PUBLISHED và ra 2 bài/ngày. Bắt cả kênh ĐỎ ở đây là kêu oan, và
    // một cổng kêu oan thì người ta ngừng đọc - tức nó chết mà vẫn còn chạy.
    const k = kenh({
      lastPublishedAt: truocGio(2),
      sources: [nguon({ label: 'Genk', lastScanAt: truoc(8) })],
    })
    const r = canhMotKenh(k, NAY)
    expect(r.trangThai).toBe('VANG')
    expect(r.ma).toBe('NGUON_QUET_CU')
    expect(datCong([r])).toBe(true)
  })

  test('cùng nguồn kẹt 8 ngày NHƯNG kênh đã ngừng ra bài ⇒ ĐỎ, và nêu tên nguồn', () => {
    // Cùng một trục trặc, khác kết quả ⇒ khác mức. Và khi đỏ thì phải nói MẮT
    // XÍCH ĐỨT chứ không chỉ nói "kênh im lặng" - im lặng là hệ quả.
    const k = kenh({
      lastPublishedAt: truoc(20),
      sources: [nguon({ label: 'Genk', lastScanAt: truoc(8) })],
    })
    const r = canhMotKenh(k, NAY)
    expect(r.trangThai).toBe('DO')
    expect(r.ma).toBe('NGUON_QUET_CU')
    expect(r.lyDo).toContain('Genk')
  })

  test('tầng 3 - nguồn quét được nhưng ăn 403 vì IP dùng chung', () => {
    const k = kenh({
      target: 'DOC',
      lastPublishedAt: null,
      sources: [nguon({ label: 'Kho mã tsudev', lastError: 'GitHub HTTP 403 (/contents/docs)' })],
    })
    const r = canhMotKenh(k, NAY)
    expect(r.trangThai).toBe('DO')
    expect(r.ma).toBe('NGUON_LOI')
    expect(r.lyDo).toContain('403')
  })
})

describe('hai ca trông giống nhau mà ý nghĩa ngược nhau', () => {
  test('chưa từng ra bài + chưa từng có nguồn ⇒ KHÔNG NGUỒN, không đỏ', () => {
    // Kênh PROJECT đúng ca này từ 27/08/2026: agent bị cấm tạo dự án mới, và
    // chưa có `kind` nào phát ra được slug dự án thật. Đỏ ở đây là báo động giả.
    const k = kenh({ target: 'PROJECT', sources: [], lastPublishedAt: null })
    const r = canhMotKenh(k, NAY)
    expect(r.trangThai).toBe('KHONG_NGUON')
    expect(datCong([r])).toBe(true)
  })

  test('TỪNG ra bài rồi mất nguồn ⇒ ĐỎ', () => {
    // Cùng "không có nguồn" như trên, nhưng đây là hồi quy: có người tắt hoặc
    // xoá nhầm. Gộp hai ca này làm một là bỏ lọt đúng thứ cổng sinh ra để bắt.
    const k = kenh({ sources: [], lastPublishedAt: truoc(2) })
    const r = canhMotKenh(k, NAY)
    expect(r.trangThai).toBe('DO')
    expect(r.ma).toBe('MAT_NGUON')
  })

  test('nguồn `manual` KHÔNG tính là nguồn máy', () => {
    // `scanSources()` cố ý bỏ qua `kind: 'manual'`, nên nó không bao giờ có
    // `lastScanAt` và không chứng minh được kênh còn sống. Tính nó vào thì một
    // kênh chỉ có chủ đề nhập tay sẽ trông như đang khoẻ.
    const k = kenh({
      sources: [nguon({ kind: 'manual', lastScanAt: null })],
      lastPublishedAt: null,
    })
    expect(canhMotKenh(k, NAY).ma).toBe('KHONG_NGUON')
  })
})

describe('im lặng và thứ tự ưu tiên', () => {
  test('có nguồn lâu rồi mà CHƯA TỪNG ra bài ⇒ ĐỎ', () => {
    const k = kenh({ lastPublishedAt: null, sources: [nguon({ createdAt: truoc(60) })] })
    expect(canhMotKenh(k, NAY).ma).toBe('CHUA_TUNG_RA_BAI')
  })

  test('từng ra bài nhưng đã im quá lâu ⇒ ĐỎ', () => {
    expect(canhMotKenh(kenh({ lastPublishedAt: truoc(30) }), NAY).ma).toBe('IM_LANG')
  })

  test('im 5 ngày ⇒ chưa đỏ; kênh DOC có trần 1 bài/ngày, vài ngày trống là thường', () => {
    expect(canhMotKenh(kenh({ lastPublishedAt: truoc(5) }), NAY).trangThai).toBe('XANH')
  })

  test('nguồn hỏng thì báo NGUỒN, không báo "im lặng" - im lặng chỉ là hệ quả', () => {
    // Kênh này vừa có nguồn lỗi vừa im lặng lâu. Báo cả hai làm loãng; người đọc
    // cần biết mắt xích nào đứt, không cần biết hệ quả của nó.
    const k = kenh({ lastPublishedAt: truoc(40), sources: [nguon({ lastError: 'toang' })] })
    const r = canhMotKenh(k, NAY)
    expect(r.trangThai).toBe('DO')
    expect(r.ma).toBe('NGUON_LOI')
  })

  test('nguồn lỗi mà kênh vẫn ra bài ⇒ VÀNG (một nguồn trong tám hỏng không phải sự cố)', () => {
    const k = kenh({ lastPublishedAt: truocGio(3), sources: [nguon({ lastError: 'RSS 404' })] })
    expect(canhMotKenh(k, NAY).trangThai).toBe('VANG')
  })
})

describe('cổng tổng', () => {
  test('một kênh ĐỎ là cả cổng trượt', () => {
    const r = canhToaSoan(
      [
        kenh({ target: 'BLOG' }),
        kenh({ target: 'DOC', lastPublishedAt: null, sources: [nguon({ lastError: 'toang' })] }),
      ],
      NAY
    )
    expect(datCong(r)).toBe(false)
    expect(r.filter((x) => x.trangThai === 'DO').map((x) => x.target)).toEqual(['DOC'])
  })

  test('TAT, KHONG_NGUON và VANG đều không làm trượt cổng', () => {
    const r = canhToaSoan(
      [
        kenh({ target: 'TRUST', enabled: false }),
        kenh({ target: 'PROJECT', sources: [], lastPublishedAt: null }),
        kenh({ target: 'BLOG', sources: [nguon({ lastScanAt: truoc(8) })] }),
      ],
      NAY
    )
    expect(r.map((x) => x.trangThai)).toEqual(['TAT', 'KHONG_NGUON', 'VANG'])
    expect(datCong(r)).toBe(true)
  })

  test('mã lý do là hằng ổn định, để cảnh báo bám vào chứ không bám câu chữ', () => {
    // Câu chữ tiếng Việt sẽ được sửa cho dễ đọc; một cái cron grep câu chữ sẽ
    // hỏng lặng lẽ ở lần sửa đó.
    const ma = canhToaSoan(
      [kenh(), kenh({ target: 'DOC', sources: [], lastPublishedAt: null })],
      NAY
    ).map((r) => r.ma)
    expect(ma).toEqual(['BINH_THUONG', 'KHONG_NGUON'])
  })

  test('ngưỡng mặc định giữ đúng quan hệ choQuet < quetCu < imLang', () => {
    // Đảo thứ tự thì một luật che mất luật kia và cổng im lặng đúng lúc cần kêu.
    expect(NGUONG_MAC_DINH.choQuetMs).toBeLessThan(NGUONG_MAC_DINH.quetCuMs)
    expect(NGUONG_MAC_DINH.quetCuMs).toBeLessThan(NGUONG_MAC_DINH.imLangMs)
  })
})
