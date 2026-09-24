<?php

namespace App\Exports;

use App\Models\Indomaret;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class IndomaretExport implements FromCollection, WithHeadings
{
    public function collection()
    {
        return Indomaret::select(
            'kode',
            'nama',
            'alamat',
            'kecamatan',
            'lat',
            'long',
            'status'
        )->get();
    }

    public function headings(): array
    {
        return [
            'Kode',
            'Nama',
            'Alamat',
            'Kecamatan',
            'Latitude',
            'Longitude',
            'Status'
        ];
    }
}
