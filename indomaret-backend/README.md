# Dashboard Indomaret - Backend (Laravel API)

Backend REST API untuk memonitor pengeluaran barang (per kategori) dan
pemasukan harian seluruh titik Indomaret dalam satu kabupaten/kota, lengkap
dengan endpoint dashboard, peta sebaran, manajemen akun, dan generate
laporan PDF.

> **Catatan skema**: nama tabel, kolom, model, controller, dan endpoint API
> di seluruh backend ini memakai Bahasa Inggris (lihat bagian "Daftar
> Endpoint" & "Struktur Data" di bawah). Pesan error/validasi dan dokumen
> di dalam kode tetap Bahasa Indonesia — yang diganti murni penamaan
> teknis/skema, supaya database aman dibagikan tanpa perlu diterjemahkan
> dulu.

## Fitur

- **Autentikasi 3 role** (Laravel Sanctum, token-based): `manager`,
  `supervisor`, `cashier`.
- **Master data gerai satu kabupaten/kota**: manager mengelola master data
  kabupaten (`regencies`) & titik-titik Indomaret (`stores`: nama, alamat,
  kecamatan, koordinat, foto).
- **Input barang keluar per kategori** (`expenses`, bukan per produk
  spesifik) dan **input pemasukan harian** (`incomes`).
- **Akun kasir bersama + identitas individu**: satu akun login role
  `cashier` dipakai bersama oleh semua kasir fisik di satu toko. Tiap
  submit transaksi tetap WAJIB mengisi `employee_name` + `employee_password`
  (identitas individu dari tabel `employees`, dikelola manager/supervisor),
  diverifikasi di server dan dicatat sebagai `employee_id` untuk audit.
- **Alur persetujuan (approval)**: transaksi yang disubmit lewat akun
  `cashier` berstatus `pending` sampai disetujui (`approve`) atau ditolak
  (`reject`) oleh supervisor toko itu (atau manager, untuk gerai mana pun).
  Transaksi `pending`/`rejected` **tidak dihitung** ke dashboard/laporan —
  baru masuk hitungan setelah `approved`. Transaksi yang disubmit langsung
  oleh manager/supervisor otomatis `approved`.
- **Notifikasi in-app** (di-poll berkala oleh frontend, bukan websocket):
  supervisor & manager dapat notif saat cashier submit transaksi baru;
  akun cashier dapat notif saat transaksinya disetujui/ditolak.
- **Dashboard (khusus manager)**: ringkasan total pengeluaran, pemasukan,
  estimasi laba, breakdown pengeluaran per kategori, tren harian, jumlah
  transaksi menunggu persetujuan.
- **Peta sebaran gerai**: `GET /api/stores/map` mengembalikan daftar titik +
  koordinat + agregat bulan berjalan + tren 14 hari, siap dipakai dengan
  Leaflet + OpenStreetMap di frontend. Detail per gerai (KPI harian,
  distribusi kategori, tren 7 hari) ada di endpoint terpisah
  `GET /api/stores/{id}/map-summary`, dipanggil saat marker diklik.
- **Generate laporan PDF** memakai `barryvdh/laravel-dompdf` (hanya
  menghitung transaksi berstatus `approved`).

## Peran & Alur Login

| Peran | Login? | Scope | Bisa apa saja |
|---|---|---|---|
| **manager** | Ya | Semua titik se-kabupaten/kota | **Akun pusat, akses penuh.** Satu-satunya yang bisa kelola akun (`users`: manager/supervisor/cashier) & master data (`regencies`/`stores`/`item_categories`); lihat dashboard/peta/laporan semua titik; approve/reject transaksi kasir di gerai mana pun |
| **supervisor** | Ya | 1 titik Indomaret (`store_id`) | **Penanggung jawab utama persetujuan transaksi kasir toko itu.** Kelola karyawan (`employees`) di titiknya; input & lihat pengeluaran/pemasukan titiknya; laporan titiknya. Boleh melihat **peta sebaran seluruh gerai** (lokasi saja — angka omset/tren gerai lain disembunyikan). **TIDAK punya akses dashboard ringkasan** (khusus manager) |
| **cashier** | Ya (SATU akun dipakai bersama per toko) | 1 titik Indomaret (`store_id`) | HANYA bisa input pemasukan/barang keluar + lihat riwayat & notifikasi miliknya sendiri (tidak dapat akses dashboard/peta/laporan). Tiap submit WAJIB isi nama+password individu (tabel `employees`); transaksinya berstatus `pending` sampai disetujui |

## Struktur Data (ERD ringkas)

```
regencies ──< stores ──< users (role=supervisor ATAU cashier, 1:1 per store per role)
                  │   └─< employees (identitas individu kasir, name+password)
                  │
                  ├──< expenses >── item_categories (master kategori)
                  └──< incomes

users role=manager TIDAK terikat ke store_id (lihat semua titik).

expenses & incomes masing-masing punya:
  user_id           -> akun yang submit (manager/supervisor/cashier)
  employee_id       -> (nullable) identitas individu kasir yang benar-benar input
  status            -> pending | approved | rejected (default approved,
                        jadi pending hanya kalau user_id adalah akun cashier)
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

### 4. Migrasi + data

```bash
php artisan migrate
```

Ada dua sumber data contoh, pilih salah satu:

- **`php artisan db:seed`** (`DatabaseSeeder`, cepat untuk dev/testing) — bikin
  1 kabupaten contoh (Sidoarjo) + 4 gerai, 7 kategori barang, 1 akun manager,
  1 supervisor & 1 cashier per gerai, 2 karyawan contoh per gerai, beberapa
  transaksi `approved` + beberapa `pending` untuk coba alur persetujuan.
  Kredensial: `manager@indomaret-dashboard.test` / `password123`,
  `supervisorN@...` / `password123`, `cashierN@...` / `password123` (ganti
  N dengan nomor gerai), karyawan `Kasir Satu`/`Kasir Dua` / `kasir123`.
- **`indomaret_surabaya_from_raw.sql`** (data asli, 259 gerai Surabaya hasil
  scraping) — jalankan lewat pgAdmin/psql kalau mau data yang lebih
  realistis. Pola kredensialnya sama (`manager@...`, `supervisorN@...`,
  `cashierN@...`, semua `password123`), N dari 1 s/d 259.

Jangan jalankan keduanya sekaligus di database yang sama — script SQL
Surabaya memulai dengan `TRUNCATE` seluruh tabel aplikasi.

### 5. Jalankan server
```bash
php artisan serve
```
API bisa diakses di `http://localhost:8000/api`.

### 6. Testing API
Import `postman_collection.json` (ada di root project ini) ke Postman —
sudah berisi contoh semua endpoint termasuk login, input transaksi via
cashier, dashboard, peta sebaran, dan download laporan PDF, dengan nama
field & endpoint versi terbaru (Bahasa Inggris).

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
| GET  | `/api/me` | Profil user yang sedang login (termasuk relasi `store`) |
| PUT  | `/api/me/password` | Ganti password sendiri (`current_password`, `new_password`, `new_password_confirmation`) |

### Notifikasi (semua role, termasuk cashier)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/notifications?unread_only=1&per_page=` | List notifikasi milik sendiri + `unread_count` |
| POST | `/api/notifications/{id}/read` | Tandai satu notifikasi sudah dibaca |
| POST | `/api/notifications/read-all` | Tandai semua sudah dibaca |

### Dashboard & Peta
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/api/dashboard?start_date=&end_date=&store_id=` | **manager saja** | Ringkasan se-kabupaten/kota, termasuk `pending_approval` |
| GET | `/api/stores/map` | manager, supervisor | Semua titik + koordinat + agregat bulan berjalan + `daily_trend` 14 hari. Supervisor tetap menerima SEMUA titik (supaya peta sebarannya utuh), tapi gerai selain miliknya dikirim dengan `show_amounts: false` dan angka `null` |
| GET | `/api/stores/{id}/map-summary` | manager, supervisor (gerai sendiri) | Isi pop-up detail gerai di peta: KPI transaksi harian, unit barang keluar, margin, `distribution` (unit per kategori), `top_sales` (nilai per kategori + porsinya), `daily_trend` 7 hari |

### Master Data
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET/POST/PUT/DELETE | `/api/regencies` | manager | CRUD kabupaten/kota |
| GET | `/api/stores` | manager, supervisor | List gerai (data lokasi/kontak, semua role lihat semua gerai). Tiap baris punya `can_view_detail` — false berarti supervisor tidak boleh membuka detail gerai itu |
| GET | `/api/stores/{id}` | manager, supervisor (gerai sendiri) | Detail satu gerai |
| POST/PUT/DELETE | `/api/stores/{id}` | manager | Kelola gerai (`regency_id`, `store_code`, `name`, `address`, `district`, `latitude`, `longitude`, `phone`, `photo_url`, `is_active`) |
| GET | `/api/item-categories?active_only=` | semua (termasuk cashier) | List kategori barang |
| POST/PUT/DELETE | `/api/item-categories/{id}` | manager | Kelola kategori barang |
| GET/POST/PUT/DELETE | `/api/users` | manager | Kelola akun manager/supervisor/cashier |

### Karyawan / Kasir individu (tabel `employees`)
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/api/employees` | semua (termasuk cashier) | List karyawan individu (supervisor/cashier hanya miliknya) |
| POST | `/api/employees` | manager, supervisor | Tambah karyawan baru (`name` + `password`; manager wajib kirim `store_id`) |
| PUT/DELETE | `/api/employees/{id}` | manager, supervisor | Update/nonaktifkan/hapus karyawan |

### Transaksi

**Expenses (Barang Keluar)**
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/api/expenses?start_date=&end_date=&item_category_id=&status=&search=&store_id=&per_page=` | semua | List (filter `status=pending` untuk antrean persetujuan). `search` mencocokkan nama/kode gerai, nama kategori, nama penginput, dan `notes`. Response ikut sertakan `summary.total_value` & `summary.total_units` dari SELURUH data yang cocok filter |
| POST | `/api/expenses` | semua | Input barang keluar |
| GET | `/api/expenses/{id}` | semua (discope) | Detail |
| PUT/DELETE | `/api/expenses/{id}` | manager, supervisor | Update/hapus (cashier tidak bisa) |
| POST | `/api/expenses/{id}/approve` | manager, supervisor | Setujui transaksi pending |
| POST | `/api/expenses/{id}/reject` | manager, supervisor | Tolak transaksi pending (body: `rejection_reason` wajib) |

**Incomes (Pemasukan)** — pola & aturan role identik dengan Expenses, field
utamanya `amount` (tidak ada field `unit`/`item_category_id`, dan tidak ada
lagi field `sumber` — sudah dihapus dari sistem):
`GET/POST /api/incomes`, `GET/PUT/DELETE /api/incomes/{id}`,
`POST /api/incomes/{id}/approve`, `POST /api/incomes/{id}/reject`.

Contoh body **POST `/api/expenses`** (input oleh manager/supervisor sendiri
→ langsung `approved`; manager wajib menambahkan `store_id`):
```json
{
  "item_category_id": 1,
  "date": "2026-09-15",
  "quantity": 20,
  "unit": "pcs",
  "value": 250000,
  "notes": "Stok opname harian"
}
```

Contoh body **kalau login sebagai akun cashier** (wajib isi nama+password
individu karyawan yang benar-benar input; hasilnya berstatus `pending`):
```json
{
  "item_category_id": 1,
  "date": "2026-09-15",
  "quantity": 10,
  "value": 120000,
  "employee_name": "Kasir Satu",
  "employee_password": "kasir123"
}
```

Body untuk `/api/incomes` sama polanya, field utamanya `amount`:
```json
{
  "date": "2026-09-15",
  "amount": 3500000,
  "employee_name": "Kasir Satu",
  "employee_password": "kasir123"
}
```

Contoh body **POST `/api/expenses/{id}/reject`** (sama untuk `/api/incomes/{id}/reject`):
```json
{ "rejection_reason": "Nilai tidak sesuai nota, mohon input ulang." }
```

> Catatan: `store_id` otomatis diambil dari akun supervisor/cashier yang
> login (discope ke toko sendiri). Manager wajib mengirim `store_id`
> secara eksplisit karena tidak terikat ke satu toko.

### Laporan PDF (manager, supervisor — TIDAK untuk cashier)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/reports/expenses-incomes/pdf?store_id=&start_date=&end_date=` | Download PDF laporan (supervisor otomatis ke titiknya sendiri; hanya menghitung transaksi `approved`) |

## Rekomendasi untuk Frontend

- **Peta sebaran**: gunakan [Leaflet](https://leafletjs.com/) + tile
  OpenStreetMap (gratis, tanpa API key) dengan data dari `/api/stores/map`.
- **Dashboard**: pakai chart library apapun (Chart.js, ApexCharts, dll, atau
  SVG buatan sendiri seperti di frontend ini) — data `expense_by_category`,
  `daily_expense_trend`, dan `daily_income_trend` dari `/api/dashboard`
  sudah dalam format siap pakai.
- Backend ini murni API (JSON), jadi frontend bisa dikembangkan terpisah dan
  konsumsi endpoint di atas.

## Struktur Folder Penting

```
app/Http/Controllers/Api/   -> semua controller API
app/Http/Middleware/EnsureUserHasRole.php  -> middleware pembatas role
app/Services/EmployeeCredentialService.php -> verifikasi nama+password individu kasir
app/Services/NotificationService.php       -> helper buat notifikasi in-app
app/Models/                 -> Regency, Store, User, Employee, ItemCategory, Expense, Income, Notification
database/migrations/        -> struktur tabel (skema Inggris)
database/seeders/           -> data contoh (manager/supervisor/cashier + demo transaksi pending)
resources/views/reports/    -> template Blade untuk PDF
routes/api.php               -> semua route API
postman_collection.json     -> koleksi Postman siap import, sudah sinkron dengan endpoint & field terbaru
```

## Troubleshooting

- **`SQLSTATE[08006] could not connect to server`**: pastikan PostgreSQL
  sudah jalan & kredensial di `.env` benar, atau pindah ke SQLite (lihat
  Opsi B di atas).
- **PDF gagal / font error**: pastikan extension PHP `gd`/`mbstring`
  aktif (biasanya sudah default di Laravel Herd/XAMPP).
- **401 Unauthenticated**: pastikan header `Authorization: Bearer {token}`
  terkirim, token didapat dari response `/api/login`.
- **422 saat login padahal password benar**: cek dulu email-nya — akun
  hasil seeder/SQL Surabaya semua pakai domain `@indomaret-dashboard.test`.
