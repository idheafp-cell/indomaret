<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KategoriBarang;
use Illuminate\Http\Request;

/**
 * Master kategori barang. Semua role bisa melihat (untuk dipakai di form
 * input pengeluaran), tapi hanya manager yang boleh create/update/delete.
 */
class KategoriBarangController extends Controller
{
    public function index(Request $request)
    {
        $query = KategoriBarang::query()->orderBy('nama');

        if ($request->boolean('aktif_saja')) {
            $query->where('is_active', true);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nama' => ['required', 'string', 'max:255', 'unique:kategori_barangs,nama'],
            'deskripsi' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $kategori = KategoriBarang::create($data);

        return response()->json(['data' => $kategori], 201);
    }

    public function show(KategoriBarang $kategoriBarang)
    {
        return response()->json(['data' => $kategoriBarang]);
    }

    public function update(Request $request, KategoriBarang $kategoriBarang)
    {
        $data = $request->validate([
            'nama' => ['sometimes', 'required', 'string', 'max:255', 'unique:kategori_barangs,nama,'.$kategoriBarang->id],
            'deskripsi' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $kategoriBarang->update($data);

        return response()->json(['data' => $kategoriBarang]);
    }

    public function destroy(KategoriBarang $kategoriBarang)
    {
        $kategoriBarang->delete();

        return response()->json(['message' => 'Kategori barang dihapus.']);
    }
}
