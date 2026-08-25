// Cổng lệch migration. Nó ra đời từ BLOG-500: migration
// `20260825165439_dau_vet_dang_nhap` không được chạy trên prod, nên mọi truy vấn
// chạm bảng `User` nổ trong khi `count` và các truy vấn không chạm `User` vẫn
// xanh - và `lib/api.ts` nuốt lỗi thành `[]` nên trang chỉ TRỐNG.
//
// Test ở đây canh phần QUYẾT ĐỊNH, không canh việc giết tiến trình: ranh giới
// "biết là lệch" / "không kiểm được" mới là chỗ dễ làm sai, và làm sai theo
// hướng thứ hai thì một sự cố mạng thoáng qua đủ để sập site.

import { bundledMigrations, missingMigrations } from '../src/migrationGate'

const clientWith = (names: string[]) => ({
  $queryRawUnsafe: async () => names.map((migration_name) => ({ migration_name })),
})

describe('cổng lệch migration', () => {
  it('đọc được thư mục migration nằm trong image', () => {
    const all = bundledMigrations()
    expect(all.length).toBeGreaterThan(0)
    // Chính migration đã gây BLOG-500 - nếu nó biến mất khỏi repo thì test này
    // sai chỗ khác, không phải cổng sai.
    expect(all).toContain('20260825165439_dau_vet_dang_nhap')
  })

  it('DB đủ migration ⇒ không thiếu gì', async () => {
    const all = bundledMigrations()
    await expect(missingMigrations(clientWith(all))).resolves.toEqual([])
  })

  it('DB thiếu migration cuối ⇒ báo đúng tên nó', async () => {
    const all = bundledMigrations()
    const last = all[all.length - 1]
    await expect(missingMigrations(clientWith(all.slice(0, -1)))).resolves.toEqual([last])
  })

  it('migration lạ TRÊN DB không phải là lệch', async () => {
    // DB đi trước mã (rollback bản dựng) - khó chịu nhưng không phải hỏng kiểu
    // BLOG-500: mã cũ không SELECT cột mới. Chặn ở đây là chặn nhầm.
    const all = bundledMigrations()
    await expect(missingMigrations(clientWith([...all, '99999999_tu_tuong_lai']))).resolves.toEqual(
      []
    )
  })

  it('không đọc được _prisma_migrations ⇒ null (không kết luận), KHÔNG phải lệch', async () => {
    const dead = {
      $queryRawUnsafe: async () => {
        throw new Error('Connection terminated')
      },
    }
    await expect(missingMigrations(dead)).resolves.toBeNull()
  })
})
