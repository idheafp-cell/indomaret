<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Income;
use App\Models\Store;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Generate laporan PDF pengeluaran & pemasukan per titik Indomaret,
 * memakai package barryvdh/laravel-dompdf.
 */
class ReportController extends Controller
{
    public function expensesIncomes(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'store_id' => ['nullable', 'exists:stores,id'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        $start = $request->filled('start_date')
            ? Carbon::parse($request->string('start_date'))->startOfDay()
            : now()->startOfMonth();

        $end = $request->filled('end_date')
            ? Carbon::parse($request->string('end_date'))->endOfDay()
            : now()->endOfMonth();

        if ($user->isScopedToOwnStore()) {
            $storeId = $user->store_id;
        } else {
            $storeId = $request->integer('store_id') ?: null;
        }

        abort_if(
            $user->hasUnscopedAccess() && ! $storeId,
            422,
            'Manager wajib menentukan store_id untuk laporan per titik.'
        );

        $store = Store::with('regency')->findOrFail($storeId);

        $expenses = Expense::with('itemCategory', 'employee')
            ->where('store_id', $storeId)
            ->where('status', Expense::STATUS_APPROVED)
            ->whereBetween('date', [$start, $end])
            ->orderBy('date')
            ->get();

        $incomes = Income::with('employee')
            ->where('store_id', $storeId)
            ->where('status', Income::STATUS_APPROVED)
            ->whereBetween('date', [$start, $end])
            ->orderBy('date')
            ->get();

        $totalExpense = $expenses->sum('value');
        $totalIncome = $incomes->sum('amount');

        $pdf = Pdf::loadView('reports.expenses-incomes', [
            'store' => $store,
            'period' => ['start' => $start, 'end' => $end],
            'expenses' => $expenses,
            'incomes' => $incomes,
            'totalExpense' => $totalExpense,
            'totalIncome' => $totalIncome,
            'printedBy' => $user,
        ])->setPaper('a4', 'portrait');

        $filename = sprintf(
            'laporan-%s-%s-%s.pdf',
            $store->store_code,
            $start->format('Ymd'),
            $end->format('Ymd')
        );

        return $pdf->download($filename);
    }
}
