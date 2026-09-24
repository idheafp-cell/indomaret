<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Dikelola khusus oleh manager: mengatur akun manager/supervisor/cashier.
 * Supervisor & cashier wajib di-assign ke satu titik Indomaret
 * (store_id). Akun cashier biasanya HANYA SATU per toko dan dipakai
 * bersama oleh semua kasir fisik di toko itu (mereka tetap wajib
 * mengisi nama+password individu -- lihat tabel employees -- tiap
 * submit transaksi untuk audit).
 */
class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->with('store')->orderBy('name');

        if ($request->filled('role')) {
            $query->where('role', $request->string('role'));
        }

        if ($request->filled('store_id')) {
            $query->where('store_id', $request->integer('store_id'));
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(User::ROLES)],
            'store_id' => [
                Rule::requiredIf(fn () => in_array($request->input('role'), [User::ROLE_SUPERVISOR, User::ROLE_CASHIER], true)),
                'nullable',
                'exists:stores,id',
                function ($attribute, $value, $fail) use ($request) {
                    if ($request->input('role') !== User::ROLE_CASHIER || ! $value) {
                        return;
                    }
                    if (User::where('store_id', $value)->where('role', User::ROLE_CASHIER)->exists()) {
                        $fail('Toko ini sudah punya akun kasir. Satu toko hanya boleh punya satu akun kasir bersama.');
                    }
                },
            ],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $user = User::create($data);

        return response()->json(['data' => $user->load('store')], 201);
    }

    public function show(User $user)
    {
        return response()->json(['data' => $user->load('store')]);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'unique:users,email,'.$user->id],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
            'role' => ['sometimes', 'required', Rule::in(User::ROLES)],
            'store_id' => [
                'nullable',
                'exists:stores,id',
                function ($attribute, $value, $fail) use ($request, $user) {
                    $role = $request->input('role', $user->role);
                    if ($role !== User::ROLE_CASHIER || ! $value) {
                        return;
                    }
                    $exists = User::where('store_id', $value)
                        ->where('role', User::ROLE_CASHIER)
                        ->where('id', '!=', $user->id)
                        ->exists();
                    if ($exists) {
                        $fail('Toko ini sudah punya akun kasir. Satu toko hanya boleh punya satu akun kasir bersama.');
                    }
                },
            ],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $user->update($data);

        return response()->json(['data' => $user->load('store')]);
    }

    public function destroy(User $user)
    {
        $user->delete();

        return response()->json(['message' => 'Akun user dihapus.']);
    }
}
