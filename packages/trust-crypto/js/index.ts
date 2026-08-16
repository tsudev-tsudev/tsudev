// Cầu nối JS ↔ WebAssembly cho Ed25519 của con dấu tín nhiệm.
//
// Không dùng wasm-bindgen: ABI thủ công (xem packages/trust-crypto/src/lib.rs)
// nên không có bước sinh mã nào trong chuỗi dựng, và cùng một `.wasm` nạp được
// bằng `WebAssembly.instantiate` trần ở mọi runtime.
//
// Artifact `.wasm` được COMMIT vào repo, không dựng lúc cài đặt. Lý do là hình
// trạng phát hành: Render dựng image Docker TỪ GIT, và image không có Rust —
// nên "dựng artifact trong CI" không với tới được nơi cần nó. Bù lại, CI dựng
// lại và đối chiếu để chứng minh artifact khớp mã nguồn.
import { readFileSync } from 'fs';
import { join } from 'path';

type WasmExports = {
  memory: WebAssembly.Memory;
  alloc(len: number): number;
  dealloc(ptr: number, len: number): void;
  sign(pemPtr: number, pemLen: number, msgPtr: number, msgLen: number, out: number): number;
  verify(pubPtr: number, msgPtr: number, msgLen: number, sigPtr: number, sigLen: number): number;
  public_key_from_private_pem(pemPtr: number, pemLen: number, out: number): number;
  public_key_from_public_pem(pemPtr: number, pemLen: number, out: number): number;
};

/** Mã lỗi phải khớp hằng trong src/lib.rs. */
const ERRORS: Record<number, string> = {
  [-1]: 'PEM không phải UTF-8 hợp lệ',
  [-2]: 'phần base64 của PEM hỏng',
  [-3]: 'DER không phải khoá Ed25519 hợp lệ',
  [-4]: 'chữ ký phải dài đúng 64 byte',
  [-5]: 'con trỏ rỗng',
};

const fail = (code: number, what: string): never => {
  throw new Error(`[trust-crypto] ${what}: ${ERRORS[code] ?? `mã lỗi ${code}`}`);
};

let instance: WasmExports | null = null;

/** Đường tới artifact. `dist/index.js` nằm cạnh `pkg/` một cấp. */
const wasmPath = () => join(__dirname, '..', 'pkg', 'trust_crypto.wasm');

/**
 * Nạp module. Đồng bộ có chủ đích: 60KB biên dịch trong vài mili giây, và ba
 * service đều nạp nó ở thời điểm khởi động chứ không phải trên đường phục vụ.
 *
 * `bytes` cho phép nơi gọi tự cung cấp artifact — đó là đường dùng ở Cloudflare
 * Workers, nơi không có `fs`.
 */
export function loadWasm(bytes?: BufferSource): void {
  const source = bytes ?? readFileSync(wasmPath());
  const module = new WebAssembly.Module(source);
  instance = new WebAssembly.Instance(module, {}).exports as unknown as WasmExports;
}

function wasm(): WasmExports {
  if (!instance) loadWasm();
  // `loadWasm` gán instance hoặc ném lỗi; nhánh này không tới được.
  if (!instance) throw new Error('[trust-crypto] không nạp được module WebAssembly');
  return instance;
}

/**
 * Chép dữ liệu vào bộ nhớ tuyến tính của WASM và LUÔN giải phóng lại.
 *
 * `dealloc` phía Rust ghi đè vùng nhớ bằng 0 trước khi trả về bộ cấp phát —
 * quan trọng ở đây vì một trong các vùng này chứa PEM khoá RIÊNG.
 */
function withBytes<T>(ex: WasmExports, chunks: Uint8Array[], fn: (ptrs: number[]) => T): T {
  const ptrs: number[] = [];
  try {
    for (const chunk of chunks) {
      const ptr = chunk.length ? ex.alloc(chunk.length) : 0;
      if (chunk.length && !ptr) throw new Error('[trust-crypto] cấp phát bộ nhớ WASM thất bại');
      if (chunk.length) new Uint8Array(ex.memory.buffer, ptr, chunk.length).set(chunk);
      ptrs.push(ptr);
    }
    return fn(ptrs);
  } finally {
    // Giải phóng theo thứ tự ngược, bỏ qua các con trỏ chưa kịp cấp.
    for (let i = ptrs.length - 1; i >= 0; i--) {
      const len = chunks[i]?.length ?? 0;
      if (ptrs[i] && len) ex.dealloc(ptrs[i]!, len);
    }
  }
}

/** Chép kết quả có độ dài cố định ra khỏi WASM rồi giải phóng vùng đệm. */
function withOut<T>(ex: WasmExports, size: number, fn: (out: number) => T): [T, Uint8Array] {
  const out = ex.alloc(size);
  if (!out) throw new Error('[trust-crypto] cấp phát bộ đệm đầu ra thất bại');
  try {
    const rc = fn(out);
    // Sao chép thành mảng RIÊNG: `memory.buffer` bị tách rời khi WASM nới bộ
    // nhớ, nên giữ một view vào nó là giữ một quả bom hẹn giờ.
    const copy = new Uint8Array(new Uint8Array(ex.memory.buffer, out, size));
    return [rc, copy];
  } finally {
    ex.dealloc(out, size);
  }
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/** Ký thông điệp bằng PEM khoá riêng. Trả chữ ký Ed25519 64 byte. */
export function signWithPrivatePem(pem: string, message: Uint8Array): Uint8Array {
  const ex = wasm();
  const pemBytes = utf8(pem);
  return withBytes(ex, [pemBytes, message], ([pemPtr, msgPtr]) => {
    const [rc, sig] = withOut(ex, 64, (out) =>
      ex.sign(pemPtr!, pemBytes.length, msgPtr!, message.length, out)
    );
    if (rc !== 0) fail(rc, 'ký thất bại');
    return sig;
  });
}

/** Rút 32 byte khoá công khai từ PEM khoá riêng. */
export function publicKeyFromPrivatePem(pem: string): Uint8Array {
  const ex = wasm();
  const pemBytes = utf8(pem);
  return withBytes(ex, [pemBytes], ([pemPtr]) => {
    const [rc, key] = withOut(ex, 32, (out) =>
      ex.public_key_from_private_pem(pemPtr!, pemBytes.length, out)
    );
    if (rc !== 0) fail(rc, 'không rút được khoá công khai từ khoá riêng');
    return key;
  });
}

/** Rút 32 byte khoá công khai từ PEM khoá công khai (SPKI). */
export function publicKeyFromPublicPem(pem: string): Uint8Array {
  const ex = wasm();
  const pemBytes = utf8(pem);
  return withBytes(ex, [pemBytes], ([pemPtr]) => {
    const [rc, key] = withOut(ex, 32, (out) =>
      ex.public_key_from_public_pem(pemPtr!, pemBytes.length, out)
    );
    if (rc !== 0) fail(rc, 'không đọc được khoá công khai');
    return key;
  });
}

/**
 * Xác minh chữ ký.
 *
 * Ném lỗi khi ĐẦU VÀO hỏng, trả `false` khi chữ ký không khớp — hai chuyện khác
 * nhau, và trang xác minh phải nói được sự khác nhau đó.
 */
export function verifyWithPublicKey(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array
): boolean {
  const ex = wasm();
  return withBytes(ex, [publicKey, message, signature], ([pubPtr, msgPtr, sigPtr]) => {
    const rc = ex.verify(pubPtr!, msgPtr!, message.length, sigPtr!, signature.length);
    if (rc < 0) fail(rc, 'xác minh không thực hiện được');
    return rc === 1;
  });
}
