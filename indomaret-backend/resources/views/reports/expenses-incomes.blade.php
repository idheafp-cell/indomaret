<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Laporan {{ $store->name }}</title>
    <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; color: #1f2937; }
        h1 { font-size: 16px; margin-bottom: 2px; }
        h2 { font-size: 13px; margin-top: 18px; margin-bottom: 6px; }
        .header { border-bottom: 2px solid #0f4c81; padding-bottom: 8px; margin-bottom: 12px; }
        .meta { width: 100%; margin-bottom: 6px; }
        .meta td { padding: 1px 4px; vertical-align: top; }
        table.data { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        table.data th, table.data td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
        table.data th { background-color: #0f4c81; color: #ffffff; font-size: 10px; }
        table.data td.num { text-align: right; }
        tfoot td { font-weight: bold; background-color: #eef2f7; }
        .summary { width: 100%; margin-top: 10px; margin-bottom: 16px; }
        .summary td { padding: 4px 8px; }
        .summary .label { font-weight: bold; }
        .badge-positif { color: #15803d; font-weight: bold; }
        .badge-negatif { color: #b91c1c; font-weight: bold; }
        .footer-note { margin-top: 24px; font-size: 9px; color: #64748b; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Laporan Pengeluaran &amp; Pemasukan</h1>
        <table class="meta">
            <tr>
                <td style="width: 50%;">
                    <strong>{{ $store->name }}</strong> ({{ $store->store_code }})<br>
                    {{ $store->address }}<br>
                    Kabupaten {{ $store->regency->name ?? '-' }}
                </td>
                <td style="width: 50%; text-align: right;">
                    Periode: {{ $period['start']->translatedFormat('d M Y') }} &mdash; {{ $period['end']->translatedFormat('d M Y') }}<br>
                    Dicetak oleh: {{ $printedBy->name }} ({{ $printedBy->role }})<br>
                    Tanggal cetak: {{ now()->translatedFormat('d M Y H:i') }}
                </td>
            </tr>
        </table>
    </div>

    <table class="summary">
        <tr>
            <td class="label">Total Pemasukan</td>
            <td>Rp {{ number_format($totalIncome, 0, ',', '.') }}</td>
            <td class="label">Total Pengeluaran</td>
            <td>Rp {{ number_format($totalExpense, 0, ',', '.') }}</td>
            <td class="label">Estimasi Selisih</td>
            @php $selisih = $totalIncome - $totalExpense; @endphp
            <td class="{{ $selisih >= 0 ? 'badge-positif' : 'badge-negatif' }}">
                Rp {{ number_format($selisih, 0, ',', '.') }}
            </td>
        </tr>
    </table>

    <h2>Rincian Pemasukan</h2>
    <table class="data">
        <thead>
            <tr>
                <th style="width: 15%;">Tanggal</th>
                <th style="width: 25%;">Diinput oleh</th>
                <th>Keterangan</th>
                <th style="width: 18%;" class="num">Jumlah (Rp)</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($incomes as $item)
                <tr>
                    <td>{{ $item->date->format('d-m-Y') }}</td>
                    <td>{{ $item->employee->name ?? '-' }}</td>
                    <td>{{ $item->notes ?? '-' }}</td>
                    <td class="num">{{ number_format($item->amount, 0, ',', '.') }}</td>
                </tr>
            @empty
                <tr><td colspan="4">Tidak ada data pemasukan pada periode ini.</td></tr>
            @endforelse
        </tbody>
        <tfoot>
            <tr>
                <td colspan="3">Total Pemasukan</td>
                <td class="num">{{ number_format($totalIncome, 0, ',', '.') }}</td>
            </tr>
        </tfoot>
    </table>

    <h2>Rincian Pengeluaran Barang (per Kategori)</h2>
    <table class="data">
        <thead>
            <tr>
                <th style="width: 10%;">Tanggal</th>
                <th style="width: 18%;">Kategori</th>
                <th style="width: 10%;">Jumlah</th>
                <th style="width: 18%;">Diinput oleh</th>
                <th>Keterangan</th>
                <th style="width: 15%;" class="num">Nilai (Rp)</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($expenses as $item)
                <tr>
                    <td>{{ $item->date->format('d-m-Y') }}</td>
                    <td>{{ $item->itemCategory->name ?? '-' }}</td>
                    <td>{{ $item->quantity }} {{ $item->unit }}</td>
                    <td>{{ $item->employee->name ?? '-' }}</td>
                    <td>{{ $item->notes ?? '-' }}</td>
                    <td class="num">{{ number_format($item->value, 0, ',', '.') }}</td>
                </tr>
            @empty
                <tr><td colspan="6">Tidak ada data pengeluaran pada periode ini.</td></tr>
            @endforelse
        </tbody>
        <tfoot>
            <tr>
                <td colspan="5">Total Pengeluaran</td>
                <td class="num">{{ number_format($totalExpense, 0, ',', '.') }}</td>
            </tr>
        </tfoot>
    </table>

    <p class="footer-note">
        Laporan ini dihasilkan otomatis oleh Dashboard Indomaret. Nilai pengeluaran mencerminkan estimasi nilai barang keluar per kategori, bukan detail per produk.
    </p>
</body>
</html>
