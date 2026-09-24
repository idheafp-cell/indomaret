<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Notifikasi in-app sederhana (dipoll berkala oleh frontend, bukan
 * broadcast/websocket). Lihat App\Services\NotificationService untuk
 * helper yang membuat notifikasi ini.
 */
class Notification extends Model
{
    public const TYPE_TRANSACTION_PENDING = 'transaction_pending_approval';

    public const TYPE_TRANSACTION_APPROVED = 'transaction_approved';

    public const TYPE_TRANSACTION_REJECTED = 'transaction_rejected';

    protected $fillable = [
        'user_id',
        'type',
        'title',
        'body',
        'data',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function markAsRead(): void
    {
        if (! $this->read_at) {
            $this->update(['read_at' => now()]);
        }
    }
}
