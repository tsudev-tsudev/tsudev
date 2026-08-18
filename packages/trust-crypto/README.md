# @tsudev/trust-crypto

Ed25519 cho con dấu tín nhiệm, viết bằng Rust và biên dịch sang WebAssembly.

## Nó mua được gì - và không mua được gì

Bản trước dùng `node:crypto`, tức là OpenSSL. Module này **không làm thuật toán
an toàn hơn**. Ba thứ nó thực sự mua được:

1. **Khoá riêng được xoá tường minh.** `SigningKey` của ed25519-dalek zeroize
   khi drop, và mọi bộ đệm trung gian ở đây cũng được xoá tay - kể cả vùng nhớ
   trả về bộ cấp phát WASM. Trong Node, khoá đã phân giải nằm trong heap của V8
   và chỉ biến mất khi GC thấy tiện.
2. **Khoá riêng không tồn tại dưới dạng giá trị JS đã phân giải.** Đây là lý do
   `sign()` nhận nguyên văn PEM chứ không nhận 32 byte hạt giống: bắt phía JS
   trích hạt giống ra sẽ vật chất hoá khoá thô thành một Buffer - **tệ hơn** hiện
   trạng, nơi `crypto.KeyObject` giữ nó bên trong OpenSSL.
3. **Dùng lại được ở edge.** Cùng artifact chạy trên Node lẫn Cloudflare Workers,
   nơi `node:crypto` không có. Truyền byte `.wasm` vào `loadWasm()` là đủ.

Thứ nó **không** sửa được: chuỗi PEM vẫn nằm trong `process.env.TRUST_SIGNING_KEY`
ở cả hai thiết kế. Đừng ai tưởng ngược lại.

## Vì sao `.wasm` được commit vào repo

Render dựng image Docker **từ git**, và image không có Rust. "Dựng artifact trong
CI" vì thế không với tới được nơi cần nó. Artifact được commit, và CI dựng lại
rồi **đối chiếu từng byte** để chứng minh nó khớp mã nguồn - bản dựng đã được
kiểm là tái lập và độc lập đường dẫn với toolchain ghim ở `rust-toolchain.toml`.

Sửa `src/lib.rs` ⇒ chạy `npm --workspace packages/trust-crypto run build:wasm`
rồi commit lại `pkg/trust_crypto.wasm`. Quên là CI đỏ ở job "WASM con dấu".

## ABI

Thủ công, không wasm-bindgen: không thêm bước sinh mã nào vào chuỗi dựng, và
cùng một `.wasm` nạp được bằng `WebAssembly.instantiate` trần ở mọi runtime.
Mọi hàm trả `i32` - `0` thành công, số âm là mã lỗi. Đầu ra có kích thước cố
định (chữ ký 64 byte, khoá công khai 32 byte) nên không cần trả con trỏ kèm độ
dài. Chi tiết ở `src/lib.rs`.
