<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Income;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Data ringkasan untuk halaman dashboard. **Khusus manager** - supervisor
 * maupun cashier tidak punya akses ke endpoint ini sama sekali (di-gate
 * middleware `role:manager`, lihat routes/api.php).
 *
 * Logika scope-per-gerai di bawah tetap dipertahankan sebagai pengaman
 * kalau suatu saat endpoint ini dibuka lagi untuk role yang discope.
 *
 * Hanya transaksi berstatus `approved` yang dihitung ke total/grafik -
 * transaksi `pending` (menunggu persetujuan) & `rejected` sengaja
 * dikecualikan supaya angka dashboard selalu mencerminkan data yang sudah
 * diverifikasi.
 */
class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $start = $request->filled('start_date')
            ? Carbon::parse($request->string('start_date'))->startOfDay()
            : now()->startOfMonth();

        $end = $request->filled('end_date')
            ? Carbon::parse($request->string('end_date'))->endOfDay()
            : now()->endOfMonth();

        $expenseQuery = Expense::query()
            ->where('status', Expense::STATUS_APPROVED)
            ->whereBetween('date', [$start, $end]);
        $incomeQuery = Income::query()
            ->where('status', Income::STATUS_APPROVED)
            ->whereBetween('date', [$start, $end]);

        $pendingQuery = null;

        if ($user->isScopedToOwnStore()) {
            $expenseQuery->where('store_id', $user->store_id);
            $incomeQuery->where('store_id', $user->store_id);
            $pendingQuery = fn ($model) => $model::query()
                ->where('store_id', $user->store_id)
                ->where('status', $model::STATUS_PENDING);
        } else {
            if ($request->filled('store_id')) {
                $expenseQuery->where('store_id', $request->integer('store_id'));
                $incomeQuery->where('store_id', $request->integer('store_id'));
            }
            $pendingQuery = fn ($model) => $model::query()->where('status', $model::STATUS_PENDING);
        }

        $totalExpense = (clone $expenseQuery)->sum('value');
        $totalIncome = (clone $incomeQuery)->sum('amount');

        $expenseByCategory = (clone $expenseQuery)
            ->selectRaw('item_category_id, sum(value) as total, sum(quantity) as total_units')
            ->with('itemCategory:id,name')
            ->groupBy('item_category_id')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'category' => $row->itemCategory?->name ?? 'Tidak diketahui',
                'total_value' => (float) $row->total,
                'total_units' => (int) $row->total_units,
            ]);

        $dailyExpenseTrend = (clone $expenseQuery)
            ->selectRaw('date, sum(value) as total')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => ['date' => $row->date->toDateString(), 'total' => (float) $row->total]);

        $dailyIncomeTrend = (clone $incomeQuery)
            ->selectRaw('date, sum(amount) as total')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => ['date' => $row->date->toDateString(), 'total' => (float) $row->total]);

        $response = [
            'period' => [
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
            ],
            'summary' => [
                'total_expense' => (float) $totalExpense,
                'total_income' => (float) $totalIncome,
                'estimated_profit' => (float) $totalIncome - (float) $totalExpense,
            ],
            'expense_by_category' => $expenseByCategory,
            'daily_expense_trend' => $dailyExpenseTrend,
            'daily_income_trend' => $dailyIncomeTrend,
            'pending_approval' => [
                'expense' => $pendingQuery(Expense::class)->count(),
                'income' => $pendingQuery(Income::class)->count(),
            ],
        ];

        if ($user->hasUnscopedAccess()) {
            $response['store_count'] = [
                'total' => Store::count(),
                'active' => Store::where('is_active', true)->count(),
            ];

            $response['top_stores_by_income'] = Income::query()
                ->where('status', Income::STATUS_APPROVED)
                ->whereBetween('date', [$start, $end])
                ->selectRaw('store_id, sum(amount) as total')
                ->with('store:id,name,store_code')
                ->groupBy('store_id')
                ->orderByDesc('total')
                ->limit(5)
                ->get()
                ->map(fn ($row) => [
                    'store' => $row->store?->name,
                    'store_code' => $row->store?->store_code,
                    'total_income' => (float) $row->total,
                ]);
        }

        return response()->json(['data' => $response]);
    }
}
