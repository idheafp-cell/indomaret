<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Data karyawan/kasir INDIVIDU (nama+password singkat untuk audit, beda
 * dengan akun login User role cashier yang dipakai bersama). Supervisor
 * hanya bisa mengelola karyawan di titik Indomaret miliknya sendiri.
 * Akun kasir toko juga boleh melihat daftar ini (dibutuhkan untuk saran
 * nama di form input), discope ke toko sendiri. Manager (akun pusat) bisa
 * melihat & mengelola karyawan di gerai mana pun, tapi wajib menyebutkan
 * `store_id` saat membuat karyawan baru karena dia tidak terikat ke
 * satu gerai.
 */
class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Employee::query()->with('store')->orderBy('name');

        if ($user->isScopedToOwnStore()) {
            $query->where('store_id', $user->store_id);
        } elseif ($request->filled('store_id')) {
            $query->where('store_id', $request->integer('store_id'));
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        // Supervisor otomatis terkunci ke gerainya sendiri; manager (tidak
        // punya store_id) wajib memilih gerai tujuan secara eksplisit.
        $storeId = $user->isScopedToOwnStore()
            ? $user->store_id
            : $request->integer('store_id');

        $data = $request->validate([
            'store_id' => [
                Rule::requiredIf(fn () => ! $user->isScopedToOwnStore()),
                'nullable',
                'exists:stores,id',
            ],
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('employees', 'name')->where('store_id', $storeId),
            ],
            'password' => ['required', 'string', 'min:4'],
        ]);

        $employee = Employee::create([
            'store_id' => $storeId,
            'name' => $data['name'],
            'password' => $data['password'],
            'created_by' => $user->id,
        ]);

        return response()->json(['data' => $employee], 201);
    }

    public function show(Request $request, Employee $employee)
    {
        $this->authorizeAccess($request, $employee);

        return response()->json(['data' => $employee->load('store')]);
    }

    public function update(Request $request, Employee $employee)
    {
        $this->authorizeAccess($request, $employee);

        $data = $request->validate([
            'name' => [
                'sometimes', 'required', 'string', 'max:255',
                Rule::unique('employees', 'name')->where('store_id', $employee->store_id)->ignore($employee->id),
            ],
            'password' => ['sometimes', 'nullable', 'string', 'min:4'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $employee->update($data);

        return response()->json(['data' => $employee]);
    }

    public function destroy(Request $request, Employee $employee)
    {
        $this->authorizeAccess($request, $employee);

        $employee->delete();

        return response()->json(['message' => 'Data karyawan dihapus.']);
    }

    protected function authorizeAccess(Request $request, Employee $employee): void
    {
        $user = $request->user();

        abort_if(
            $user->isScopedToOwnStore() && $user->store_id !== $employee->store_id,
            403,
            'Anda hanya bisa mengelola karyawan di titik Indomaret Anda sendiri.'
        );
    }
}
