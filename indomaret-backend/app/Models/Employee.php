<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Karyawan / kasir individu di satu titik Indomaret.
 *
 * Employee BEDA dengan User(role=cashier): User role cashier adalah SATU
 * akun login yang dipakai bersama oleh semua kasir fisik di satu toko
 * (supaya mereka bisa masuk ke Kasir Dashboard). Employee di model ini
 * adalah identitas individu (nama + password singkat) yang wajib diisi
 * tiap kali submit transaksi, supaya tetap tercatat siapa sebenarnya yang
 * input (kolom employee_id di expenses/incomes), terlepas dari akun login
 * mana yang dipakai. Lihat EmployeeCredentialService untuk verifikasinya.
 */
class Employee extends Model
{
    use HasFactory;

    protected $fillable = [
        'store_id',
        'name',
        'password',
        'is_active',
        'created_by',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function incomes(): HasMany
    {
        return $this->hasMany(Income::class);
    }
}
