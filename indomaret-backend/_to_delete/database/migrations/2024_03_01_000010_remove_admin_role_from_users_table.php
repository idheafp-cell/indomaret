<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Role `admin` DIHAPUS dari sistem. Tugasnya diambil alih sepenuhnya oleh
     * role `manager`, yang sekarang menjadi satu-satunya akun pusat:
     * akses baca ke semua titik Indomaret + kelola akun & master data +
     * approve/reject transaksi kasir di gerai mana pun.
     *
     * Sisa role: manager, supervisor, kasir.
     *
     * Migration ini aman dijalankan di database lama (akun admin yang sudah
     * ada otomatis dipromosikan jadi manager sehingga tidak ada akun yang
     * terkunci) maupun di database baru hasil `migrate:fresh` (UPDATE-nya
     * tidak mengenai baris apa pun).
     */
    public function up(): void
    {
        DB::statement('UPDATE users SET role = ? WHERE role = ?', ['manager', 'admin']);

        $this->setRoleCheck(['manager', 'supervisor', 'kasir']);
    }

    public function down(): void
    {
        $this->setRoleCheck(['admin', 'manager', 'supervisor', 'kasir']);
    }

    /**
     * Kolom `role` dibuat lewat Schema::enum() yang di Postgres menjadi CHECK
     * constraint (bukan native ENUM type). Nama constraint-nya dicari dinamis
     * lewat pg_constraint supaya tidak perlu doctrine/dbal untuk ->change().
     * Driver lain (mis. SQLite untuk testing) menyimpan kolom ini sebagai
     * varchar tanpa CHECK ketat, jadi tidak perlu tindakan apa pun.
     *
     * @param  list<string>  $roles
     */
    private function setRoleCheck(array $roles): void
    {
        if (DB::getDriverName() !== 'pgsql') {
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

        $list = implode(',', array_map(fn (string $role) => "'".$role."'", $roles));

        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ({$list}))");
    }
};
