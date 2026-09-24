<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Data titik/gerai Indomaret dalam satu kabupaten, lengkap dengan
     * koordinat (latitude/longitude) untuk kebutuhan peta sebaran.
     */
    public function up(): void
    {
        Schema::create('indomarets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kabupaten_id')->constrained('kabupatens')->cascadeOnDelete();
            $table->string('kode_toko')->unique();
            $table->string('nama');
            $table->text('alamat');
            $table->string('kecamatan')->nullable();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->string('no_telp')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['latitude', 'longitude']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('indomarets');
    }
};
