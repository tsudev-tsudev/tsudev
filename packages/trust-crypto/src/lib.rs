//! Ed25519 cho con dấu tín nhiệm tsudev, biên dịch sang WebAssembly.
//!
//! # Vì sao module này tồn tại
//!
//! Bản TypeScript dùng `node:crypto`, tức là OpenSSL — một bản cài đặt đã qua
//! kiểm toán. Module này **không** làm thuật toán an toàn hơn. Ba thứ nó mua
//! được, và chỉ ba thứ đó:
//!
//! 1. **Khoá riêng được xoá khỏi bộ nhớ tường minh.** `SigningKey` của
//!    ed25519-dalek cài `Drop` có zeroize, và mọi bộ đệm trung gian ở đây cũng
//!    được xoá tay. Trong Node, khoá đã phân giải nằm trong heap do V8 quản lý
//!    và chỉ biến mất khi GC thấy tiện.
//! 2. **Khoá riêng không bao giờ tồn tại dưới dạng giá trị JS đã phân giải.**
//!    Đây là lý do hàm `sign` nhận nguyên văn PEM chứ không nhận 32 byte hạt
//!    giống: bắt phía JS trích hạt giống ra để truyền vào sẽ vật chất hoá khoá
//!    thô thành một Buffer, tức là TỆ HƠN hiện trạng, nơi `crypto.KeyObject`
//!    giữ nó bên trong OpenSSL.
//! 3. **Dùng lại được ở edge.** Cùng một artifact chạy trên Node lẫn Cloudflare
//!    Workers, nơi `node:crypto` không có.
//!
//! Chuỗi PEM vẫn nằm trong `process.env.TRUST_SIGNING_KEY` ở cả hai thiết kế —
//! điều đó module này không sửa được, và đừng ai tưởng là nó sửa được.
//!
//! # Giao diện
//!
//! ABI thủ công, không wasm-bindgen: không thêm công cụ sinh mã vào chuỗi dựng,
//! và cùng một `.wasm` nạp được bằng `WebAssembly.instantiate` trần ở mọi
//! runtime. Mọi hàm trả `i32`: `0` là thành công, số âm là mã lỗi. Đầu ra có
//! kích thước CỐ ĐỊNH (chữ ký 64 byte, khoá công khai 32 byte) nên không cần
//! trả con trỏ kèm độ dài.

use base64ct::{Base64, Encoding};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use std::alloc::{alloc as sys_alloc, dealloc as sys_dealloc, Layout};
use zeroize::Zeroize;

/// PKCS#8 của Ed25519 có tiền tố DER cố định, rồi tới đúng 32 byte hạt giống.
/// Cùng hằng số này đã có trong `signing.ts` — Ed25519 không có tham số nào để
/// thương lượng, nên đây là toàn bộ việc "phân giải".
const PKCS8_PREFIX: [u8; 16] = [
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
];
const PKCS8_LEN: usize = PKCS8_PREFIX.len() + 32;

/// SubjectPublicKeyInfo của Ed25519: tiền tố cố định + 32 byte khoá công khai.
const SPKI_PREFIX: [u8; 12] = [
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
];
const SPKI_LEN: usize = SPKI_PREFIX.len() + 32;

pub const ERR_BAD_UTF8: i32 = -1;
pub const ERR_BAD_BASE64: i32 = -2;
pub const ERR_BAD_DER: i32 = -3;
pub const ERR_BAD_SIGNATURE_LEN: i32 = -4;
pub const ERR_NULL_POINTER: i32 = -5;

// ---------------------------------------------------------------------------
// Cấp phát bộ nhớ — phía JS gọi `alloc`, ghi dữ liệu vào, gọi hàm, rồi `dealloc`.
// ---------------------------------------------------------------------------

/// # Safety
/// Người gọi phải trả lại con trỏ này cho [`dealloc`] với ĐÚNG `len` đã cấp.
#[no_mangle]
pub unsafe extern "C" fn alloc(len: usize) -> *mut u8 {
    if len == 0 {
        return std::ptr::null_mut();
    }
    match Layout::from_size_align(len, 1) {
        Ok(layout) => sys_alloc(layout),
        Err(_) => std::ptr::null_mut(),
    }
}

/// # Safety
/// `ptr` phải đến từ [`alloc`] với cùng `len`, và chưa từng được giải phóng.
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    if let Ok(layout) = Layout::from_size_align(len, 1) {
        // Xoá trước khi trả về bộ cấp phát: vùng này có thể vừa chứa PEM khoá
        // riêng, và bộ cấp phát không có nghĩa vụ dọn hộ.
        std::ptr::write_bytes(ptr, 0, len);
        sys_dealloc(ptr, layout);
    }
}

// ---------------------------------------------------------------------------
// Phân giải PEM
// ---------------------------------------------------------------------------

/// Bóc vỏ PEM và giải mã base64. Bộ đệm trung gian được xoá trước khi trả về
/// nếu có lỗi — PEM khoá riêng không được phép nằm lại trong bộ nhớ đã giải phóng.
fn der_from_pem(pem: &str) -> Result<Vec<u8>, i32> {
    let mut body = String::with_capacity(pem.len());
    for line in pem.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("-----") {
            continue;
        }
        body.push_str(line);
    }
    let decoded = Base64::decode_vec(&body);
    body.zeroize();
    decoded.map_err(|_| ERR_BAD_BASE64)
}

/// Trích 32 byte hạt giống từ PKCS#8. `der` bị xoá trước khi hàm trả về.
fn seed_from_pkcs8(mut der: Vec<u8>) -> Result<[u8; 32], i32> {
    let ok = der.len() == PKCS8_LEN && der[..PKCS8_PREFIX.len()] == PKCS8_PREFIX;
    if !ok {
        der.zeroize();
        return Err(ERR_BAD_DER);
    }
    let mut seed = [0u8; 32];
    seed.copy_from_slice(&der[PKCS8_PREFIX.len()..]);
    der.zeroize();
    Ok(seed)
}

fn public_from_spki(der: &[u8]) -> Result<[u8; 32], i32> {
    if der.len() != SPKI_LEN || der[..SPKI_PREFIX.len()] != SPKI_PREFIX {
        return Err(ERR_BAD_DER);
    }
    let mut raw = [0u8; 32];
    raw.copy_from_slice(&der[SPKI_PREFIX.len()..]);
    Ok(raw)
}

/// Dựng khoá ký từ PEM. Hạt giống được xoá ngay sau khi `SigningKey` nhận nó;
/// bản thân `SigningKey` cũng zeroize khi bị drop (feature `zeroize` của
/// ed25519-dalek).
fn signing_key_from_pem(pem: &str) -> Result<SigningKey, i32> {
    let der = der_from_pem(pem)?;
    let mut seed = seed_from_pkcs8(der)?;
    let key = SigningKey::from_bytes(&seed);
    seed.zeroize();
    Ok(key)
}

// ---------------------------------------------------------------------------
// ABI công khai
// ---------------------------------------------------------------------------

/// # Safety
/// Mọi con trỏ phải hợp lệ với độ dài tương ứng; `out` phải trỏ tới 64 byte ghi được.
#[no_mangle]
pub unsafe extern "C" fn sign(
    pem_ptr: *const u8,
    pem_len: usize,
    msg_ptr: *const u8,
    msg_len: usize,
    out: *mut u8,
) -> i32 {
    if pem_ptr.is_null() || out.is_null() || (msg_ptr.is_null() && msg_len != 0) {
        return ERR_NULL_POINTER;
    }
    let pem_bytes = std::slice::from_raw_parts(pem_ptr, pem_len);
    let pem = match std::str::from_utf8(pem_bytes) {
        Ok(s) => s,
        Err(_) => return ERR_BAD_UTF8,
    };
    let key = match signing_key_from_pem(pem) {
        Ok(k) => k,
        Err(e) => return e,
    };
    let msg = if msg_len == 0 {
        &[][..]
    } else {
        std::slice::from_raw_parts(msg_ptr, msg_len)
    };
    let sig = key.sign(msg);
    std::ptr::copy_nonoverlapping(sig.to_bytes().as_ptr(), out, 64);
    // `key` bị drop ở đây và tự zeroize.
    0
}

/// Rút khoá công khai (32 byte thô) từ PEM khoá riêng.
///
/// # Safety
/// `out` phải trỏ tới 32 byte ghi được.
#[no_mangle]
pub unsafe extern "C" fn public_key_from_private_pem(
    pem_ptr: *const u8,
    pem_len: usize,
    out: *mut u8,
) -> i32 {
    if pem_ptr.is_null() || out.is_null() {
        return ERR_NULL_POINTER;
    }
    let pem_bytes = std::slice::from_raw_parts(pem_ptr, pem_len);
    let pem = match std::str::from_utf8(pem_bytes) {
        Ok(s) => s,
        Err(_) => return ERR_BAD_UTF8,
    };
    let key = match signing_key_from_pem(pem) {
        Ok(k) => k,
        Err(e) => return e,
    };
    let public = key.verifying_key();
    std::ptr::copy_nonoverlapping(public.to_bytes().as_ptr(), out, 32);
    0
}

/// Rút khoá công khai (32 byte thô) từ PEM khoá CÔNG KHAI (SPKI).
///
/// # Safety
/// `out` phải trỏ tới 32 byte ghi được.
#[no_mangle]
pub unsafe extern "C" fn public_key_from_public_pem(
    pem_ptr: *const u8,
    pem_len: usize,
    out: *mut u8,
) -> i32 {
    if pem_ptr.is_null() || out.is_null() {
        return ERR_NULL_POINTER;
    }
    let pem_bytes = std::slice::from_raw_parts(pem_ptr, pem_len);
    let pem = match std::str::from_utf8(pem_bytes) {
        Ok(s) => s,
        Err(_) => return ERR_BAD_UTF8,
    };
    let der = match der_from_pem(pem) {
        Ok(d) => d,
        Err(e) => return e,
    };
    match public_from_spki(&der) {
        Ok(raw) => {
            std::ptr::copy_nonoverlapping(raw.as_ptr(), out, 32);
            0
        }
        Err(e) => e,
    }
}

/// Xác minh chữ ký. Trả `1` nếu hợp lệ, `0` nếu không, số âm nếu đầu vào hỏng.
///
/// Phân biệt `0` với số âm là có chủ đích: "chữ ký sai" và "không đọc nổi khoá"
/// là hai chuyện khác nhau, và trang xác minh phải nói được sự khác nhau đó.
///
/// # Safety
/// Mọi con trỏ phải hợp lệ với độ dài tương ứng.
#[no_mangle]
pub unsafe extern "C" fn verify(
    pub_ptr: *const u8,
    msg_ptr: *const u8,
    msg_len: usize,
    sig_ptr: *const u8,
    sig_len: usize,
) -> i32 {
    if pub_ptr.is_null() || sig_ptr.is_null() || (msg_ptr.is_null() && msg_len != 0) {
        return ERR_NULL_POINTER;
    }
    if sig_len != 64 {
        return ERR_BAD_SIGNATURE_LEN;
    }
    let mut pub_raw = [0u8; 32];
    std::ptr::copy_nonoverlapping(pub_ptr, pub_raw.as_mut_ptr(), 32);
    let verifying = match VerifyingKey::from_bytes(&pub_raw) {
        Ok(k) => k,
        Err(_) => return ERR_BAD_DER,
    };
    let mut sig_raw = [0u8; 64];
    std::ptr::copy_nonoverlapping(sig_ptr, sig_raw.as_mut_ptr(), 64);
    let signature = Signature::from_bytes(&sig_raw);
    let msg = if msg_len == 0 {
        &[][..]
    } else {
        std::slice::from_raw_parts(msg_ptr, msg_len)
    };
    match verifying.verify(msg, &signature) {
        Ok(()) => 1,
        Err(_) => 0,
    }
}

// ---------------------------------------------------------------------------
// Test chạy trên target máy chủ (`cargo test`), không phải wasm.
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    /// Cùng hạt giống với khoá dev trong `signing.ts` — đúng 32 byte, công khai
    /// có chủ đích, không bao giờ dùng ngoài môi trường phát triển.
    const DEV_SEED: &[u8; 32] = b"tsudev-trust-dev-key-do-not-use!";

    fn dev_private_pem() -> String {
        let mut der = Vec::from(PKCS8_PREFIX);
        der.extend_from_slice(DEV_SEED);
        let b64 = Base64::encode_string(&der);
        format!("-----BEGIN PRIVATE KEY-----\n{b64}\n-----END PRIVATE KEY-----\n")
    }

    fn call_sign(pem: &str, msg: &[u8]) -> Result<[u8; 64], i32> {
        let mut out = [0u8; 64];
        let rc = unsafe {
            sign(
                pem.as_ptr(),
                pem.len(),
                msg.as_ptr(),
                msg.len(),
                out.as_mut_ptr(),
            )
        };
        if rc == 0 {
            Ok(out)
        } else {
            Err(rc)
        }
    }

    fn call_public(pem: &str) -> Result<[u8; 32], i32> {
        let mut out = [0u8; 32];
        let rc = unsafe { public_key_from_private_pem(pem.as_ptr(), pem.len(), out.as_mut_ptr()) };
        if rc == 0 {
            Ok(out)
        } else {
            Err(rc)
        }
    }

    fn call_verify(pubkey: &[u8; 32], msg: &[u8], sig: &[u8]) -> i32 {
        unsafe {
            verify(
                pubkey.as_ptr(),
                msg.as_ptr(),
                msg.len(),
                sig.as_ptr(),
                sig.len(),
            )
        }
    }

    #[test]
    fn ky_roi_xac_minh_thanh_cong() {
        let pem = dev_private_pem();
        let msg = b"eyJhbGciOiJFZERTQSJ9.eyJzZXJpYWwiOiJUU1UtQ1YtMjAyNi0wMDAwMDEifQ";
        let sig = call_sign(&pem, msg).expect("ky duoc");
        let public = call_public(&pem).expect("rut duoc khoa cong khai");
        assert_eq!(call_verify(&public, msg, &sig), 1);
    }

    #[test]
    fn doi_mot_byte_trong_thong_diep_lam_chu_ky_hong() {
        let pem = dev_private_pem();
        let msg = b"noi dung goc";
        let sig = call_sign(&pem, msg).unwrap();
        let public = call_public(&pem).unwrap();
        assert_eq!(call_verify(&public, b"noi dung gocX", &sig), 0);
    }

    #[test]
    fn chu_ky_bi_sua_bi_tu_choi() {
        let pem = dev_private_pem();
        let msg = b"noi dung";
        let mut sig = call_sign(&pem, msg).unwrap();
        sig[0] ^= 0x01;
        let public = call_public(&pem).unwrap();
        assert_eq!(call_verify(&public, msg, &sig), 0);
    }

    #[test]
    fn chu_ky_sai_do_dai_la_LOI_chu_khong_phai_khong_hop_le() {
        // Phân biệt này quan trọng: "chữ ký không khớp" và "đầu vào hỏng" phải
        // ra hai kết quả khác nhau để trang xác minh nói đúng lý do.
        let pem = dev_private_pem();
        let public = call_public(&pem).unwrap();
        let rc = unsafe { verify(public.as_ptr(), b"x".as_ptr(), 1, b"ngan".as_ptr(), 4) };
        assert_eq!(rc, ERR_BAD_SIGNATURE_LEN);
    }

    #[test]
    fn pem_khong_phai_ed25519_bi_tu_choi_thay_vi_ky_bua() {
        // DER đúng base64 nhưng sai tiền tố: phải ra ERR_BAD_DER, tuyệt đối
        // không được im lặng ký bằng thứ gì đó.
        let der = vec![0u8; PKCS8_LEN];
        let b64 = Base64::encode_string(&der);
        let pem = format!("-----BEGIN PRIVATE KEY-----\n{b64}\n-----END PRIVATE KEY-----");
        assert_eq!(call_sign(&pem, b"x"), Err(ERR_BAD_DER));
    }

    #[test]
    fn pem_do_dai_sai_bi_tu_choi() {
        let der = vec![0u8; PKCS8_LEN + 1];
        let b64 = Base64::encode_string(&der);
        let pem = format!("-----BEGIN PRIVATE KEY-----\n{b64}\n-----END PRIVATE KEY-----");
        assert_eq!(call_sign(&pem, b"x"), Err(ERR_BAD_DER));
    }

    #[test]
    fn base64_hong_bi_tu_choi() {
        let pem = "-----BEGIN PRIVATE KEY-----\n!!!khong-phai-base64!!!\n-----END PRIVATE KEY-----";
        assert_eq!(call_sign(pem, b"x"), Err(ERR_BAD_BASE64));
    }

    #[test]
    fn khoa_cong_khai_spki_rut_ra_khop_voi_khoa_rieng() {
        let pem = dev_private_pem();
        let from_private = call_public(&pem).unwrap();

        let mut spki = Vec::from(SPKI_PREFIX);
        spki.extend_from_slice(&from_private);
        let b64 = Base64::encode_string(&spki);
        let public_pem = format!("-----BEGIN PUBLIC KEY-----\n{b64}\n-----END PUBLIC KEY-----");

        let mut out = [0u8; 32];
        let rc = unsafe {
            public_key_from_public_pem(public_pem.as_ptr(), public_pem.len(), out.as_mut_ptr())
        };
        assert_eq!(rc, 0);
        assert_eq!(out, from_private);
    }

    #[test]
    fn thong_diep_rong_van_ky_va_xac_minh_duoc() {
        let pem = dev_private_pem();
        let sig = call_sign(&pem, b"").unwrap();
        let public = call_public(&pem).unwrap();
        assert_eq!(call_verify(&public, b"", &sig), 1);
    }
}
