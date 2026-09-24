<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pemasukan;
use App\Services\EmployeeCredentialService;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Input pemasukan (pendapatan) harian per titik Indomaret. Sama seperti
 * PemasukanController: manager/supervisor langsung approved, akun
 * kasir toko berstatus pending sampai disetujui.
 */
class PemasukanController extends Controller
{
    public function __construct(
        protected EmployeeCredentialService $credentials,
        protected NotificationService $notifications
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Pemasukan::query()->with(['indomaret', 'user', 'employee', 'approvedBy']);

        if ($user->isScopedToOwnStore()) {
            $query->where('indomaret_id', $user->indomaret_id);
        } elseif ($request->filled('indomaret_id')) {
            $query->where('indomaret_id', $request->integer('indomaret_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('tanggal', [$request->date('start_date'), $request->date('end_date')]);
        }

        // Pencarian bebas dari tabel di frontend — dikerjakan di server supaya
        // mencakup SELURUH data, bukan cuma halaman yang sedang terbuka.
        if ($request->filled('search')) {
            $term = '%'.str_replace(['%', '_'], ['\%', '\_'], trim($request->string('search'))).'%';
            // ILIKE hanya ada di Postgres; SQLite (dipakai untuk dev cepat &
            // testing) sudah case-insensitive dengan LIKE biasa.
            $like = \Illuminate\Support\Facades\DB::getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';

            $query->where(function ($q) use ($term, $like) {
                $q->whereHas('indomaret', fn ($r) => $r->where('nama', $like, $term)->orWhere('kode_toko', $like, $term))
                    ->orWhereHas('user', fn ($r) => $r->where('name', $like, $term))
                    ->orWhereHas('employee', fn ($r) => $r->where('nama', $like, $term))
                    ->orWhere('keterangan', $like, $term);
            });
        }

        $query->orderByDesc('tanggal')->orderByDesc('id');

        // Ringkasan dihitung dari SELURUH data yang cocok dengan filter (bukan
        // cuma baris di halaman yang sedang dibuka) — dipakai kartu KPI di
        // frontend supaya angkanya tidak berubah-ubah tiap pindah halaman.
        $totalsQuery = clone $query;

        $paginated = $query->paginate($request->integer('per_page', 20));

        return response()->json(array_merge($paginated->toArray(), [
            'ringkasan' => [
                'total_jumlah' => (float) (clone $totalsQuery)->sum('jumlah'),
            ],
        ]));
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'indomaret_id' => [Rule::requiredIf($user->hasUnscopedAccess()), 'nullable', 'exists:indomarets,id'],
            'tanggal' => ['required', 'date'],
            'jumlah' => ['required', 'numeric', 'min:0'],
            'keterangan' => ['nullable', 'string'],
            'employee_nama' => ['nullable', 'string', 'max:255', Rule::requiredIf($user->isKasir()), 'required_with:employee_password'],
            'employee_password' => ['nullable', 'string', 'required_with:employee_nama'],
        ]);

        $indomaretId = $user->isScopedToOwnStore() ? $user->indomaret_id : $data['indomaret_id'];

        $employeeId = null;
        if (! empty($data['employee_nama'])) {
            $employee = $this->credentials->verify($indomaretId, $data['employee_nama'], $data['employee_password']);
            $employeeId = $employee->id;
        }

        $isKasir = $user->isKasir();

        $pemasukan = Pemasukan::create([
            'indomaret_id' => $indomaretId,
            'tanggal' => $data['tanggal'],
            'jumlah' => $data['jumlah'],
            'keterangan' => $data['keterangan'] ?? null,
            'user_id' => $user->id,
            'employee_id' => $employeeId,
            'status' => $isKasir ? Pemasukan::STATUS_PENDING : Pemasukan::STATUS_APPROVED,
            'approved_by' => $isKasir ? null : $user->id,
            'approved_at' => $isKasir ? null : now(),
        ]);

        if ($isKasir) {
            $this->notifications->transaksiMenungguPersetujuan(
                $indomaretId,
                'pemasukan',
                sprintf('Rp%s', number_format((float) $data['jumlah'], 0, ',', '.')),
                ['pemasukan_id' => $pemasukan->id, 'indomaret_id' => $indomaretId]
            );
        }

        return response()->json([
            'data' => $pemasukan->load(['indomaret', 'user', 'employee', 'approvedBy']),
        ], 201);
    }

    public function show(Request $request, Pemasukan $pemasukan)
    {
        $this->authorizeAccess($request, $pemasukan);

        return response()->json([
            'data' => $pemasukan->load(['indomaret', 'user', 'employee', 'approvedBy']),
        ]);
    }

    public function update(Request $request, Pemasukan $pemasukan)
    {
        $this->authorizeEdit($request, $pemasukan);

        $data = $request->validate([
            'tanggal' => ['sometimes', 'required', 'date'],
            'jumlah' => ['sometimes', 'required', 'numeric', 'min:0'],
            'keterangan' => ['nullable', 'string'],
        ]);

        $pemasukan->update($data);

        return response()->json([
            'data' => $pemasukan->load(['indomaret', 'user', 'employee', 'approvedBy']),
        ]);
    }

    public function destroy(Request $request, Pemasukan $pemasukan)
    {
        $this->authorizeEdit($request, $pemasukan);

        $pemasukan->delete();

        return response()->json(['message' => 'Data pemasukan dihapus.']);
    }

    public function approve(Request $request, Pemasukan $pemasukan)
    {
        $this->authorizeApproval($request, $pemasukan);

        $pemasukan->update([
            'status' => Pemasukan::STATUS_APPROVED,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => null,
        ]);

        $this->notifications->transaksiDiputuskan(
            $pemasukan->indomaret_id,
            true,
            'Pemasukan',
            sprintf('Rp%s', number_format((float) $pemasukan->jumlah, 0, ',', '.')),
            ['pemasukan_id' => $pemasukan->id]
        );

        return response()->json(['data' => $pemasukan->load(['indomaret', 'user', 'employee', 'approvedBy'])]);
    }

    public function reject(Request $request, Pemasukan $pemasukan)
    {
        $this->authorizeApproval($request, $pemasukan);

        $data = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $pemasukan->update([
            'status' => Pemasukan::STATUS_REJECTED,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => $data['rejection_reason'],
        ]);

        $this->notifications->transaksiDiputuskan(
            $pemasukan->indomaret_id,
            false,
            'Pemasukan',
            sprintf('Rp%s', number_format((float) $pemasukan->jumlah, 0, ',', '.')),
            ['pemasukan_id' => $pemasukan->id, 'rejection_reason' => $data['rejection_reason']]
        );

        return response()->json(['data' => $pemasukan->load(['indomaret', 'user', 'employee', 'approvedBy'])]);
    }

    protected function authorizeAccess(Request $request, Pemasukan $pemasukan): void
    {
        $user = $request->user();

        abort_if(
            $user->isScopedToOwnStore() && $user->indomaret_id !== $pemasukan->indomaret_id,
            403,
            'Anda hanya bisa mengakses data pemasukan titik Indomaret Anda sendiri.'
        );
    }

    protected function authorizeEdit(Request $request, Pemasukan $pemasukan): void
    {
        $user = $request->user();

        abort_if($user->isKasir(), 403, 'Akun kasir tidak bisa mengubah/menghapus transaksi yang sudah disubmit.');

        $this->authorizeAccess($request, $pemasukan);
    }

    protected function authorizeApproval(Request $request, Pemasukan $pemasukan): void
    {
        $user = $request->user();

        abort_if($user->isKasir(), 403, 'Akun kasir tidak berwenang menyetujui transaksi.');
        $this->authorizeAccess($request, $pemasukan);
        abort_if($pemasukan->status !== Pemasukan::STATUS_PENDING, 422, 'Transaksi ini sudah diputuskan sebelumnya.');
    }
}
