import { useEffect, useMemo, useState } from "react";
import Badge from "../components/ui/Badge";
import { Field, InputShell, inputClass } from "../components/ui/InputShell";
import { useAuth } from "../context/AuthContext";
import {
  createPengeluaran,
  createPemasukan,
  listPengeluaran,
  listPemasukan,
  listKategoriBarang,
  listEmployees,
} from "../api/resources";
import { formatRupiah, formatNumber, formatDate, todayISO } from "../lib/format";

const SUMBER_OPTIONS = [
  { value: "tunai", label: "Tunai" },
  { value: "non_tunai", label: "Non-Tunai / QRIS" },
  { value: "lainnya", label: "Lainnya" },
];

const STATUS_BADGE = {
  pending: { variant: "amber", label: "Menunggu Persetujuan", icon: "hourglass_top" },
  approved: { variant: "emerald", label: "Disetujui", icon: "check_circle" },
  rejected: { variant: "red", label: "Ditolak", icon: "cancel" },
};

function emptyBarang() {
  return {
    kategori_barang_id: "",
    tanggal: todayISO(),
    jumlah_barang: "",
    satuan: "pcs",
    nilai: "",
    keterangan: "",
    employee_nama: "",
    employee_password: "",
  };
}

function emptyPemasukan() {
  return {
    tanggal: todayISO(),
    jumlah: "",
    sumber: "tunai",
    keterangan: "",
    employee_nama: "",
    employee_password: "",
  };
}

export default function KasirDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("barang");
  const [kategoriList, setKategoriList] = useState([]);
  const [employeeList, setEmployeeList] = useState([]);
  const [pengeluaranRows, setPengeluaranRows] = useState([]);
  const [pemasukanRows, setPemasukanRows] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [formBarang, setFormBarang] = useState(emptyBarang());
  const [formPemasukan, setFormPemasukan] = useState(emptyPemasukan());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function loadHistory() {
    setLoadingHistory(true);
    Promise.all([
      listPengeluaran({ per_page: 50 }).catch(() => ({ data: [] })),
      listPemasukan({ per_page: 50 }).catch(() => ({ data: [] })),
    ])
      .then(([peng, pem]) => {
        setPengeluaranRows(peng.data || []);
        setPemasukanRows(pem.data || []);
      })
      .finally(() => setLoadingHistory(false));
  }

  useEffect(() => {
    loadHistory();
    listKategoriBarang({ aktif_saja: true }).then(setKategoriList).catch(() => {});
    listEmployees().then(setEmployeeList).catch(() => {});
  }, []);

  const riwayat = useMemo(() => {
    const own = (rows, jenis) =>
      rows
        .filter((r) => r.user_id === user?.id)
        .map((r) => ({ ...r, jenis }));
    const combined = [...own(pengeluaranRows, "barang"), ...own(pemasukanRows, "pemasukan")];
    return combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [pengeluaranRows, pemasukanRows, user]);

  const pendingCount = riwayat.filter((r) => r.status === "pending").length;

  async function handleSubmitBarang(e) {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");
    setSaving(true);
    try {
      await createPengeluaran({
        kategori_barang_id: Number(formBarang.kategori_barang_id),
        tanggal: formBarang.tanggal,
        jumlah_barang: Number(formBarang.jumlah_barang),
        satuan: formBarang.satuan || "pcs",
        nilai: Number(formBarang.nilai),
        keterangan: formBarang.keterangan || undefined,
        employee_nama: formBarang.employee_nama,
        employee_password: formBarang.employee_password,
      });
      setFormBarang(emptyBarang());
      setSuccessMsg("Barang keluar berhasil dikirim, menunggu persetujuan supervisor.");
      loadHistory();
    } catch (err) {
      const errs = err?.response?.data?.errors;
      const msg = errs ? Object.values(errs)[0]?.[0] : err?.response?.data?.message;
      setFormError(msg || "Gagal menyimpan data. Periksa kembali isian Anda.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitPemasukan(e) {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");
    setSaving(true);
    try {
      await createPemasukan({
        tanggal: formPemasukan.tanggal,
        jumlah: Number(formPemasukan.jumlah),
        sumber: formPemasukan.sumber,
        keterangan: formPemasukan.keterangan || undefined,
        employee_nama: formPemasukan.employee_nama,
        employee_password: formPemasukan.employee_password,
      });
      setFormPemasukan(emptyPemasukan());
      setSuccessMsg("Pemasukan berhasil dikirim, menunggu persetujuan supervisor.");
      loadHistory();
    } catch (err) {
      const errs = err?.response?.data?.errors;
      const msg = errs ? Object.values(errs)[0]?.[0] : err?.response?.data?.message;
      setFormError(msg || "Gagal menyimpan data. Periksa kembali isian Anda.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title-md font-extrabold text-on-surface">
          Input Transaksi — {user?.indomaret?.nama || "Gerai"}
        </h1>
        <p className="text-body-sm text-text-muted">
          Setiap transaksi wajib diisi nama & password kasir yang bertugas, untuk keperluan audit. Transaksi akan
          berstatus <span className="font-bold text-amber-700">menunggu persetujuan</span> sampai diverifikasi oleh
          supervisor.
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-900">
          <span className="material-symbols-outlined text-[20px]">pending_actions</span>
          <span className="text-sm font-semibold">
            {pendingCount} transaksi Anda masih menunggu persetujuan supervisor.
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 m-4 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setTab("barang")}
            className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
              tab === "barang" ? "bg-idm-red text-white shadow-sm" : "text-text-muted"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">outbox</span>
            Barang Keluar
          </button>
          <button
            type="button"
            onClick={() => setTab("pemasukan")}
            className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
              tab === "pemasukan" ? "bg-idm-blue text-white shadow-sm" : "text-text-muted"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            Pemasukan
          </button>
        </div>

        <div className="px-5 pb-5">
          {tab === "barang" ? (
            <form onSubmit={handleSubmitBarang} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field label="Kategori Produk" required>
                  <InputShell icon="category">
                    <select
                      required
                      className={inputClass}
                      value={formBarang.kategori_barang_id}
                      onChange={(e) => setFormBarang((f) => ({ ...f, kategori_barang_id: e.target.value }))}
                    >
                      <option value="">Pilih kategori...</option>
                      {kategoriList.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nama}
                        </option>
                      ))}
                    </select>
                  </InputShell>
                </Field>
                <Field label="Tanggal Keluar" required>
                  <InputShell icon="calendar_today">
                    <input
                      type="date"
                      required
                      className={inputClass}
                      value={formBarang.tanggal}
                      onChange={(e) => setFormBarang((f) => ({ ...f, tanggal: e.target.value }))}
                    />
                  </InputShell>
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field label="Jumlah Barang" required>
                  <InputShell icon="scale">
                    <input
                      type="number"
                      min="1"
                      required
                      className={inputClass}
                      placeholder="0"
                      value={formBarang.jumlah_barang}
                      onChange={(e) => setFormBarang((f) => ({ ...f, jumlah_barang: e.target.value }))}
                    />
                    <span className="text-[11px] text-text-muted shrink-0">{formBarang.satuan || "pcs"}</span>
                  </InputShell>
                </Field>
                <Field label="Total Biaya" required>
                  <InputShell icon="payments">
                    <span className="text-[11px] text-text-muted">Rp</span>
                    <input
                      type="number"
                      min="0"
                      required
                      className={inputClass}
                      placeholder="0"
                      value={formBarang.nilai}
                      onChange={(e) => setFormBarang((f) => ({ ...f, nilai: e.target.value }))}
                    />
                  </InputShell>
                </Field>
              </div>
              <Field label="Keterangan (opsional)">
                <InputShell icon="notes">
                  <input
                    className={inputClass}
                    placeholder="cth. Stok opname harian"
                    value={formBarang.keterangan}
                    onChange={(e) => setFormBarang((f) => ({ ...f, keterangan: e.target.value }))}
                  />
                </InputShell>
              </Field>
              <KasirIdentityFields
                nama={formBarang.employee_nama}
                onNamaChange={(v) => setFormBarang((f) => ({ ...f, employee_nama: v }))}
                password={formBarang.employee_password}
                onPasswordChange={(v) => setFormBarang((f) => ({ ...f, employee_password: v }))}
                employeeOptions={employeeList}
                listId="employee-suggestions-barang"
              />
              <SubmitBar saving={saving} label="Kirim Barang Keluar" color="bg-idm-red hover:bg-idm-red-dark" />
            </form>
          ) : (
            <form onSubmit={handleSubmitPemasukan} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field label="Nominal Pemasukan" required>
                  <InputShell icon="payments">
                    <span className="text-[11px] text-text-muted">Rp</span>
                    <input
                      type="number"
                      min="0"
                      required
                      className={inputClass}
                      placeholder="0"
                      value={formPemasukan.jumlah}
                      onChange={(e) => setFormPemasukan((f) => ({ ...f, jumlah: e.target.value }))}
                    />
                  </InputShell>
                </Field>
                <Field label="Tanggal Transaksi" required>
                  <InputShell icon="calendar_today">
                    <input
                      type="date"
                      required
                      className={inputClass}
                      value={formPemasukan.tanggal}
                      onChange={(e) => setFormPemasukan((f) => ({ ...f, tanggal: e.target.value }))}
                    />
                  </InputShell>
                </Field>
              </div>
              <Field label="Sumber Penerimaan">
                <InputShell icon="account_balance_wallet">
                  <select
                    className={inputClass}
                    value={formPemasukan.sumber}
                    onChange={(e) => setFormPemasukan((f) => ({ ...f, sumber: e.target.value }))}
                  >
                    {SUMBER_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </InputShell>
              </Field>
              <Field label="Keterangan (opsional)">
                <InputShell icon="notes">
                  <input
                    className={inputClass}
                    placeholder="cth. Setoran shift pagi"
                    value={formPemasukan.keterangan}
                    onChange={(e) => setFormPemasukan((f) => ({ ...f, keterangan: e.target.value }))}
                  />
                </InputShell>
              </Field>
              <KasirIdentityFields
                nama={formPemasukan.employee_nama}
                onNamaChange={(v) => setFormPemasukan((f) => ({ ...f, employee_nama: v }))}
                password={formPemasukan.employee_password}
                onPasswordChange={(v) => setFormPemasukan((f) => ({ ...f, employee_password: v }))}
                employeeOptions={employeeList}
                listId="employee-suggestions-pemasukan"
              />
              <SubmitBar saving={saving} label="Kirim Pemasukan" color="bg-idm-blue hover:bg-idm-blue-dark" />
            </form>
          )}

          {formError && (
            <div className="mt-3 flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {formError}
            </div>
          )}
          {successMsg && (
            <div className="mt-3 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-semibold">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              {successMsg}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border-subtle shadow-sm p-5">
        <h2 className="text-body-md font-extrabold text-on-surface mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-idm-blue text-[20px]">history</span>
          Riwayat Input Anda
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Jenis</th>
                <th className="py-2.5 px-3 text-right">Nilai</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-body-sm">
              {riwayat.map((row) => {
                const badge = STATUS_BADGE[row.status] || STATUS_BADGE.approved;
                return (
                  <tr key={`${row.jenis}-${row.id}`} className="hover:bg-slate-50">
                    <td className="py-3 px-3 whitespace-nowrap text-text-muted font-medium text-[12px]">
                      {formatDate(row.tanggal)}
                    </td>
                    <td className="py-3 px-3 text-[13px] font-semibold">
                      {row.jenis === "barang" ? (
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-idm-red text-[16px]">outbox</span>
                          Barang Keluar
                          {row.kategori_barang?.nama ? ` • ${row.kategori_barang.nama}` : ""}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-emerald-600 text-[16px]">
                            account_balance_wallet
                          </span>
                          Pemasukan
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[13px]">
                      {row.jenis === "barang"
                        ? `${formatRupiah(row.nilai)} (${formatNumber(row.jumlah_barang)} ${row.satuan})`
                        : formatRupiah(row.jumlah)}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={badge.variant}>
                        <span className="material-symbols-outlined text-[13px]">{badge.icon}</span>
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-[12px] text-text-muted max-w-[220px]">
                      {row.status === "rejected" && row.rejection_reason ? (
                        <span className="text-idm-red">{row.rejection_reason}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loadingHistory && riwayat.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-muted text-sm">
                    Belum ada transaksi yang diinput.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function KasirIdentityFields({ nama, onNamaChange, password, onPasswordChange, employeeOptions, listId }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
      <p className="text-[11px] font-bold text-on-surface mb-2 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[15px] text-idm-blue">badge</span>
        Identitas Kasir yang Bertugas (wajib diisi untuk audit)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nama Kasir" required>
          <InputShell icon="person">
            <input
              list={listId}
              required
              className={inputClass}
              placeholder="cth. Kasir Satu"
              value={nama}
              onChange={(e) => onNamaChange(e.target.value)}
            />
          </InputShell>
          <datalist id={listId}>
            {employeeOptions.map((e) => (
              <option key={e.id} value={e.nama} />
            ))}
          </datalist>
        </Field>
        <Field label="Password Kasir" required>
          <InputShell icon="lock">
            <input
              type="password"
              required
              className={inputClass}
              placeholder="Password milik kasir"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </InputShell>
        </Field>
      </div>
    </div>
  );
}

function SubmitBar({ saving, label, color }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className={`w-full sm:w-auto flex items-center justify-center gap-1.5 ${color} text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm disabled:opacity-60 transition-colors`}
    >
      <span className="material-symbols-outlined text-[18px]">send</span>
      {saving ? "Mengirim..." : label}
    </button>
  );
}
