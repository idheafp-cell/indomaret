<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Regency;
use Illuminate\Http\Request;

/**
 * Master data kabupaten. Hanya manager yang boleh kelola (lihat routes/api.php).
 */
class RegencyController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Regency::withCount('stores')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'province' => ['nullable', 'string', 'max:255'],
        ]);

        $regency = Regency::create($data);

        return response()->json(['data' => $regency], 201);
    }

    public function show(Regency $regency)
    {
        return response()->json([
            'data' => $regency->load('stores'),
        ]);
    }

    public function update(Request $request, Regency $regency)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'province' => ['nullable', 'string', 'max:255'],
        ]);

        $regency->update($data);

        return response()->json(['data' => $regency]);
    }

    public function destroy(Regency $regency)
    {
        $regency->delete();

        return response()->json(['message' => 'Kabupaten dihapus.']);
    }
}
