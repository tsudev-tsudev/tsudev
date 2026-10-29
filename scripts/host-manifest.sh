#!/usr/bin/env bash
# In ra BỘ SỐ ĐO CHUẨN của một bản sao repo này, để so hai máy bằng `diff`.
#
#   # ở máy nguồn
#   npm run host:manifest > /tmp/nguon.txt
#   # ở máy đích
#   npm run host:manifest > /tmp/dich.txt
#   diff /tmp/nguon.txt /tmp/dich.txt && echo "HAI MAY KHOP"
#
# Ba tầng nghiệm thu độc lập, vì mỗi tầng một mình đều bỏ sót được:
#   1. git      - phủ mọi file được theo dõi. HEAD trùng + 0 file lệch là bằng
#                 chứng MẠNH, vì git so bằng hash nội dung.
#   2. ngoaigit - nhóm `.gitignore` loại ra nhưng VẪN PHẢI đi theo (secret).
#                 Không tầng nào khác thấy chúng.
#   3. db       - đếm bản ghi. Độc lập với định dạng lưu trữ, với collation,
#                 với phiên bản PostgreSQL. Đây là bằng chứng mạnh nhất về
#                 NỘI DUNG, và là thứ duy nhất còn đúng sau pg_dump/pg_restore.
#
# Danh tính máy in ra STDERR, không phải stdout - để `diff` của hai máy sạch.
#
# Xem ~/projects/SO-TAY-DI-CHUYEN-CODEBASE.md §6 để biết giao thức đầy đủ.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
DATA_DIR="${TSUDEV_DATA_DIR:-$HOME/.tsudev}"

# LC_ALL=C ở mọi phép sort: hai máy có locale khác nhau (đợt 29/10/2026 là
# vi_VN trên Mint và C.UTF-8 trên WSL mới) thì thứ tự sort đổi theo, và tổng
# vân tay đổi theo nó - báo lệch ở nơi không có gì lệch.
export LC_ALL=C

printf 'may      : %s@%s\n' "$(whoami)" "$(hostname)" >&2
printf 'thu muc  : %s\n'    "$ROOT_DIR" >&2
printf 'du lieu  : %s\n'    "$DATA_DIR" >&2

ra() { printf '%-18s %s\n' "$1" "$2"; }

# ── Tầng 1: git ─────────────────────────────────────────────────────────────
ra git.head   "$(git rev-parse --short HEAD 2>/dev/null || echo KHONG-PHAI-REPO)"
ra git.branch "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo -)"
ra git.dirty  "$(git status --porcelain 2>/dev/null | wc -l)"

# ── Tầng 2: nhóm NGOÀI git ──────────────────────────────────────────────────
# Mẫu nào không khớp file nào thì lặng lẽ bỏ qua, nhưng SỐ LƯỢNG được in ra -
# nên một file biến mất vẫn hiện thành lệch, không bị che.
NGOAI_GIT=(
  .env
  .env.bak-*
  .claude/settings.local.json
  apps/frontend-main/.dev.vars
  apps/frontend-main/AGENTS.md
  apps/frontend-main/CLAUDE.md
)
liet_ke_ngoai_git() {
  {
    for pat in "${NGOAI_GIT[@]}"; do
      for f in $pat; do [ -f "$f" ] && printf '%s\n' "$f"; done
    done
    [ -d backup ] && find backup -type f -print
  } | sort
}
ds="$(liet_ke_ngoai_git)"
if [ -n "$ds" ]; then
  ra ngoaigit.files  "$(printf '%s\n' "$ds" | wc -l)"
  ra ngoaigit.sha256 "$(printf '%s\n' "$ds" | tr '\n' '\0' | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"
else
  ra ngoaigit.files  0
  ra ngoaigit.sha256 "(khong co file nao - DANG NGHI)"
fi

# ── Tầng 2b: dữ liệu NGOÀI thư mục dự án ────────────────────────────────────
# Chỉ so được khi database ĐANG TẮT ở cả hai đầu: một cluster đang chạy ghi
# vào pgdata liên tục, nên hash vô nghĩa. Nói thẳng ra thay vì in một con số
# trông như số đo.
if [ ! -d "$DATA_DIR" ]; then
  ra dulieu.files  "(khong co $DATA_DIR)"
  ra dulieu.sha256 "(khong co $DATA_DIR)"
elif [ -e "$DATA_DIR/pgdata/postmaster.pid" ]; then
  ra dulieu.files  "(bo qua - DB dang chay)"
  ra dulieu.sha256 "(bo qua - DB dang chay)"
else
  ds2="$(cd "$DATA_DIR" && find pgdata minio-data -type f -print 2>/dev/null | sort || true)"
  if [ -n "$ds2" ]; then
    ra dulieu.files  "$(printf '%s\n' "$ds2" | wc -l)"
    ra dulieu.sha256 "$(cd "$DATA_DIR" && printf '%s\n' "$ds2" | tr '\n' '\0' | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"
  else
    ra dulieu.files  0
    ra dulieu.sha256 "(trong)"
  fi
fi

# ── Tầng 3: nội dung database ───────────────────────────────────────────────
# psql từ chối query string kiểu `?schema=public` của Prisma, phải cắt bỏ.
URL=""
[ -f .env ] && URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"'\''' || true)"
URL="${URL%%\?*}"
if [ -z "$URL" ] || ! command -v psql >/dev/null 2>&1; then
  ra db.tables     "(khong co DATABASE_URL hoac psql)"
  ra db.rows       "(khong co DATABASE_URL hoac psql)"
  ra db.migrations "(khong co DATABASE_URL hoac psql)"
elif ! timeout 10 psql "$URL" -Atc 'select 1' >/dev/null 2>&1; then
  ra db.tables     "(khong ket noi duoc - chay: npm run db:up)"
  ra db.rows       "(khong ket noi duoc - chay: npm run db:up)"
  ra db.migrations "(khong ket noi duoc - chay: npm run db:up)"
else
  # ĐẾM CHÍNH XÁC. Không dùng pg_class.reltuples hay n_live_tup: đó là ước
  # lượng của planner, bảng chưa ANALYZE trả -1, và số khác số thật.
  read -r sb sr <<<"$(timeout 60 psql "$URL" -Atc "
    select count(*), coalesce(sum(cnt),0) from (
      select (xpath('/row/c/text()', query_to_xml(
               format('select count(*) as c from %I.%I','public',table_name),
               false,true,'')))[1]::text::bigint as cnt
      from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE') t;" | tr '|' ' ')"
  ra db.tables "$sb"
  ra db.rows   "$sr"
  mg="$(timeout 20 psql "$URL" -Atc \
    "select count(*) from _prisma_migrations where finished_at is not null;" 2>/dev/null || echo '(khong co bang)')"
  ra db.migrations "$mg"
fi
