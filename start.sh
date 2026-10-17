#!/usr/bin/env bash
# Jalankan seluruh stack development dengan satu perintah:  ./start.sh
# (bisa juga lewat: pnpm start)
#
# Yang dilakukan, berurutan:
#   1. cek Node & pnpm
#   2. pastikan .env ada dan berisi kunci API
#   3. pastikan PostgreSQL hidup, terapkan migrasi, isi hero bila masih kosong
#   4. bebaskan port 3001/5173 dari proses lama proyek ini
#   5. jalankan API + web, lalu buka browser
#
# Env opsional:
#   NO_OPEN=1   jangan buka browser otomatis
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BOLD=$'\033[1m'; DIM=$'\033[2m'; CYAN=$'\033[36m'; GREEN=$'\033[32m'
YELLOW=$'\033[33m'; RED=$'\033[31m'; RESET=$'\033[0m'

info() { printf '%s•%s %s\n' "$CYAN" "$RESET" "$1"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$1"; }
fail() { printf '%s✗%s %s\n' "$RED" "$RESET" "$1" >&2; exit 1; }

printf '\n%sDota 2 Tracker — dev startup%s\n\n' "$BOLD" "$RESET"

# --- 1. Prasyarat ---------------------------------------------------------
command -v node >/dev/null 2>&1 || fail "Node.js tidak ditemukan. Install Node >= 20."
command -v pnpm >/dev/null 2>&1 || fail "pnpm tidak ditemukan. Jalankan: npm i -g pnpm"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Butuh Node >= 20, sekarang $(node -v)."
fi
ok "Node $(node -v) · pnpm $(pnpm -v)"

# --- 2. .env --------------------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env dibuat dari .env.example."
  fail "Isi STEAM_API_KEY dan STRATZ_TOKEN di .env, lalu jalankan ./start.sh lagi."
fi

for key in STEAM_API_KEY STRATZ_TOKEN; do
  value="$(grep -E "^${key}=" .env | head -1 | cut -d= -f2- | tr -d '\r"' || true)"
  if [ -z "$value" ]; then
    fail "$key masih kosong di .env"
  fi
done
ok ".env lengkap"

DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed -E 's/^"(.*)"$/\1/' || true)"
[ -n "$DATABASE_URL" ] || fail "DATABASE_URL kosong di .env"

# --- 3. Database ----------------------------------------------------------
command -v psql >/dev/null 2>&1 || fail "psql tidak ditemukan (paket postgresql)."

if ! psql "$DATABASE_URL" -tAc 'select 1' >/dev/null 2>&1; then
  warn "PostgreSQL belum bisa dihubungi, mencoba menyalakan service…"
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start postgresql >/dev/null 2>&1 || true
    for _ in $(seq 1 15); do
      psql "$DATABASE_URL" -tAc 'select 1' >/dev/null 2>&1 && break
      sleep 1
    done
  fi
fi

if ! psql "$DATABASE_URL" -tAc 'select 1' >/dev/null 2>&1; then
  DB_NAME="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
  printf '\n' >&2
  fail "PostgreSQL tidak bisa dihubungi.
  URL: ${DATABASE_URL}

  Kalau servisnya mati:   sudo systemctl start postgresql
  Kalau database belum ada: sudo -u postgres createdb -O dota ${DB_NAME}"
fi
ok "PostgreSQL terhubung"

info "Menerapkan migrasi…"
if ! pnpm --silent db:migrate >/tmp/dota-tracker-migrate.log 2>&1; then
  cat /tmp/dota-tracker-migrate.log >&2
  fail "Migrasi gagal (lihat pesan di atas)."
fi
ok "Skema database siap"

HERO_COUNT="$(psql "$DATABASE_URL" -tAc 'select count(*) from heroes' 2>/dev/null || echo 0)"
if [ "$HERO_COUNT" = "0" ]; then
  info "Daftar hero masih kosong, mengambil dari OpenDota…"
  pnpm --silent db:seed >/dev/null 2>&1 || warn "Seed hero gagal; coba lagi dengan: pnpm db:seed"
fi

# --- 4. Port --------------------------------------------------------------
free_port() {
  local port="$1" pid args
  pid="$(ss -ltnp 2>/dev/null | grep ":$port " | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true)"
  [ -z "$pid" ] && return 0

  args="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  if printf '%s' "$args" | grep -qF "$ROOT"; then
    warn "Port $port dipakai proses lama proyek ini (pid $pid) — dihentikan."
    kill "$pid" 2>/dev/null || true
    sleep 1
  else
    fail "Port $port dipakai proses lain (pid $pid): $args"
  fi
}

free_port 3001
free_port 5173
ok "Port 3001 & 5173 siap"

# --- 5. Jalankan ----------------------------------------------------------
if [ "${NO_OPEN:-0}" != "1" ] && command -v xdg-open >/dev/null 2>&1; then
  (
    for _ in $(seq 1 60); do
      if curl -sf -o /dev/null http://localhost:5173/; then
        xdg-open http://localhost:5173/ >/dev/null 2>&1 || true
        break
      fi
      sleep 1
    done
  ) &
fi

printf '\n%sWeb%s  http://localhost:5173   %s(pakai "localhost", bukan 127.0.0.1)%s\n' \
  "$BOLD" "$RESET" "$DIM" "$RESET"
printf '%sAPI%s  http://127.0.0.1:3001/api/health\n' "$BOLD" "$RESET"
printf '%sHentikan dengan Ctrl+C.%s\n\n' "$DIM" "$RESET"

exec pnpm dev
