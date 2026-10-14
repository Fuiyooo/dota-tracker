# Dota 2 Tracker — TODO List

Target project: `~/Projects/dota-tracker`
Sumber data: **OpenDota** (profil, match, hero) + **STRATZ** (MMR/rank granular)
Bentuk: Web app React + backend API sendiri
Stack: TypeScript / Node.js
Cakupan: multi-akun, search bebas

---

## 0. Persiapan & Prasyarat

- [x] Siapkan **Steam Web API key** (https://steamcommunity.com/dev/apikey) — untuk resolve vanity URL + `GetPlayerSummaries` → sudah di `.env`, terverifikasi (GetPlayerSummaries balas HTTP 200)
- [x] Siapkan **STRATZ API token** (login Steam/Discord di https://stratz.com/api) → sudah di `.env`, berlaku sampai 2027-10-14. **Wajib kirim header `User-Agent`**, tanpa itu Cloudflare balas HTTP 403 "Just a moment..."
- [x] Pastikan Node.js >= 20 terpasang → v26.10.0
- [x] Pastikan pnpm terpasang → v12.11.2 via `npm i -g pnpm`. Catatan: Node 26 tidak lagi membundel `corepack`, jadi `corepack enable pnpm` tidak tersedia
- [x] Pastikan Docker + Docker Compose terpasang → Docker 29.9.0 + Compose 5.6.0. **Tidak dipakai untuk DB**; memakai PostgreSQL 18.6 native (`postgresql.service`) karena port 5432 sudah terpakai
- [x] Pastikan akun Dota target mengaktifkan *"Expose Public Match Data"* → `recentMatches` terisi 20 match (terbaru 2026-10-13)

**Akun uji:** account_id `1061259054` · SteamID64 `76561199021524782` · "Nyenyenye" — Archon 1, `computed_mmr` ≈ 3960, 462W/496L

---

## 1. Skeleton Monorepo

- [x] Buat folder `~/Projects/dota-tracker`
- [x] Init `pnpm-workspace.yaml`
- [x] Buat struktur:
  - `apps/api` — Fastify + TypeScript
  - `apps/web` — React + Vite (masih placeholder, diisi Bagian 9)
  - `packages/shared` — tipe + zod schema
  - `drizzle/` — migrasi DB
  - `docker-compose.yml` → **ditunda ke Bagian 12** (DB pakai Postgres native)
- [x] Setup `tsconfig.base.json`. Catatan: tanpa `paths`/`baseUrl` — resolusi `@dota/shared` lewat symlink workspace + `exports`/`types`; TypeScript 7 sudah menghapus `baseUrl`
- [ ] Setup ESLint + Prettier → Prettier ✓ (`.prettierrc.json`), **ESLint ditunda** sampai ada kode nyata
- [x] Setup `.gitignore` (node_modules, .env, *.db, dist)
- [x] Init git repo + commit awal
- [x] Setup `.env.example`:
  - `DATABASE_URL`
  - `STEAM_API_KEY`
  - `OPENDOTA_API_KEY` (opsional)
  - `STRATZ_TOKEN`
  - `PORT`
  - `SYNC_INTERVAL_CRON`

---

## 2. Package `shared`

- [x] Definisi tipe domain: `Player`, `Match`, `MatchPlayer`, `Hero`, `MmrSnapshot` (zod schema + `z.infer`, satu file per domain)
- [x] Zod schema untuk request/response API (`src/api.ts`: param `:accountId`, pagination, search, body track)
- [x] Enum `MmrSource = 'stratz' | 'estimate'` (`mmrSourceSchema` di `src/mmr.ts`)
- [x] Helper konversi SteamID (`src/steam-id.ts`, wajib **BigInt** karena SteamID64 > `Number.MAX_SAFE_INTEGER`):
  - [x] `steamId64ToAccountId()` (kurangi `76561197960265728`)
  - [x] `accountIdToSteamId64()`
  - [x] Deteksi format input (account_id / steamid64 / vanity URL / SteamID3 / URL OpenDota)
- [x] Konstanta rank tier -> label medal (Herald..Immortal + leaderboard) (`src/ranks.ts`)
- [x] Ekstra: unit test vitest untuk SteamID + rank (19 tes) — dimajukan dari Bagian 11

---

## 3. Database & Migrasi

- [ ] Init Drizzle ORM + konfigurasi driver (SQLite dev -> Postgres prod)
- [ ] Buat tabel:
  - [ ] `players` (account_id PK, steam_id64, personaname, avatar, rank_tier, leaderboard_rank, computed_mmr, tracking_enabled, last_synced_at)
  - [ ] `matches` (match_id PK, start_time, duration, radiant_win, game_mode, lobby_type, average_rank, radiant_score, dire_score)
  - [ ] `match_players` (match_id, account_id, hero_id, is_radiant, player_slot, kills, deaths, assists, gpm, xpm, last_hits, hero_damage, hero_healing, mmr_before, mmr_after, mmr_delta, mmr_source) PK(match_id, account_id)
  - [ ] `heroes` (hero_id PK, name, localized_name, img, primary_attr, roles)
  - [ ] `mmr_snapshots` (id PK, account_id, recorded_at, rank_tier, leaderboard_rank, computed_mmr, source)
  - [ ] `sync_logs` (id PK, account_id, scope, started_at, finished_at, status, error)
- [ ] Buat index: `match_players(account_id, hero_id)`, `mmr_snapshots(account_id, recorded_at)`, `matches(start_time)`
- [ ] Generate + jalankan migrasi pertama
- [ ] Seed data hero dari OpenDota `/heroStats`

---

## 4. Integrasi OpenDota

- [ ] HTTP client (`undici`) + wrapper retry + rate limiter (`p-queue`/`bottleneck`)
- [ ] Batas: 60 req/menit, 2000/hari (free tier)
- [ ] Endpoint client:
  - [ ] `GET /players/{account_id}` -> profil, rank_tier, leaderboard_rank, computed_mmr
  - [ ] `GET /search?q=` -> resolve akun
  - [ ] `GET /players/{id}/matches` + `/recentMatches`
  - [ ] `GET /players/{id}/heroes` + `/wl`
  - [ ] `GET /matches/{match_id}`
  - [ ] `GET /heroStats` (cache 24 jam)
- [ ] Cache layer (TTL): profil 10 menit, matches 2 menit, heroStats 24 jam, detail match permanen
- [ ] Logging + error handling terpusat

---

## 5. Integrasi STRATZ

- [ ] Setup GraphQL client + auth header token. **Header `User-Agent` wajib** (mis. `dota-tracker/0.1 (+https://github.com/Fuiyooo/dota-tracker)`); tanpa itu Cloudflare balas HTTP 403 "Just a moment..." — itu bukan tanda token salah
- [x] Auth token terverifikasi: `{ player(steamAccountId: 22202) { steamAccountId } }` → HTTP 200
- [ ] **Verifikasi schema via GraphiQL** — konfirmasi field MMR per match:
  - [ ] `player(steamAccountId)` -> rank, seasonRank, mmr
  - [ ] `player.matches` -> list match
  - [ ] `match(id).players` -> apakah ada `mmrBefore`/`mmrAfter`/delta
- [ ] Dokumentasikan field yang tersedia di `packages/shared` (komentar)
- [ ] Fallback: jika MMR per match tidak tersedia, andalkan snapshot (bagian 7)

---

## 6. Sync Layer

- [ ] `syncHeroes()` — upsert daftar hero
- [ ] `syncPlayerProfile(accountId)` — upsert profil + rank
- [ ] `syncPlayerMatches(accountId)` — inkremental (simpan match_id terakhir)
- [ ] `syncMatchDetail(matchId)` — simpan match + match_players
- [ ] Isi `mmr_delta` dari STRATZ bila tersedia (`mmr_source='stratz'`)
- [ ] Tulis `sync_logs` tiap run (status, error)
- [ ] Dedup / idempotent upsert

---

## 7. MMR Snapshot Job

- [ ] Job `snapshotMmr()`: ambil `computed_mmr` + rank tiap akun yang `tracking_enabled`
- [ ] Simpan ke `mmr_snapshots` (`source='estimate'`)
- [ ] Hitung delta antar snapshot, atribusi ke match terakhir
- [ ] Scheduler `node-cron` (interval dari `SYNC_INTERVAL_CRON`)
- [ ] (Opsional) Migrasi ke BullMQ + Redis untuk job queue

---

## 8. Backend API (Fastify)

- [ ] Setup server + plugin (cors, helmet, rate limit, error handler)
- [ ] Route:
  - [ ] `GET /players/search?q=` — account_id / steamid64 / vanity
  - [ ] `GET /players/:accountId` — profil + rank + mmr terkini
  - [ ] `GET /players/:accountId/matches` — paginated
  - [ ] `GET /players/:accountId/heroes` — winrate per hero
  - [ ] `GET /players/:accountId/summary` — winrate, streak, top heroes
  - [ ] `GET /players/:accountId/mmr-history`
  - [ ] `POST /players` — mulai tracking
  - [ ] `POST /players/:accountId/sync` — trigger sync manual
  - [ ] `GET /sync/status`
- [ ] Validasi zod di semua route
- [ ] Dokumentasi OpenAPI (Swagger) opsional

---

## 9. Frontend (React + Vite)

- [ ] Setup Vite + React + TailwindCSS + TanStack Query
- [ ] Routing (React Router)
- [ ] Halaman Search
  - [ ] Input bebas (account_id / steamid64 / URL)
  - [ ] Hasil + tombol "Track"
- [ ] Halaman Profil
  - [ ] Kartu profil (avatar, nama, rank medal, leaderboard rank)
  - [ ] Grafik MMR history (Recharts/ECharts) dengan label **resmi vs estimasi**
  - [ ] Ringkasan: winrate total, streak, top 5 hero
- [ ] Halaman Match
  - [ ] Tabel match (hero, K/D/A, GPM/XPM, durasi, menang/kalah, party size)
  - [ ] Filter by hero / hasil
  - [ ] Detail match (opsional)
- [ ] Hero Pool view
  - [ ] Winrate + jumlah game per hero
  - [ ] Sorting
- [ ] Daftar akun yang di-track (multi-akun)
- [ ] Indikator loading/error/cache

---

## 10. Multi-Akun & Scheduler

- [ ] Tabel `players.tracking_enabled` + endpoint toggle
- [ ] Loop scheduler untuk semua akun yang di-track
- [ ] Backoff untuk akun yang gagal (private match data)
- [ ] Batas konkurensi agar tidak kena rate limit

---

## 11. Testing & Kualitas

- [x] Unit test: helper SteamID, parsing rank tier → 19 tes vitest di `packages/shared`
- [ ] Unit test: TTL cache
- [ ] Unit test: client OpenDota/STRATZ (mock HTTP)
- [ ] Integration test: endpoint API (SQLite in-memory)
- [ ] Test idempotensi sync
- [ ] CI (GitHub Actions): lint + typecheck + test

---

## 12. Deployment & Ops

- [ ] `docker-compose.yml`: Postgres + Redis + api + web
- [ ] Build produksi `apps/web` (static) + `apps/api`
- [ ] Env produksi + secrets
- [ ] Migrasi otomatis saat start
- [ ] Health check endpoint
- [ ] Logging terstruktur (pino)

---

## 13. Risiko & Catatan

- [ ] **Wajib**: target player harus mengaktifkan *Expose Public Match Data*, kalau tidak data baru tidak muncul
- [ ] Field `average_rank` OpenDota bisa `null`; `/players/{id}/ratings` bisa kosong -> STRATZ jadi andalan MMR
- [ ] MMR per match dari Valve **tidak ada**; semua angka MMR adalah STRATZ atau estimasi
- [ ] Field MMR STRATZ harus diverifikasi di GraphiQL sebelum diandalkan
- [ ] ToS: pemakaian pribadi, wajib cache + atribusi OpenDota/STRATZ; jangan resell data
- [ ] Volume besar -> pertimbangkan OpenDota API key/patron & perhatikan limit STRATZ

---

## Urutan Pengerjaan (Milestone)

1. [ ] Skeleton monorepo + skema DB + migrasi + env config
2. [ ] OpenDota client + sync hero + resolve/search akun + endpoint profil
3. [ ] Sync match + list match + stats per hero
4. [ ] Job snapshot MMR + endpoint history
5. [ ] Integrasi STRATZ (verifikasi schema + MMR per match)
6. [ ] Frontend: search, profil, grafik MMR, tabel match & hero pool
7. [ ] Multi-akun tracking + scheduler + polish + error handling
