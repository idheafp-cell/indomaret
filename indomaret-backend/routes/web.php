<?php

use Illuminate\Support\Facades\Route;
use App\Exports\IndomaretExport;
use Maatwebsite\Excel\Facades\Excel;

Route::get('/', function () {
    return response()->json([
        'app' => 'Dashboard Indomaret API',
        'status' => 'ok',
        'docs' => 'Lihat README.md & postman_collection.json pada root project.',
    ]);
});

Route::get('/indomarets/export', function () {
    return Excel::download(
        new IndomaretExport,
        'data-indomaret.xlsx'
    );
})->name('indomarets.export');
