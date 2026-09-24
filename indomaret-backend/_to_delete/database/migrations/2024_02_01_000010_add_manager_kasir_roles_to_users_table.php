<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Perluasan role dari 2 (manager, supervisor) jadi 3:
     * - manager    : akun pusat, akses penuh ke SEMUA titik Indomaret
     *                se-kabupaten (dashboard, peta, transaksi, laporan)
     *                sekaligus satu-satunya yang boleh kelola akun &
     *                master data.
     * - supervisor : discope ke satu titik Indomaret miliknya (tidak berubah).
     * - kasir      : role login BARU. Satu akun kasir dipakai bersama oleh
     *                banyak kasir fisik di satu titik Indomaret (login
     *                bersama), tapi tetap wajib isi nama+password individu
     *                (tabel employees) tiap submit transaksi untuk audit.
     *                Kasir cuma bisa input pemasukan/barang keluar milik
     *                toko sendiri, dan transaksinya berstatus pending
     *                sampai disetujui supervisor/manager.
     *
     * Kolom `role` dibuat via Schema::enum() yang di Postgres menjadi CHECK
     * constraint (bukan native ENUM type), jadi diperluas lewat SQL mentah
     * biar tidak perlu doctrine/dbal untuk ->change(). Nama constraint-nya
     * dicari secara dinamis (bukan di-hardcode) supaya migration ini tetap
     * jalan walau nama constraint auto-generate Postgres sedikit berbeda.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            // SQLite/lainnya: kolom disimpan sebagai varchar tanpa CHECK
            // constraint ketat dari Laravel, jadi tidak perlu tindakan apa pun.
            return;
        }

        $constraint = DB::selectOne(<<<'SQL'
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'users'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%role%'
        SQL);

        if ($constraint) {
            DB::statement('ALTER TABLE users DROP CONSTRAINT '.$constraint->conname);
        }

        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('manager','supervisor','kasir'))");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('UPDATE users SET role = ? WHERE role = ?', ['supervisor', 'kasir']);

        $constraint = DB::selectOne(<<<'SQL'
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'users'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%role%'
        SQL);

        if ($constraint) {
            DB::statement('ALTER TABLE users DROP CONSTRAINT '.$constraint->conname);
        }

        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('manager','supervisor'))");
    }
};
