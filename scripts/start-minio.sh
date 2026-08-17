#!/usr/bin/env bash
# Khởi động MinIO user-space cho local dev (không cần Docker/sudo).
# Idempotent: bỏ qua nếu đã chạy, tạo bucket nếu chưa có.
#
# MinIO ở đây KHÔNG phải kho lưu trữ của production — production dùng
# Cloudflare R2. Nó chỉ tồn tại để đường ký URL presign có thứ để nói chuyện
# khi bấm thử upload ở local. Test không cần nó: storage-service stub sẵn
# presign khi NODE_ENV=test.
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MINIO_BIN="${TSUDEV_MINIO_BIN:-$HOME/.tsudev/bin/minio}"
MINIO_DATA="${TSUDEV_MINIO_DATA:-$HOME/.tsudev/minio-data}"
MINIO_PORT="${TSUDEV_MINIO_PORT:-$(node -e "const{loadTopology,port}=require('$ROOT_DIR/scripts/topology/load');process.stdout.write(String(port(loadTopology(),'cdn')))")}"
MINIO_CONSOLE_PORT="${TSUDEV_MINIO_CONSOLE_PORT:-9001}"
MINIO_LOG="$HOME/.tsudev/minio.log"

# Tài khoản lấy từ .env gốc để không tách làm hai nguồn sự thật.
if [ -f "$ROOT_DIR/.env" ]; then
  MINIO_ROOT_USER="$(grep -E '^MINIO_ROOT_USER=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2-)"
  MINIO_ROOT_PASSWORD="$(grep -E '^MINIO_ROOT_PASSWORD=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2-)"
fi
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
S3_BUCKET="${S3_BUCKET:-tsudev}"

if [ ! -x "$MINIO_BIN" ]; then
  echo "[minio] KHÔNG tìm thấy binary ở $MINIO_BIN" >&2
  echo "[minio] Tải về: curl -fSL -o \"$MINIO_BIN\" https://dl.min.io/server/minio/release/linux-amd64/minio && chmod +x \"$MINIO_BIN\"" >&2
  exit 1
fi

if curl -sf --max-time 2 "http://127.0.0.1:$MINIO_PORT/minio/health/live" >/dev/null 2>&1; then
  echo "[minio] already running"
else
  echo "[minio] starting on port $MINIO_PORT (console $MINIO_CONSOLE_PORT)"
  mkdir -p "$MINIO_DATA" "$(dirname "$MINIO_LOG")"
  MINIO_ROOT_USER="$MINIO_ROOT_USER" MINIO_ROOT_PASSWORD="$MINIO_ROOT_PASSWORD" \
    nohup "$MINIO_BIN" server "$MINIO_DATA" \
      --address "127.0.0.1:$MINIO_PORT" \
      --console-address "127.0.0.1:$MINIO_CONSOLE_PORT" \
      >"$MINIO_LOG" 2>&1 &
  for _ in $(seq 1 40); do
    curl -sf --max-time 2 "http://127.0.0.1:$MINIO_PORT/minio/health/live" >/dev/null 2>&1 && break
    sleep 0.5
  done
  if ! curl -sf --max-time 2 "http://127.0.0.1:$MINIO_PORT/minio/health/live" >/dev/null 2>&1; then
    echo "[minio] không lên được — xem $MINIO_LOG" >&2
    exit 1
  fi
fi

# Tạo bucket bằng chính @aws-sdk/client-s3 mà storage-service dùng, thay vì
# thêm binary `mc` thứ hai chỉ để gọi một lệnh.
S3_BUCKET="$S3_BUCKET" \
S3_ENDPOINT="http://127.0.0.1:$MINIO_PORT" \
S3_ACCESS_KEY="$MINIO_ROOT_USER" \
S3_SECRET_KEY="$MINIO_ROOT_PASSWORD" \
  node "$ROOT_DIR/scripts/ensure-bucket.js"

echo "[minio] ready: http://127.0.0.1:$MINIO_PORT (bucket $S3_BUCKET)"
