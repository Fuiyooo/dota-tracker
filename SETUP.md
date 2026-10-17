# Setup dari Nol

Panduan untuk siapa pun yang baru `git clone` repo ini dan ingin menjalankannya di
komputernya sendiri. Sekali setup ±15 menit; setelah itu cukup `./start.sh` tiap
kali mau dipakai.

Repo: <https://github.com/Fuiyooo/dota-tracker> (publik, tidak perlu minta akses).

Semua data tersimpan di PostgreSQL milikmu sendiri. Tidak ada server bersama, dan
kunci API temanmu tidak pernah keluar dari mesinmu.

---

## 1. Pasang prasyarat

### Node.js 22.19 atau lebih baru (wajib)

```sh
node -v      # harus v22.19.0+
```

Kalau masih v20 atau lebih lama — **tidak akan jalan**, lihat catatan di bawah.
Cara pasang:

- Unduh dari <https://nodejs.org> (pilih LTS terbaru), atau
- Pakai version manager:

  ```sh
  # fnm
  curl -fsSL https://fnm.vercel.app/install | bash
  fnm install 22 && fnm use 22
  ```

> **Kenapa 22.19?** Paket `undici` 8.x memakai `zlib.createZstdDecompress`, yang
> baru ada di Node 22.15. Di Node 20 API langsung mati dengan pesan
> `TypeError: Cannot read properties of undefined (reading 'bind')`.

### pnpm

```sh
npm i -g pnpm@12
pnpm -v      # harus 12.x
```

### PostgreSQL 16+

Pilih salah satu.

**Arch / CachyOS**

```sh
sudo pacman -S postgresql
sudo -u postgres initdb -D /var/lib/postgres/data   # hanya kalau direktori data masih kosong
sudo systemctl enable --now postgresql
```

**Debian / Ubuntu**

```sh
sudo apt update && sudo apt install -y postgresql
sudo systemctl enable --now postgresql
```

**macOS (Homebrew)**

```sh
brew install postgresql@18
brew services start postgresql@18
```

**Docker** (kalau tidak ingin memasang Postgres native)

```sh
docker run -d --name dota-pg \
  -e POSTGRES_USER=dota \
  -e POSTGRES_PASSWORD=dota \
  -e POSTGRES_DB=dota_tracker \
  -p 5432:5432 \
  postgres:17-alpine
```

Kalau memakai Docker, **lewati Langkah 2** — user dan database sudah dibuat otomatis.

Windows: pakai WSL2 dan ikuti petunjuk Debian/Ubuntu di atas.

---

## 2. Siapkan database (lewati kalau pakai Docker)

```sh
sudo -u postgres psql -c "CREATE ROLE dota LOGIN PASSWORD 'dota';"
sudo -u postgres createdb -O dota dota_tracker
```

Cek koneksinya:

```sh
psql 'postgres://dota:dota@localhost:5432/dota_tracker' -c 'select 1'
```

Harus membalas `1 row`. Kalau diminta password dan `dota` ditolak, berarti role
`dota` sudah ada dengan password lain — ganti passwordnya dengan
`ALTER ROLE dota PASSWORD 'dota';`.

Opsional, hanya kalau mau menjalankan `pnpm test`:

```sh
sudo -u postgres createdb -O dota dota_tracker_test
```

---

## 3. Ambil dua kunci API (gratis, ±3 menit)

| Variabel | Dari mana | Wajib? | Dipakai untuk |
| --- | --- | --- | --- |
| `STEAM_API_KEY` | <https://steamcommunity.com/dev/apikey> | ya | resolusi vanity URL & pencarian nama pemain |
| `STRATZ_TOKEN` | <https://stratz.com/api> | ya | histori rank dari STRATZ |
| `OPENDOTA_API_KEY` | <https://www.opendota.com/api-keys> | tidak | menaikkan limit OpenDota |

- **Steam**: login, isi kolom *Domain Name* dengan `localhost`, lalu salin key-nya.
- **STRATZ**: login pakai Steam, buat token di halaman API, salin.
- **OpenDota**: opsional. Tanpa key, limit 60 permintaan/menit & 2000/hari — masih
  cukup untuk pemakaian pribadi.

API akan **menolak start** kalau `STEAM_API_KEY` atau `STRATZ_TOKEN` kosong, jadi
jangan lewatkan langkah ini.

---

## 4. Clone dan install

```sh
git clone https://github.com/Fuiyooo/dota-tracker.git
cd dota-tracker
pnpm install
cp .env.example .env
```

---

## 5. Isi `.env`

Buka `.env`, isi dua baris ini:

```env
STEAM_API_KEY=tempel-di-sini
STRATZ_TOKEN=tempel-di-sini
```

Sisanya biarkan apa adanya. Arti variabel lainnya:

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://dota:dota@localhost:5432/dota_tracker` | sesuaikan kalau kredensial Postgres-mu beda |
| `OPENDOTA_API_KEY` | kosong | opsional |
| `PORT` | `3001` | port API |
| `HOST` | `127.0.0.1` | alamat bind. Untuk container wajib `0.0.0.0` |
| `SYNC_INTERVAL_CRON` | `*/30 * * * *` | jadwal sync otomatis |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `CORS_ORIGIN` | kosong | tidak perlu diisi untuk dev (web lewat proxy Vite) |
| `RATE_LIMIT_MAX` | `120` | batas permintaan/menit ke API sendiri |
| `RUN_MIGRATIONS` | `false` | hanya dipakai container produksi |

`.env` sudah masuk `.gitignore`. Jangan pernah menempel kunci API ke tempat lain
yang ikut ter-commit.

---

## 6. Jalankan

```sh
./start.sh
```

Skrip itu mengerjakan semuanya, berurutan:

1. cek Node & pnpm
2. pastikan `.env` ada dan `STEAM_API_KEY` + `STRATZ_TOKEN` sudah terisi
3. hubungkan PostgreSQL (kalau servisnya mati, dicoba `systemctl start postgresql`)
4. terapkan migrasi
5. isi 127 daftar hero dari OpenDota kalau tabel `heroes` masih kosong
6. bebaskan port 3001/5173 dari proses lama repo ini
7. jalankan API + web, lalu buka browser

Tidak ingin browser terbuka otomatis:

```sh
NO_OPEN=1 ./start.sh
```

Buka **<http://localhost:5173>**.

> Pakai `localhost`, bukan `127.0.0.1`. Vite bind ke IPv6 (`[::1]`), jadi
> `127.0.0.1:5173` tidak akan menyahut.

Hentikan dengan `Ctrl+C`.

---

## 7. Pastikan berhasil

```sh
curl http://127.0.0.1:3001/api/health
# {"ok":true,"database":"up","opendota":{...},"cacheSize":0,"uptimeSeconds":...}

curl http://localhost:5173/api/health     # lewat proxy Vite, hasilnya sama
```

Di halaman web, baris status di bagian atas harus menampilkan kuota OpenDota dan
jumlah pemain terlacak — bukan tulisan **API offline**.

---

## 8. Mulai pakai

1. Ketik nama pemain, SteamID64, atau vanity URL di kolom cari.
2. Pilih hasilnya, tekan **Track**.
3. Klik pemainnya untuk membuka profil: rank history, tabel match, hero pool.
4. Tekan **Sync now** untuk menarik match terbaru. Selain itu scheduler berjalan
   sendiri tiap 30 menit.

**Syarat di sisi pemain yang dilacak:** pengaturan *Expose Public Match Data* harus
aktif. Kalau tidak, match barunya tidak akan pernah muncul di OpenDota — berlaku
juga untuk profilmu sendiri.

---

## Alternatif tanpa `start.sh`

Kalau ingin menjalankan tahapannya sendiri:

```sh
pnpm db:migrate     # buat tabel (6 tabel)
pnpm db:seed        # isi daftar hero
pnpm dev            # API :3001 + web :5173 + watcher shared sekaligus
```

---

## Perintah yang sering dipakai

| Perintah | Fungsi |
| --- | --- |
| `./start.sh` | cara tercepat: cek semua, migrasi, jalankan |
| `pnpm dev` | API + web + watcher `shared` |
| `pnpm typecheck` | `tsc` untuk API, web, dan shared |
| `pnpm test` | tes shared + API (butuh database `dota_tracker_test`) |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm db:generate` | buat file migrasi baru dari perubahan skema |
| `pnpm db:migrate` | terapkan migrasi |
| `pnpm db:seed` | upsert daftar hero |
| `pnpm --filter @dota/api sync <accountId>` | sync profil + match + snapshot satu akun |
| `pnpm --filter @dota/api sync --scheduler-once` | jalankan satu putaran scheduler manual |
| `pnpm --filter @dota/api sync <accountId> --backfill-ranks` | impor histori rank dari STRATZ |

---

## Kalau ada masalah

| Gejala | Sebabnya | Solusinya |
| --- | --- | --- |
| `Node.js tidak ditemukan` | Node belum terpasang / tidak di `PATH` | pasang Node 22.19+ |
| `Cannot read properties of undefined (reading 'bind')` | Node < 22.15 | naikkan Node ke 22.19+ |
| `ERR_PNPM_UNSUPPORTED_ENGINE` | Node terlalu lama | idem, naikkan Node |
| `STEAM_API_KEY masih kosong di .env` | kunci belum diisi | isi `.env`, tanpa spasi atau tanda kutip |
| `psql tidak ditemukan` | klien Postgres tidak ada | `sudo pacman -S postgresql` / `sudo apt install postgresql-client` |
| `PostgreSQL tidak bisa dihubungi` | servis mati atau URL salah | `sudo systemctl start postgresql`, cek `DATABASE_URL` |
| `database "dota_tracker" does not exist` | database belum dibuat | `sudo -u postgres createdb -O dota dota_tracker` |
| `role "dota" does not exist` | role belum dibuat | lihat Langkah 2 |
| `port 5432 ... No such file or directory` (Arch) | `initdb` belum dijalankan | `sudo -u postgres initdb -D /var/lib/postgres/data`, lalu start servis |
| `Port 3001 dipakai proses lain (pid ...)` | ada program lain di port itu | hentikan proses tersebut; `start.sh` hanya menghentikan proses milik repo ini |
| Halaman putih di `127.0.0.1:5173` | bukan alamat Vite | buka `http://localhost:5173` |
| Status bar bilang **API offline** | API tidak jalan | `curl http://127.0.0.1:3001/api/health`, cek log `Ctrl+C` sebelumnya |
| Pencarian pemain selalu kosong | `STEAM_API_KEY` salah atau vanity URL salah | uji manual: `pnpm --filter @dota/api sync <accountId>` |
| Match baru tidak muncul | pemain tidak expose public match data, atau OpenDota belum ter-update | aktifkan di pengaturan Dota; OpenDota butuh ±15 menit |
| Daftar hero kosong | seed belum jalan | `pnpm db:seed` |
| MMR beda dengan in-game | Valve tidak mempublikasikan MMR | medal/rank yang resmi; angka MMR di aplikasi ini perkiraan dari bracket medal |

Log API tampil langsung di terminal `./start.sh`. Set `LOG_LEVEL=debug` di `.env`
kalau butuh lebih detail.

---

## Mulai ulang dari database kosong

```sh
psql 'postgres://dota:dota@localhost:5432/dota_tracker' \
  -c 'drop schema public cascade; create schema public;'
pnpm db:migrate
pnpm db:seed
```

---

## Catatan

- Ini **pemakaian pribadi**. Hormati batas OpenDota (60 permintaan/menit, 2000/hari);
  batas itu naik kalau `OPENDOTA_API_KEY` diisi.
- Pemain dengan profil privat tidak punya `account_id` di detail match, jadi barisnya
  dilewati saat menulis `match_players`.
- Ingin deploy ke internet, bukan jalan lokal? Lihat [DEPLOY.md](DEPLOY.md).
