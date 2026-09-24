<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Transaksi pemasukan (pendapatan) harian tiap titik Indomaret.
     */
    public function up(): void
    {
        Schema::create('pemasukans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('indomaret_id')->constrained('indomarets')->cascadeOnDelete();
            $table->date('tanggal');
            $table->decimal('jumlah', 15, 2);
            $table->enum('sumber', ['tunai', 'non_tunai', 'lainnya'])->default('tunai');
            $table->text('keterangan')->nullable();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamps();

            $table->index(['indomaret_id', 'tanggal']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pemasukans');
    }
};
