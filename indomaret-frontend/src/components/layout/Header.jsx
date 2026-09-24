import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../notifications/NotificationBell";

const ROLE_LABELS = {
  manager: "Manager Pusat",
  supervisor: "Supervisor",
  cashier: "Kasir",
};

function roleLabel(user) {
  const base = ROLE_LABELS[user?.role] || user?.role || "";
  // Manager = akun pusat, tidak terikat ke satu gerai
  if (user?.role === "manager") return base;
  return `${base} • ${user?.store?.store_code || ""}`;
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function Header() {
  const { user, logout, isManager, isCashier } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  function toggleDark() {
    document.documentElement.classList.toggle("dark");
    setDark((d) => !d);
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="fixed top-1.5 left-[18rem] right-0 h-[4.5rem] bg-white/90 backdrop-blur-xl border-b border-border-subtle z-40 px-6 flex items-center justify-between">
      {/* Kolom pencarian global dihapus (belum pernah berfungsi & tidak
          dipakai). Ruang kirinya diisi konteks wilayah/gerai yang sedang
          dilihat: manager melihat kabupatennya, supervisor & kasir melihat
          gerai tempat mereka bertugas. */}
      
      <div className="flex items-center gap-3 ml-auto">
        <NotificationBell onNavigate={(item) => {
          const type = item?.type;
          // Kasir diarahkan ke halaman input jenis transaksi yang dimaksud —
          // riwayat & status persetujuannya ada tepat di bawah form itu.
          if (isCashier) navigate(item?.data?.income_id ? "/kasir/pemasukan" : "/kasir/barang-keluar");
          else if (type === "transaction_pending_approval") navigate("/persetujuan");
        }} />
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-3 pl-2 border-l border-border-subtle"
          >
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[13px] font-bold text-on-surface">{user?.name || "Pengguna"}</span>
              <span className="text-[11px] text-text-muted font-medium">{roleLabel(user)}</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-idm-blue to-blue-500 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-blue-100">
              {initials(user?.name) || "U"}
            </div>
            <span className="material-symbols-outlined text-text-muted text-[18px] hidden sm:block">
              expand_more
            </span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-border-subtle shadow-lg py-1.5 z-50">
              <button
                onClick={handleLogout}
                type="button"
                className="w-full text-left px-4 py-2 text-sm font-medium text-idm-red hover:bg-red-50 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
