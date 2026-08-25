import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PAGE_SIZES,
  normalizePage,
  normalizePageSize,
  pageMeta,
  parsePaging,
} from '@tsudev/types'

/**
 * Phân trang chuẩn - DATA_TABLE.md mục 8.
 *
 * Canh phần HỢP ĐỒNG, không canh cách cài đặt: mốc hợp lệ, cách quy giá trị lạ,
 * trần cứng, và hình dạng khối `meta`. Đây là chỗ dễ trôi nhất khi có người thêm
 * một mốc "cho tiện" ở một bảng.
 */
describe('mốc page_size', () => {
  it('đúng năm mốc chuẩn, không thêm không bớt', () => {
    expect([...PAGE_SIZES]).toEqual([10, 20, 50, 100, 200])
    expect(DEFAULT_PAGE_SIZE).toBe(10)
    expect(MAX_PAGE_SIZE).toBe(200)
  })

  it('giá trị lạ quy về mốc gần nhất KHÔNG LỚN HƠN nó, không báo lỗi', () => {
    expect(normalizePageSize(15)).toBe(10)
    expect(normalizePageSize(20)).toBe(20)
    expect(normalizePageSize(99)).toBe(50)
    expect(normalizePageSize(199)).toBe(100)
    expect(normalizePageSize(200)).toBe(200)
  })

  it('trần cứng 200: không phục vụ lớn hơn với bất kỳ lý do gì', () => {
    expect(normalizePageSize(201)).toBe(200)
    expect(normalizePageSize(1000)).toBe(200)
    expect(normalizePageSize(Number.MAX_SAFE_INTEGER)).toBe(200)
  })

  it('nhỏ hơn mốc nhỏ nhất, hoặc không đọc được, thì về mặc định', () => {
    expect(normalizePageSize(3)).toBe(10)
    expect(normalizePageSize(0)).toBe(10)
    expect(normalizePageSize(-50)).toBe(10)
    expect(normalizePageSize('abc')).toBe(10)
    expect(normalizePageSize(undefined)).toBe(10)
    expect(normalizePageSize(null)).toBe(10)
    expect(normalizePageSize(NaN)).toBe(10)
  })

  it('đọc được chuỗi, vì query và body đều là chuỗi', () => {
    expect(normalizePageSize('50')).toBe(50)
    expect(normalizePageSize('  100  ')).toBe(100)
  })
})

describe('page', () => {
  it('bắt đầu từ 1; giá trị lạ về 1 thay vì báo lỗi', () => {
    expect(normalizePage(1)).toBe(1)
    expect(normalizePage(7)).toBe(7)
    expect(normalizePage(0)).toBe(1)
    expect(normalizePage(-3)).toBe(1)
    expect(normalizePage('abc')).toBe(1)
    expect(normalizePage(undefined)).toBe(1)
    expect(normalizePage(2.9)).toBe(2)
  })
})

describe('parsePaging', () => {
  it('tính skip/take dùng thẳng được cho Prisma', () => {
    expect(parsePaging({ page: 1, page_size: 20 })).toEqual({
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
    })
    expect(parsePaging({ page: 3, page_size: 50 })).toEqual({
      page: 3,
      pageSize: 50,
      skip: 100,
      take: 50,
    })
  })

  it('body rỗng ra trang 1 mốc 10', () => {
    expect(parsePaging({})).toEqual({ page: 1, pageSize: 10, skip: 0, take: 10 })
  })
})

describe('pageMeta', () => {
  it('hình dạng đúng đặc tả mục 8.2', () => {
    expect(pageMeta(128, parsePaging({ page: 1, page_size: 10 }))).toEqual({
      total: 128,
      page: 1,
      page_size: 10,
      total_pages: 13,
    })
  })

  it('bảng rỗng vẫn là trang 1 trên 1, không phải trên 0', () => {
    // total_pages = 0 làm giao diện hiện "trang 1 / 0".
    expect(pageMeta(0, parsePaging({})).total_pages).toBe(1)
  })

  it('trang vượt quá trang cuối vẫn cho meta đúng (route trả mảng rỗng, KHÔNG 404)', () => {
    const meta = pageMeta(15, parsePaging({ page: 99, page_size: 10 }))
    expect(meta.page).toBe(99)
    expect(meta.total_pages).toBe(2)
    expect(meta.total).toBe(15)
  })
})

export {}
