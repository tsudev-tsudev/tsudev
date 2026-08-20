// Hợp đồng giữa agent và nhà cung cấp LLM.
//
// Agent chỉ biết `complete()`. Đổi nhà cung cấp là đổi cấu hình, không phải
// viết lại agent - đó là lý do lớp này tồn tại thay vì gọi thẳng fetch().

export interface CompleteInput {
  system: string
  user: string
  maxTokens: number
  /// Ghi đè model của agent khi cần (ví dụ hạ xuống model rẻ cho việc lọc).
  model?: string
  /// Yêu cầu đầu ra là JSON. KHÔNG có mô hình nào ở đây bảo đảm cú pháp như
  /// `output_config.format` của Claude, nên đây chỉ là gợi ý cho prompt và
  /// người gọi VẪN phải parse có phòng vệ. Xem parseJsonLoose().
  json?: boolean
}

export interface CompleteResult {
  text: string
  inputTokens: number
  outputTokens: number
  /// Neuron tiêu thụ. Với nhà cung cấp không tính theo Neuron (Gemini) thì là 0
  /// - hạn mức của họ đếm theo request/ngày, không theo Neuron.
  neurons: number
  provider: ProviderName
  model: string
}

export type ProviderName = 'workers-ai' | 'gemini'

export interface LlmProvider {
  readonly name: ProviderName
  /// `false` khi thiếu biến môi trường. Router bỏ qua nhà cung cấp chưa cấu hình
  /// thay vì ném lỗi lúc khởi động - thiếu Gemini không được làm chết service.
  isConfigured(): boolean
  complete(input: CompleteInput): Promise<CompleteResult>
}

/// Lỗi phân biệt được "hết hạn mức" với "hỏng thật". Router chỉ chuyển sang dự
/// phòng khi gặp loại đầu; loại sau phải nổi lên để còn sửa.
export class QuotaExhaustedError extends Error {
  readonly provider: ProviderName
  constructor(provider: ProviderName, message: string) {
    super(message)
    this.name = 'QuotaExhaustedError'
    this.provider = provider
  }
}

/// Cạn hạn mức ở MỌI nhà cung cấp - khác hẳn "hỏng".
///
/// Hạn mức miễn phí cạn mỗi ngày là chuyện BÌNH THƯỜNG của hệ này, không phải
/// sự cố: 10.000 Neuron/ngày là thiết kế, và nó reset lúc 00:00 UTC. Trước khi
/// có lớp phân biệt này, mọi lượt cạn hạn mức đều đi chung đường với lỗi thật:
/// sự kiện bị tính một lần thử hỏng, ba lần thì DEAD vĩnh viễn, và bản nháp
/// đang viết dở nằm lại mãi. Ba nhịp trong một ngày cạn Neuron là đủ giết một
/// bài - đó chính là các "bài bị lỗi" ở /admin/newsroom.
///
/// Người gọi phải HOÃN việc lại (trả sự kiện về PENDING, không tăng attempts),
/// chứ không được coi là thất bại.
export class AllProvidersExhaustedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AllProvidersExhaustedError'
  }
}
