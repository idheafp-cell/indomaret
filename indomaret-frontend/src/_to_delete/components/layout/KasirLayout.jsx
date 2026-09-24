import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../notifications/NotificationBell";

/**
 * Layout minimal khusus akun kasir (role=kasir). Satu akun login dipakai
 * bersama oleh semua kasir fisik di gerai itu, jadi halaman ini sengaja
 * dibuat sempit: cuma input pemasukan & barang keluar + riwayat status
 * persetujuan miliknya sendiri. Tidak ada sidebar/menu dashboard, peta,
 * laporan, atau manajemen akun sama sekali.
 */
export default function KasirLayout() {
  const { user, loading, isKasir, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-idm-blue text-4xl">progress_activity</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isKasir) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50/60">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-border-subtle px-4 sm:px-6 h-[4.5rem] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 px-2.5 bg-white border-2 border-idm-blue rounded-lg shadow-sm flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-idm-red" />
            <span className="font-extrabold tracking-tight text-[15px] italic text-idm-blue">
              Indo<span className="text-idm-red">maret</span>
            </span>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-idm-yellow" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[13px] leading-tight text-on-surface">Input Kasir</span>
            <span className="text-[10px] text-text-muted font-bold tracking-wider uppercase">
              {user?.indomaret?.nama || "Gerai"} • {user?.indomaret?.kode_toko || ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <NotificationBell />
          <button
            onClick={handleLogout}
            type="button"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-idm-red font-bold text-xs hover:bg-red-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            Keluar
          </button>
        </div>
      </header>
      <main className="w-full px-4 sm:px-6 py-6">
        <div className="flex flex-col w-full gap-6 max-w-3xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
