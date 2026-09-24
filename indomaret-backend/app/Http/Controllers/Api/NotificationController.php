<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

/**
 * Notifikasi in-app milik user yang sedang login. Frontend polling
 * endpoint ini secara berkala (bukan realtime/websocket).
 */
class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = $user->notifications();

        if ($request->boolean('unread_only')) {
            $query->whereNull('read_at');
        }

        $notifications = $query->paginate($request->integer('per_page', 15));

        return response()->json([
            'data' => $notifications->items(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'total' => $notifications->total(),
            ],
            'unread_count' => $user->notifications()->whereNull('read_at')->count(),
        ]);
    }

    public function markRead(Request $request, int $id)
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return response()->json(['data' => $notification]);
    }

    public function markAllRead(Request $request)
    {
        $request->user()->notifications()->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['message' => 'Semua notifikasi ditandai sudah dibaca.']);
    }
}
