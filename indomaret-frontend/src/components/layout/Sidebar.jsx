import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Menu yang dilihat manager DAN supervisor. Dashboard sengaja TIDAK di sini
// karena khusus manager (lihat managerDashboardNavItem di bawah).
// "Manajemen Akun" ikut di sini (bukan cuma khusus manager) karena
// halaman /akun sekarang berisi 2 tab: "Akun Login" (khusus manager) dan
// "Pegawai" (manager & supervisor) -- lihat pages/ManajemenAkun.jsx.
// Supervisor yang membukanya otomatis cuma melihat tab Pegawai.
const navItems = [
  {
    to: "/peta",
    label: "Peta & Daftar Gerai",
    icon: "pin_drop",
    iconColor: "text-idm-blue",
  },
  {
    to: "/barang-keluar",
    label: "Barang Keluar",
    icon: "outbox",
    iconColor: "text-idm-red",
  },
  {
    to: "/pemasukan",
    label: "Pemasukan",
    icon: "account_balance_wallet",
    iconColor: "text-emerald-600",
  },
  {
    to: "/persetujuan",
    label: "Persetujuan Kasir",
    icon: "task_alt",
    iconColor: "text-idm-yellow",
  },
  {
    to: "/akun",
    label: "Manajemen Akun",
    icon: "manage_accounts",
    iconColor: "text-idm-blue",
  },
];

// Khusus manager (akun pusat): dashboard ringkasan se-kabupaten ditaruh
// paling atas. Supervisor tidak mendapat menu ini - backend juga
// memblokir /api/dashboard untuknya.
const managerDashboardNavItem = { to: "/dashboard", label: "Dashboard", icon: "dashboard" };

// Akun kasir memakai shell yang sama (sidebar + header) seperti role lain,
// tapi menunya dibatasi jadi dua halaman input saja. Riwayat tiap jenis
// transaksi ditempel langsung di bawah form-nya masing-masing, dan
// notifikasi cukup lewat bell di header. Dashboard/peta/laporan/manajemen
// akun memang diblokir di backend.
const kasirNavItems = [
  {
    to: "/kasir/barang-keluar",
    label: "Input Barang Keluar",
    icon: "outbox",
    iconColor: "text-idm-red",
  
  },
  {
    to: "/kasir/pemasukan",
    label: "Input Pemasukan",
    icon: "account_balance_wallet",
    iconColor: "text-emerald-600",
  },
];

const ROLE_TITLE = {
  manager: "Manager Pusat",
  supervisor: "Supervisor",
  cashier: "Kasir Gerai",
};

export default function Sidebar({ open }) {
  const { user, isManager, isCashier } = useAuth();

  let items = navItems;
  if (isCashier) items = kasirNavItems;
  else if (isManager) items = [managerDashboardNavItem, ...navItems];

  const storeLabel = user?.store?.name || (isManager ? "DC Waru Surabaya" : "Gerai Anda");

  return (
    <aside
      className={`fixed left-0 top-1.5 h-[calc(100%-0.375rem)] w-[18rem] bg-white border-r border-border-subtle z-50 flex flex-col justify-between shadow-[2px_0_12px_rgba(0,91,170,0.03)] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex flex-col">
        <div className="h-[4.5rem] px-6 flex items-center gap-3 border-b border-border-subtle/80">
          <div className="flex items-center gap-2.5">
            <div className="h-9 px-2.5 bg-white border-2 border-idm-blue rounded-lg shadow-sm flex items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-idm-red" />
              <span className="font-extrabold tracking-tight text-[15px] italic text-idm-blue">
                Indo<span className="text-idm-red">maret</span>
              </span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-idm-yellow" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[14px] leading-tight text-on-surface flex items-center gap-1">
                {ROLE_TITLE[user?.role] || user?.role}{" "}
                <span className="w-1.5 h-1.5 rounded-full bg-idm-blue" />
              </span>
              <span className="text-[10px] text-text-muted font-bold tracking-wider uppercase">
                {user?.store?.regency?.name || "CABANG PUSAT"}
              </span>
            </div>
          </div>
        </div>
        <nav className="px-4 py-4 flex flex-col gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group text-body-md",
                  isActive
                    ? "bg-idm-blue text-white font-semibold shadow-[0_4px_14px_rgba(0,91,170,0.3)]"
                    : "text-on-surface-variant hover:bg-slate-50 hover:text-idm-blue font-medium",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isActive ? "text-white" : item.iconColor || ""
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {item.badge && !isActive && (
                    <span
                      className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full border ${item.badgeClass}`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <span className="ml-auto w-2 h-2 rounded-full bg-idm-yellow" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="p-5">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 border border-border-subtle flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 flex">
            <span className="w-1/3 bg-idm-blue" />
            <span className="w-1/3 bg-idm-red" />
            <span className="w-1/3 bg-idm-yellow" />
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-idm-blue text-[18px]">hub</span>
              <span className="text-xs font-bold text-on-surface truncate max-w-[140px]">{storeLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
