#!/usr/bin/env node
'use strict'
// Sinh cặp khoá Ed25519 cho cơ quan cấp dấu.
//   node services/trust-service/scripts/genkey.js
// In ra các dòng để dán vào .env (hoặc secret manager của nền tảng triển khai).
// Khoá riêng KHÔNG được commit; lộ nó là giả được mọi chứng chỉ.
//
// XOAY KHOÁ: chạy lại lệnh này, đặt khoá mới vào TRUST_SIGNING_KEY, rồi CHUYỂN
// khoá cũ sang TRUST_SIGNING_KEYS_RETIRED (chỉ cần phần công khai — xem dòng in
// ra ở cuối). Bỏ qua bước thứ hai thì mọi chứng chỉ đã cấp lập tức báo "không
// có khoá công khai" trên trang xác thực.
const crypto = require('crypto')

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
const privPem = privateKey.export({ format: 'pem', type: 'pkcs8' })
const pubPem = publicKey.export({ format: 'pem', type: 'spki' })
const kid = `tsu-${new Date().toISOString().slice(0, 7)}-${crypto.randomBytes(3).toString('hex')}`

console.log('# Khoá đang ký — dán vào .env (giá trị là PEM PKCS#8 đã base64 hoá)')
console.log(`TRUST_SIGNING_KEY=${Buffer.from(privPem).toString('base64')}`)
console.log(`TRUST_SIGNING_KEY_ID=${kid}`)
console.log('')
console.log('# Khi xoay sang khoá khác, thêm mục này vào TRUST_SIGNING_KEYS_RETIRED')
console.log('# (nhiều mục ngăn nhau bằng dấu phẩy) để chứng chỉ đã cấp vẫn xác minh được:')
console.log(`#   ${kid}:${Buffer.from(pubPem).toString('base64')}`)
console.log('')
console.log('# Khoá công khai dạng JWK (chỉ để đối chiếu, service tự suy ra được):')
console.log(`#   ${JSON.stringify(publicKey.export({ format: 'jwk' }))}`)
