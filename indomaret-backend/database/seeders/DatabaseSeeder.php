<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\Expense;
use App\Models\ItemCategory;
use App\Models\Income;
use App\Models\Notification;
use App\Models\Regency;
use App\Models\Store;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Regency (contoh: satu kabupaten sesuai kebutuhan sistem)
        $regency = Regency::create([
            'name' => 'Kabupaten Sidoarjo',
            'province' => 'Jawa Timur',
        ]);

        // 2. Beberapa titik Indomaret dalam kabupaten tersebut
        $storeSeeds = [
            ['store_code' => 'IDM-001', 'name' => 'Indomaret Sudirman', 'address' => 'Jl. Jend. Sudirman No. 10, Sidoarjo', 'district' => 'Sidoarjo', 'latitude' => -7.4478, 'longitude' => 112.7183],
            ['store_code' => 'IDM-002', 'name' => 'Indomaret Gajah Mada', 'address' => 'Jl. Gajah Mada No. 25, Sidoarjo', 'district' => 'Sidoarjo', 'latitude' => -7.4512, 'longitude' => 112.7201],
            ['store_code' => 'IDM-003', 'name' => 'Indomaret Waru', 'address' => 'Jl. Raya Waru No. 5, Waru', 'district' => 'Waru', 'latitude' => -7.3629, 'longitude' => 112.7275],
            ['store_code' => 'IDM-004', 'name' => 'Indomaret Krian', 'address' => 'Jl. Raya Krian No. 88, Krian', 'district' => 'Krian', 'latitude' => -7.3789, 'longitude' => 112.5761],
        ];

        $stores = collect($storeSeeds)->map(fn ($data) => Store::create([
            ...$data,
            'regency_id' => $regency->id,
            'phone' => '031-8945'.rand(100, 999),
            'is_active' => true,
        ]));

        // 3. Master kategori barang (per kelompok, bukan per produk)
        $categoryNames = [
            'Makanan Ringan',
            'Minuman',
            'Rokok',
            'Kebutuhan Rumah Tangga',
            'Kesehatan & Kecantikan',
            'Makanan Instan',
            'Lainnya',
        ];

        $categories = collect($categoryNames)->map(fn ($name) => ItemCategory::create([
            'name' => $name,
            'is_active' => true,
        ]));

        // 4. Akun manager = AKUN PUSAT dengan akses penuh: lihat semua gerai,
        // kelola akun & master data, sekaligus bisa approve/reject transaksi
        // kasir di gerai mana pun.
        $manager = User::create([
            'name' => 'Manager Pusat',
            'email' => 'manager@indomaret-dashboard.test',
            'password' => 'password123',
            'role' => User::ROLE_MANAGER,
            'is_active' => true,
        ]);

        // 5. Akun supervisor untuk tiap titik Indomaret
        $supervisors = $stores->map(function (Store $store, int $i) {
            return User::create([
                'name' => 'Supervisor '.$store->name,
                'email' => 'supervisor'.($i + 1).'@indomaret-dashboard.test',
                'password' => 'password123',
                'role' => User::ROLE_SUPERVISOR,
                'store_id' => $store->id,
                'is_active' => true,
            ]);
        });

        // 5b. Akun cashier (SATU akun login per toko, dipakai bersama oleh
        // semua kasir fisik di toko itu - mereka tetap wajib isi nama+
        // password INDIVIDU dari tabel employees tiap submit transaksi)
        $cashierAccounts = $stores->map(function (Store $store, int $i) {
            return User::create([
                'name' => 'Kasir '.$store->name,
                'email' => 'kasir'.($i + 1).'@indomaret-dashboard.test',
                'password' => 'password123',
                'role' => User::ROLE_CASHIER,
                'store_id' => $store->id,
                'is_active' => true,
            ]);
        });

        // 6. Contoh karyawan/kasir INDIVIDU di tiap titik (nama+password
        // untuk tanda tangan digital tiap transaksi, beda dari akun login
        // cashier di atas yang dipakai bersama)
        $stores->each(function (Store $store, int $i) use ($supervisors) {
            $supervisor = $supervisors[$i];

            Employee::create([
                'store_id' => $store->id,
                'name' => 'Kasir Satu',
                'password' => 'kasir123',
                'created_by' => $supervisor->id,
            ]);

            Employee::create([
                'store_id' => $store->id,
                'name' => 'Kasir Dua',
                'password' => 'kasir123',
                'created_by' => $supervisor->id,
            ]);
        });

        // 7. Contoh transaksi pengeluaran & pemasukan 14 hari terakhir
        $stores->each(function (Store $store, int $i) use ($categories, $supervisors) {
            $supervisor = $supervisors[$i];
            $employee = Employee::where('store_id', $store->id)->first();

            for ($d = 13; $d >= 0; $d--) {
                $date = now()->subDays($d)->toDateString();

                foreach ($categories->random(3) as $category) {
                    Expense::create([
                        'store_id' => $store->id,
                        'item_category_id' => $category->id,
                        'date' => $date,
                        'quantity' => rand(5, 60),
                        'unit' => 'pcs',
                        'value' => rand(50_000, 1_500_000),
                        'user_id' => $supervisor->id,
                        'employee_id' => $employee?->id,
                    ]);
                }

                Income::create([
                    'store_id' => $store->id,
                    'date' => $date,
                    'amount' => rand(2_000_000, 8_000_000),
                    'user_id' => $supervisor->id,
                    'employee_id' => $employee?->id,
                ]);
            }
        });

        // 8. Contoh transaksi PENDING dari akun cashier (demo alur persetujuan)
        // + notifikasi terkait, supaya bell icon & halaman Persetujuan
        // langsung ada isinya saat pertama kali dicoba.
        $stores->take(2)->each(function (Store $store, int $i) use ($categories, $cashierAccounts, $supervisors, $manager) {
            $cashierAccount = $cashierAccounts[$i];
            $supervisor = $supervisors[$i];
            $employee = Employee::where('store_id', $store->id)->first();
            $category = $categories->random();

            $expense = Expense::create([
                'store_id' => $store->id,
                'item_category_id' => $category->id,
                'date' => now()->toDateString(),
                'quantity' => rand(10, 40),
                'unit' => 'pcs',
                'value' => rand(200_000, 900_000),
                'notes' => 'Input kasir - menunggu persetujuan (contoh seeder)',
                'user_id' => $cashierAccount->id,
                'employee_id' => $employee?->id,
                'status' => Expense::STATUS_PENDING,
            ]);

            $income = Income::create([
                'store_id' => $store->id,
                'date' => now()->toDateString(),
                'amount' => rand(500_000, 3_000_000),
                'notes' => 'Input kasir - menunggu persetujuan (contoh seeder)',
                'user_id' => $cashierAccount->id,
                'employee_id' => $employee?->id,
                'status' => Income::STATUS_PENDING,
            ]);

            foreach ([$supervisor, $manager] as $recipient) {
                Notification::create([
                    'user_id' => $recipient->id,
                    'type' => Notification::TYPE_TRANSACTION_PENDING,
                    'title' => 'Transaksi baru menunggu persetujuan',
                    'body' => "Kasir menginput barang keluar: {$expense->quantity} pcs • Rp".number_format((float) $expense->value, 0, ',', '.'),
                    'data' => ['expense_id' => $expense->id, 'store_id' => $store->id],
                ]);
                Notification::create([
                    'user_id' => $recipient->id,
                    'type' => Notification::TYPE_TRANSACTION_PENDING,
                    'title' => 'Transaksi baru menunggu persetujuan',
                    'body' => 'Kasir menginput pemasukan: Rp'.number_format((float) $income->amount, 0, ',', '.'),
                    'data' => ['income_id' => $income->id, 'store_id' => $store->id],
                ]);
            }
        });

        $this->command?->info('Seeding selesai. Login manager (akun pusat): manager@indomaret-dashboard.test / password123');
        $this->command?->info('Login supervisor: supervisor1@indomaret-dashboard.test / password123');
        $this->command?->info('Login kasir contoh: kasir1@indomaret-dashboard.test / password123 (nama karyawan: "Kasir Satu", password karyawan: "kasir123")');
    }
}
