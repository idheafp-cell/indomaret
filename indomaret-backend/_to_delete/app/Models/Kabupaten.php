<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Kabupaten extends Model
{
    use HasFactory;

    protected $fillable = [
        'nama',
        'provinsi',
    ];

    public function indomarets(): HasMany
    {
        return $this->hasMany(Indomaret::class);
    }
}
