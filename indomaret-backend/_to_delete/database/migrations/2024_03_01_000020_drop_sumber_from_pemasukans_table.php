<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Field `sumber` (tunai/non_tunai/lainnya) di pemasukan DIHAPUS atas
     * permintaan user — sudah tidak dipakai di form input, tabel, maupun
     * laporan. Di Postgres kolom ini dibuat lewat Schema::enum() yang jadi
     * CHECK constraint; constraint itu otomatis ikut hilang saat kolomnya
     * di-drop, tidak perlu penanganan khusus seperti migrasi role.
     */
    public function up(): void
    {
        Schema::table('pemasukans', function (Blueprint $table) {
            $table->dropColumn('sumber');
        });
    }

    public function down(): void
    {
        Schema::table('pemasukans', function (Blueprint $table) {
            $table->enum('sumber', ['tunai', 'non_tunai', 'lainnya'])->default('tunai')->after('jumlah');
        });
    }
};
