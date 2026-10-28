/**
 * BẢNG ICON - dữ liệu thuần, tách khỏi component.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * MÀU ĐI THEO CHỨC NĂNG, KHÔNG THEO Ý THÍCH TỪNG TRANG
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Mỗi icon gắn cứng với MỘT nhóm hành động, và nhóm đó quyết định màu:
 *
 *   nav     xanh dương  điều hướng, liên kết, mở
 *   create  xanh lá     tạo, thêm, tải lên, tải về
 *   edit    hổ phách    sửa, cấu hình, vận hành
 *   danger  đỏ          xoá, thu hồi, huỷ, cảnh báo
 *   info    tím         siêu dữ liệu, thời gian, số liệu, nền tảng
 *   trust   ngọc        con dấu, xác minh, chữ ký, bảo mật
 *
 * Vì sao gắn cứng chứ không cho truyền màu: khi mỗi trang tự chọn, cùng một
 * hành động "xoá" sẽ đỏ ở trang này và xám ở trang kia, và người dùng mất khả
 * năng đọc màu như một tín hiệu. Cần một sắc khác nghĩa là cần một CHỨC NĂNG
 * khác - thêm vào bảng, đừng ghi đè tại chỗ gọi.
 *
 * Sáu màu được canh tương phản ≥4.5:1 với cả ba tầng bề mặt ở CẢ BA chế độ
 * (`test/contrast.test.ts`). Icon ở đây mang thông tin, nên nó chịu ngưỡng của
 * CHỮ chứ không phải của đồ hoạ trang trí.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * QUY TẮC VẼ - theo đúng để bộ icon trông như MỘT bộ
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   · lưới 24×24, vùng an toàn 2px mỗi bên (nét nằm trong 2..22)
 *   · nét 1.6, `strokeLinecap="round"`, `strokeLinejoin="round"`
 *   · KHÔNG tô (`fill`), chỉ nét - trừ `dot` dùng `circle` đặc có chủ đích
 *   · không nét nào mảnh hơn 1.6: ở 16px nó biến mất trên màn hình thường
 *   · hình học càng ít điểm càng tốt; icon 20 điểm ở 16px chỉ là một vệt xám
 *
 * Vẽ TAY, không nhập thư viện ngoài. Ba lý do, cả ba đều thật: (1) đây là bộ
 * biểu tượng RIÊNG của tsudev, nhập Lucide là mang bộ icon mà hàng vạn site
 * khác đang dùng; (2) app chạy trên Cloudflare Workers nên mỗi dependency là
 * bundle phải trả tiền; (3) hệ màu theo vai trò ở trên không tồn tại trong bất
 * kỳ thư viện nào, nên nhập vào rồi cũng phải bọc lại.
 *
 * `npm run icons:check` canh ba chuyện: mọi `IconName` được dùng trong mã phải
 * có trong bảng này, mọi icon trong bảng phải có `role` hợp lệ, và mọi đường vẽ
 * phải nằm trong vùng an toàn.
 */

export type IconRole = 'nav' | 'create' | 'edit' | 'danger' | 'info' | 'trust';

export type IconSpec = {
  role: IconRole;
  /** Đường vẽ chính. */
  d: string;
  /** `[cx, cy, r]` - hình tròn vẽ THÊM, không thay cho `d`. */
  circle?: readonly [number, number, number];
  /** Hình tròn ĐẶC (có `fill`). Chỉ dùng cho chấm trạng thái. */
  solidCircle?: readonly [number, number, number];
};

export const ICONS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // nav - điều hướng, liên kết, mở
  // ═══════════════════════════════════════════════════════════════════════════
  home: { role: 'nav', d: 'M3.5 10.5 12 3.5l8.5 7M5.5 9.2V20h13V9.2M9.8 20v-5.5h4.4V20' },
  external: {
    role: 'nav',
    d: 'M14 4h6v6M20 4l-8.5 8.5M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5',
  },
  search: { role: 'nav', circle: [11, 11, 7], d: 'M20 20l-3.2-3.2' },
  chevron: { role: 'nav', d: 'M9 5l7 7-7 7' },
  'chevron-down': { role: 'nav', d: 'M5 9l7 7 7-7' },
  'chevron-left': { role: 'nav', d: 'M15 5l-7 7 7 7' },
  'arrow-right': { role: 'nav', d: 'M4 12h15M13 6l6 6-6 6' },
  'arrow-left': { role: 'nav', d: 'M20 12H5M11 6l-6 6 6 6' },
  'arrow-up': { role: 'nav', d: 'M12 20V5M6 11l6-6 6 6' },
  doc: { role: 'nav', d: 'M6 3h7l5 5v13H6zM13 3v5h5M9 12.5h6M9 16.5h6' },
  menu: { role: 'nav', d: 'M4 6.5h16M4 12h16M4 17.5h16' },
  close: { role: 'nav', d: 'M6 6l12 12M18 6L6 18' },
  link: {
    role: 'nav',
    d: 'M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.5 1.5M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.5-1.5',
  },
  grid: { role: 'nav', d: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  list: { role: 'nav', d: 'M4 6.5h2M9 6.5h11M4 12h2M9 12h11M4 17.5h2M9 17.5h11' },
  filter: { role: 'nav', d: 'M3.5 5.5h17l-6.5 7.5V20l-4-2.5v-4.5z' },
  sort: { role: 'nav', d: 'M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3' },
  book: {
    role: 'nav',
    d: 'M4 5a1 1 0 0 1 1-1h6v16H5a1 1 0 0 1-1-1zM20 5a1 1 0 0 0-1-1h-6v16h6a1 1 0 0 0 1-1zM11 4v16',
  },
  rss: { role: 'nav', solidCircle: [6, 18, 1.6], d: 'M5 5a14 14 0 0 1 14 14M5 11a8 8 0 0 1 8 8' },

  // ═══════════════════════════════════════════════════════════════════════════
  // create - tạo, thêm, tải lên, tải về
  // ═══════════════════════════════════════════════════════════════════════════
  plus: { role: 'create', d: 'M12 5v14M5 12h14' },
  upload: {
    role: 'create',
    d: 'M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  },
  // Mũi tên CHĨA XUỐNG, đối xứng với `upload`. Cặp này phải đọc được ngay cả
  // khi đứng riêng, nên cùng một khay dưới và chỉ khác chiều mũi tên.
  download: {
    role: 'create',
    d: 'M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  },
  check: { role: 'create', d: 'M4.5 12.5l5 5 10-10' },
  'check-circle': { role: 'create', circle: [12, 12, 8.5], d: 'M8.4 12.2l2.6 2.6 4.6-5' },
  save: { role: 'create', d: 'M5 4h11l3 3v13H5zM8.5 4v5h7V4M8.5 20v-5.5h7V20' },
  copy: { role: 'create', d: 'M9 9h10v11H9zM15 9V4H5v10h4' },
  send: { role: 'create', d: 'M20.5 3.5 3.5 10l6.5 2.8L13 20z M10 12.8 20.5 3.5' },
  package: {
    role: 'create',
    d: 'M12 3.2 20.5 7.5v9L12 20.8 3.5 16.5v-9zM3.5 7.5 12 11.8l8.5-4.3M12 11.8v9M7.7 5.3l8.6 4.4',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // edit - sửa, cấu hình, vận hành
  // ═══════════════════════════════════════════════════════════════════════════
  edit: { role: 'edit', d: 'M4 20h4L19 9l-4-4L4 16v4zM14.5 5.5l4 4' },
  settings: {
    role: 'edit',
    circle: [12, 12, 3.2],
    d: 'M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9',
  },
  pen: { role: 'edit', d: 'M4.5 19.5 9 18l10-10a2.5 2.5 0 0 0-3.5-3.5L5.5 14.5zM14.5 5.5l4 4' },
  refresh: {
    role: 'edit',
    d: 'M20 6v5h-5M4 18v-5h5M19.3 13a7.5 7.5 0 0 1-12.6 3.4L4 13.8M4.7 11a7.5 7.5 0 0 1 12.6-3.4L20 10.2',
  },
  play: { role: 'edit', d: 'M7 4.5 19 12 7 19.5z' },
  pause: { role: 'edit', d: 'M8.5 4.5v15M15.5 4.5v15' },
  stop: { role: 'edit', d: 'M5.5 5.5h13v13h-13z' },
  sliders: {
    role: 'edit',
    circle: [9, 7, 2.4],
    d: 'M4 7h2.6M11.4 7H20M4 17h5.6M14.4 17H20M12 14.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8',
  },
  flag: { role: 'edit', d: 'M5.5 20V4.5h10l-1.5 4 1.5 4h-10' },
  bell: { role: 'edit', d: 'M6.5 10a5.5 5.5 0 0 1 11 0v4l1.5 3H5l1.5-3zM10 20a2.2 2.2 0 0 0 4 0' },

  // ═══════════════════════════════════════════════════════════════════════════
  // danger - xoá, thu hồi, huỷ, cảnh báo
  // ═══════════════════════════════════════════════════════════════════════════
  trash: {
    role: 'danger',
    d: 'M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5V20a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6.5M10 11v5M14 11v5',
  },
  warning: { role: 'danger', d: 'M12 3.5 21 20H3zM12 9.5v4.5M12 16.8v.2' },
  'x-circle': { role: 'danger', circle: [12, 12, 8.5], d: 'M9 9l6 6M15 9l-6 6' },
  ban: { role: 'danger', circle: [12, 12, 8.5], d: 'M6 6l12 12' },
  'lock-open': { role: 'danger', d: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.8-1' },

  // ═══════════════════════════════════════════════════════════════════════════
  // info - siêu dữ liệu, thời gian, số liệu, nền tảng
  // ═══════════════════════════════════════════════════════════════════════════
  clock: { role: 'info', circle: [12, 12, 8.5], d: 'M12 7.2V12l3.2 2' },
  tag: { role: 'info', d: 'M3.5 11.4V4.5a1 1 0 0 1 1-1h6.9l9.1 9.1-7.9 7.9zM8 8v.2' },
  info: { role: 'info', circle: [12, 12, 8.5], d: 'M12 11v5.5M12 7.8v.2' },
  question: {
    role: 'info',
    circle: [12, 12, 8.5],
    d: 'M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.4M12 16.8v.2',
  },
  calendar: { role: 'info', d: 'M4.5 6.5h15V20h-15zM4.5 11h15M8.5 4v3M15.5 4v3' },
  user: { role: 'info', circle: [12, 8, 3.6], d: 'M5 20.5a7 7 0 0 1 14 0' },
  users: {
    role: 'info',
    circle: [9.5, 8, 3.2],
    d: 'M3.5 20.5a6 6 0 0 1 12 0M16 5.3a3.2 3.2 0 0 1 0 5.4M17.5 15.6a6 6 0 0 1 3 4.9',
  },
  chart: { role: 'info', d: 'M4 20h16M7 20v-6M12 20V7M17 20v-9' },
  activity: { role: 'info', d: 'M3 12h3.5l2.5-6 3 13 3-8 2 1h4' },
  database: {
    role: 'info',
    d: 'M4.5 6.5c0-1.4 3.4-2.5 7.5-2.5s7.5 1.1 7.5 2.5-3.4 2.5-7.5 2.5S4.5 7.9 4.5 6.5M4.5 6.5v11c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-11M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5',
  },
  server: { role: 'info', d: 'M4.5 4.5h15v6h-15zM4.5 13.5h15v6h-15zM8 7.5v.2M8 16.5v.2' },
  folder: { role: 'info', d: 'M4 6.5a1 1 0 0 1 1-1h4l2 2.5h8a1 1 0 0 1 1 1V19H4z' },
  image: { role: 'info', circle: [9, 9.5, 1.8], d: 'M4 5h16v14H4zM4 16l4.5-4 4 3.5L16 12l4 4' },
  code: { role: 'info', d: 'M9 7.5 4.5 12 9 16.5M15 7.5 19.5 12 15 16.5' },
  mail: { role: 'info', d: 'M4 6h16v12H4zM4 6.5l8 6 8-6' },
  // --- nền tảng phát hành ---
  // Vẽ theo DÁNG nhận ra được ở 16px, không chép logo thương hiệu: logo Android
  // và Apple là nhãn hiệu được bảo hộ, và một bộ icon tự vẽ thì không được phép
  // dựa trên nhãn hiệu của người khác. Repo này có cả một hệ con dấu về bản
  // quyền - tự vi phạm nhãn hiệu thì không còn gì để nói.
  android: {
    role: 'info',
    d: 'M6.5 11.5a5.5 5.5 0 0 1 11 0v6h-11zM8.3 7.2 6.8 5M15.7 7.2 17.2 5M9.8 9.4v.2M14.2 9.4v.2M4 12v4.5M20 12v4.5',
  },
  windows: {
    role: 'info',
    d: 'M4 5.8 11 4.8v6.4H4zM13 4.5 20 3.5v7.7h-7zM4 12.8h7v6.4l-7-1zM13 12.8h7v7.7l-7-1z',
  },
  apple: {
    role: 'info',
    d: 'M12 8.5c-1.2-1-3.2-1.2-4.6 0-1.9 1.6-1.8 5 .2 7.6 1 1.3 2 2.2 3 2 .8-.1 1-.6 2-.6s1.2.5 2 .6c1 .2 2-.8 3-2.2M12 8.5c1.2-1 3.2-1.2 4.6 0M12 8.5V5.5a2.5 2.5 0 0 1 2.5-2.5',
  },
  linux: {
    role: 'info',
    d: 'M9.5 4.5a2.5 2.5 0 0 1 5 0v3l2.5 5.5 1.5 4.5-3 1-2-2h-4l-2 2-3-1L6 13l2.5-5.5zM10.6 5.6v.2M13.4 5.6v.2M10.5 8.5h3',
  },
  web: {
    role: 'info',
    circle: [12, 12, 8.5],
    d: 'M3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // trust - con dấu, xác minh, chữ ký, bảo mật
  // ═══════════════════════════════════════════════════════════════════════════
  seal: {
    role: 'trust',
    d: 'M12 3l7.5 3.2v5.1c0 4.4-3 8.2-7.5 9.7-4.5-1.5-7.5-5.3-7.5-9.7V6.2zM8.8 12.2l2.4 2.4 4.2-4.6',
  },
  key: { role: 'trust', circle: [8.5, 12, 3.8], d: 'M12.3 12H21M17.5 12v3M20 12v2.2' },
  shield: {
    role: 'trust',
    d: 'M12 3l7.5 3.2v5.1c0 4.4-3 8.2-7.5 9.7-4.5-1.5-7.5-5.3-7.5-9.7V6.2z',
  },
  lock: { role: 'trust', d: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3' },
  fingerprint: {
    role: 'trust',
    d: 'M12 4a8 8 0 0 0-8 8M20 12a8 8 0 0 0-8-8M7.5 13a4.5 4.5 0 0 1 9 0v1.5M10.2 14.2a1.8 1.8 0 0 1 3.6 0v4M6.2 16.5A6 6 0 0 1 6 15M17.8 17v2',
  },
  certificate: { role: 'trust', circle: [12, 9.5, 5], d: 'M9.6 13.8 8.5 20.5l3.5-2 3.5 2-1.1-6.7' },
  // Chữ ký số: ngòi bút kéo một nét trên đường nền. Phân biệt với `pen` (sửa)
  // bằng đường nền ngang - thứ nói "đây là việc ĐÓNG DẤU lên một tài liệu".
  signature: {
    role: 'trust',
    d: 'M3.5 17.5h17M4.5 14c2-5 3.5-7.5 4.5-7.5s1 3 1.5 5.5 1.3 3 2.5 1.5 2-4 3.5-4 2 1.5 2.5 2.5',
  },
  hash: { role: 'trust', d: 'M9 4 7 20M17 4l-2 16M4.5 9h15.5M3.5 15H19' },
  scan: {
    role: 'trust',
    d: 'M4 8.5V5a1 1 0 0 1 1-1h3.5M15.5 4H19a1 1 0 0 1 1 1v3.5M20 15.5V19a1 1 0 0 1-1 1h-3.5M8.5 20H5a1 1 0 0 1-1-1v-3.5M4 12h16',
  },
  globe: {
    role: 'trust',
    circle: [12, 12, 8.5],
    d: 'M3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.2 12 20.5',
  },
  eye: {
    role: 'trust',
    circle: [12, 12, 2.8],
    d: 'M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12',
  },
  'eye-off': {
    role: 'trust',
    d: 'M4 4l16 16M9.5 9.7a2.8 2.8 0 0 0 3.9 3.9M6.3 6.5C4 8.2 2.5 12 2.5 12s3.5 5.5 9.5 5.5c1.6 0 3-.4 4.2-1M18.4 15.2c1.9-1.7 3.1-3.2 3.1-3.2S18 6.5 12 6.5c-.6 0-1.2.1-1.7.2',
  },
  // Passkey: người + chìa khoá. Icon này từng được vẽ INLINE trong
  // `pages/login.tsx` - tức một icon mang nghĩa bảo mật nằm ngoài hệ thống màu,
  // nên nó không đổi màu theo chế độ và không bị cổng tương phản nào canh.
  passkey: {
    role: 'trust',
    circle: [9, 8, 3.4],
    d: 'M3.5 20c0-3.2 2.7-5.2 5.5-5.2 0.9 0 1.8 0.2 2.5 0.5M20.5 13.2a2.6 2.6 0 1 0-4 2.2V21l1.4-1.2 1.4 1.2v-5.6c0.7-0.5 1.2-1.3 1.2-2.2z',
  },
  robot: {
    role: 'trust',
    d: 'M6.5 8.5h11v9h-11zM12 8.5V5.5M9.8 12.2v.2M14.2 12.2v.2M9.5 15.2h5M4 11v4M20 11v4',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // chấm trạng thái - hình tròn ĐẶC có chủ đích
  // ═══════════════════════════════════════════════════════════════════════════
  // Lý do dùng `solidCircle` thay vì nét: chấm trạng thái phải đọc được ở 8px,
  // và ở kích thước đó một hình tròn chỉ-nét biến thành một vòng xám mờ.
  dot: { role: 'info', solidCircle: [12, 12, 4], d: '' },
} as const satisfies Record<string, IconSpec>;

export type IconName = keyof typeof ICONS;

export const ROLE_CLASS: Record<IconRole, string> = {
  nav: 'text-icon-nav',
  create: 'text-icon-create',
  edit: 'text-icon-edit',
  danger: 'text-icon-danger',
  info: 'text-icon-info',
  trust: 'text-icon-trust',
};
