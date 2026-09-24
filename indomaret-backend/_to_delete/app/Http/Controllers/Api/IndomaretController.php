<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Indomaret;
use App\Models\Pemasukan;
use App\Models\Pengeluaran;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * CRUD data titik/gerai Indomaret. Create/update/delete khusus manager.
 *
 * Supervisor boleh MELIHAT lokasi semua gerai (daftar & peta sebaran),
 * tapi tidak boleh melihat angka keuangan gerai selain miliknya sendiri —
 * lihat flag `tampilkan_angka` di peta() dan pengecekan di show().
 */
class IndomaretController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        // Daftar ini hanya berisi data lokasi/kontak (tanpa angka keuangan),
        // jadi supervisor pun boleh melihat seluruh gerai — dia butuh itu
        // untuk membaca peta sebaran. Pembatasannya ada di show() (detail
        // gerai) dan pada flag `tampilkan_angka` di peta().
        $query = Indomaret::query()->with('kabupaten')->orderBy('nama');

        if ($request->filled('kabupaten_id')) {
            $query->where('kabupaten_id', $request->integer('kabupaten_id'));
        }

        $data = $query->get()->map(function (Indomaret $indomaret) use ($user) {
            $indomaret->setAttribute(
                'boleh_lihat_detail',
                $user->hasUnscopedAccess() || (int) $user->indomaret_id === (int) $indomaret->id
            );

            return $indomaret;
        });

        return response()->json(['data' => $data]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'kabupaten_id' => ['required', 'exists:kabupatens,id'],
            'kode_toko' => ['required', 'string', 'max:50', 'unique:indomarets,kode_toko'],
            'nama' => ['required', 'string', 'max:255'],
            'alamat' => ['required', 'string'],
            'kecamatan' => ['nullable', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'no_telp' => ['nullable', 'string', 'max:30'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $indomaret = Indomaret::create($data);

        return response()->json(['data' => $indomaret->load('kabupaten')], 201);
    }

    public function show(Request $request, Indomaret $indomaret)
    {
        $this->authorizeAccess($request, $indomaret);

        return response()->json([
            'data' => $indomaret->load('kabupaten', 'supervisors:id,name,email,indomaret_id'),
        ]);
    }

    public function update(Request $request, Indomaret $indomaret)
    {
        $data = $request->validate([
            'kabupaten_id' => ['sometimes', 'required', 'exists:kabupatens,id'],
            'kode_toko' => ['sometimes', 'required', 'string', 'max:50', 'unique:indomarets,kode_toko,'.$indomaret->id],
            'nama' => ['sometimes', 'required', 'string', 'max:255'],
            'alamat' => ['sometimes', 'required', 'string'],
            'kecamatan' => ['nullable', 'string', 'max:255'],
            'latitude' => ['sometimes', 'required', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'required', 'numeric', 'between:-180,180'],
            'no_telp' => ['nullable', 'string', 'max:30'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $indomaret->update($data);

        return response()->json(['data' => $indomaret->load('kabupaten')]);
    }

    public function destroy(Indomaret $indomaret)
    {
        $indomaret->delete();

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
     * dengan `tampilkan_angka: false` dan nilai null/kosong sehingga
     * frontend hanya menampilkan info lokasi.
     */
    public function peta(Request $request)
    {
        $user = $request->user();
        $startOfMonth = now()->startOfMonth()->toDateString();
        $endOfMonth = now()->endOfMonth()->toDateString();

        // Rentang tren harian untuk grafik mini (sparkline) di popup peta —
        // 14 hari terakhir, hanya transaksi berstatus approved yang dihitung.
        $trendDays = 14;
        $trendStart = now()->subDays($trendDays - 1)->startOfDay()->toDateString();
        $trendEnd = now()->endOfDay()->toDateString();

        $query = Indomaret::query()->with('kabupaten')->where('is_active', true);

        $indomarets = $query->get()->map(function (Indomaret $indomaret) use ($user, $startOfMonth, $endOfMonth, $trendStart, $trendEnd, $trendDays) {
            $bolehLihatAngka = $user->hasUnscopedAccess()
                || (int) $user->indomaret_id === (int) $indomaret->id;

            if (! $bolehLihatAngka) {
                return [
                    'id' => $indomaret->id,
                    'kode_toko' => $indomaret->kode_toko,
                    'nama' => $indomaret->nama,
                    'alamat' => $indomaret->alamat,
                    'kecamatan' => $indomaret->kecamatan,
                    'kabupaten' => $indomaret->kabupaten?->nama,
                    'latitude' => (float) $indomaret->latitude,
                    'longitude' => (float) $indomaret->longitude,
                    'tampilkan_angka' => false,
                    'total_pengeluaran_bulan_ini' => null,
                    'total_pemasukan_bulan_ini' => null,
                    'tren_harian' => [],
                ];
            }

            $totalPengeluaran = $indomaret->pengeluarans()
                ->where('status', Pengeluaran::STATUS_APPROVED)
                ->whereBetween('tanggal', [$startOfMonth, $endOfMonth])
                ->sum('nilai');

            $totalPemasukan = $indomaret->pemasukans()
                ->where('status', Pemasukan::STATUS_APPROVED)
                ->whereBetween('tanggal', [$startOfMonth, $endOfMonth])
                ->sum('jumlah');

            $pemasukanPerHari = $indomaret->pemasukans()
                ->where('status', Pemasukan::STATUS_APPROVED)
                ->whereBetween('tanggal', [$trendStart, $trendEnd])
                ->selectRaw('tanggal, sum(jumlah) as total')
                ->groupBy('tanggal')
                ->pluck('total', 'tanggal');

            $pengeluaranPerHari = $indomaret->pengeluarans()
                ->where('status', Pengeluaran::STATUS_APPROVED)
                ->whereBetween('tanggal', [$trendStart, $trendEnd])
                ->selectRaw('tanggal, sum(nilai) as total')
                ->groupBy('tanggal')
                ->pluck('total', 'tanggal');

            $trenHarian = [];
            for ($i = $trendDays - 1; $i >= 0; $i--) {
                $tanggal = Carbon::parse($trendEnd)->subDays($i)->toDateString();
                $trenHarian[] = [
                    'tanggal' => $tanggal,
                    'pemasukan' => (float) ($pemasukanPerHari[$tanggal] ?? 0),
                    'pengeluaran' => (float) ($pengeluaranPerHari[$tanggal] ?? 0),
                ];
            }

            return [
                'id' => $indomaret->id,
                'kode_toko' => $indomaret->kode_toko,
                'nama' => $indomaret->nama,
                'alamat' => $indomaret->alamat,
                'kecamatan' => $indomaret->kecamatan,
                'kabupaten' => $indomaret->kabupaten?->nama,
                'latitude' => (float) $indomaret->latitude,
                'longitude' => (float) $indomaret->longitude,
                'tampilkan_angka' => true,
                'total_pengeluaran_bulan_ini' => (float) $totalPengeluaran,
                'total_pemasukan_bulan_ini' => (float) $totalPemasukan,
                'tren_harian' => $trenHarian,
            ];
        });

        return response()->json(['data' => $indomarets]);
    }

    /**
     * Isi pop-up detail gerai di peta. Sengaja DIPISAH dari /api/peta-sebaran
     * dan hanya dipanggil saat marker gerai diklik, supaya request awal peta
     * tetap ringan walau jumlah gerainya nanti puluhan (agregasi per kategori
     * di bawah ini butuh beberapa query tambahan per gerai).
     *
     * Supervisor hanya boleh membuka gerainya sendiri (authorizeAccess).
     */
    public function ringkasanPeta(Request $request, Indomaret $indomaret)
    {
        $this->authorizeAccess($request, $indomaret);

        $hariIni = now()->toDateString();
        $kemarin = now()->subDay()->toDateString();
        $awalBulan = now()->startOfMonth()->toDateString();
        $akhirBulan = now()->endOfMonth()->toDateString();

        // --- KPI 1: jumlah transaksi hari ini + perbandingan ke kemarin ---
        $transaksiPada = function (string $tanggal) use ($indomaret): int {
            return $indomaret->pengeluarans()
                    ->where('status', Pengeluaran::STATUS_APPROVED)
                    ->whereDate('tanggal', $tanggal)->count()
                + $indomaret->pemasukans()
                    ->where('status', Pemasukan::STATUS_APPROVED)
                    ->whereDate('tanggal', $tanggal)->count();
        };

        $transaksiHariIni = $transaksiPada($hariIni);
        $transaksiKemarin = $transaksiPada($kemarin);

        // --- KPI 2: unit barang keluar hari ini ---
        $unitHariIni = (int) $indomaret->pengeluarans()
            ->where('status', Pengeluaran::STATUS_APPROVED)
            ->whereDate('tanggal', $hariIni)
            ->sum('jumlah_barang');

        // --- KPI 3: margin laba bulan berjalan ---
        $pemasukanBulanIni = (float) $indomaret->pemasukans()
            ->where('status', Pemasukan::STATUS_APPROVED)
            ->whereBetween('tanggal', [$awalBulan, $akhirBulan])
            ->sum('jumlah');

        $pengeluaranBulanIni = (float) $indomaret->pengeluarans()
            ->where('status', Pengeluaran::STATUS_APPROVED)
            ->whereBetween('tanggal', [$awalBulan, $akhirBulan])
            ->sum('nilai');

        // --- Agregasi per kategori (bulan berjalan) ---
        // Dipakai dua tab sekaligus: "Distribusi" memakai kolom unit,
        // "Top Penjualan" memakai kolom nilai + porsinya terhadap total.
        $perKategori = $indomaret->pengeluarans()
            ->where('pengeluarans.status', Pengeluaran::STATUS_APPROVED)
            ->whereBetween('pengeluarans.tanggal', [$awalBulan, $akhirBulan])
            ->join('kategori_barangs', 'kategori_barangs.id', '=', 'pengeluarans.kategori_barang_id')
            ->groupBy('kategori_barangs.id', 'kategori_barangs.nama')
            ->selectRaw('kategori_barangs.nama as kategori, sum(pengeluarans.jumlah_barang) as unit, sum(pengeluarans.nilai) as nilai')
            ->get();

        $totalNilaiKategori = (float) $perKategori->sum('nilai');

        $distribusi = $perKategori
            ->sortByDesc(fn ($row) => (int) $row->unit)
            ->values()
            ->map(fn ($row) => [
                'kategori' => $row->kategori,
                'unit' => (int) $row->unit,
            ]);

        $topPenjualan = $perKategori
            ->sortByDesc(fn ($row) => (float) $row->nilai)
            ->values()
            ->map(fn ($row) => [
                'kategori' => $row->kategori,
                'nilai' => (float) $row->nilai,
                'unit' => (int) $row->unit,
                'persen' => $totalNilaiKategori > 0
                    ? round(((float) $row->nilai / $totalNilaiKategori) * 100, 1)
                    : 0.0,
            ]);

        // --- Tren 7 hari terakhir (pemasukan vs beban barang keluar) ---
        $trendDays = 7;
        $trendStart = now()->subDays($trendDays - 1)->toDateString();

        $pemasukanPerHari = $indomaret->pemasukans()
            ->where('status', Pemasukan::STATUS_APPROVED)
            ->whereBetween('tanggal', [$trendStart, $hariIni])
            ->selectRaw('tanggal, sum(jumlah) as total')
            ->groupBy('tanggal')
            ->pluck('total', 'tanggal');

        $pengeluaranPerHari = $indomaret->pengeluarans()
            ->where('status', Pengeluaran::STATUS_APPROVED)
            ->whereBetween('tanggal', [$trendStart, $hariIni])
            ->selectRaw('tanggal, sum(nilai) as total')
            ->groupBy('tanggal')
            ->pluck('total', 'tanggal');

        $trenHarian = [];
        for ($i = $trendDays - 1; $i >= 0; $i--) {
            $tanggal = now()->subDays($i)->toDateString();
            $trenHarian[] = [
                'tanggal' => $tanggal,
                'pemasukan' => (float) ($pemasukanPerHari[$tanggal] ?? 0),
                'pengeluaran' => (float) ($pengeluaranPerHari[$tanggal] ?? 0),
            ];
        }

        return response()->json([
            'data' => [
                'id' => $indomaret->id,
                'kode_toko' => $indomaret->kode_toko,
                'nama' => $indomaret->nama,
                'alamat' => $indomaret->alamat,
                'kecamatan' => $indomaret->kecamatan,
                'is_active' => (bool) $indomaret->is_active,

                'transaksi_hari_ini' => $transaksiHariIni,
                'transaksi_kemarin' => $transaksiKemarin,
                // null kalau kemarin nol — supaya frontend tidak menampilkan
                // kenaikan "tak terhingga" yang menyesatkan.
                'transaksi_delta_persen' => $transaksiKemarin > 0
                    ? round((($transaksiHariIni - $transaksiKemarin) / $transaksiKemarin) * 100, 1)
                    : null,

                'unit_barang_keluar_hari_ini' => $unitHariIni,

                'pemasukan_bulan_ini' => $pemasukanBulanIni,
                'pengeluaran_bulan_ini' => $pengeluaranBulanIni,
                'margin_persen' => $pemasukanBulanIni > 0
                    ? round((($pemasukanBulanIni - $pengeluaranBulanIni) / $pemasukanBulanIni) * 100, 1)
                    : null,

                'distribusi' => $distribusi,
                'top_penjualan' => $topPenjualan,
                'tren_harian' => $trenHarian,
            ],
        ]);
    }

    protected function authorizeAccess(Request $request, Indomaret $indomaret): void
    {
        $user = $request->user();

        abort_if(
            $user->isSupervisor() && $user->indomaret_id !== $indomaret->id,
            403,
            'Anda hanya bisa mengakses data titik Indomaret Anda sendiri.'
        );
    }
}
