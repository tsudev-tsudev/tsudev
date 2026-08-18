#!/usr/bin/env node
'use strict';
// Tạo bucket S3 cho local dev nếu chưa có. Idempotent.
//
// Dùng chính @aws-sdk/client-s3 mà storage-service dùng thay vì thêm binary
// `mc`: một phụ thuộc ít hơn phải cài và nhớ cập nhật, và nếu SDK nói chuyện
// được với MinIO thì service cũng vậy - bước này thành phép thử luôn.

const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

const { loadTopology, port } = require('./topology/load');

// Cổng lấy từ config/topology.json chứ không cắm cứng - `topology:check`
// chặn hardcode, và đổi cổng đáng lẽ chỉ phải sửa một chỗ.
const endpoint = process.env.S3_ENDPOINT || `http://127.0.0.1:${port(loadTopology(), 'cdn')}`;
const bucket = process.env.S3_BUCKET || 'tsudev';

const s3 = new S3Client({
  endpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
  // Giống storage-service: MinIO không phục vụ kiểu virtual-host.
  forcePathStyle: true,
});

(async () => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`[minio] bucket ${bucket} đã có`);
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    if (status !== 404 && err?.name !== 'NotFound') throw err;
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[minio] đã tạo bucket ${bucket}`);
  }
})().catch((err) => {
  console.error(`[minio] không tạo được bucket: ${err.message}`);
  process.exit(1);
});
