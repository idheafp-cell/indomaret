import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import KpiCard from "../components/ui/KpiCard";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Field, InputShell, inputClass } from "../components/ui/InputShell";
import Pagination from "../components/ui/Pagination";
import usePaginatedRows from "../hooks/usePaginatedRows";
import { useAuth } from "../context/AuthContext";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listStores,
} from "../api/resources";
import { formatDate } from "../lib/format";

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager (Pusat, akses penuh)" },
  { value: "supervisor", label: "Supervisor Gerai" },
  { value: "cashier", label: "Kasir Gerai (akun bersama)" },
];

const ROLE_BADGE = {
  manager: { variant: "blue", label: "Manager" },
  supervisor: { variant: "amber", label: "Supervisor" },
  cashier: { variant: "emerald", label: "Kasir" },
};

const ROLE_REQUIRES_STORE = ["supervisor", "cashier"];

/**
 * Satu halaman terpusat untuk dua data yang berbeda tapi sering dikerjakan
 * bareng: akun LOGIN (tabel `users`, khusus manager yang berhak kelola) dan
 * pegawai/kasir INDIVIDU (tabel `employees`, boleh dikelola manager maupun
 * supervisor gerainya sendiri). Keduanya beda skema & endpoint backend
 * (/api/users vs /api/employees) jadi datanya tetap terpisah -- yang
 * digabung cuma tampilannya lewat 2 tab, supaya tidak perlu 2 menu sidebar
 * terpisah.
 */
export default function ManajemenAkun() {
  const { isManager, isSupervisor } = useAuth();
  const [tab, setTab] = useState("akun");

  if (!isManager && !isSupervisor) {
    return <Navigate to="/dashboard" replace />;
  }

  // Supervisor tidak berhak kelola akun login sama sekali (backend membatasi
  // /api/users khusus role manager), jadi tab "Akun Login" & switcher-nya
  // disembunyikan total untuk supervisor -- langsung ke tab Pegawai.
  const activeTab = isManager ? tab : "pegawai";

  return (
    <>
      <PageHeader
        title={isManager ? "Manajemen Akun & Pegawai" : "Manajemen Pegawai"}
        description={
          isManager
            ? "Kelola akun login manager/supervisor/kasir dan data pegawai individu tiap gerai."
            : "Kelola data pegawai individu di gerai Anda."
        }
      />

      {isManager && (
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setTab("akun")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold rounded-lg transition-colors ${
              activeTab === "akun" ? "bg-idm-blue text-white shadow-sm" : "text-text-muted hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
            Akun Login
          </button>
          <button
            type="button"
            onClick={() => setTab("pegawai")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold rounded-lg transition-colors ${
              activeTab === "pegawai" ? "bg-idm-blue text-white shadow-sm" : "text-text-muted hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            Pegawai
          </button>
        </div>
      )}

      {activeTab === "akun" ? <AkunSection /> : <PegawaiSection isManager={isManager} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tab "Akun Login" -- akun users (manager/supervisor/kasir)           */
/* ------------------------------------------------------------------ */

function AkunSection() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [storeList, setStoreList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  function load() {
    setLoading(true);
    listUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useEffect(() => {
    listStores().then(setStoreList).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, search, roleFilter]);

  const halaman = usePaginatedRows(filtered, 10);

  const totalManager = users.filter((u) => u.role === "manager").length;
  const totalSupervisor = users.filter((u) => u.role === "supervisor").length;
  const totalKasir = users.filter((u) => u.role === "cashier").length;
  const geraiTanpaSupervisor = storeList.filter(
    (g) => !users.some((u) => u.role === "supervisor" && u.store_id === g.id)
  ).length;
  const geraiTanpaKasir = storeList.filter(
    (g) => !users.some((u) => u.role === "cashier" && u.store_id === g.id)
  ).length;

  async function handleDelete(u) {
    if (u.id === currentUser?.id) {
      alert("Anda tidak bisa menghapus akun Anda sendiri.");
      return;
    }
    if (!window.confirm(`Hapus akun "${u.name}" (${u.email})? Tindakan ini tidak bisa dibatalkan.`)) return;
    await deleteUser(u.id);
    load();
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingUser(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-idm-blue hover:bg-idm-blue-dark text-white px-4 py-2 rounded-xl font-bold text-body-sm shadow-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>Tambah Akun
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
        <KpiCard icon="admin_panel_settings" accent="blue" label="Akun Manager Pusat" value={`${totalManager} Akun`} footerLeft="Akses penuh semua gerai" />
        <KpiCard icon="badge" accent="yellow" label="Akun Supervisor" value={`${totalSupervisor} Akun`} footerLeft={geraiTanpaSupervisor > 0 ? `${geraiTanpaSupervisor} gerai belum ada` : "Semua gerai tercakup"} />
        <KpiCard icon="point_of_sale" accent="red" label="Akun Kasir" value={`${totalKasir} Akun`} footerLeft={geraiTanpaKasir > 0 ? `${geraiTanpaKasir} gerai belum ada` : "Semua gerai tercakup"} />
      </div>

      <SectionCard
        title="Daftar Akun"
        description="Akun manager, supervisor & kasir yang bisa login ke sistem ini"
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1">
            <InputShell icon="search">
              <input
                className={inputClass}
                placeholder="Cari nama atau email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputShell>
          </div>
          <div className="w-full sm:w-56">
            <InputShell icon="filter_list">
              <select className={inputClass} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">Semua Role</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </InputShell>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                <th className="py-2.5 px-3">Nama</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Gerai</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Bergabung</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-body-sm">
              {halaman.pageRows.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-idm-blue font-bold flex items-center justify-center text-[11px]">
                        {u.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-bold text-[13px] text-on-surface">
                        {u.name}
                        {u.id === currentUser?.id && (
                          <span className="ml-1.5 text-[10px] font-semibold text-idm-blue">(Anda)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-[12px] font-mono text-text-muted">{u.email}</td>
                  <td className="py-3 px-3">
                    <Badge variant={ROLE_BADGE[u.role]?.variant || "slate"}>{ROLE_BADGE[u.role]?.label || u.role}</Badge>
                  </td>
                  <td className="py-3 px-3 text-[12px]">
                    {u.store ? (
                      <>
                        <div className="font-semibold text-on-surface">{u.store.name}</div>
                        <span className="text-[11px] text-idm-blue font-mono">{u.store.store_code}</span>
                      </>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant={u.is_active ? "emerald" : "slate"}>{u.is_active ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td className="py-3 px-3 text-[12px] text-text-muted font-mono">{formatDate(u.created_at)}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setModalOpen(true);
                        }}
                        title="Edit akun"
                        className="w-8 h-8 rounded-lg hover:bg-blue-50 text-idm-blue flex items-center justify-center transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        title="Hapus akun"
                        disabled={u.id === currentUser?.id}
                        className="w-8 h-8 rounded-lg hover:bg-red-50 text-idm-red flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-muted text-sm">
                    Tidak ada akun yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={halaman.page}
          lastPage={halaman.lastPage}
          from={halaman.from}
          to={halaman.to}
          total={halaman.total}
          onChange={halaman.setPage}
          label="akun"
        />
      </SectionCard>

      <UserFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingUser={editingUser}
        storeList={storeList}
        onSaved={() => {
          setModalOpen(false);
          load();
        }}
      />
    </>
  );
}

function UserFormModal({ open, onClose, editingUser, storeList, onSaved }) {
  const isEdit = !!editingUser;
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function emptyForm() {
    return { name: "", email: "", password: "", role: "supervisor", store_id: "", phone: "", is_active: true };
  }

  useEffect(() => {
    if (open) {
      setError("");
      setForm(
        editingUser
          ? {
              name: editingUser.name,
              email: editingUser.email,
              password: "",
              role: editingUser.role,
              store_id: editingUser.store_id || "",
              phone: editingUser.phone || "",
              is_active: !!editingUser.is_active,
            }
          : emptyForm()
      );
    }
  }, [open, editingUser]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        store_id: ROLE_REQUIRES_STORE.includes(form.role) ? Number(form.store_id) : null,
        phone: form.phone || undefined,
      };
      if (form.password) payload.password = form.password;
      if (!isEdit && !form.password) {
        setError("Password wajib diisi untuk akun baru.");
        setSaving(false);
        return;
      }
      if (isEdit) {
        payload.is_active = form.is_active;
        await updateUser(editingUser.id, payload);
      } else {
        await createUser(payload);
      }
      onSaved();
    } catch (err) {
      const errs = err?.response?.data?.errors;
      const msg = errs ? Object.values(errs)[0]?.[0] : err?.response?.data?.message;
      setError(msg || "Gagal menyimpan akun. Periksa kembali isian Anda.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Akun Pengguna" : "Tambah Akun Baru"}
      description={
        isEdit
          ? "Kosongkan password jika tidak ingin mengubahnya."
          : "Buat akun login baru untuk manager pusat, supervisor, atau kasir gerai."
      }
      footer={
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-text-muted hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            form="form-user-account"
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-idm-blue hover:bg-idm-blue-dark text-white text-sm font-bold shadow-sm disabled:opacity-60 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Buat Akun"}
          </button>
        </div>
      }
    >
      <form id="form-user-account" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nama Lengkap" code="name" required>
          <InputShell icon="person">
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </InputShell>
        </Field>
        <Field label="Email" code="email" required>
          <InputShell icon="mail">
            <input
              type="email"
              required
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </InputShell>
        </Field>
        <Field label={isEdit ? "Password Baru (opsional)" : "Password"} code="password" required={!isEdit}>
          <InputShell icon="lock">
            <input
              type="password"
              required={!isEdit}
              minLength={8}
              placeholder={isEdit ? "Kosongkan jika tidak diubah" : "Minimal 8 karakter"}
              className={inputClass}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </InputShell>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="Role" code="role" required>
            <InputShell icon="admin_panel_settings">
              <select
                required
                className={inputClass}
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value,
                    store_id: ROLE_REQUIRES_STORE.includes(e.target.value) ? f.store_id : "",
                  }))
                }
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </InputShell>
          </Field>
          <Field label="No. Telepon">
            <InputShell icon="call">
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </InputShell>
          </Field>
        </div>

        {ROLE_REQUIRES_STORE.includes(form.role) && (
          <Field label="Gerai yang Dikelola" code="store_id" required>
            <InputShell icon="storefront">
              <select
                required
                className={inputClass}
                value={form.store_id}
                onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}
              >
                <option value="">Pilih gerai...</option>
                {storeList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.store_code} • {g.name}
                  </option>
                ))}
              </select>
            </InputShell>
          </Field>
        )}

        {form.role === "cashier" && (
          <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <span className="material-symbols-outlined text-[16px] shrink-0">info</span>
            <span>
              Hanya boleh ada <strong>1 akun kasir per gerai</strong> — akun ini dipakai bersama oleh semua kasir
              fisik di toko tersebut. Setiap transaksi tetap wajib diisi nama & password kasir individu untuk audit.
            </span>
          </div>
        )}

        {isEdit && (
          <label className="flex items-center gap-2 text-xs font-bold text-on-surface">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Akun berstatus aktif (bisa login)
          </label>
        )}

        {error && (
          <div className="flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Tab "Pegawai" -- data employees (kasir/karyawan individu)           */
/* ------------------------------------------------------------------ */

function PegawaiSection({ isManager }) {
  const [employees, setEmployees] = useState([]);
  const [storeList, setStoreList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  function load() {
    setLoading(true);
    listEmployees(isManager && storeFilter ? { store_id: storeFilter } : {})
      .then(setEmployees)
      .finally(() => setLoading(false));
  }

  useEffect(load, [isManager, storeFilter]);
  useEffect(() => {
    if (isManager) {
      listStores().then(setStoreList).catch(() => {});
    }
  }, [isManager]);

  const filtered = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter((e) => e.name.toLowerCase().includes(q));
  }, [employees, search]);

  const halaman = usePaginatedRows(filtered, 10);

  const totalAktif = employees.filter((e) => e.is_active).length;
  const totalNonaktif = employees.filter((e) => !e.is_active).length;
  const geraiTanpaPegawai = storeList.filter(
    (g) => !employees.some((e) => e.store_id === g.id)
  ).length;

  async function handleToggleActive(emp) {
    try {
      await updateEmployee(emp.id, { is_active: !emp.is_active });
      load();
    } catch (err) {
      alert(err?.response?.data?.message || "Gagal mengubah status pegawai.");
    }
  }

  async function handleDelete(emp) {
    const ok = window.confirm(
      `Hapus pegawai "${emp.name}"? Riwayat transaksi yang pernah dicatat pegawai ini akan tetap tersimpan tapi kehilangan keterangan nama pegawainya. Kalau pegawai ini hanya berhenti sementara, lebih baik nonaktifkan saja. Tindakan hapus tidak bisa dibatalkan.`
    );
    if (!ok) return;
    try {
      await deleteEmployee(emp.id);
      load();
    } catch (err) {
      alert(err?.response?.data?.message || "Gagal menghapus pegawai.");
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingEmployee(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-idm-blue hover:bg-idm-blue-dark text-white px-4 py-2 rounded-xl font-bold text-body-sm shadow-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>Tambah Pegawai
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
        <KpiCard icon="groups" accent="blue" label="Total Pegawai" value={`${employees.length} Orang`} footerLeft={isManager ? "Semua gerai" : "Gerai Anda"} />
        <KpiCard icon="person_check" accent="emerald" label="Pegawai Aktif" value={`${totalAktif} Orang`} footerLeft="Bisa dipakai untuk verifikasi transaksi" />
        <KpiCard
          icon="person_off"
          accent="yellow"
          label="Pegawai Nonaktif"
          value={`${totalNonaktif} Orang`}
          footerLeft={isManager && geraiTanpaPegawai > 0 ? `${geraiTanpaPegawai} gerai belum ada pegawai` : "—"}
        />
      </div>

      <SectionCard
        title="Daftar Pegawai"
        description="Nama & password singkat pegawai — dipakai untuk verifikasi tiap transaksi, bukan akun login penuh"
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1">
            <InputShell icon="search">
              <input
                className={inputClass}
                placeholder="Cari nama pegawai..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputShell>
          </div>
          {isManager && (
            <div className="w-full sm:w-64">
              <InputShell icon="storefront">
                <select className={inputClass} value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
                  <option value="">Semua Gerai</option>
                  {storeList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.store_code} • {g.name}
                    </option>
                  ))}
                </select>
              </InputShell>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                <th className="py-2.5 px-3">Nama Pegawai</th>
                {isManager && <th className="py-2.5 px-3">Gerai</th>}
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Terdaftar</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-body-sm">
              {halaman.pageRows.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-idm-blue font-bold flex items-center justify-center text-[11px]">
                        {e.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-bold text-[13px] text-on-surface">{e.name}</span>
                    </div>
                  </td>
                  {isManager && (
                    <td className="py-3 px-3 text-[12px]">
                      {e.store ? (
                        <>
                          <div className="font-semibold text-on-surface">{e.store.name}</div>
                          <span className="text-[11px] text-idm-blue font-mono">{e.store.store_code}</span>
                        </>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                  )}
                  <td className="py-3 px-3">
                    <Badge variant={e.is_active ? "emerald" : "slate"}>{e.is_active ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td className="py-3 px-3 text-[12px] text-text-muted font-mono">{formatDate(e.created_at)}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditingEmployee(e);
                          setModalOpen(true);
                        }}
                        type="button"
                        title="Edit pegawai"
                        aria-label={`Edit ${e.name}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-200 text-text-muted hover:text-idm-blue hover:bg-blue-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleToggleActive(e)}
                        type="button"
                        title={e.is_active ? "Nonaktifkan pegawai" : "Aktifkan pegawai"}
                        aria-label={e.is_active ? `Nonaktifkan ${e.name}` : `Aktifkan ${e.name}`}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                          e.is_active
                            ? "bg-slate-50 border-slate-200 text-text-muted hover:text-amber-600 hover:bg-amber-50"
                            : "bg-slate-50 border-slate-200 text-text-muted hover:text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {e.is_active ? "person_off" : "person_check"}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDelete(e)}
                        type="button"
                        title="Hapus pegawai"
                        aria-label={`Hapus ${e.name}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-200 text-text-muted hover:text-idm-red hover:bg-red-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={isManager ? 5 : 4} className="py-8 text-center text-text-muted text-sm">
                    Belum ada pegawai yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={halaman.page}
          lastPage={halaman.lastPage}
          from={halaman.from}
          to={halaman.to}
          total={halaman.total}
          onChange={halaman.setPage}
          label="pegawai"
        />
      </SectionCard>

      <EmployeeFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingEmployee={editingEmployee}
        isManager={isManager}
        storeList={storeList}
        onSaved={() => {
          setModalOpen(false);
          load();
        }}
      />
    </>
  );
}

function EmployeeFormModal({ open, onClose, editingEmployee, isManager, storeList, onSaved }) {
  const isEdit = !!editingEmployee;
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(editingEmployee?.name || "");
      setPassword("");
      setStoreId(editingEmployee?.store_id ? String(editingEmployee.store_id) : "");
      setIsActive(editingEmployee ? !!editingEmployee.is_active : true);
      setError("");
    }
  }, [open, editingEmployee]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        // Gerai tidak bisa diubah lewat form edit — hanya nama, password
        // (opsional), dan status aktif.
        const payload = { name, is_active: isActive };
        if (password) payload.password = password;
        await updateEmployee(editingEmployee.id, payload);
      } else {
        if (isManager && !storeId) {
          setError("Gerai wajib dipilih untuk pegawai baru.");
          setSaving(false);
          return;
        }
        const payload = { name, password };
        if (isManager) payload.store_id = Number(storeId);
        // Supervisor tidak perlu mengirim store_id — backend otomatis
        // mengunci ke gerainya sendiri.
        await createEmployee(payload);
      }
      onSaved();
    } catch (err) {
      const errs = err?.response?.data?.errors;
      const msg = errs ? Object.values(errs)[0]?.[0] : err?.response?.data?.message;
      setError(msg || `Gagal ${isEdit ? "menyimpan perubahan" : "menambahkan"} pegawai.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Pegawai / Kasir" : "Tambah Pegawai / Kasir"}
      description="Karyawan tidak memiliki akun login penuh — nama & password ini hanya dipakai untuk verifikasi saat input transaksi."
      footer={
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-text-muted hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            form="form-pegawai"
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-idm-blue hover:bg-idm-blue-dark text-white text-sm font-bold shadow-sm disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Pegawai"}
          </button>
        </div>
      }
    >
      <form id="form-pegawai" onSubmit={handleSubmit} className="space-y-4">
        {isManager && (
          <Field label="Gerai" code="store_id" required>
            <InputShell icon="storefront">
              <select
                required
                disabled={isEdit}
                className={inputClass}
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
              >
                <option value="">Pilih gerai...</option>
                {storeList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.store_code} • {g.name}
                  </option>
                ))}
              </select>
            </InputShell>
            {isEdit && (
              <p className="text-[11px] text-text-muted mt-1">Gerai tidak bisa diubah setelah pegawai dibuat.</p>
            )}
          </Field>
        )}
        <Field label="Nama Pegawai" code="name" required>
          <InputShell icon="badge">
            <input
              required
              className={inputClass}
              placeholder="cth. Kasir Dua"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </InputShell>
        </Field>
        <Field label={isEdit ? "Password Baru (opsional)" : "Password"} code="password" required={!isEdit}>
          <InputShell icon="lock">
            <input
              required={!isEdit}
              type="password"
              minLength={4}
              className={inputClass}
              placeholder={isEdit ? "Kosongkan jika tidak diganti" : "Minimal 4 karakter"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </InputShell>
        </Field>
        {isEdit && (
          <label className="flex items-center gap-2 text-xs font-bold text-on-surface">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Pegawai berstatus aktif
          </label>
        )}
        {error && (
          <div className="flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
