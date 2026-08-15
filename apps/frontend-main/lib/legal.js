// Thông tin định danh của bên vận hành, dùng chung cho /terms, /privacy, /rules.
//
// CẦN ĐIỀN TRƯỚC KHI ĐƯA LÊN PRODUCTION: Nghị định 147/2024/NĐ-CP buộc trang
// thông tin điện tử phải công bố tên tổ chức/cá nhân quản lý, đầu mối liên hệ
// và số điện thoại; Luật Bảo vệ dữ liệu cá nhân 2025 buộc công bố đầu mối tiếp
// nhận yêu cầu của chủ thể dữ liệu. Để nguyên chuỗi "[…]" là thiếu tuân thủ.
export const OPERATOR = {
  name: 'tsudev',
  legalName: 'Nguyễn Trang Tình Sử',
  taxCode: '8536310833 / [số ĐKKD]',
  address: 'An Giang, Việt Nam',
  owner: 'Nguyễn Trang Tình Sử',
  // Ba địa chỉ này chỉ nhận được thư khi Cloudflare Email Routing của zone
  // tsudev.com đã bật và có route chuyển tiếp. Công bố địa chỉ chưa định tuyến
  // còn tệ hơn để trống: người dùng gửi khiếu nại và thư dội ngược trong im lặng.
  email: 'contact@tsudev.com',
  privacyEmail: 'privacy@tsudev.com',
  abuseEmail: 'abuse@tsudev.com',
  phone: '0329577500',
};

// Ngày ban hành/hiệu lực của chính các văn bản này trên tsudev — không phải
// ngày hiệu lực của luật.
export const DOC_DATES = {
  effective: '01/08/2026',
  updated: '31/07/2026',
};

// Cơ sở pháp lý được viện dẫn trong cả ba văn bản. Rà lại mỗi khi luật thay đổi:
// Luật An ninh mạng 2025 vừa thay thế Luật An ninh mạng 2018 từ 01/7/2026, và
// Nghị định 356/2025/NĐ-CP đã thay Nghị định 13/2023/NĐ-CP từ 01/01/2026.
export const LEGAL_BASIS = [
  {
    title: 'Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15',
    note: 'Quốc hội thông qua ngày 26/6/2025, hiệu lực từ 01/01/2026.',
  },
  {
    title: 'Nghị định số 356/2025/NĐ-CP',
    note: 'Ban hành ngày 31/12/2025, hiệu lực từ 01/01/2026, thay thế Nghị định số 13/2023/NĐ-CP.',
  },
  {
    title: 'Luật An ninh mạng số 116/2025/QH15',
    note: 'Quốc hội thông qua ngày 10/12/2025, hiệu lực từ 01/7/2026, thay thế Luật An ninh mạng 2018 và Luật An toàn thông tin mạng 2015.',
  },
  {
    title: 'Nghị định số 147/2024/NĐ-CP',
    note: 'Ban hành ngày 09/11/2024, hiệu lực từ 25/12/2024, về quản lý, cung cấp, sử dụng dịch vụ Internet và thông tin trên mạng.',
  },
  {
    title: 'Luật Giao dịch điện tử số 20/2023/QH15',
    note: 'Hiệu lực từ 01/7/2024.',
  },
  {
    title: 'Luật Bảo vệ quyền lợi người tiêu dùng số 19/2023/QH15',
    note: 'Hiệu lực từ 01/7/2024.',
  },
  {
    title: 'Bộ luật Dân sự số 91/2015/QH13 và Luật Sở hữu trí tuệ (sửa đổi, bổ sung năm 2022)',
    note: 'Áp dụng cho quyền nhân thân, quyền tác giả và quyền liên quan.',
  },
];

export default OPERATOR;
