# Dota 2 Tracker

Pelacak statistik Dota 2 pribadi: cari pemain, pantau rank/MMR, lihat daftar match dan hero pool.

Sumber data:

- **OpenDota** — profil, rank, match, daftar hero, estimasi MMR.
- **STRATZ** — histori rank (GraphQL, wajib HTTP/2).
- **Steam Web API** — resolusi vanity URL.

## Prasyarat

- Node.js >= 22.19 (dibutuhkan oleh `undici` 8.x — `zlib.createZstdDecompress` baru ada di Node 22.15+)
- pnpm 12 (`npm i -g pnpm`)
- PostgreSQL 16+ — native, atau lewat Docker

## Development

> Baru pertama kali `git clone` di mesin baru? Ikuti langkah lengkapnya di
> **[SETUP.md](SETUP.md)** — dari memasang prasyarat sampai aplikasi jalan.

### Cara tercepat

```sh
./start.sh          # atau: pnpm dev:all
```

Skrip itu melakukan semuanya: cek Node & pnpm, menyiapkan `.env` bila belum ada,
memastikan PostgreSQL hidup, menerapkan migrasi, mengisi daftar hero bila masih
kosong, membebaskan port 3001/5173 dari proses lama proyek ini, lalu menjalankan
API + web dan membuka browser. Hentikan dengan `Ctrl+C`.

Kalau tidak ingin browser terbuka otomatis:

```sh
NO_OPEN=1 ./start.sh
```

### Langkah manual (kalau ingin tahu detailnya)

```sh
pnpm install
cp .env.example .env          # isi STEAM_API_KEY & STRATZ_TOKEN
pnpm db:migrate               # buat/ubah tabel
pnpm db:seed                  # isi daftar hero (127 baris)
pnpm dev                      # API :3001 + web :5173
```

Buka <http://localhost:5173>.

> Pakai `localhost`, bukan `127.0.0.1` — Vite bind ke IPv6 (`[::1]`).

### Script yang sering dipakai

| Perintah | Fungsi |
| --- | --- |
| `pnpm dev` | API + web + watcher `shared` sekaligus |
| `pnpm typecheck` | `tsc` untuk API, web, dan shared |
| `pnpm lint` | ESLint |
| `pnpm test` | tes shared + API, butuh database uji |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm db:generate` | Buat file migrasi dari perubahan skema |
| `pnpm db:migrate` | Terapkan migrasi |
| `pnpm db:seed` | Upsert daftar hero |
| `pnpm --filter @dota/api sync <accountId>` | Sync profil + match + snapshot satu akun |
| `pnpm --filter @dota/api sync --scheduler-once` | Jalankan satu putaran scheduler manual |
| `pnpm --filter @dota/api sync <id> --backfill-ranks` | Impor histori rank STRATZ |

Tes integrasi memakai database terpisah. Buat sekali:

```sh
sudo -u postgres createdb -O dota dota_tracker_test
```

## Struktur

```
apps/api      Fastify + Drizzle ORM + client OpenDota/STRATZ/Steam
apps/web      React + Vite + Tailwind + TanStack Query
packages/shared  tipe, schema zod, helper SteamID & rank
drizzle/      migrasi SQL
```

## Produksi (Docker)

```sh
docker compose up -d --build
```

- Web: <http://localhost:8080>
- API: <http://localhost:3001/api/health>
- Postgres: `localhost:5433` (5433 karena 5432 sering sudah dipakai Postgres native)
- Migrasi dijalankan otomatis saat container API start (`RUN_MIGRATIONS=true`)
- nginx meneruskan `/api` ke container `api`, jadi tidak perlu konfigurasi CORS

Kredensial dibaca dari `.env` di root (tidak ikut ter-commit).

## Deploy ke cloud

Panduan lengkap ada di **[DEPLOY.md](DEPLOY.md)**.

Ringkasnya: `apps/web` ke **Vercel** (static), `apps/api` ke **Railway/Render/Fly**
(butuh proses panjang untuk scheduler dan cache), database ke **Neon/Supabase**.

Frontend membaca `VITE_API_BASE` saat build:

```sh
VITE_API_BASE=https://api-kamu.up.railway.app/api
```

Kalau variabel itu kosong, frontend memakai `/api` (cocok untuk dev dan untuk
mode rewrite di Vercel).

Isi daftar hero sekali setelah stack hidup (database container terpisah dari database dev):

```sh
docker compose exec api node apps/api/dist/sync/run.js --heroes
```

Data pemain diambil saat kamu menekan **Track** di aplikasi, atau manual:

```sh
docker compose exec api node apps/api/dist/sync/run.js <accountId>
```

## Catatan data

- **MMR tidak resmi.** Valve tidak menyediakan MMR per match, dan STRATZ juga tidak
  (`MatchPlayerType` tidak punya field MMR). Grafik di halaman pemain menampilkan
  **histori medal** (`rank_tier` — data resmi Valve). Angka `MMR ≈` adalah heuristik:
  titik tengah bracket medal (±154 MMR per bintang) digeser `(menang - kalah) × 25`,
  dibatasi ±154, dan hanya menghitung match Ranked (Turbo punya pool MMR sendiri).
  `computed_mmr` dari OpenDota tetap disimpan sebagai pembanding, tetapi tidak
  ditampilkan karena sering tidak cocok dengan medal.
- **Target player harus mengaktifkan "Expose Public Match Data"**, kalau tidak
  match baru tidak akan muncul di OpenDota.
- Pemain dengan profil privat tidak punya `account_id` di detail match, sehingga
  barisnya dilewati saat menulis `match_players`.
- Pemakaian pribadi. Hormati batas OpenDota (60 permintaan/menit, 2000/hari).
