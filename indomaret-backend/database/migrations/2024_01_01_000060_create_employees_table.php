<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Data karyawan/kasir di tiap titik Indomaret. Karyawan TIDAK punya
     * akun login penuh (tidak masuk tabel users) - mereka hanya perlu
     * memasukkan nama & password singkat (PIN) saat input transaksi,
     * supaya setiap pengeluaran/pemasukan tetap tercatat siapa yang
     * benar-benar menginputnya (untuk keperluan audit).
     */
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores')->cascadeOnDelete();
            $table->string('name');
            $table->string('password');
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['store_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
