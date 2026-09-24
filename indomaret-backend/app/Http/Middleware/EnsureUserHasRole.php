<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Membatasi akses route berdasarkan role user yang sedang login.
 *
 * Contoh pemakaian di routes/api.php:
 *   Route::middleware('role:manager')->group(...)
 *   Route::middleware('role:manager,supervisor')->group(...)
 */
class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! $user->is_active) {
            return response()->json([
                'message' => 'Akun tidak aktif atau tidak terautentikasi.',
            ], 403);
        }

        if (! in_array($user->role, $roles, true)) {
            return response()->json([
                'message' => 'Anda tidak memiliki akses untuk resource ini.',
            ], 403);
        }

        return $next($request);
    }
}
