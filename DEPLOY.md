# Deploy

Aplikasi ini terdiri dari dua bagian yang **tidak bisa disatukan di satu platform
static**:

| Bagian | Tempat yang disarankan | Alasan |
| --- | --- | --- |
| `apps/web` | **Vercel** | murni static, cocok dengan CDN Vercel |
| `apps/api` | **Railway / Render / Fly.io / VPS** | butuh proses panjang: scheduler 30 menit, cache in-memory permanen, backoff per akun |
| Database | **Neon / Supabase** | Vercel tidak menyediakan Postgres untuk proses panjang |

Ringkasnya: Vercel untuk frontend, container untuk backend.

---

## 1. Database

Buat project Postgres di [Neon](https://neon.tech) atau [Supabase](https://supabase.com),
lalu ambil connection string-nya. Pakai **pooled connection** (Neon: host yang
mengandung `-pooler`) dan tambahkan `?sslmode=require` bila belum ada:

```
postgres://user:password@ep-xxx-pooler.region.aws.neon.tech/dota_tracker?sslmode=require
```

Migrasi dan seed hero dijalankan otomatis oleh container API saat start
(`RUN_MIGRATIONS=true`), jadi tidak perlu langkah manual di sini.

## 2. Deploy API (Railway sebagai contoh)

1. **New Project → Deploy from GitHub repo**, pilih repo ini.
2. Builder: **Dockerfile**. Dockerfile Path: `apps/api/Dockerfile`.
   Build context harus **root repo** (Dockerfile menyalin seluruh workspace).
3. Isi environment variables:

   ```
   DATABASE_URL        postgres://...?sslmode=require
   STEAM_API_KEY       ...
   STRATZ_TOKEN        ...
   HOST                0.0.0.0
   RUN_MIGRATIONS      true
   LOG_LEVEL           info
   SYNC_INTERVAL_CRON  */30 * * * *
   ```

   `PORT` disuntikkan otomatis oleh Railway dan sudah dibaca aplikasi.

4. Deploy, lalu cek:

   ```sh
   curl https://<api-kamu>.up.railway.app/api/health
   # {"ok":true,"database":"up",...}
   ```

5. **Base URL API** yang dipakai frontend:

   ```
   https://<api-kamu>.up.railway.app/api
   ```

> Render: **New Web Service → Docker**, Dockerfile Path `apps/api/Dockerfile`,
> env sama. Fly.io: `fly launch` dengan Dockerfile tersebut.

## 3. Deploy web ke Vercel

1. **Add New → Project**, import repo yang sama.
2. **Root Directory: `apps/web`** ← penting, jangan root repo.
3. Framework Preset: **Vite** (terdeteksi otomatis).
4. **Build Command:**

   ```
   pnpm --filter @dota/shared build && pnpm --filter @dota/web build
   ```

   Langkah `@dota/shared` wajib: frontend mengimpor `RANK_MEDALS`,
   `describeMatchMode`, dan `estimateCurrentMmr` dari package itu.

5. **Output Directory:** `dist`
6. **Install Command:** biarkan default (`pnpm install`) — Vercel mendeteksi
   `pnpm-workspace.yaml` dan install dari root repo.
7. **Environment Variable** (Production **dan** Preview):

   ```
   VITE_API_BASE = https://<api-kamu>.up.railway.app/api
   ```

8. Deploy.

> `VITE_*` ditanam saat **build**. Kalau kamu menambahkan variabel ini setelah
> deploy pertama, lakukan **Redeploy** — kalau tidak, frontend tetap memanggil
> `/api` di domain Vercel dan akan 404.

## 4. Izinkan CORS di API

Frontend dan API beda origin, jadi API harus mengizinkan domain Vercel:

```
CORS_ORIGIN = https://<app-kamu>.vercel.app
```

Beberapa origin dipisah koma, misal preview + production:

```
CORS_ORIGIN = https://<app>.vercel.app,https://<app>-git-main-<user>.vercel.app
```

Harus **persis** (termasuk `https://`, tanpa garis miring di akhir). Setelah
mengubahnya, restart/redeploy container API.

## 5. Alternatif: tanpa CORS (pakai rewrite)

Kalau tidak ingin mengurus CORS, biarkan `VITE_API_BASE` kosong dan biarkan
Vercel mem-proxy `/api`:

`apps/web/vercel.json`

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<api-kamu>/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Urutan penting: `/api` **harus** di atas catch-all. Konsekuensinya, kalau host
API berubah, file ini ikut diubah dan di-deploy ulang.

## 6. Checklist setelah deploy

```sh
# API sehat
curl https://<api-kamu>/api/health

# CORS benar (harus memuat access-control-allow-origin)
curl -i -H 'Origin: https://<app>.vercel.app' https://<api-kamu>/api/health | grep -i access-control

# SPA fallback (harus 200, bukan 404)
curl -o /dev/null -w '%{http_code}\n' https://<app>.vercel.app/players/1061259054
```

Di browser: cari pemain → **Track** → buka profil → klik satu match → lihat
roster + item. Setelah ±30 menit, `last_synced_at` di `/api/sync/status` harus
berubah sendiri (bukti scheduler jalan).

## 7. Yang perlu diingat

- **Jangan commit `.env`.** Semua rahasia diisi lewat dashboard platform.
- **Neon free tier** menidurkan database saat idle; request pertama setelah lama
  sepi bisa terasa beberapa detik.
- **Rate limit 120/menit** dihitung per IP. Dengan mode rewrite, semua pengunjung
  terlihat datang dari IP Vercel sehingga berbagi satu jatah — untuk pemakaian
  pribadi tidak masalah.
- **Ukuran image API** belum dioptimalkan (devDependencies ikut terbawa karena
  seluruh workspace disalin agar symlink `node_modules` tetap valid). Kalau perlu
  image lebih kecil, pisahkan instalasi produksi dengan `pnpm deploy`.
- **Semua di Vercel (serverless) tidak disarankan** untuk versi ini: scheduler,
  cache in-memory, dan rate limit adalah state yang hidup di proses. Butuh
  refactor (Vercel Cron + Upstash Redis) supaya berjalan benar.
