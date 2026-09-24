<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Income;
use App\Services\EmployeeCredentialService;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Input pemasukan (pendapatan) harian per titik Indomaret. Sama seperti
 * ExpenseController: manager/supervisor langsung approved, akun
 * cashier toko berstatus pending sampai disetujui.
 */
class IncomeController extends Controller
{
    public function __construct(
        protected EmployeeCredentialService $credentials,
        protected NotificationService $notifications
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Income::query()->with(['store', 'user', 'employee', 'approvedBy']);

        if ($user->isScopedToOwnStore()) {
            $query->where('store_id', $user->store_id);
        } elseif ($request->filled('store_id')) {
            $query->where('store_id', $request->integer('store_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('date', [$request->date('start_date'), $request->date('end_date')]);
        }

        // Pencarian bebas dari tabel di frontend — dikerjakan di server supaya
        // mencakup SELURUH data, bukan cuma halaman yang sedang terbuka.
        if ($request->filled('search')) {
            $term = '%'.str_replace(['%', '_'], ['\%', '\_'], trim($request->string('search'))).'%';
            // ILIKE hanya ada di Postgres; SQLite (dipakai untuk dev cepat &
            // testing) sudah case-insensitive dengan LIKE biasa.
            $like = \Illuminate\Support\Facades\DB::getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';

            $query->where(function ($q) use ($term, $like) {
                $q->whereHas('store', fn ($r) => $r->where('name', $like, $term)->orWhere('store_code', $like, $term))
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
                'total_amount' => (float) (clone $totalsQuery)->sum('amount'),
            ],
        ]));
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'store_id' => [Rule::requiredIf($user->hasUnscopedAccess()), 'nullable', 'exists:stores,id'],
            'date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'min:0'],
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

        $income = Income::create([
            'store_id' => $storeId,
            'date' => $data['date'],
            'amount' => $data['amount'],
            'notes' => $data['notes'] ?? null,
            'user_id' => $user->id,
            'employee_id' => $employeeId,
            'status' => $isCashier ? Income::STATUS_PENDING : Income::STATUS_APPROVED,
            'approved_by' => $isCashier ? null : $user->id,
            'approved_at' => $isCashier ? null : now(),
        ]);

        if ($isCashier) {
            $this->notifications->transactionPendingApproval(
                $storeId,
                'pemasukan',
                sprintf('Rp%s', number_format((float) $data['amount'], 0, ',', '.')),
                ['income_id' => $income->id, 'store_id' => $storeId]
            );
        }

        return response()->json([
            'data' => $income->load(['store', 'user', 'employee', 'approvedBy']),
        ], 201);
    }

    public function show(Request $request, Income $income)
    {
        $this->authorizeAccess($request, $income);

        return response()->json([
            'data' => $income->load(['store', 'user', 'employee', 'approvedBy']),
        ]);
    }

    public function update(Request $request, Income $income)
    {
        $this->authorizeEdit($request, $income);

        $data = $request->validate([
            'date' => ['sometimes', 'required', 'date'],
            'amount' => ['sometimes', 'required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $income->update($data);

        return response()->json([
            'data' => $income->load(['store', 'user', 'employee', 'approvedBy']),
        ]);
    }

    public function destroy(Request $request, Income $income)
    {
        $this->authorizeEdit($request, $income);

        $income->delete();

        return response()->json(['message' => 'Data pemasukan dihapus.']);
    }

    public function approve(Request $request, Income $income)
    {
        $this->authorizeApproval($request, $income);

        $income->update([
            'status' => Income::STATUS_APPROVED,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => null,
        ]);

        $this->notifications->transactionDecided(
            $income->store_id,
            true,
            'Pemasukan',
            sprintf('Rp%s', number_format((float) $income->amount, 0, ',', '.')),
            ['income_id' => $income->id]
        );

        return response()->json(['data' => $income->load(['store', 'user', 'employee', 'approvedBy'])]);
    }

    public function reject(Request $request, Income $income)
    {
        $this->authorizeApproval($request, $income);

        $data = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $income->update([
            'status' => Income::STATUS_REJECTED,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => $data['rejection_reason'],
        ]);

        $this->notifications->transactionDecided(
            $income->store_id,
            false,
            'Pemasukan',
            sprintf('Rp%s', number_format((float) $income->amount, 0, ',', '.')),
            ['income_id' => $income->id, 'rejection_reason' => $data['rejection_reason']]
        );

        return response()->json(['data' => $income->load(['store', 'user', 'employee', 'approvedBy'])]);
    }

    protected function authorizeAccess(Request $request, Income $income): void
    {
        $user = $request->user();

        abort_if(
            $user->isScopedToOwnStore() && $user->store_id !== $income->store_id,
            403,
            'Anda hanya bisa mengakses data pemasukan titik Indomaret Anda sendiri.'
        );
    }

    protected function authorizeEdit(Request $request, Income $income): void
    {
        $user = $request->user();

        abort_if($user->isCashier(), 403, 'Akun kasir tidak bisa mengubah/menghapus transaksi yang sudah disubmit.');

        $this->authorizeAccess($request, $income);
    }

    protected function authorizeApproval(Request $request, Income $income): void
    {
        $user = $request->user();

        abort_if($user->isCashier(), 403, 'Akun kasir tidak berwenang menyetujui transaksi.');
        $this->authorizeAccess($request, $income);
        abort_if($income->status !== Income::STATUS_PENDING, 422, 'Transaksi ini sudah diputuskan sebelumnya.');
    }
}
