# Dashboard Indomaret — Frontend (React + Vite)

Frontend untuk **Dashboard Indomaret**: monitoring pengeluaran barang (per kategori) dan pemasukan harian gerai-gerai Indomaret dalam satu kabupaten. Dibangun berdasarkan desain hasil ekspor Stitch (`stitch_tailadmin_react_dashboard_map`) dan terhubung ke backend Laravel (`indomaret-backend`) lewat REST API.

## Tumpukan Teknologi

- React 19 + Vite 8
- React Router v7 (routing client-side)
- Tailwind CSS v4 (`@theme` token, tanpa `tailwind.config.js`)
- Axios (HTTP client + interceptor token Sanctum)
- Leaflet + react-leaflet (peta sebaran real, OpenStreetMap tiles)
- Material Symbols Outlined + font Plus Jakarta Sans (sesuai desain asli)

## Menjalankan secara lokal

```bash
npm install
cp .env.example .env   # sesuaikan VITE_API_BASE_URL ke URL backend Laravel Anda
npm run dev
```

Build produksi:

```bash
npm run build
npm run preview
```

## Struktur Halaman

| Rute | Halaman | Keterangan |
| --- | --- | --- |
| `/login` | Login | Login manager/supervisor/kasir (token Sanctum) |
| `/dashboard` | Dashboard | KPI, tren harian, breakdown kategori, transaksi terbaru — **khusus manager** |
| `/peta` | Peta & Daftar Gerai | Peta sebaran gerai (manager: tab semua/kecamatan/heatmap omset; supervisor: tab semua saja) + tabel master gerai berisi pencarian & filter kecamatan. Pop-up tiap gerai = kartu ringkasan bergaya desain Stitch (3 KPI + tab Distribusi/Tren Harian/Top Penjualan) |
| `/barang-keluar` | Barang Keluar | Input & riwayat pengeluaran barang per kategori |
| `/pemasukan` | Pemasukan | Input & riwayat pemasukan + unduh laporan PDF |
| `/gerai` | Gerai Indomaret | Direktori/manajemen titik gerai (manager bisa tambah gerai) |
| `/gerai/:id` | Detail Gerai | Profil gerai, peta lokasi, daftar pegawai, transaksi per gerai |
| `/persetujuan` | Persetujuan Kasir | Antrean transaksi kasir yang menunggu disetujui/ditolak |
| `/akun` | Manajemen Akun | Kelola akun manager/supervisor/kasir (khusus manager) |
| `/kasir/barang-keluar` | Input Barang Keluar | Form barang keluar + riwayat barang keluar (status & alasan penolakan) di bawahnya |
| `/kasir/pemasukan` | Input Pemasukan | Form pemasukan harian + riwayat pemasukan di bawahnya |

Role `manager` adalah akun pusat: melihat seluruh gerai dalam kabupaten sekaligus satu-satunya yang bisa kelola akun & master data. Role `supervisor` otomatis di-scope ke gerai miliknya sendiri oleh backend dan menjadi penanggung jawab persetujuan transaksi kasir toko itu. Role `kasir` punya akun login sendiri (SATU akun dipakai bersama per toko); tiap submit transaksi tetap wajib mengisi nama + password kasir individu (tabel `employees`) agar tercatat siapa yang benar-benar menginput (kolom `employee_id`), dan transaksinya berstatus `pending` sampai disetujui.

**Semua role memakai shell yang sama** (`AppLayout`: sidebar kiri + header), termasuk kasir — yang membedakan hanyalah daftar menu di sidebar. Kasir hanya mendapat dua menu, Input Barang Keluar dan Input Pemasukan; riwayat tiap jenis transaksi ditempel langsung di bawah form-nya masing-masing (bukan halaman terpisah), dan notifikasi cukup lewat bell kecil di header.

Menu per role:

| Role | Menu sidebar | Halaman awal setelah login |
| --- | --- | --- |
| manager | Dashboard, Peta & Daftar Gerai, Barang Keluar, Pemasukan, Persetujuan Kasir, Manajemen Akun | `/dashboard` |
| supervisor | Peta & Daftar Gerai, Barang Keluar, Pemasukan, Persetujuan Kasir | `/persetujuan` |

Di halaman `/peta`, supervisor melihat **lokasi seluruh gerai** supaya peta sebarannya utuh, tapi angka omset/pengeluaran & grafik tren hanya muncul untuk gerainya sendiri — gerai lain popup-nya berisi info lokasi plus catatan bahwa data keuangannya hanya bisa dilihat manager. Backend yang menentukan ini lewat flag `tampilkan_angka` per titik di `/api/peta-sebaran`, jadi angka gerai lain memang tidak pernah dikirim ke browser supervisor. Tab "Wilayah Kecamatan" dan "Heatmap Omset" (keduanya berbasis angka omset) serta tabel agregasi kecamatan hanya tampil untuk manager.
| kasir | Input Barang Keluar, Input Pemasukan | `/kasir/barang-keluar` |

Penjagaannya terpusat di `AppLayout.jsx` lewat variabel `homeRoute`: akun kasir yang membuka URL non-`/kasir` dilempar ke `/kasir/barang-keluar`, role lain yang membuka `/kasir/*` dilempar ke halaman awalnya, dan siapa pun selain manager yang membuka `/dashboard` dilempar ke halaman awalnya juga. Backend memblokir hal yang sama di level API (`role:manager` untuk `/api/dashboard`), jadi pembatasan ini bukan sekadar menyembunyikan menu.

## Catatan Penyesuaian dari Desain Asli (Stitch)

Desain diambil 1:1 dari file `code.html` hasil ekspor Stitch (warna, tipografi, layout, komponen kartu/modal/tabel). Ada beberapa penyesuaian yang **disengaja** demi kejujuran data (bukan sekadar tempelan mockup):

1. **Peta** menggunakan Leaflet + OpenStreetMap sungguhan (marker, radius kecamatan, heatmap omset berbasis `CircleMarker`) — bukan ilustrasi peta statis seperti di mockup, karena kita punya data lat/long asli dari backend.
2. **Grafik tren** dilabeli "Tren Harian" (bukan "Komparasi Bulanan/Tahunan" seperti mockup) karena endpoint `/api/dashboard` memang mengembalikan agregat harian untuk rentang tanggal yang dipilih, bukan 12 bulan tetap.
3. **Kolom jabatan pegawai** ("Kepala Toko", "Kasir Utama", dst di mockup) tidak ditampilkan di halaman Detail Gerai karena skema tabel `employees` di backend memang hanya menyimpan nama + status aktif (tidak ada kolom jabatan/role kasir).
5. **Pop-up gerai di peta** mengikuti desain Stitch `peta_lokasi_popup_*`, dengan tiga penyesuaian karena keterbatasan data: (a) baris info "Point Store", "Luas 186,75 m²", dan "Buka 24 Jam" dihilangkan — kolomnya memang tidak ada di tabel `indomarets`, jadi yang ditampilkan hanya alamat, kecamatan, dan badge status; (b) chip "Margin: 32,4%" per kategori di tab Top Penjualan diganti jumlah unit keluar, karena margin per kategori tidak bisa dihitung (pemasukan dicatat harian per gerai, bukan per kategori barang); (c) angka KPI diberi sub-label periodenya yang sebenarnya ("Hari ini", "Bulan berjalan") supaya tidak ambigu.
6. **Input kasir** memakai field nama + password (dengan saran nama via datalist), bukan dropdown pilih-ID seperti mockup, karena verifikasi password asli butuh input yang diketik langsung, bukan pilihan dari daftar yang sudah dipercaya begitu saja.

## Struktur Kode

```
src/
  api/            # axios client + wrapper endpoint REST
  components/
    layout/       # Sidebar, Header, AppLayout, TopAccentBar
    ui/           # KpiCard, SectionCard, Modal, Badge, ProgressBar, dll (design system)
    charts/       # DualBarChart (SVG kustom)
    map/          # ikon marker Leaflet custom warna Indomaret
  context/        # AuthContext (Sanctum token + role)
  lib/            # helper format Rupiah/angka/tanggal
  pages/          # satu file per halaman/rute
```
