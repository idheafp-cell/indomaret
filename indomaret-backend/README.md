# Dashboard Indomaret - Backend (Laravel API)

Backend REST API untuk memonitor pengeluaran barang (per kategori) dan
pemasukan harian seluruh titik Indomaret dalam satu kabupaten, lengkap
dengan endpoint dashboard, peta sebaran, manajemen user, dan generate
laporan PDF.

## ⚠️ Catatan penting soal file `vendor/`

Project ini dibuat di lingkungan sandbox cloud yang **tidak memiliki akses
ke Packagist/getcomposer.org** (diblokir oleh kebijakan jaringan), sehingga
folder `vendor/` (dependency Composer) **tidak bisa di-generate & disertakan**
di sini. Semua kode aplikasi (migrations, models, controllers, routes,
seeders, view PDF) sudah lengkap dan sudah dicek sintaksnya (`php -l`),
tapi belum bisa dijalankan/diuji langsung (`php artisan migrate`, dsb) di
lingkungan ini.

**Yang perlu Anda lakukan di komputer Anda sendiri** (yang sepertinya sudah
punya PHP/Composer/Laravel Herd terpasang):

```bash
cd indomaret-backend
composer install
cp .env.example .env
php artisan key:generate
```

Lanjutkan ke bagian **Instalasi** di bawah untuk setup database & migrasi.

## Fitur

- **Autentikasi 3 role** (Laravel Sanctum, token-based): `manager`,
  `supervisor`, `kasir`. (Role `admin` sudah DIHAPUS — semua kewenangannya
  dipegang `manager`.)
- **Input Indomaret satu kabupaten**: manager mengelola master data
  kabupaten & titik-titik Indomaret (nama, alamat, koordinat).
- **Input barang keluar per kategori** (bukan per produk spesifik) dan
  **input pemasukan harian**.
- **Akun kasir bersama + identitas individu**: satu akun login `kasir`
  dipakai bersama oleh semua kasir fisik di satu toko (supaya mereka bisa
  masuk ke Kasir Dashboard). Tiap submit transaksi tetap WAJIB mengisi
  `employee_nama` + `employee_password` (identitas individu dari tabel
  `employees`, dikelola oleh supervisor), yang diverifikasi di server dan
  dicatat sebagai `employee_id` untuk audit ("siapa yang benar-benar input").
- **Alur persetujuan (approval)**: transaksi yang disubmit lewat akun
  `kasir` berstatus `pending` sampai disetujui (`approve`) atau ditolak
  (`reject`) oleh supervisor toko itu (atau manager, untuk gerai mana pun).
  Transaksi `pending`/`rejected` **tidak dihitung** ke dashboard/laporan —
  baru masuk hitungan setelah `approved`. Transaksi yang disubmit langsung
  oleh manager/supervisor otomatis `approved`.
- **Notifikasi in-app** (di-poll berkala oleh frontend, bukan websocket):
  supervisor & manager dapat notif saat kasir submit transaksi baru;
  akun kasir dapat notif saat transaksinya disetujui/ditolak.
- **Dashboard (khusus manager)**: ringkasan total pengeluaran, pemasukan, estimasi laba,
  breakdown pengeluaran per kategori, tren harian, jumlah transaksi
  menunggu persetujuan (untuk grafik & badge).
- **Peta sebaran Indomaret**: endpoint `GET /api/peta-sebaran` mengembalikan
  daftar titik + koordinat (latitude/longitude) + agregat bulan berjalan,
  siap dipakai dengan library peta gratis seperti **Leaflet + OpenStreetMap**
  di sisi frontend.
- **Generate laporan PDF** memakai `barryvdh/laravel-dompdf` (hanya
  menghitung transaksi berstatus `approved`).

## Peran & Alur Login

| Peran | Login? | Scope | Bisa apa saja |
|---|---|---|---|
| **Manager** | Ya | Semua titik se-kabupaten | **Akun pusat, akses penuh.** Satu-satunya yang bisa kelola akun (manager/supervisor/kasir) & master data (kabupaten/gerai/kategori barang); lihat dashboard/peta/laporan semua titik; approve/reject transaksi kasir di gerai mana pun |
| **Supervisor** | Ya | 1 titik Indomaret | **Penanggung jawab utama persetujuan transaksi kasir toko itu.** Kelola karyawan/kasir individu di titiknya; input & lihat pengeluaran/pemasukan titiknya; laporan titiknya. Boleh melihat **peta sebaran seluruh gerai** (lokasi saja — angka omset/tren gerai lain disembunyikan). **TIDAK punya akses dashboard ringkasan** (khusus manager) |
| **Kasir** | Ya (SATU akun dipakai bersama per toko) | 1 titik Indomaret | HANYA bisa input pemasukan/barang keluar + lihat riwayat & notifikasi miliknya sendiri (tidak dapat akses dashboard/peta/laporan). Tiap submit WAJIB isi nama+password individu (tabel `employees`); transaksinya berstatus `pending` sampai disetujui |

## Struktur Data (ERD ringkas)

```
kabupatens ──< indomarets ──< users (role=supervisor ATAU kasir, 1:1 per indomaret per role)
                    │      └─< employees (identitas individu kasir, nama+password, dibuat oleh supervisor)
                    │
                    ├──< pengeluarans >── kategori_barangs (master kategori)
                    └──< pemasukans

users role=manager TIDAK terikat ke indomaret_id (lihat semua titik).

pengeluarans & pemasukans masing-masing punya:
  user_id           -> akun yang submit (manager/supervisor/kasir)
  employee_id       -> (nullable) identitas individu kasir yang benar-benar input
  status            -> pending | approved | rejected (default approved,
                        jadi pending hanya kalau user_id adalah akun kasir)
  approved_by       -> user yang approve/reject
  approved_at       -> kapan diputuskan
  rejection_reason  -> alasan (wajib diisi kalau reject)

notifications: user_id, type, title, body, data (json), read_at
```

## Instalasi

### 1. Requirement
- PHP >= 8.2
- Composer
- PostgreSQL (direkomendasikan) — atau SQLite untuk dev cepat

### 2. Install dependency
```bash
composer install
cp .env.example .env
php artisan key:generate
```

### 3. Setup database

**Opsi A — PostgreSQL (direkomendasikan, sudah default di `.env.example`)**
```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=indomaret_dashboard
DB_USERNAME=postgres
DB_PASSWORD=isi_password_anda
```
Buat database-nya dulu: `createdb indomaret_dashboard` (atau lewat pgAdmin).

**Opsi B — SQLite (paling cepat untuk coba-coba lokal)**
```env
DB_CONNECTION=sqlite
```
```bash
touch database/database.sqlite
```

### 4. Migrasi + Seeder (data contoh)
```bash
php artisan migrate --seed
```
Seeder akan membuat:
- 1 kabupaten contoh (Kabupaten Sidoarjo) + 4 titik Indomaret dengan koordinat
- 7 kategori barang (Makanan Ringan, Minuman, Rokok, dll)
- 1 akun manager (akun pusat, akses penuh):
  `manager@indomaret-dashboard.test` / `password123`
- 4 akun supervisor (satu per titik): `supervisor1@indomaret-dashboard.test`
  s/d `supervisor4@...`, password `password123`
- 4 akun kasir/login (satu per titik): `kasir1@indomaret-dashboard.test`
  s/d `kasir4@...`, password `password123`
- 2 karyawan/kasir individu contoh per titik (nama: "Kasir Satu", "Kasir Dua",
  password `kasir123`) — diisi saat login akun kasir toko itu untuk submit transaksi
- Data transaksi pengeluaran & pemasukan 14 hari terakhir berstatus `approved`
  (untuk isi dashboard), + beberapa contoh transaksi `pending` dari akun kasir
  di 2 titik pertama beserta notifikasinya (untuk coba alur persetujuan)

### 5. Jalankan server
```bash
php artisan serve
```
API bisa diakses di `http://localhost:8000/api`.

### 6. Testing API
Import `postman_collection.json` (ada di root project ini) ke Postman —
sudah berisi contoh semua endpoint termasuk login, input transaksi via
kasir, dashboard, peta sebaran, dan download laporan PDF.

## Daftar Endpoint

Semua endpoint (kecuali `/login`) butuh header:
```
Authorization: Bearer {token}
```

### Auth
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/api/login` | Login (semua role) → dapat token |
| POST | `/api/logout` | Hapus token aktif |
| GET  | `/api/me` | Profil user yang sedang login (termasuk relasi `indomaret`) |
| PUT  | `/api/me/password` | Ganti password sendiri |

### Notifikasi (semua role, termasuk kasir)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/notifications?unread_only=1&per_page=` | List notifikasi milik sendiri + `unread_count` |
| POST | `/api/notifications/{id}/read` | Tandai satu notifikasi sudah dibaca |
| POST | `/api/notifications/read-all` | Tandai semua sudah dibaca |

### Dashboard & Peta
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/api/dashboard?start_date=&end_date=&indomaret_id=` | **manager saja** | Ringkasan se-kabupaten, termasuk `menunggu_persetujuan` |
| GET | `/api/peta-sebaran` | manager, supervisor | Semua titik + koordinat + agregat bulan berjalan. Supervisor tetap menerima SEMUA titik (supaya peta sebarannya utuh), tapi gerai selain miliknya dikirim dengan `tampilkan_angka: false` dan angka `null` |

### Master Data
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET/POST/PUT/DELETE | `/api/kabupaten` | manager | CRUD kabupaten |
| GET | `/api/indomaret` | manager, supervisor | List titik (data lokasi/kontak saja, semua role lihat semua gerai). Tiap baris punya `boleh_lihat_detail` — false berarti supervisor tidak boleh membuka detail gerai itu |
| GET | `/api/indomaret/{id}/ringkasan-peta` | manager, supervisor (gerai sendiri) | Isi pop-up gerai di peta: KPI transaksi harian + unit barang keluar + margin, `distribusi` (unit per kategori), `top_penjualan` (nilai per kategori + porsinya), dan `tren_harian` 7 hari. Dipanggil hanya saat marker diklik |
| POST/PUT/DELETE | `/api/indomaret/{id}` | manager | Kelola titik Indomaret |
| GET | `/api/kategori-barang` | semua (termasuk kasir) | List kategori barang |
| POST/PUT/DELETE | `/api/kategori-barang/{id}` | manager | Kelola kategori barang |
| GET/POST/PUT/DELETE | `/api/users` | manager | Kelola akun manager/supervisor/kasir |

### Karyawan / Kasir individu (tabel `employees`)
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/api/employees` | semua (termasuk kasir) | List karyawan individu (supervisor/kasir hanya miliknya) |
| POST | `/api/employees` | manager, supervisor | Tambah karyawan baru (nama + password; manager wajib kirim `indomaret_id`) |
| PUT/DELETE | `/api/employees/{id}` | manager, supervisor | Update/nonaktifkan karyawan |

### Transaksi
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/api/pengeluaran?start_date=&end_date=&kategori_barang_id=&status=&search=` | semua | List pengeluaran (filter `status=pending` untuk antrean persetujuan). `search` mencocokkan nama/kode gerai, nama kategori, nama penginput, dan keterangan — dikerjakan di server supaya mencakup seluruh data, bukan cuma halaman yang terbuka. Endpoint `/api/pemasukan` punya `search` yang sama (mencocokkan gerai, penginput, keterangan) |
| POST | `/api/pengeluaran` | semua | Input barang keluar (lihat contoh body di bawah) |
| GET | `/api/pengeluaran/{id}` | semua (discope) | Detail |
| PUT/DELETE | `/api/pengeluaran/{id}` | manager, supervisor | Update/hapus (kasir tidak bisa) |
| POST | `/api/pengeluaran/{id}/approve` | manager, supervisor | Setujui transaksi pending |
| POST | `/api/pengeluaran/{id}/reject` | manager, supervisor | Tolak transaksi pending (body: `rejection_reason` wajib) |
| GET/POST/PUT/DELETE/approve/reject | `/api/pemasukan...` | sama seperti di atas | Pola identik, field utama `jumlah` (tidak ada field `sumber` lagi — sudah dihapus) |

Contoh body **POST `/api/pengeluaran`** (input oleh manager/supervisor sendiri → langsung `approved`):
```json
{
  "kategori_barang_id": 1,
  "tanggal": "2026-09-15",
  "jumlah_barang": 20,
  "satuan": "pcs",
  "nilai": 250000,
  "keterangan": "Stok opname harian"
}
```

Contoh body **kalau login sebagai akun kasir** (wajib isi nama+password
individu kasir yang benar-benar input; hasilnya berstatus `pending`):
```json
{
  "kategori_barang_id": 1,
  "tanggal": "2026-09-15",
  "jumlah_barang": 10,
  "nilai": 120000,
  "employee_nama": "Kasir Satu",
  "employee_password": "kasir123"
}
```
Body untuk `/api/pemasukan` sama polanya, field utamanya `jumlah` (dulu ada
field `sumber` — tunai/non_tunai/lainnya — tapi sudah dihapus dari sistem).

Contoh body **POST `/api/pengeluaran/{id}/reject`**:
```json
{ "rejection_reason": "Nilai tidak sesuai nota, mohon input ulang." }
```

> Catatan: `indomaret_id` otomatis diambil dari akun supervisor/kasir yang
> login (discope ke toko sendiri). Manager wajib mengirim
> `indomaret_id` secara eksplisit karena tidak terikat ke satu toko.

### Laporan PDF (manager, supervisor — TIDAK untuk kasir)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/laporan/pengeluaran-pemasukan/pdf?indomaret_id=&start_date=&end_date=` | Download PDF laporan (supervisor otomatis ke titiknya sendiri; hanya menghitung transaksi `approved`) |

## Rekomendasi untuk Frontend

- **Peta sebaran**: gunakan [Leaflet](https://leafletjs.com/) + tile
  OpenStreetMap (gratis, tanpa API key) dengan data dari `/api/peta-sebaran`.
- **Dashboard**: pakai chart library apapun (Chart.js, ApexCharts, dll) —
  data `pengeluaran_per_kategori`, `tren_harian_pengeluaran`, dan
  `tren_harian_pemasukan` dari `/api/dashboard` sudah dalam format siap pakai.
- Backend ini murni API (JSON), jadi frontend (React/Vue/dll, atau hasil
  desain dari Stitch) bisa dikembangkan terpisah dan konsumsi endpoint di atas.

## Struktur Folder Penting

```
app/Http/Controllers/Api/   -> semua controller API
app/Http/Middleware/EnsureUserHasRole.php  -> middleware pembatas role
app/Services/EmployeeCredentialService.php -> verifikasi nama+password individu kasir
app/Services/NotificationService.php       -> helper buat notifikasi in-app
app/Models/                 -> Kabupaten, Indomaret, User, Employee, KategoriBarang, Pengeluaran, Pemasukan, Notification
database/migrations/        -> struktur tabel (termasuk migration role manager/kasir & status approval)
database/seeders/           -> data contoh (manager/supervisor/kasir + demo transaksi pending)
resources/views/laporan/    -> template Blade untuk PDF
routes/api.php               -> semua route API
postman_collection.json     -> koleksi Postman siap import (BELUM diperbarui untuk role manager/kasir/approval — perlu update manual atau minta dibuatkan ulang)
```

## Troubleshooting

- **`SQLSTATE[08006] could not connect to server`**: pastikan PostgreSQL
  sudah jalan & kredensial di `.env` benar, atau pindah ke SQLite (lihat
  Opsi B di atas).
- **PDF gagal / font error**: pastikan extension PHP `gd`/`mbstring`
  aktif (biasanya sudah default di Laravel Herd/XAMPP).
- **401 Unauthenticated**: pastikan header `Authorization: Bearer {token}`
  terkirim, token didapat dari response `/api/login`.
