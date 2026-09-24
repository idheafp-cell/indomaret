<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Transaksi barang keluar, dikelompokkan PER KATEGORI barang (bukan
     * per produk spesifik), untuk tiap titik Indomaret.
     *
     * Alur persetujuan: kalau yang submit adalah akun berrole `cashier`,
     * transaksinya berstatus `pending` sampai disetujui oleh
     * supervisor/manager. Kalau yang submit manager/supervisor sendiri,
     * langsung `approved`. Transaksi `pending`/`rejected` TIDAK dihitung
     * ke dashboard & laporan.
     */
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores')->cascadeOnDelete();
            $table->foreignId('item_category_id')->constrained('item_categories')->restrictOnDelete();
            $table->date('date');
            $table->unsignedInteger('quantity');
            $table->string('unit')->default('pcs');
            $table->decimal('value', 15, 2);
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('approved');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['store_id', 'date']);
            $table->index(['item_category_id', 'date']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
