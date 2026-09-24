<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\ItemCategoryController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\RegencyController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\StoreController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\IncomeController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - Dashboard Indomaret
|--------------------------------------------------------------------------
| 3 role login (Sanctum token): manager, supervisor, cashier.
| - manager    : AKUN PUSAT dengan akses penuh. Melihat semua titik
|                Indomaret se-kabupaten (dashboard, peta, transaksi,
|                laporan), satu-satunya yang bisa kelola akun & master data
|                (regency/gerai/kategori barang), dan bisa approve/reject
|                transaksi kasir di gerai mana pun.
| - supervisor : discope ke satu titik Indomaret miliknya. Penanggung jawab
|                utama approve/reject transaksi kasir toko sendiri. TIDAK
|                punya akses dashboard ringkasan (khusus manager).
| - cashier    : SATU akun per toko dipakai bersama oleh semua kasir fisik
|                di situ. Discope ke toko sendiri. HANYA bisa input
|                pemasukan/barang keluar + lihat riwayat & notifikasi
|                miliknya sendiri (bukan dashboard/peta/laporan). Tiap
|                submit transaksi tetap wajib isi nama+password INDIVIDU
|                (employee_name + employee_password, tabel employees)
|                untuk audit, dan transaksinya berstatus pending sampai
|                disetujui supervisor/manager.
*/

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me/password', [AuthController::class, 'updatePassword']);

    // Notifikasi in-app (semua role, termasuk cashier) - di-poll berkala oleh FE
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    // Kategori barang & data karyawan: semua role login boleh lihat
    // (dibutuhkan cashier untuk dropdown/datalist form input)
    Route::get('/item-categories', [ItemCategoryController::class, 'index']);
    Route::get('/item-categories/{itemCategory}', [ItemCategoryController::class, 'show']);
    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::get('/employees/{employee}', [EmployeeController::class, 'show']);

    // Input transaksi: manager/supervisor (langsung approved) atau
    // cashier toko sendiri (status pending, wajib employee_name+password)
    Route::apiResource('expenses', ExpenseController::class)->except('index', 'show');
    Route::get('/expenses', [ExpenseController::class, 'index']);
    Route::get('/expenses/{expense}', [ExpenseController::class, 'show']);

    Route::apiResource('incomes', IncomeController::class)->except('index', 'show');
    Route::get('/incomes', [IncomeController::class, 'index']);
    Route::get('/incomes/{income}', [IncomeController::class, 'show']);

    // Peta, direktori gerai, & laporan PDF: manager/supervisor saja - cashier
    // TIDAK dapat akses (halaman kasir cuma input transaksi).
    // CATATAN: /dashboard TIDAK ada di grup ini - lihat grup role:manager di
    // bawah, dashboard ringkasan memang khusus manager.
    Route::middleware('role:manager,supervisor')->group(function () {
        Route::get('/stores/map', [StoreController::class, 'map']);
        Route::get('/stores', [StoreController::class, 'index']);
        Route::get('/stores/{store}', [StoreController::class, 'show']);
        // Isi pop-up gerai di peta, diambil saat marker diklik (bukan sekaligus
        // di /stores/map) supaya request awal peta tetap ringan.
        Route::get('/stores/{store}/map-summary', [StoreController::class, 'mapSummary']);
        Route::get('/reports/expenses-incomes/pdf', [ReportController::class, 'expensesIncomes']);

        // Terima/tolak transaksi yang disubmit akun cashier
        Route::post('/expenses/{expense}/approve', [ExpenseController::class, 'approve']);
        Route::post('/expenses/{expense}/reject', [ExpenseController::class, 'reject']);
        Route::post('/incomes/{income}/approve', [IncomeController::class, 'approve']);
        Route::post('/incomes/{income}/reject', [IncomeController::class, 'reject']);
    });

    // Kelola kasir/karyawan INDIVIDU (tabel employees): supervisor gerainya
    // sendiri, manager untuk gerai mana pun
    Route::middleware('role:manager,supervisor')->group(function () {
        Route::post('/employees', [EmployeeController::class, 'store']);
        Route::put('/employees/{employee}', [EmployeeController::class, 'update']);
        Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy']);
    });

    // Dashboard ringkasan, master data & manajemen akun: khusus manager
    // (akun pusat). Supervisor sengaja TIDAK diberi akses dashboard - tugas
    // utamanya input transaksi & menyetujui input cashier gerainya.
    Route::middleware('role:manager')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index']);

        Route::apiResource('regencies', RegencyController::class);

        Route::post('/stores', [StoreController::class, 'store']);
        Route::put('/stores/{store}', [StoreController::class, 'update']);
        Route::delete('/stores/{store}', [StoreController::class, 'destroy']);

        Route::post('/item-categories', [ItemCategoryController::class, 'store']);
        Route::put('/item-categories/{itemCategory}', [ItemCategoryController::class, 'update']);
        Route::delete('/item-categories/{itemCategory}', [ItemCategoryController::class, 'destroy']);

        Route::apiResource('users', UserController::class);
    });
});
