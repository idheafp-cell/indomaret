<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Master data kabupaten/kota. Sesuai kebutuhan, sistem ini fokus untuk
     * satu kabupaten, tapi dibuat sebagai tabel master supaya fleksibel
     * jika suatu saat cakupan bertambah ke kabupaten lain.
     */
    public function up(): void
    {
        Schema::create('regencies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('province')->nullable();
            $table->timestamps();

            $table->unique(['name', 'province']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('regencies');
    }
};
