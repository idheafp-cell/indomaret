<?php

namespace App\Services;

use App\Models\Employee;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Memverifikasi identitas karyawan/kasir (nama + password) saat mereka
 * menginput data pengeluaran atau pemasukan di titik Indomaret milik
 * supervisor yang sedang login.
 */
class EmployeeCredentialService
{
    public function verify(int $storeId, string $name, string $password): Employee
    {
        $employee = Employee::query()
            ->where('store_id', $storeId)
            ->where('name', $name)
            ->first();

        if (! $employee || ! $employee->is_active || ! Hash::check($password, $employee->password)) {
            throw ValidationException::withMessages([
                'employee_password' => ['Nama atau password karyawan tidak sesuai.'],
            ]);
        }

        return $employee;
    }
}
