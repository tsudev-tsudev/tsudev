#!/usr/bin/env bash
# Khởi động MinIO user-space cho local dev (không cần Docker/sudo).
# Idempotent: bỏ qua nếu đã chạy, tạo bucket nếu chưa có.
#
# MinIO ở đây KHÔNG phải kho lưu trữ của production - production dùng
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
# Bản dùng ở mọi máy của dự án. Ghim một chỗ để ba đường lấy binary ở dưới cho
# ra cùng một thứ - MinIO không còn kênh "latest" nào để tin cậy nữa.
MINIO_VERSION="${TSUDEV_MINIO_VERSION:-RELEASE.2025-09-07T16-13-09Z}"

# Tài khoản lấy từ .env gốc để không tách làm hai nguồn sự thật.
if [ -f "$ROOT_DIR/.env" ]; then
  MINIO_ROOT_USER="$(grep -E '^MINIO_ROOT_USER=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2-)"
  MINIO_ROOT_PASSWORD="$(grep -E '^MINIO_ROOT_PASSWORD=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2-)"
fi
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
S3_BUCKET="${S3_BUCKET:-tsudev}"

BIN_DIR="$(dirname "$MINIO_BIN")"

# Tự dựng chỉ khi được cho phép TƯỜNG MINH. Không bật theo mặc định: `go install`
# tải vài trăm MB module và mất nhiều phút, không phải việc một script dev được
# quyền làm sau lưng người gọi.
if [ ! -x "$MINIO_BIN" ] && [ "${TSUDEV_MINIO_AUTOBUILD:-0}" = "1" ]; then
  if command -v go >/dev/null 2>&1; then
    echo "[minio] không có binary - dựng từ nguồn: github.com/minio/minio@$MINIO_VERSION" >&2
    mkdir -p "$BIN_DIR"
    GOBIN="$BIN_DIR" go install "github.com/minio/minio@$MINIO_VERSION"
  else
    echo "[minio] TSUDEV_MINIO_AUTOBUILD=1 nhưng không có 'go' trong PATH - bỏ qua bước dựng." >&2
  fi
fi

if [ ! -x "$MINIO_BIN" ]; then
  cat >&2 <<MSG
[minio] KHÔNG tìm thấy binary ở $MINIO_BIN

[minio] dl.min.io đã NGỪNG phát hành binary dựng sẵn. Mọi URL dạng
[minio]   https://dl.min.io/server/minio/release/linux-amd64/minio
[minio] nay trả HTTP 410 VĨNH VIỄN, kể cả dạng có ghim bản và dạng archive;
[minio] release trên GitHub của minio/minio cũng không kèm asset nào.
[minio] Đừng đi tìm URL tải khác - không còn cái nào.

[minio] Ba đường lấy binary $MINIO_VERSION, theo thứ tự nên thử:

[minio]   1. Copy từ máy đã có - nhanh nhất, và chắc chắn trùng bản:
[minio]        scp <user>@<host>:.tsudev/bin/minio "$MINIO_BIN"
[minio]        chmod +x "$MINIO_BIN"

[minio]   2. Dựng từ nguồn - cần Go >= 1.24, tải nhiều, chậm:
[minio]        TSUDEV_MINIO_AUTOBUILD=1 npm run minio:up

[minio]   3. Rút từ image Docker - cần Docker:
[minio]        docker run --rm --entrypoint cat quay.io/minio/minio:$MINIO_VERSION /usr/bin/minio > "$MINIO_BIN"
[minio]        chmod +x "$MINIO_BIN"

[minio] MinIO chỉ phục vụ đường ký presign ở local. Thiếu nó thì upload ở local
[minio] không chạy, còn lại bình thường - bộ test không cần nó.
MSG
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
    echo "[minio] không lên được - xem $MINIO_LOG" >&2
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
