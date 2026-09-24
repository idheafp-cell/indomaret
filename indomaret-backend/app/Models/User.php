<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /**
     * Catatan: proyek ini TIDAK memakai sistem Notification bawaan Laravel
     * (trait Notifiable + tabel notifications polymorphic-nya). Notifikasi
     * in-app di aplikasi ini pakai model App\Models\Notification sendiri
     * (tabel `notifications` custom, lihat migration
     * 2024_01_01_000090_create_notifications_table) supaya skema & query-nya
     * simpel dan sesuai kebutuhan (1 tipe notifikasi, bukan polymorphic).
     */

    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory;

    public const ROLE_MANAGER = 'manager';

    public const ROLE_SUPERVISOR = 'supervisor';

    public const ROLE_CASHIER = 'cashier';

    /** Semua role yang valid, urut dari akses terluas ke tersempit. */
    public const ROLES = [
        self::ROLE_MANAGER,
        self::ROLE_SUPERVISOR,
        self::ROLE_CASHIER,
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'store_id',
        'phone',
        'is_active',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function isManager(): bool
    {
        return $this->role === self::ROLE_MANAGER;
    }

    public function isSupervisor(): bool
    {
        return $this->role === self::ROLE_SUPERVISOR;
    }

    public function isCashier(): bool
    {
        return $this->role === self::ROLE_CASHIER;
    }

    /**
     * Manager (akun pusat) melihat data di seluruh kabupaten dan tidak
     * discope ke satu titik Indomaret. Supervisor & cashier hanya melihat
     * titik mereka sendiri (lewat kolom store_id).
     */
    public function hasUnscopedAccess(): bool
    {
        return $this->isManager();
    }

    /**
     * Supervisor & cashier terikat ke satu titik Indomaret lewat store_id.
     */
    public function isScopedToOwnStore(): bool
    {
        return $this->isSupervisor() || $this->isCashier();
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function incomes(): HasMany
    {
        return $this->hasMany(Income::class);
    }

    public function createdEmployees(): HasMany
    {
        return $this->hasMany(Employee::class, 'created_by');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class)->latest();
    }
}
