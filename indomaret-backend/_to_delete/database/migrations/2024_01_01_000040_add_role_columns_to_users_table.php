<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Menambahkan kolom role & relasi indomaret ke tabel users bawaan Laravel.
     * Dua role dasar: manager (akun pusat, akses penuh) dan supervisor
     * (penanggung jawab satu titik Indomaret). Role `kasir` ditambahkan
     * migration berikutnya (2024_02_01_000010).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['manager', 'supervisor'])->default('supervisor')->after('email');
            $table->foreignId('indomaret_id')->nullable()->after('role')
                ->constrained('indomarets')->nullOnDelete();
            $table->string('phone')->nullable()->after('indomaret_id');
            $table->boolean('is_active')->default(true)->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('indomaret_id');
            $table->dropColumn(['role', 'phone', 'is_active']);
        });
    }
};
