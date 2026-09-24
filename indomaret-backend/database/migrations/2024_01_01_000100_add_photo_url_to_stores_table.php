<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * URL foto gerai (hasil scraping Google Maps di tabel mentah
     * indomaret_surabaya) — dipakai untuk menampilkan foto di halaman
     * Detail Gerai. Nullable karena tidak semua baris data mentah punya
     * foto.
     */
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->text('photo_url')->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('photo_url');
        });
    }
};
