<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Services\EmployeeCredentialService;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Input barang keluar, dikelompokkan PER KATEGORI (bukan per produk).
 *
 * Yang boleh submit: manager/supervisor (langsung approved), atau
 * akun cashier toko (status pending, wajib menyertakan `employee_name` +
 * `employee_password` individu, menunggu persetujuan supervisor/manager
 * sebelum dihitung ke dashboard & laporan).
 */
class ExpenseController extends Controller
{
    public function __construct(
        protected EmployeeCredentialService $credentials,
        protected NotificationService $notifications
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Expense::query()->with(['itemCategory', 'store', 'user', 'employee', 'approvedBy']);

        if ($user->isScopedToOwnStore()) {
            $query->where('store_id', $user->store_id);
        } elseif ($request->filled('store_id')) {
            $query->where('store_id', $request->integer('store_id'));
        }

        if ($request->filled('item_category_id')) {
            $query->where('item_category_id', $request->integer('item_category_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('date', [$request->date('start_date'), $request->date('end_date')]);
        }

        // Pencarian bebas dari tabel di frontend. Sengaja dikerjakan di server
        // (bukan memfilter baris yang sudah terlanjur di-paginate), supaya
        // hasilnya mencakup SELURUH data, bukan cuma halaman yang sedang
        // terbuka.
        if ($request->filled('search')) {
            $term = '%'.str_replace(['%', '_'], ['\%', '\_'], trim($request->string('search'))).'%';
            // ILIKE hanya ada di Postgres; SQLite (dipakai untuk dev cepat &
            // testing) sudah case-insensitive dengan LIKE biasa.
            $like = \Illuminate\Support\Facades\DB::getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';

            $query->where(function ($q) use ($term, $like) {
                $q->whereHas('store', fn ($r) => $r->where('name', $like, $term)->orWhere('store_code', $like, $term))
                    ->orWhereHas('itemCategory', fn ($r) => $r->where('name', $like, $term))
                    ->orWhereHas('user', fn ($r) => $r->where('name', $like, $term))
                    ->orWhereHas('employee', fn ($r) => $r->where('name', $like, $term))
                    ->orWhere('notes', $like, $term);
            });
        }

        $query->orderByDesc('date')->orderByDesc('id');

        // Ringkasan dihitung dari SELURUH data yang cocok dengan filter (bukan
        // cuma baris di halaman yang sedang dibuka) — dipakai kartu KPI di
        // frontend supaya angkanya tidak berubah-ubah tiap pindah halaman.
        $totalsQuery = clone $query;

        $paginated = $query->paginate($request->integer('per_page', 20));

        return response()->json(array_merge($paginated->toArray(), [
            'summary' => [
                'total_value' => (float) (clone $totalsQuery)->sum('value'),
                'total_units' => (int) (clone $totalsQuery)->sum('quantity'),
            ],
        ]));
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'store_id' => [Rule::requiredIf($user->hasUnscopedAccess()), 'nullable', 'exists:stores,id'],
            'item_category_id' => ['required', 'exists:item_categories,id'],
            'date' => ['required', 'date'],
            'quantity' => ['required', 'integer', 'min:1'],
            'unit' => ['nullable', 'string', 'max:50'],
            'value' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'employee_name' => ['nullable', 'string', 'max:255', Rule::requiredIf($user->isCashier()), 'required_with:employee_password'],
            'employee_password' => ['nullable', 'string', 'required_with:employee_name'],
        ]);

        $storeId = $user->isScopedToOwnStore() ? $user->store_id : $data['store_id'];

        $employeeId = null;
        if (! empty($data['employee_name'])) {
            $employee = $this->credentials->verify($storeId, $data['employee_name'], $data['employee_password']);
            $employeeId = $employee->id;
        }

        $isCashier = $user->isCashier();

        $expense = Expense::create([
            'store_id' => $storeId,
            'item_category_id' => $data['item_category_id'],
            'date' => $data['date'],
            'quantity' => $data['quantity'],
            'unit' => $data['unit'] ?? 'pcs',
            'value' => $data['value'],
            'notes' => $data['notes'] ?? null,
            'user_id' => $user->id,
            'employee_id' => $employeeId,
            'status' => $isCashier ? Expense::STATUS_PENDING : Expense::STATUS_APPROVED,
            'approved_by' => $isCashier ? null : $user->id,
            'approved_at' => $isCashier ? null : now(),
        ]);

        if ($isCashier) {
            $this->notifications->transactionPendingApproval(
                $storeId,
                'barang keluar',
                sprintf('%s pcs • Rp%s', number_format($data['quantity']), number_format((float) $data['value'], 0, ',', '.')),
                ['expense_id' => $expense->id, 'store_id' => $storeId]
            );
        }

        return response()->json([
            'data' => $expense->load(['itemCategory', 'store', 'user', 'employee', 'approvedBy']),
        ], 201);
    }

    public function show(Request $request, Expense $expense)
    {
        $this->authorizeAccess($request, $expense);

        return response()->json([
            'data' => $expense->load(['itemCategory', 'store', 'user', 'employee', 'approvedBy']),
        ]);
    }

    public function update(Request $request, Expense $expense)
    {
        $this->authorizeEdit($request, $expense);

        $data = $request->validate([
            'item_category_id' => ['sometimes', 'required', 'exists:item_categories,id'],
            'date' => ['sometimes', 'required', 'date'],
            'quantity' => ['sometimes', 'required', 'integer', 'min:1'],
            'unit' => ['nullable', 'string', 'max:50'],
            'value' => ['sometimes', 'required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $expense->update($data);

        return response()->json([
            'data' => $expense->load(['itemCategory', 'store', 'user', 'employee', 'approvedBy']),
        ]);
    }

    public function destroy(Request $request, Expense $expense)
    {
        $this->authorizeEdit($request, $expense);

        $expense->delete();

        return response()->json(['message' => 'Data pengeluaran dihapus.']);
    }

    /**
     * Supervisor (toko sendiri) atau manager (semua toko) menyetujui transaksi
     * yang disubmit oleh akun cashier.
     */
    public function approve(Request $request, Expense $expense)
    {
        $this->authorizeApproval($request, $expense);

        $expense->update([
            'status' => Expense::STATUS_APPROVED,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => null,
        ]);

        $this->notifications->transactionDecided(
            $expense->store_id,
            true,
            'Barang keluar',
            sprintf('%s pcs • Rp%s', number_format($expense->quantity), number_format((float) $expense->value, 0, ',', '.')),
            ['expense_id' => $expense->id]
        );

        return response()->json(['data' => $expense->load(['itemCategory', 'store', 'user', 'employee', 'approvedBy'])]);
    }

    public function reject(Request $request, Expense $expense)
    {
        $this->authorizeApproval($request, $expense);

        $data = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $expense->update([
            'status' => Expense::STATUS_REJECTED,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => $data['rejection_reason'],
        ]);

        $this->notifications->transactionDecided(
            $expense->store_id,
            false,
            'Barang keluar',
            sprintf('%s pcs • Rp%s', number_format($expense->quantity), number_format((float) $expense->value, 0, ',', '.')),
            ['expense_id' => $expense->id, 'rejection_reason' => $data['rejection_reason']]
        );

        return response()->json(['data' => $expense->load(['itemCategory', 'store', 'user', 'employee', 'approvedBy'])]);
    }

    protected function authorizeAccess(Request $request, Expense $expense): void
    {
        $user = $request->user();

        abort_if(
            $user->isScopedToOwnStore() && $user->store_id !== $expense->store_id,
            403,
            'Anda hanya bisa mengakses data pengeluaran titik Indomaret Anda sendiri.'
        );
    }

    protected function authorizeEdit(Request $request, Expense $expense): void
    {
        $user = $request->user();

        abort_if($user->isCashier(), 403, 'Akun kasir tidak bisa mengubah/menghapus transaksi yang sudah disubmit.');

        $this->authorizeAccess($request, $expense);
    }

    protected function authorizeApproval(Request $request, Expense $expense): void
    {
        $user = $request->user();

        abort_if($user->isCashier(), 403, 'Akun kasir tidak berwenang menyetujui transaksi.');
        $this->authorizeAccess($request, $expense);
        abort_if($expense->status !== Expense::STATUS_PENDING, 422, 'Transaksi ini sudah diputuskan sebelumnya.');
    }
}
