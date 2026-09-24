<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Menambahkan kolom role & relasi store ke tabel users bawaan Laravel.
     * Tiga role login (Sanctum token):
     * - manager    : akun pusat, akses penuh ke SEMUA titik Indomaret
     *                se-kabupaten (dashboard, peta, transaksi, laporan)
     *                sekaligus satu-satunya yang boleh kelola akun & master
     *                data, dan bisa approve/reject transaksi kasir di gerai
     *                mana pun.
     * - supervisor : discope ke satu titik Indomaret miliknya (store_id).
     * - cashier    : satu akun dipakai bersama oleh semua kasir fisik di
     *                satu titik Indomaret (login bersama), tapi tetap
     *                wajib isi nama+password individu (tabel employees)
     *                tiap submit transaksi untuk audit. Transaksinya
     *                berstatus pending sampai disetujui supervisor/manager.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['manager', 'supervisor', 'cashier'])->default('supervisor')->after('email');
            $table->foreignId('store_id')->nullable()->after('role')
                ->constrained('stores')->nullOnDelete();
            $table->string('phone')->nullable()->after('store_id');
            $table->boolean('is_active')->default(true)->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('store_id');
            $table->dropColumn(['role', 'phone', 'is_active']);
        });
    }
};
