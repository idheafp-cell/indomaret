<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ItemCategory;
use Illuminate\Http\Request;

/**
 * Master kategori barang. Semua role bisa melihat (untuk dipakai di form
 * input pengeluaran), tapi hanya manager yang boleh create/update/delete.
 */
class ItemCategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = ItemCategory::query()->orderBy('name');

        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:item_categories,name'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $itemCategory = ItemCategory::create($data);

        return response()->json(['data' => $itemCategory], 201);
    }

    public function show(ItemCategory $itemCategory)
    {
        return response()->json(['data' => $itemCategory]);
    }

    public function update(Request $request, ItemCategory $itemCategory)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255', 'unique:item_categories,name,'.$itemCategory->id],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $itemCategory->update($data);

        return response()->json(['data' => $itemCategory]);
    }

    public function destroy(ItemCategory $itemCategory)
    {
        $itemCategory->delete();

        return response()->json(['message' => 'Kategori barang dihapus.']);
    }
}
