#!/usr/bin/env bash
# Menjalankan test database di cluster Postgres sementara (tanpa Docker/Supabase).
# Butuh binary Postgres (initdb, pg_ctl) di PATH atau di /usr/lib/postgresql/*/bin.
set -euo pipefail

PG_BIN="${PG_BIN:-}"
if [ -z "$PG_BIN" ]; then
  if command -v initdb >/dev/null 2>&1; then
    PG_BIN="$(dirname "$(command -v initdb)")"
  else
    PG_BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
  fi
fi
if [ -z "$PG_BIN" ] || [ ! -x "$PG_BIN/initdb" ]; then
  echo "initdb tidak ditemukan. Set PG_BIN atau pakai TEST_DATABASE_URL + npm run test:db." >&2
  exit 1
fi

PORT="${PGPORT_TEST:-54329}"
DATA_DIR="$(mktemp -d)"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  # Postgres menolak jalan sebagai root.
  id -u postgres >/dev/null 2>&1 || useradd -m postgres
  chown -R postgres "$DATA_DIR"
  RUN_AS=(su postgres -c)
fi

run() {
  if [ ${#RUN_AS[@]} -gt 0 ]; then "${RUN_AS[@]}" "$*"; else bash -c "$*"; fi
}

cleanup() {
  run "$PG_BIN/pg_ctl -D $DATA_DIR -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR"
}
trap cleanup EXIT

run "$PG_BIN/initdb -D $DATA_DIR -U postgres -A trust --no-sync" >/dev/null
run "$PG_BIN/pg_ctl -D $DATA_DIR -o '-p $PORT -k /tmp -c max_connections=200 -c fsync=off' -l $DATA_DIR/log -w start" >/dev/null

export TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/postgres"
npx vitest run --config vitest.db.config.mts "$@"
