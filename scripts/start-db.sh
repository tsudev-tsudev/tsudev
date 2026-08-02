#!/usr/bin/env bash
# Khởi động Postgres cluster user-space cho local dev (không cần Docker/sudo).
# Idempotent: init cluster nếu chưa có, start nếu chưa chạy, tạo DB tsudev.
set -e

PGDATA="${TSUDEV_PGDATA:-$HOME/.tsudev/pgdata}"
PGPORT="${TSUDEV_PGPORT:-5433}"
PGSOCK="${TSUDEV_PGSOCK:-/tmp}"
PGUSER="tsudev"
PGPASS="tsudev"
PGDB="tsudev"

# Tìm postgres binaries (Ubuntu đặt trong /usr/lib/postgresql/<ver>/bin)
if ! command -v pg_ctl >/dev/null 2>&1; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
  export PATH="$PGBIN:$PATH"
fi

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[db] initializing cluster at $PGDATA"
  mkdir -p "$(dirname "$PGDATA")"
  echo "$PGPASS" > /tmp/.tsudev_pw
  initdb -D "$PGDATA" -U "$PGUSER" --auth=scram-sha-256 --pwfile=/tmp/.tsudev_pw >/dev/null
  rm -f /tmp/.tsudev_pw
  grep -q "^port = $PGPORT" "$PGDATA/postgresql.conf" || echo "port = $PGPORT" >> "$PGDATA/postgresql.conf"
fi

if pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "[db] already running"
else
  echo "[db] starting on port $PGPORT"
  pg_ctl -D "$PGDATA" -l "$HOME/.tsudev/pg.log" \
    -o "-p $PGPORT -k $PGSOCK -c listen_addresses='localhost'" -w start >/dev/null
fi

export PGPASSWORD="$PGPASS"
if ! psql -h localhost -p "$PGPORT" -U "$PGUSER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PGDB'" | grep -q 1; then
  createdb -h localhost -p "$PGPORT" -U "$PGUSER" "$PGDB"
  echo "[db] created database $PGDB"
fi
echo "[db] ready: postgresql://$PGUSER:***@localhost:$PGPORT/$PGDB"
