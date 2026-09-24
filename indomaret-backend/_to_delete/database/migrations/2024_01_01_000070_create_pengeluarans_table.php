<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Transaksi barang keluar, dikelompokkan PER KATEGORI barang
     * (bukan per produk spesifik), untuk tiap titik Indomaret.
     */
    public function up(): void
    {
        Schema::create('pengeluarans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('indomaret_id')->constrained('indomarets')->cascadeOnDelete();
            $table->foreignId('kategori_barang_id')->constrained('kategori_barangs')->restrictOnDelete();
            $table->date('tanggal');
            $table->unsignedInteger('jumlah_barang');
            $table->string('satuan')->default('pcs');
            $table->decimal('nilai', 15, 2);
            $table->text('keterangan')->nullable();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamps();

            $table->index(['indomaret_id', 'tanggal']);
            $table->index(['kategori_barang_id', 'tanggal']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pengeluarans');
    }
};
