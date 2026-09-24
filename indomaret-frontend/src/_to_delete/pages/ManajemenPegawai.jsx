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
import { listEmployees, createEmployee, updateEmployee, deleteEmployee, listIndomaret } from "../api/resources";
import { formatDate } from "../lib/format";

/**
 * Halaman pusat untuk mengelola data karyawan/kasir individu (tabel
 * `employees` — nama+password pendek untuk verifikasi tiap transaksi,
 * BUKAN akun login `users`). Sebelumnya hanya bisa dikelola lewat kartu
 * "Daftar Pegawai" di halaman detail tiap gerai; halaman ini
 * mengumpulkannya jadi satu tempat, bisa diakses manager (semua gerai)
 * maupun supervisor (gerainya sendiri, otomatis discope backend).
 */
export default function ManajemenPegawai() {
  const { isManager, isSupervisor } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [indomaretList, setIndomaretList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  function load() {
    setLoading(true);
    listEmployees(isManager && storeFilter ? { indomaret_id: storeFilter } : {})
      .then(setEmployees)
      .finally(() => setLoading(false));
  }

  useEffect(load, [isManager, storeFilter]);
  useEffect(() => {
    if (isManager) {
      listIndomaret().then(setIndomaretList).catch(() => {});
    }
  }, [isManager]);

  const filtered = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter((e) => e.nama.toLowerCase().includes(q));
  }, [employees, search]);

  const halaman = usePaginatedRows(filtered, 10);

  const totalAktif = employees.filter((e) => e.is_active).length;
  const totalNonaktif = employees.filter((e) => !e.is_active).length;
  const geraiTanpaPegawai = indomaretList.filter(
    (g) => !employees.some((e) => e.indomaret_id === g.id)
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
      `Hapus pegawai "${emp.nama}"? Riwayat transaksi yang pernah dicatat pegawai ini akan tetap tersimpan tapi kehilangan keterangan nama pegawainya. Kalau pegawai ini hanya berhenti sementara, lebih baik nonaktifkan saja. Tindakan hapus tidak bisa dibatalkan.`
    );
    if (!ok) return;
    try {
      await deleteEmployee(emp.id);
      load();
    } catch (err) {
      alert(err?.response?.data?.message || "Gagal menghapus pegawai.");
    }
  }

  if (!isManager && !isSupervisor) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <PageHeader
        title="Manajemen Pegawai"
        description={
          isManager
            ? "Kelola data karyawan/kasir individu di semua gerai Indomaret."
            : "Kelola data karyawan/kasir individu di gerai Anda."
        }
        actions={
          <button
            onClick={() => {
              setEditingEmployee(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-idm-blue hover:bg-idm-blue-dark text-white px-4 py-2 rounded-xl font-bold text-body-sm shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>Tambah Pegawai
          </button>
        }
      />

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
                  {indomaretList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.kode_toko} • {g.nama}
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
                        {e.nama?.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-bold text-[13px] text-on-surface">{e.nama}</span>
                    </div>
                  </td>
                  {isManager && (
                    <td className="py-3 px-3 text-[12px]">
                      {e.indomaret ? (
                        <>
                          <div className="font-semibold text-on-surface">{e.indomaret.nama}</div>
                          <span className="text-[11px] text-idm-blue font-mono">{e.indomaret.kode_toko}</span>
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
                        aria-label={`Edit ${e.nama}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-200 text-text-muted hover:text-idm-blue hover:bg-blue-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleToggleActive(e)}
                        type="button"
                        title={e.is_active ? "Nonaktifkan pegawai" : "Aktifkan pegawai"}
                        aria-label={e.is_active ? `Nonaktifkan ${e.nama}` : `Aktifkan ${e.nama}`}
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
                        aria-label={`Hapus ${e.nama}`}
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
        indomaretList={indomaretList}
        onSaved={() => {
          setModalOpen(false);
          load();
        }}
      />
    </>
  );
}

function EmployeeFormModal({ open, onClose, editingEmployee, isManager, indomaretList, onSaved }) {
  const isEdit = !!editingEmployee;
  const [nama, setNama] = useState("");
  const [password, setPassword] = useState("");
  const [indomaretId, setIndomaretId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setNama(editingEmployee?.nama || "");
      setPassword("");
      setIndomaretId(editingEmployee?.indomaret_id ? String(editingEmployee.indomaret_id) : "");
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
        const payload = { nama, is_active: isActive };
        if (password) payload.password = password;
        await updateEmployee(editingEmployee.id, payload);
      } else {
        if (isManager && !indomaretId) {
          setError("Gerai wajib dipilih untuk pegawai baru.");
          setSaving(false);
          return;
        }
        const payload = { nama, password };
        if (isManager) payload.indomaret_id = Number(indomaretId);
        // Supervisor tidak perlu mengirim indomaret_id — backend otomatis
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
          <Field label="Gerai" code="indomaret_id" required>
            <InputShell icon="storefront">
              <select
                required
                disabled={isEdit}
                className={inputClass}
                value={indomaretId}
                onChange={(e) => setIndomaretId(e.target.value)}
              >
                <option value="">Pilih gerai...</option>
                {indomaretList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.kode_toko} • {g.nama}
                  </option>
                ))}
              </select>
            </InputShell>
            {isEdit && (
              <p className="text-[11px] text-text-muted mt-1">Gerai tidak bisa diubah setelah pegawai dibuat.</p>
            )}
          </Field>
        )}
        <Field label="Nama Pegawai" code="nama" required>
          <InputShell icon="badge">
            <input
              required
              className={inputClass}
              placeholder="cth. Kasir Dua"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
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
