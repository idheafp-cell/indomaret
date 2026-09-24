<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Indomaret;
use App\Models\Pemasukan;
use App\Models\Pengeluaran;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Generate laporan PDF pengeluaran & pemasukan per titik Indomaret,
 * memakai package barryvdh/laravel-dompdf.
 */
class LaporanController extends Controller
{
    public function pengeluaranPemasukan(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'indomaret_id' => ['nullable', 'exists:indomarets,id'],
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
            $indomaretId = $user->indomaret_id;
        } else {
            $indomaretId = $request->integer('indomaret_id') ?: null;
        }

        abort_if(
            $user->hasUnscopedAccess() && ! $indomaretId,
            422,
            'Manager wajib menentukan indomaret_id untuk laporan per titik.'
        );

        $indomaret = Indomaret::with('kabupaten')->findOrFail($indomaretId);

        $pengeluarans = Pengeluaran::with('kategoriBarang', 'employee')
            ->where('indomaret_id', $indomaretId)
            ->where('status', Pengeluaran::STATUS_APPROVED)
            ->whereBetween('tanggal', [$start, $end])
            ->orderBy('tanggal')
            ->get();

        $pemasukans = Pemasukan::with('employee')
            ->where('indomaret_id', $indomaretId)
            ->where('status', Pemasukan::STATUS_APPROVED)
            ->whereBetween('tanggal', [$start, $end])
            ->orderBy('tanggal')
            ->get();

        $totalPengeluaran = $pengeluarans->sum('nilai');
        $totalPemasukan = $pemasukans->sum('jumlah');

        $pdf = Pdf::loadView('laporan.pengeluaran-pemasukan', [
            'indomaret' => $indomaret,
            'periode' => ['start' => $start, 'end' => $end],
            'pengeluarans' => $pengeluarans,
            'pemasukans' => $pemasukans,
            'totalPengeluaran' => $totalPengeluaran,
            'totalPemasukan' => $totalPemasukan,
            'dicetakOleh' => $user,
        ])->setPaper('a4', 'portrait');

        $filename = sprintf(
            'laporan-%s-%s-%s.pdf',
            $indomaret->kode_toko,
            $start->format('Ymd'),
            $end->format('Ymd')
        );

        return $pdf->download($filename);
    }
}
