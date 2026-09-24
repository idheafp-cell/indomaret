<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pengeluaran;
use App\Services\EmployeeCredentialService;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Input barang keluar, dikelompokkan PER KATEGORI (bukan per produk).
 *
 * Yang boleh submit: manager/supervisor (langsung approved), atau
 * akun kasir toko (status pending, wajib menyertakan `employee_nama` +
 * `employee_password` individu, menunggu persetujuan supervisor/manager/
 * manager sebelum dihitung ke dashboard & laporan).
 */
class PengeluaranController extends Controller
{
    public function __construct(
        protected EmployeeCredentialService $credentials,
        protected NotificationService $notifications
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Pengeluaran::query()->with(['kategoriBarang', 'indomaret', 'user', 'employee', 'approvedBy']);

        if ($user->isScopedToOwnStore()) {
            $query->where('indomaret_id', $user->indomaret_id);
        } elseif ($request->filled('indomaret_id')) {
            $query->where('indomaret_id', $request->integer('indomaret_id'));
        }

        if ($request->filled('kategori_barang_id')) {
            $query->where('kategori_barang_id', $request->integer('kategori_barang_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('tanggal', [$request->date('start_date'), $request->date('end_date')]);
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
                $q->whereHas('indomaret', fn ($r) => $r->where('nama', $like, $term)->orWhere('kode_toko', $like, $term))
                    ->orWhereHas('kategoriBarang', fn ($r) => $r->where('nama', $like, $term))
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
                'total_nilai' => (float) (clone $totalsQuery)->sum('nilai'),
                'total_unit' => (int) (clone $totalsQuery)->sum('jumlah_barang'),
            ],
        ]));
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'indomaret_id' => [Rule::requiredIf($user->hasUnscopedAccess()), 'nullable', 'exists:indomarets,id'],
            'kategori_barang_id' => ['required', 'exists:kategori_barangs,id'],
            'tanggal' => ['required', 'date'],
            'jumlah_barang' => ['required', 'integer', 'min:1'],
            'satuan' => ['nullable', 'string', 'max:50'],
            'nilai' => ['required', 'numeric', 'min:0'],
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

        $pengeluaran = Pengeluaran::create([
            'indomaret_id' => $indomaretId,
            'kategori_barang_id' => $data['kategori_barang_id'],
            'tanggal' => $data['tanggal'],
            'jumlah_barang' => $data['jumlah_barang'],
            'satuan' => $data['satuan'] ?? 'pcs',
            'nilai' => $data['nilai'],
            'keterangan' => $data['keterangan'] ?? null,
            'user_id' => $user->id,
            'employee_id' => $employeeId,
            'status' => $isKasir ? Pengeluaran::STATUS_PENDING : Pengeluaran::STATUS_APPROVED,
            'approved_by' => $isKasir ? null : $user->id,
            'approved_at' => $isKasir ? null : now(),
        ]);

        if ($isKasir) {
            $this->notifications->transaksiMenungguPersetujuan(
                $indomaretId,
                'barang keluar',
                sprintf('%s pcs • Rp%s', number_format($data['jumlah_barang']), number_format((float) $data['nilai'], 0, ',', '.')),
                ['pengeluaran_id' => $pengeluaran->id, 'indomaret_id' => $indomaretId]
            );
        }

        return response()->json([
            'data' => $pengeluaran->load(['kategoriBarang', 'indomaret', 'user', 'employee', 'approvedBy']),
        ], 201);
    }

    public function show(Request $request, Pengeluaran $pengeluaran)
    {
        $this->authorizeAccess($request, $pengeluaran);

        return response()->json([
            'data' => $pengeluaran->load(['kategoriBarang', 'indomaret', 'user', 'employee', 'approvedBy']),
        ]);
    }

    public function update(Request $request, Pengeluaran $pengeluaran)
    {
        $this->authorizeEdit($request, $pengeluaran);

        $data = $request->validate([
            'kategori_barang_id' => ['sometimes', 'required', 'exists:kategori_barangs,id'],
            'tanggal' => ['sometimes', 'required', 'date'],
            'jumlah_barang' => ['sometimes', 'required', 'integer', 'min:1'],
            'satuan' => ['nullable', 'string', 'max:50'],
            'nilai' => ['sometimes', 'required', 'numeric', 'min:0'],
            'keterangan' => ['nullable', 'string'],
        ]);

        $pengeluaran->update($data);

        return response()->json([
            'data' => $pengeluaran->load(['kategoriBarang', 'indomaret', 'user', 'employee', 'approvedBy']),
        ]);
    }

    public function destroy(Request $request, Pengeluaran $pengeluaran)
    {
        $this->authorizeEdit($request, $pengeluaran);

        $pengeluaran->delete();

        return response()->json(['message' => 'Data pengeluaran dihapus.']);
    }

    /**
     * Supervisor (toko sendiri) atau manager (semua toko) menyetujui transaksi
     * yang disubmit oleh akun kasir.
     */
    public function approve(Request $request, Pengeluaran $pengeluaran)
    {
        $this->authorizeApproval($request, $pengeluaran);

        $pengeluaran->update([
            'status' => Pengeluaran::STATUS_APPROVED,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => null,
        ]);

        $this->notifications->transaksiDiputuskan(
            $pengeluaran->indomaret_id,
            true,
            'Barang keluar',
            sprintf('%s pcs • Rp%s', number_format($pengeluaran->jumlah_barang), number_format((float) $pengeluaran->nilai, 0, ',', '.')),
            ['pengeluaran_id' => $pengeluaran->id]
        );

        return response()->json(['data' => $pengeluaran->load(['kategoriBarang', 'indomaret', 'user', 'employee', 'approvedBy'])]);
    }

    public function reject(Request $request, Pengeluaran $pengeluaran)
    {
        $this->authorizeApproval($request, $pengeluaran);

        $data = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $pengeluaran->update([
            'status' => Pengeluaran::STATUS_REJECTED,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => $data['rejection_reason'],
        ]);

        $this->notifications->transaksiDiputuskan(
            $pengeluaran->indomaret_id,
            false,
            'Barang keluar',
            sprintf('%s pcs • Rp%s', number_format($pengeluaran->jumlah_barang), number_format((float) $pengeluaran->nilai, 0, ',', '.')),
            ['pengeluaran_id' => $pengeluaran->id, 'rejection_reason' => $data['rejection_reason']]
        );

        return response()->json(['data' => $pengeluaran->load(['kategoriBarang', 'indomaret', 'user', 'employee', 'approvedBy'])]);
    }

    protected function authorizeAccess(Request $request, Pengeluaran $pengeluaran): void
    {
        $user = $request->user();

        abort_if(
            $user->isScopedToOwnStore() && $user->indomaret_id !== $pengeluaran->indomaret_id,
            403,
            'Anda hanya bisa mengakses data pengeluaran titik Indomaret Anda sendiri.'
        );
    }

    protected function authorizeEdit(Request $request, Pengeluaran $pengeluaran): void
    {
        $user = $request->user();

        abort_if($user->isKasir(), 403, 'Akun kasir tidak bisa mengubah/menghapus transaksi yang sudah disubmit.');

        $this->authorizeAccess($request, $pengeluaran);
    }

    protected function authorizeApproval(Request $request, Pengeluaran $pengeluaran): void
    {
        $user = $request->user();

        abort_if($user->isKasir(), 403, 'Akun kasir tidak berwenang menyetujui transaksi.');
        $this->authorizeAccess($request, $pengeluaran);
        abort_if($pengeluaran->status !== Pengeluaran::STATUS_PENDING, 422, 'Transaksi ini sudah diputuskan sebelumnya.');
    }
}
