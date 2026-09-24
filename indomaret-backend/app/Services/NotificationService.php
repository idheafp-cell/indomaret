<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

/**
 * Helper untuk membuat notifikasi in-app. Dipoll berkala oleh frontend
 * lewat GET /api/notifications, bukan realtime/websocket.
 */
class NotificationService
{
    /**
     * Beritahu supervisor toko terkait + semua manager (akun pusat) bahwa
     * ada transaksi baru dari akun kasir yang menunggu persetujuan.
     */
    public function transactionPendingApproval(int $storeId, string $type, string $summary, array $data): void
    {
        $recipients = User::query()
            ->where('is_active', true)
            ->where(function ($q) use ($storeId) {
                $q->where('role', User::ROLE_SUPERVISOR)->where('store_id', $storeId);
            })
            ->orWhere(function ($q) {
                $q->where('role', User::ROLE_MANAGER);
            })
            ->get();

        foreach ($recipients as $user) {
            Notification::create([
                'user_id' => $user->id,
                'type' => Notification::TYPE_TRANSACTION_PENDING,
                'title' => 'Transaksi baru menunggu persetujuan',
                'body' => "Kasir menginput {$type}: {$summary}",
                'data' => $data,
            ]);
        }
    }

    /**
     * Beritahu akun kasir toko terkait bahwa transaksi mereka sudah
     * disetujui atau ditolak.
     */
    public function transactionDecided(int $storeId, bool $approved, string $type, string $summary, array $data): void
    {
        $recipients = User::query()
            ->where('is_active', true)
            ->where('role', User::ROLE_CASHIER)
            ->where('store_id', $storeId)
            ->get();

        foreach ($recipients as $user) {
            Notification::create([
                'user_id' => $user->id,
                'type' => $approved ? Notification::TYPE_TRANSACTION_APPROVED : Notification::TYPE_TRANSACTION_REJECTED,
                'title' => $approved ? 'Transaksi disetujui' : 'Transaksi ditolak',
                'body' => $approved
                    ? "{$type} \"{$summary}\" sudah disetujui dan masuk ke laporan."
                    : "{$type} \"{$summary}\" ditolak. Periksa alasannya dan input ulang jika perlu.",
                'data' => $data,
            ]);
        }
    }
}
