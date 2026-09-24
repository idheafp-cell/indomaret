<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Income;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * CRUD data titik/gerai Indomaret. Create/update/delete khusus manager.
 *
 * Supervisor boleh MELIHAT lokasi semua gerai (daftar & peta sebaran),
 * tapi tidak boleh melihat angka keuangan gerai selain miliknya sendiri —
 * lihat flag `show_amounts` di map() dan pengecekan di show().
 */
class StoreController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        // Daftar ini hanya berisi data lokasi/kontak (tanpa angka keuangan),
        // jadi supervisor pun boleh melihat seluruh gerai — dia butuh itu
        // untuk membaca peta sebaran. Pembatasannya ada di show() (detail
        // gerai) dan pada flag `show_amounts` di map().
        $query = Store::query()->with('regency')->orderBy('name');

        if ($request->filled('regency_id')) {
            $query->where('regency_id', $request->integer('regency_id'));
        }

        $data = $query->get()->map(function (Store $store) use ($user) {
            $store->setAttribute(
                'can_view_detail',
                $user->hasUnscopedAccess() || (int) $user->store_id === (int) $store->id
            );

            return $store;
        });

        return response()->json(['data' => $data]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'regency_id' => ['required', 'exists:regencies,id'],
            'store_code' => ['required', 'string', 'max:50', 'unique:stores,store_code'],
            'name' => ['required', 'string', 'max:255'],
            'address' => ['required', 'string'],
            'district' => ['nullable', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'phone' => ['nullable', 'string', 'max:30'],
            'photo_url' => ['nullable', 'string', 'max:2048'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $store = Store::create($data);

        return response()->json(['data' => $store->load('regency')], 201);
    }

    public function show(Request $request, Store $store)
    {
        $this->authorizeAccess($request, $store);

        return response()->json([
            'data' => $store->load('regency', 'supervisors:id,name,email,store_id'),
        ]);
    }

    public function update(Request $request, Store $store)
    {
        $data = $request->validate([
            'regency_id' => ['sometimes', 'required', 'exists:regencies,id'],
            'store_code' => ['sometimes', 'required', 'string', 'max:50', 'unique:stores,store_code,'.$store->id],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'address' => ['sometimes', 'required', 'string'],
            'district' => ['nullable', 'string', 'max:255'],
            'latitude' => ['sometimes', 'required', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'required', 'numeric', 'between:-180,180'],
            'phone' => ['nullable', 'string', 'max:30'],
            'photo_url' => ['nullable', 'string', 'max:2048'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $store->update($data);

        return response()->json(['data' => $store->load('regency')]);
    }

    public function destroy(Store $store)
    {
        $store->delete();

        return response()->json(['message' => 'Data Indomaret dihapus.']);
    }

    /**
     * Data untuk peta sebaran: daftar titik Indomaret + koordinat +
     * ringkasan pengeluaran/pemasukan bulan berjalan (dipakai frontend
     * peta dengan Leaflet).
     *
     * SEMUA titik aktif dikirim ke semua role yang boleh mengakses endpoint
     * ini (manager & supervisor), supaya supervisor tetap bisa membaca peta
     * sebaran secara utuh. Yang dibatasi adalah ANGKA-nya: supervisor cuma
     * mendapat angka keuangan & tren gerainya sendiri, gerai lain dikirim
     * dengan `show_amounts: false` dan nilai null/kosong sehingga
     * frontend hanya menampilkan info lokasi.
     */
    public function map(Request $request)
    {
        $user = $request->user();
        $startOfMonth = now()->startOfMonth()->toDateString();
        $endOfMonth = now()->endOfMonth()->toDateString();

        // Rentang tren harian untuk grafik mini (sparkline) di popup peta —
        // 14 hari terakhir, hanya transaksi berstatus approved yang dihitung.
        $trendDays = 14;
        $trendStart = now()->subDays($trendDays - 1)->startOfDay()->toDateString();
        $trendEnd = now()->endOfDay()->toDateString();

        $query = Store::query()->with('regency')->where('is_active', true);

        $stores = $query->get()->map(function (Store $store) use ($user, $startOfMonth, $endOfMonth, $trendStart, $trendEnd, $trendDays) {
            $canViewAmounts = $user->hasUnscopedAccess()
                || (int) $user->store_id === (int) $store->id;

            if (! $canViewAmounts) {
                return [
                    'id' => $store->id,
                    'store_code' => $store->store_code,
                    'name' => $store->name,
                    'address' => $store->address,
                    'district' => $store->district,
                    'regency' => $store->regency?->name,
                    'latitude' => (float) $store->latitude,
                    'longitude' => (float) $store->longitude,
                    'show_amounts' => false,
                    'total_expense_this_month' => null,
                    'total_income_this_month' => null,
                    'daily_trend' => [],
                ];
            }

            $totalExpense = $store->expenses()
                ->where('status', Expense::STATUS_APPROVED)
                ->whereBetween('date', [$startOfMonth, $endOfMonth])
                ->sum('value');

            $totalIncome = $store->incomes()
                ->where('status', Income::STATUS_APPROVED)
                ->whereBetween('date', [$startOfMonth, $endOfMonth])
                ->sum('amount');

            $incomePerDay = $store->incomes()
                ->where('status', Income::STATUS_APPROVED)
                ->whereBetween('date', [$trendStart, $trendEnd])
                ->selectRaw('date, sum(amount) as total')
                ->groupBy('date')
                ->pluck('total', 'date');

            $expensePerDay = $store->expenses()
                ->where('status', Expense::STATUS_APPROVED)
                ->whereBetween('date', [$trendStart, $trendEnd])
                ->selectRaw('date, sum(value) as total')
                ->groupBy('date')
                ->pluck('total', 'date');

            $dailyTrend = [];
            for ($i = $trendDays - 1; $i >= 0; $i--) {
                $date = Carbon::parse($trendEnd)->subDays($i)->toDateString();
                $dailyTrend[] = [
                    'date' => $date,
                    'income' => (float) ($incomePerDay[$date] ?? 0),
                    'expense' => (float) ($expensePerDay[$date] ?? 0),
                ];
            }

            return [
                'id' => $store->id,
                'store_code' => $store->store_code,
                'name' => $store->name,
                'address' => $store->address,
                'district' => $store->district,
                'regency' => $store->regency?->name,
                'latitude' => (float) $store->latitude,
                'longitude' => (float) $store->longitude,
                'show_amounts' => true,
                'total_expense_this_month' => (float) $totalExpense,
                'total_income_this_month' => (float) $totalIncome,
                'daily_trend' => $dailyTrend,
            ];
        });

        return response()->json(['data' => $stores]);
    }

    /**
     * Isi pop-up detail gerai di peta. Sengaja DIPISAH dari /api/stores/map
     * dan hanya dipanggil saat marker gerai diklik, supaya request awal peta
     * tetap ringan walau jumlah gerainya nanti puluhan (agregasi per kategori
     * di bawah ini butuh beberapa query tambahan per gerai).
     *
     * Supervisor hanya boleh membuka gerainya sendiri (authorizeAccess).
     */
    public function mapSummary(Request $request, Store $store)
    {
        $this->authorizeAccess($request, $store);

        $today = now()->toDateString();
        $yesterday = now()->subDay()->toDateString();
        $startOfMonth = now()->startOfMonth()->toDateString();
        $endOfMonth = now()->endOfMonth()->toDateString();

        // --- KPI 1: jumlah transaksi hari ini + perbandingan ke kemarin ---
        $transactionsOn = function (string $date) use ($store): int {
            return $store->expenses()
                    ->where('status', Expense::STATUS_APPROVED)
                    ->whereDate('date', $date)->count()
                + $store->incomes()
                    ->where('status', Income::STATUS_APPROVED)
                    ->whereDate('date', $date)->count();
        };

        $transactionsToday = $transactionsOn($today);
        $transactionsYesterday = $transactionsOn($yesterday);

        // --- KPI 2: unit barang keluar hari ini ---
        $unitsToday = (int) $store->expenses()
            ->where('status', Expense::STATUS_APPROVED)
            ->whereDate('date', $today)
            ->sum('quantity');

        // --- KPI 3: margin laba bulan berjalan ---
        $incomeThisMonth = (float) $store->incomes()
            ->where('status', Income::STATUS_APPROVED)
            ->whereBetween('date', [$startOfMonth, $endOfMonth])
            ->sum('amount');

        $expenseThisMonth = (float) $store->expenses()
            ->where('status', Expense::STATUS_APPROVED)
            ->whereBetween('date', [$startOfMonth, $endOfMonth])
            ->sum('value');

        // --- Agregasi per kategori (bulan berjalan) ---
        // Dipakai dua tab sekaligus: "Distribusi" memakai kolom unit,
        // "Top Penjualan" memakai kolom nilai + porsinya terhadap total.
        $perCategory = $store->expenses()
            ->where('expenses.status', Expense::STATUS_APPROVED)
            ->whereBetween('expenses.date', [$startOfMonth, $endOfMonth])
            ->join('item_categories', 'item_categories.id', '=', 'expenses.item_category_id')
            ->groupBy('item_categories.id', 'item_categories.name')
            ->selectRaw('item_categories.name as category, sum(expenses.quantity) as unit, sum(expenses.value) as value')
            ->get();

        $totalCategoryValue = (float) $perCategory->sum('value');

        $distribution = $perCategory
            ->sortByDesc(fn ($row) => (int) $row->unit)
            ->values()
            ->map(fn ($row) => [
                'category' => $row->category,
                'unit' => (int) $row->unit,
            ]);

        $topSales = $perCategory
            ->sortByDesc(fn ($row) => (float) $row->value)
            ->values()
            ->map(fn ($row) => [
                'category' => $row->category,
                'value' => (float) $row->value,
                'unit' => (int) $row->unit,
                'percent' => $totalCategoryValue > 0
                    ? round(((float) $row->value / $totalCategoryValue) * 100, 1)
                    : 0.0,
            ]);

        // --- Tren 7 hari terakhir (pemasukan vs beban barang keluar) ---
        $trendDays = 7;
        $trendStart = now()->subDays($trendDays - 1)->toDateString();

        $incomePerDay = $store->incomes()
            ->where('status', Income::STATUS_APPROVED)
            ->whereBetween('date', [$trendStart, $today])
            ->selectRaw('date, sum(amount) as total')
            ->groupBy('date')
            ->pluck('total', 'date');

        $expensePerDay = $store->expenses()
            ->where('status', Expense::STATUS_APPROVED)
            ->whereBetween('date', [$trendStart, $today])
            ->selectRaw('date, sum(value) as total')
            ->groupBy('date')
            ->pluck('total', 'date');

        $dailyTrend = [];
        for ($i = $trendDays - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $dailyTrend[] = [
                'date' => $date,
                'income' => (float) ($incomePerDay[$date] ?? 0),
                'expense' => (float) ($expensePerDay[$date] ?? 0),
            ];
        }

        return response()->json([
            'data' => [
                'id' => $store->id,
                'store_code' => $store->store_code,
                'name' => $store->name,
                'address' => $store->address,
                'district' => $store->district,
                'is_active' => (bool) $store->is_active,

                'transactions_today' => $transactionsToday,
                'transactions_yesterday' => $transactionsYesterday,
                // null kalau kemarin nol — supaya frontend tidak menampilkan
                // kenaikan "tak terhingga" yang menyesatkan.
                'transactions_delta_percent' => $transactionsYesterday > 0
                    ? round((($transactionsToday - $transactionsYesterday) / $transactionsYesterday) * 100, 1)
                    : null,

                'units_out_today' => $unitsToday,

                'income_this_month' => $incomeThisMonth,
                'expense_this_month' => $expenseThisMonth,
                'margin_percent' => $incomeThisMonth > 0
                    ? round((($incomeThisMonth - $expenseThisMonth) / $incomeThisMonth) * 100, 1)
                    : null,

                'distribution' => $distribution,
                'top_sales' => $topSales,
                'daily_trend' => $dailyTrend,
            ],
        ]);
    }

    protected function authorizeAccess(Request $request, Store $store): void
    {
        $user = $request->user();

        abort_if(
            $user->isSupervisor() && $user->store_id !== $store->id,
            403,
            'Anda hanya bisa mengakses data titik Indomaret Anda sendiri.'
        );
    }
}
