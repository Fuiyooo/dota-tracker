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

- [x] Init Drizzle ORM + konfigurasi driver → `drizzle-orm` + `postgres` (postgres.js) + `drizzle-kit`. Postgres native dipakai untuk dev **dan** prod (bukan SQLite dev → Postgres prod)
- [x] Buat tabel:
  - [x] `players` (account_id PK, steam_id64, personaname, avatar, rank_tier, leaderboard_rank, computed_mmr, tracking_enabled, last_synced_at). Catatan: `computed_mmr` **double precision** (OpenDota mengirim desimal); `account_id` **bigint** (uint32 melebihi int4 — diperbaiki di Bagian 8)
  - [x] `matches` (match_id PK, start_time, duration, radiant_win, game_mode, lobby_type, average_rank, radiant_score, dire_score). Catatan: `match_id` **bigint** (match asli 9043331899 > batas integer 32-bit)
  - [x] `match_players` (match_id, account_id, hero_id, is_radiant, player_slot, kills, deaths, assists, gpm, xpm, last_hits, hero_damage, hero_healing, mmr_before, mmr_after, mmr_delta, mmr_source) PK(match_id, account_id). Tanpa FK ke `players`/`heroes` (1 match berisi 10 pemain; hero baru bisa muncul sebelum seed ulang)
  - [x] `heroes` (hero_id PK, name, localized_name, img, primary_attr, roles → `text[]`)
  - [x] `mmr_snapshots` (id PK, account_id, recorded_at, rank_tier, leaderboard_rank, computed_mmr, source)
  - [x] `sync_logs` (id PK, account_id, scope, started_at, finished_at, status, error)
- [x] Buat index: `match_players(account_id, hero_id)`, `mmr_snapshots(account_id, recorded_at)`, `matches(start_time)`
- [x] Generate + jalankan migrasi pertama → `drizzle/0000_abandoned_warbird.sql`, 6 tabel terpasang di `dota_tracker`
- [x] Seed data hero dari OpenDota `/heroStats` → 127 hero, idempoten (upsert)

---

## 4. Integrasi OpenDota

- [x] HTTP client (`undici`) + wrapper retry + rate limiter (`p-queue`) → `apps/api/src/opendota/client.ts`. Retry eksponensial (3 percobaan) untuk 429/5xx/error jaringan, menghormati header `Retry-After`
- [x] Batas: 60 req/menit, 2000/hari (free tier) → `PQueue` (intervalCap 60 / 60 detik, concurrency 2) + penghitung kuota harian yang melempar error sebelum kuota habis
- [x] Endpoint client:
  - [x] `GET /players/{account_id}` -> profil, rank_tier, leaderboard_rank, computed_mmr
  - [x] `GET /search?q=` -> resolve akun
  - [x] `GET /players/{id}/matches` + `/recentMatches`
  - [x] `GET /players/{id}/heroes` + `/wl`
  - [x] `GET /matches/{match_id}`
  - [x] `GET /heroStats` (cache 24 jam)
- [x] Cache layer (TTL): profil 10 menit, matches 2 menit, heroStats 24 jam, detail match permanen → `apps/api/src/cache.ts`, plus penggabungan permintaan bersamaan (5 request key sama = 1 HTTP) dan batas 500 entri
- [x] Logging + error handling terpusat → `apps/api/src/logger.ts` (JSON satu baris, level dari `LOG_LEVEL`) + kelas `OpenDotaError`
- [x] Setiap respons divalidasi zod sebelum dipakai (menangkap perubahan bentuk API lebih awal)

---

## 5. Integrasi STRATZ

**Sudah selesai.** Ringkasan hasil verifikasi:

- [x] Setup GraphQL client + auth header token → `apps/api/src/stratz/client.ts`. Header `User-Agent` **wajib** (tanpa itu Cloudflare balas 403 "Just a moment...", dan itu bukan tanda token salah)
- [x] **Temuan penting: STRATZ harus diakses lewat HTTP/2.** Cloudflare menantang setiap permintaan HTTP/1.1 dari Node. Diuji: `curl` (HTTP/2) → 200; `undici`/`fetch` → 403 walau header lengkap, walau `allowH2: true`, walau ALPN dipaksa `['h2']`; `node:http2` → 200 di semua varian header. Client memakai `node:http2`, **jangan** "dirapikan" jadi undici seperti client OpenDota
- [x] Auth token terverifikasi → HTTP 200
- [x] **Verifikasi schema (16 Okt 2026)** — root query type bernama `DotaQuery`:
  - `player(steamAccountId: Long) -> PlayerType`
  - `player.ranks -> [SteamAccountSeasonRankType]` = **DERET WAKTU** `{ seasonRankId, rank, isCore, asOfDateTime }` (akun uji: 49 entri sejak Mei 2021) + `player.leaderboardRanks`
  - `player.matches(request: PlayerMatchesRequestType) -> [MatchType]`
  - `match(id: Long) -> MatchType`
  - **TIDAK ADA `mmrBefore`/`mmrAfter`/`mmrDelta`.** `MatchPlayerType` punya 55 field, satu pun tidak menyangkut MMR
  - **Tidak ada angka MMR di seluruh schema.** Hanya `PlayerPerformanceType.mmrTier`/`mmrBracket` (tingkat, bukan nilai)
- [x] Dokumentasikan field yang tersedia (komentar) → di `apps/api/src/stratz/types.ts` dan `packages/shared/src/mmr.ts`
- [x] Fallback dikonfirmasi: **MMR per match memang tidak tersedia**, jadi MMR selalu `estimate` dari snapshot (Bagian 7)

**Temuan tambahan yang berguna:**

- `MatchType.averageRank` **sering `null`** (pada match uji: null), tetapi `actualRank` dan `rank` **terisi** (44) → pakai salah satu ini untuk mengisi `matches.average_rank`
- `player.ranks` adalah **histori rank ber-timestamp** → bisa langsung jadi grafik di Bagian 9, tanpa perlu job snapshot
- `rank` memakai pengkodean sama seperti `rank_tier` OpenDota (`medal*10 + bintang`). **Namun bisa tertinggal**: STRATZ bilang 35 (Crusader 5, entri terbaru Agustus 2026) sedangkan OpenDota bilang 41 (Archon 1) di Oktober 2026 → jadikan OpenDota sebagai acuan rank terkini
- STRATZ kadang membalas HTTP 200 dengan error internal sementara (`NPGSQL TIMEOUT` saat resolve `match`); client sudah menganggapnya layak di-retry

---

## 6. Sync Layer

**Selesai.** Kode di `apps/api/src/sync/`; CLI: `pnpm --filter @dota/api sync <accountId>`.

- [x] `syncHeroes()` — upsert daftar hero (`sync/heroes.ts`). `pnpm db:seed` kini memanggil ini
- [x] `syncPlayerProfile(accountId)` — upsert profil + rank (`sync/players.ts`). `tracking_enabled` sengaja **tidak** ikut ditimpa karena itu preferensi pengguna, bukan data OpenDota
- [x] `syncPlayerMatches(accountId)` — inkremental: hanya match yang belum ada di `match_players` milik pemain itu yang detail-nya diambil. Pemanggilan kedua terbukti mengambil **0 request** tambahan
- [x] `syncMatchDetail(matchId)` — simpan match + **kesepuluh** pemainnya (yang punya `account_id`)
- [x] `mmr_delta` dari STRATZ — **tidak bisa diisi**: verifikasi Bagian 5 membuktikan STRATZ tidak menyediakan MMR per match. `mmr_before`/`mmr_after`/`mmr_delta`/`mmr_source` dibiarkan `null` dan hal ini didokumentasikan di kode
- [x] Tulis `sync_logs` tiap run — `withSyncLog()` mencatat satu baris `running` lalu `success`/`error` beserta pesannya
- [x] Dedup / idempotent upsert — semua memakai `onConflictDoUpdate`
- [x] `average_rank` **dihitung** dari rata-rata `rank_tier` kesepuluh pemain, karena `/matches/{id}` tidak menyediakannya

**Hasil uji pada akun 1061259054:**

```
sync --heroes ......... 127 hero di-upsert
sync 1061259054 ....... profil Nyenyenye | rank_tier 41 | MMR 3935.88
                        20 diperiksa, 0 sudah ada, 20 baru disimpan
sync ulang ............ 20 diperiksa, 20 sudah ada, 0 baru disimpan  (idempoten)
DB .................... players=1 matches=20 match_players=146 sync_logs=3 (semua success)
average_rank .......... terisi (46, 43, 39, ...) - tadinya selalu kosong
```

---

## 7. MMR Snapshot Job

**Selesai** (kecuali BullMQ yang memang opsional).

- [x] Job `snapshotMmr()` — ambil `computed_mmr` + rank tiap akun yang `tracking_enabled` (`sync/mmr.ts`). Satu akun gagal **tidak** membatalkan batch; kegagalannya dikumpulkan di `failures`
- [x] Simpan ke `mmr_snapshots` (`source='estimate'`). Catatan: `computed_mmr` adalah **perkiraan** OpenDota, bukan MMR resmi — dan nilainya tidak selalu cocok dengan `rank_tier` (akun uji: Archon 1 tetapi 3935.88). `rank_tier`/`leaderboard_rank` sendiri andal karena dari Valve
- [x] Hitung delta antar snapshot + atribusi ke match terakhir → `listMmrHistory()` di `queries/mmr.ts`. Delta **tidak** disimpan di tabel (skema `mmr_snapshots` tidak punya kolomnya), melainkan dihitung terhadap snapshot sebelumnya, dan tiap entri diberi `match_id` match terakhir pemain pada/sebelum `recorded_at`
- [x] Scheduler `node-cron` dengan interval dari `SYNC_INTERVAL_CRON` (`scheduler.ts`, dijalankan dari `index.ts`). Memakai `noOverlap` supaya eksekusi tidak bertumpuk, dan `unref` agar timer tidak menahan proses saat shutdown
- [ ] (Opsional) Migrasi ke BullMQ + Redis untuk job queue
- [ ] (Opsional, dari temuan Bagian 5) Impor **histori rank STRATZ** ke `mmr_snapshots` dengan `source='stratz'` — akun uji punya 49 entri sejak 2021, ini bisa langsung mengisi grafik Bagian 9 tanpa menunggu snapshot menumpuk

**Hasil uji:**

```
sync --snapshot-mmr (ke-1) .. 1/1 akun tersimpan | MMR null -> 3935.88, rank_tier null -> 41
sync --snapshot-mmr (ke-2) .. 1/1 akun tersimpan | MMR 3935.88 -> 3935.88 (delta 0)
listMmrHistory(1061259054) .. 2 entri, entri pertama diatribusikan ke match 9047075077
server startup ............... {"msg":"scheduler dijalankan","cron":"*/30 * * * *","task":"snapshot-mmr"}
```

---

## 8. Backend API (Fastify)

> Sebagian dikerjakan saat pratinjau FE; **dilengkapi** di Bagian 8.

- [x] Setup server + plugin (cors, helmet, rate limit, error handler) — `@fastify/helmet` + `@fastify/rate-limit` aktif (terbukti dari header `content-security-policy`, `x-ratelimit-limit: 120`). **CORS hanya dinyalakan bila `CORS_ORIGIN` diisi** di `.env`, supaya tidak ada default longgar; saat dev FE lewat proxy Vite sehingga CORS tidak perlu
- [x] Route:
  - [x] `GET /players/search?q=` — menerima **account_id, SteamID64, SteamID3, URL profil, dan vanity** (via `ResolveVanityURL` Steam) selain nama. Respons membawa `resolved_from`. Bila vanity menunjuk akun tanpa profil OpenDota, otomatis jatuh ke pencarian nama
  - [x] `GET /players/:accountId` — **database lebih dulu**, jatuh ke OpenDota bila belum tersinkron. Respons membawa `source: 'database' | 'opendota'`
  - [x] `GET /players/:accountId/matches` — **database lebih dulu**, bentuk respons disamakan dengan jalur OpenDota
  - [x] `GET /players/:accountId/heroes` — winrate per hero dari database
  - [x] `GET /players/:accountId/summary` — `synced` (dari DB: winrate, streak, top 5 hero) + `lifetime` (dari OpenDota `/wl`)
  - [x] `GET /players/:accountId/mmr-history` — dari `listMmrHistory()`, menyertakan delta dan atribusi match
  - [x] `POST /players` — mulai tracking (resolusi + upsert profil + sync match awal; `match_limit: 0` untuk melewati)
  - [x] `POST /players/:accountId/sync` — trigger sync manual
  - [x] `GET /sync/status` — akun yang di-track, kuota OpenDota, 20 log terakhir
- [x] Validasi zod di semua route (param, query, dan body)
- [x] Ekstra: `GET /api/health` dan `GET /api/heroes` (dari Postgres)
- [ ] Dokumentasi OpenAPI (Swagger) opsional — belum, sengaja ditunda

**Bug skema yang ketemu & diperbaiki di sini:**

`account_id` bertipe `integer` (int4, maks 2 147 483 647) padahal SteamID64 mengizinkan sampai **4 294 967 295** (uint32) — dan `steamId64ToAccountId` di `@dota/shared` menerima rentang itu. Akibatnya `GET /players/4294967295` gagal dengan error query, bukan 404. Keempat kolom `account_id` (`players`, `match_players`, `mmr_snapshots`, `sync_logs`) diubah ke **bigint** lewat migrasi `drizzle/0001_*.sql`, dan `accountIdParamSchema` diberi batas atas uint32.

**Hasil uji:**

```
search account_id ...... resolved_from: account_id
search steamid64 ....... resolved_from: steamid64
search vanity URL ...... resolved_from: vanity  -> akun 22202 (Rabscuttle)
search nama ............ resolved_from: name    (fallback bekerja)
profil dari DB ......... source: database | rank_label "Archon 1"
profil akun lain ....... source: opendota
matches dari DB ........ party_size null, source: database
heroes ................. 20 match, winrate per hero (Zeus 2 game 1 menang 0.5)
summary ................ synced 20 match 10W/10L, streak win 2, top 5 hero
mmr-history ............ 2 entri dengan mmr_delta/rank_delta + match_id
POST /players .......... 201 (profil + tracking)
POST /players (nama) ... 404 + arahan memakai /players/search
POST /sync ............. alreadyStored 20, synced 0 (idempoten)
akun tidak ada ......... 404 (sebelumnya 500 karena bug skema)
accountId > uint32 ..... 400
```

---

## 9. Frontend (React + Vite)

> Sebagian sudah dikerjakan sebagai pratinjau "jalur vertikal tipis" (lihat Bagian 8).

- [x] Setup Vite + React + TailwindCSS + TanStack Query
- [ ] Routing (React Router) — belum, masih satu halaman
- [ ] Halaman Search
  - [ ] Input bebas (account_id / steamid64 / URL) → sekarang hanya menerima **nama**
  - [ ] Hasil + tombol "Track" → hasil sudah bisa diklik untuk membuka profil; tombol Track menyusul (butuh `POST /players`)
- [ ] Halaman Profil
  - [x] Kartu profil (avatar, nama, rank medal) — `leaderboard_rank` belum ditampilkan
  - [ ] Grafik MMR history (Recharts/ECharts) dengan label **resmi vs estimasi**
  - [ ] Ringkasan: winrate total, streak, top 5 hero
- [ ] Halaman Match
  - [x] Tabel match (hero + gambar, K/D/A, GPM, XPM, durasi, menang/kalah) — kolom party size belum
  - [ ] Filter by hero / hasil
  - [ ] Detail match (opsional)
- [ ] Hero Pool view
  - [ ] Winrate + jumlah game per hero
  - [ ] Sorting
- [ ] Daftar akun yang di-track (multi-akun)
- [x] Indikator loading/error → sudah ada; indikator cache belum

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
- [ ] **`computed_mmr` dari OpenDota tidak cocok dengan `rank_tier`** — pada akun uji: `rank_tier` 41 (Archon 1) tetapi `computed_mmr` 3935.88, padahal Archon 1 biasanya ~2000–2500. Jangan tampilkan `computed_mmr` sebagai "MMR" sebelum diverifikasi di Bagian 7; STRATZ kemungkinan sumber yang lebih akurat
- [ ] `/matches/{id}` **tidak menyediakan** `average_rank` di level atas (beda dengan `/players/{id}/matches`) → harus dihitung dari rata-rata `rank_tier` pemain, atau dibiarkan `null`
- [ ] Di `/matches/{id}`, `players[].account_id` bisa **kosong** untuk pemain berprofil privat → baris tanpa `account_id` dilewati saat menulis `match_players`. **Jumlahnya banyak**: pada 20 match akun uji, hanya sebagian match yang lengkap 10 pemain — sisanya 3–7 pemain. Jadi `match_players` **tidak bisa** dipakai untuk mendeteksi party; pakai field `party_size` dari `/players/{id}/recentMatches`
- [ ] `/players/{id}/matches` tidak memuat `gpm`/`xpm`/`hero_damage` → kolom itu hanya bisa diisi dari `/matches/{id}` atau `/recentMatches`
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
