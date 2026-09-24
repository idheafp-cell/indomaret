import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import TopAccentBar from "./TopAccentBar";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuth } from "../../context/AuthContext";

export default function AppLayout() {
  const { user, loading, isManager, isCashier } = useAuth();
  const { pathname } = useLocation();

  // Sidebar bisa disembunyikan (slide-out) supaya konten utama bisa full-
  // width kalau perlu. SELALU mulai kebuka tiap kali aplikasi dibuka/di-
  // refresh (bukan diingat dari sesi sebelumnya) -- nutupnya cuma berlaku
  // sementara di sesi yang sedang berjalan.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  function toggleSidebar() {
    setSidebarOpen((prev) => !prev);
  }

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

  // Halaman awal tiap role - dipakai juga sebagai tujuan pantulan kalau
  // seseorang mengetik URL yang bukan haknya.
  //   manager    -> Dashboard (ringkasan se-kabupaten)
  //   supervisor -> Persetujuan Kasir (tugas utamanya; dashboard diblokir)
  //   kasir      -> form input barang keluar
  let homeRoute = "/persetujuan";
  if (isCashier) homeRoute = "/kasir/barang-keluar";
  else if (isManager) homeRoute = "/dashboard";

  // Kasir memakai shell yang sama, tapi hanya boleh membuka halaman di
  // bawah /kasir. Sebaliknya manager/supervisor tidak boleh masuk ke sana.
  const isCashierRoute = pathname.startsWith("/kasir");

  if (isCashier !== isCashierRoute) {
    return <Navigate to={homeRoute} replace />;
  }

  // Dashboard ringkasan khusus manager - backend juga memblokir
  // /api/dashboard untuk supervisor & kasir.
  if (!isManager && pathname.startsWith("/dashboard")) {
    return <Navigate to={homeRoute} replace />;
  }

  return (
    <>
      <TopAccentBar />
      <Sidebar open={sidebarOpen} />
      <div
        className={`transition-[padding-left] duration-300 ease-in-out ${
          sidebarOpen ? "pl-[18rem]" : "pl-0"
        }`}
      >
        <Header sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
        <main className="w-full bg-slate-50/60 min-h-screen px-6 pb-6 pt-[calc(4.5rem+0.375rem+1.5rem)]">
          <div className="flex flex-col w-full gap-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
