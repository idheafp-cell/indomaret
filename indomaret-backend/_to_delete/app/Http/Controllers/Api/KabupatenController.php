<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Kabupaten;
use Illuminate\Http\Request;

/**
 * Master data kabupaten. Hanya manager yang boleh kelola (lihat routes/api.php).
 */
class KabupatenController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Kabupaten::withCount('indomarets')->orderBy('nama')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nama' => ['required', 'string', 'max:255'],
            'provinsi' => ['nullable', 'string', 'max:255'],
        ]);

        $kabupaten = Kabupaten::create($data);

        return response()->json(['data' => $kabupaten], 201);
    }

    public function show(Kabupaten $kabupaten)
    {
        return response()->json([
            'data' => $kabupaten->load('indomarets'),
        ]);
    }

    public function update(Request $request, Kabupaten $kabupaten)
    {
        $data = $request->validate([
            'nama' => ['sometimes', 'required', 'string', 'max:255'],
            'provinsi' => ['nullable', 'string', 'max:255'],
        ]);

        $kabupaten->update($data);

        return response()->json(['data' => $kabupaten]);
    }

    public function destroy(Kabupaten $kabupaten)
    {
        $kabupaten->delete();

        return response()->json(['message' => 'Kabupaten dihapus.']);
    }
}
