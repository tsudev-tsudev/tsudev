/**
 * Cổng canh: một KÊNH của toà soạn có đang im lặng mà không ai biết không.
 *
 * Vì sao cần, và vì sao các cổng cũ không thay được:
 *
 * Ngày 27/08/2026 đóng được `/docs` sau khi gỡ BA tầng chồng nhau - thiếu nguồn,
 * van áp lực ngược toàn cục bỏ đói kênh, và 403 vì IP dùng chung của Render. Cả
 * ba đều sống nhiều ngày mà **không có gì đỏ lên**:
 *
 *   - `newsroom:check` đếm `AgentRun` tăng, mà toà soạn vẫn chạy đầy đủ cho BLOG.
 *     Nó in "✔ Toà soạn ĐANG CHẠY THẬT" suốt thời gian `/docs` chết.
 *   - `newsroom:chan-doan` hỏi các van của `tick()`, và mọi van đều mở thật.
 *   - Bộ test đơn vị canh HÌNH DẠNG của mã, không canh được dữ liệu production.
 *
 * Cả ba đều hỏi "toà soạn có chạy không". Không cái nào hỏi **"kênh này đã bao
 * lâu không ra bài"** - và đó mới là câu hỏi mà một trang trống trả lời được.
 *
 * Logic tách khỏi database CỐ Ý: quyết định là phần dễ sai và cần test, còn truy
 * vấn thì không. Hàm này thuần - không đọc `Date.now()`, không đọc `process.env`,
 * nên `scripts/canh-kenh-toa-soan.js` nạp dữ liệu rồi gọi, và bộ test dựng thẳng
 * các ca biên mà không cần một database nào.
 */

export type TrangThaiKenh = 'XANH' | 'VANG' | 'DO' | 'TAT' | 'KHONG_NGUON'

export interface NguonTin {
  label: string
  kind: string
  enabled: boolean
  lastScanAt: Date | null
  lastError: string | null
  createdAt: Date
}

export interface KenhCanh {
  target: string
  enabled: boolean
  sources: NguonTin[]
  /** Lần gần nhất kênh này ĐĂNG được một thứ. `null` = chưa bao giờ. */
  lastPublishedAt: Date | null
}

export interface Nguong {
  /** Ân hạn cho một nguồn MỚI trước khi đòi hỏi nó phải được quét. */
  choQuetMs: number
  /** Quét lần cuối cách đây quá lâu ⇒ nguồn đang bị bỏ đói. */
  quetCuMs: number
  /** Kênh không ra bài quá lâu ⇒ im lặng. */
  imLangMs: number
}

const GIO = 60 * 60 * 1000
const NGAY = 24 * GIO

/**
 * Ngưỡng mặc định. Ba con số, ba lý do khác nhau - đừng gộp:
 *
 * - `choQuetMs` **6 giờ**: nhịp là mỗi giờ và mỗi nhịp quét tối đa 3 nguồn, nên
 *   một nguồn mới có thể chờ vài nhịp mới tới lượt. Dưới 6 giờ mà đã kêu thì
 *   cổng này báo động giả mỗi lần thêm nguồn.
 * - `quetCuMs` **3 ngày**: chọn để nằm GIỮA hai thứ. Một kênh đang tồn hàng đợi
 *   thì nguồn của nó bị bỏ qua HỢP LỆ (trần theo kênh) và chuyện đó kéo dài
 *   khoảng một ngày - 3 ngày không bắt nhầm ca đó. Còn Tuổi Trẻ và Genk từng kẹt
 *   **8 ngày**, tức ca thật vượt xa ngưỡng này.
 * - `imLangMs` **7 ngày**: kênh DOC có trần 1 bài/ngày và nguồn của nó là chính
 *   kho mã, nên vài ngày không có gì để viết là BÌNH THƯỜNG. 7 ngày thì không.
 */
export const NGUONG_MAC_DINH: Nguong = {
  choQuetMs: 6 * GIO,
  quetCuMs: 3 * NGAY,
  imLangMs: 7 * NGAY,
}

export interface KetLuan {
  target: string
  trangThai: TrangThaiKenh
  /** Mã lý do ỔN ĐỊNH - test và cảnh báo bám vào cái này, không bám vào câu chữ. */
  ma: string
  lyDo: string
}

const ngay = (ms: number) => Math.floor(ms / NGAY)

/**
 * Đánh giá MỘT kênh.
 *
 * ⚠️ Nguyên tắc chia mức, và nó là thứ quyết định cổng này SỐNG hay CHẾT:
 * **cổng trượt vì KẾT QUẢ, còn trục trặc ở nguồn chỉ giải thích TẠI SAO.**
 *
 * Đo trên prod 27/08/2026 cho thấy vì sao phải tách: Tuổi Trẻ và Genk kẹt 8 ngày
 * không được quét, **trong khi BLOG vẫn đăng đều** (64 bài PUBLISHED, 2 bài/ngày).
 * Bắt cả kênh ĐỎ vì hai nguồn ngủ trong khi trang vẫn đầy bài là kêu oan - và một
 * cổng kêu oan thì người ta ngừng đọc nó, tức là nó chết mà vẫn còn chạy.
 *
 * Nên: kênh CÒN RA BÀI thì trục trặc nguồn là **VÀNG** (đáng biết, không chặn);
 * kênh KHÔNG ra bài thì đúng trục trặc đó thành **ĐỎ**, và nó được nêu tên như
 * nguyên nhân thay vì chỉ báo "kênh im lặng" - vì "im lặng" là hệ quả, không phải
 * mắt xích đứt.
 */
export function canhMotKenh(kenh: KenhCanh, now: Date, nguong: Nguong = NGUONG_MAC_DINH): KetLuan {
  const t = now.getTime()
  const ket = (trangThai: TrangThaiKenh, ma: string, lyDo: string): KetLuan => ({
    target: kenh.target,
    trangThai,
    ma,
    lyDo,
  })

  if (!kenh.enabled) return ket('TAT', 'KENH_TAT', 'kênh đang tắt - không canh')

  // `manual` là chủ đề người nhập tay; `scanSources()` cố ý bỏ qua nó, nên nó
  // không bao giờ có `lastScanAt` và không chứng minh được kênh còn sống.
  const nguonMay = kenh.sources.filter((s) => s.enabled && s.kind !== 'manual')

  if (!nguonMay.length) {
    // Phân biệt HAI ca trông giống nhau mà ý nghĩa ngược nhau.
    if (kenh.lastPublishedAt) {
      return ket(
        'DO',
        'MAT_NGUON',
        `kênh TỪNG ra bài (gần nhất ${ngay(
          t - kenh.lastPublishedAt.getTime()
        )} ngày trước) mà nay không còn nguồn nào đang bật - nghi có người tắt hoặc xoá nhầm`
      )
    }
    // Chưa từng ra bài và cũng chưa từng có nguồn = cố ý để trống. Kênh PROJECT
    // đúng ca này từ 27/08/2026: nó chỉ sửa mô tả dự án đã có, và chưa có `kind`
    // nào phát ra được slug dự án thật.
    return ket(
      'KHONG_NGUON',
      'KHONG_NGUON',
      'không có nguồn nào đang bật ⇒ kênh này sẽ không bao giờ ra bài. Đúng thiết kế thì bỏ qua; không thì đây là lý do trang tương ứng trống'
    )
  }

  // Trục trặc ở nguồn, theo thứ tự nghiêm trọng. Chỉ lấy CÁI ĐẦU TIÊN: một nguồn
  // vừa lỗi vừa quét cũ thì "lỗi" là thứ cần sửa, "quét cũ" là hệ quả.
  const loi = nguonMay.find((s) => s.lastError)
  const chuaQuet = nguonMay.find(
    (s) => s.lastScanAt === null && t - s.createdAt.getTime() > nguong.choQuetMs
  )
  const quetCu = nguonMay.find(
    (s) => s.lastScanAt !== null && t - s.lastScanAt.getTime() > nguong.quetCuMs
  )

  let truc: { ma: string; lyDo: string } | null = null
  if (loi) {
    truc = { ma: 'NGUON_LOI', lyDo: `nguồn "${loi.label}" đang lỗi: ${loi.lastError}` }
  } else if (chuaQuet) {
    truc = {
      ma: 'NGUON_CHUA_QUET',
      lyDo: `nguồn "${chuaQuet.label}" tạo ${ngay(
        t - chuaQuet.createdAt.getTime()
      )} ngày trước mà CHƯA TỪNG được quét - không có nguồn được quét thì không có đề tài, không có đề tài thì kênh không ra bài`,
    }
  } else if (quetCu) {
    truc = {
      ma: 'NGUON_QUET_CU',
      lyDo: `nguồn "${quetCu.label}" quét lần cuối ${ngay(
        t - quetCu.lastScanAt!.getTime()
      )} ngày trước - nghi đang bị bỏ đói ở khâu chọn nguồn`,
    }
  }

  const dangRaBai =
    kenh.lastPublishedAt !== null && t - kenh.lastPublishedAt.getTime() <= nguong.imLangMs

  // Kênh còn ra bài: trục trặc nguồn là chuyện đáng biết, không phải chuyện chặn.
  if (dangRaBai) {
    if (truc) return ket('VANG', truc.ma, truc.lyDo)
    return ket(
      'XANH',
      'BINH_THUONG',
      `ra bài gần nhất ${ngay(t - kenh.lastPublishedAt!.getTime())} ngày trước`
    )
  }

  // Kênh KHÔNG ra bài: nếu có trục trặc nguồn thì chính nó là nguyên nhân, nêu
  // tên nó chứ đừng chỉ nói "im lặng".
  if (truc) return ket('DO', truc.ma, truc.lyDo)

  if (!kenh.lastPublishedAt) {
    // Nguồn cũ nhất quyết định "đã đủ thời gian chưa": nguồn vừa thêm hôm qua thì
    // chưa ra bài là bình thường, nguồn có từ hai tháng trước thì không.
    const cuNhat = Math.min(...nguonMay.map((s) => s.createdAt.getTime()))
    if (t - cuNhat > nguong.imLangMs) {
      return ket(
        'DO',
        'CHUA_TUNG_RA_BAI',
        `có nguồn từ ${ngay(t - cuNhat)} ngày trước mà kênh CHƯA TỪNG ra bài nào`
      )
    }
    return ket('XANH', 'CON_MOI', 'nguồn còn mới, chưa ra bài nhưng chưa tới mức đáng lo')
  }

  return ket(
    'DO',
    'IM_LANG',
    `không ra bài nào trong ${ngay(t - kenh.lastPublishedAt.getTime())} ngày`
  )
}

/** Đánh giá cả toà soạn. Giữ nguyên thứ tự kênh được truyền vào. */
export function canhToaSoan(
  kenhs: KenhCanh[],
  now: Date,
  nguong: Nguong = NGUONG_MAC_DINH
): KetLuan[] {
  return kenhs.map((k) => canhMotKenh(k, now, nguong))
}

/** Cổng có ĐẠT không. Chỉ `DO` mới làm trượt - `VANG`, `TAT`, `KHONG_NGUON` là thông tin. */
export function datCong(ketLuan: KetLuan[]): boolean {
  return !ketLuan.some((k) => k.trangThai === 'DO')
}
