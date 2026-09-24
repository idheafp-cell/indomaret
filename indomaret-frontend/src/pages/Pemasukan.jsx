import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import TableSearch from "../components/ui/TableSearch";
import Pagination from "../components/ui/Pagination";
import KpiCard from "../components/ui/KpiCard";
import Modal from "../components/ui/Modal";
import { Field, InputShell, inputClass } from "../components/ui/InputShell";
import EmployeeInputToggle from "../components/ui/EmployeeInputToggle";
import { useAuth } from "../context/AuthContext";
import { listIncomes, createIncome, listStores, listEmployees } from "../api/resources";
import { exportRowsToExcel } from "../lib/exportExcel";
import { formatRupiah, formatDate, todayISO } from "../lib/format";

const STATUS_LABEL = { approved: "Disetujui", pending: "Menunggu", rejected: "Ditolak" };

export default function Pemasukan() {
  const { isManager, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [storeList, setStoreList] = useState([]);
  const [employeeList, setEmployeeList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState(emptyForm());

  function emptyForm() {
    return {
      store_id: "",
      date: todayISO(),
      amount: "",
      notes: "",
      mode: "self",
      employee_name: "",
      employee_password: "",
    };
  }

  function loadList(p = 1, term = search) {
    setLoading(true);
    listIncomes({ page: p, per_page: 8, search: term || undefined })
      .then((res) => {
        setRows(res.data || []);
        setMeta(res);
      })
      .finally(() => setLoading(false));
  }

  // Pencarian di-debounce supaya tiap ketikan tidak langsung memukul API.
  useEffect(() => {
    const timer = setTimeout(() => loadList(page, search), search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [page, search]);

  function handleSearch(value) {
    setSearch(value);
    setPage(1);
  }

  useEffect(() => {
    listEmployees().then(setEmployeeList).catch(() => {});
    if (isManager) listStores().then(setStoreList);
  }, [isManager]);

  // Total & rata-rata kartu KPI diambil dari ringkasan backend (SELURUH data
  // yang cocok filter/pencarian), bukan cuma `rows` halaman yang sedang dilihat.
  const totalSemua = meta?.summary?.total_amount ?? 0;
  const totalTransaksiSemua = meta?.total ?? 0;
  const rataRataSemua = totalTransaksiSemua ? totalSemua / totalTransaksiSemua : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        amount: Number(form.amount),
        notes: form.notes || undefined,
      };
      if (isManager) payload.store_id = Number(form.store_id);
      if (form.mode === "employee") {
        payload.employee_name = form.employee_name;
        payload.employee_password = form.employee_password;
      }
      await createIncome(payload);
      setModalOpen(false);
      setForm(emptyForm());
      loadList(1);
      setPage(1);
    } catch (err) {
      const errs = err?.response?.data?.errors;
      const msg = errs ? Object.values(errs)[0]?.[0] : err?.response?.data?.message;
      setFormError(msg || "Gagal menyimpan data. Periksa kembali isian Anda.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await listIncomes({ search: search || undefined, per_page: 10000 });
      exportRowsToExcel(
        res.data || [],
        [
          { header: "Tanggal", accessor: (r) => formatDate(r.date) },
          { header: "Gerai", accessor: (r) => r.store?.name || "-" },
          { header: "Kode Toko", accessor: (r) => r.store?.store_code || "-" },
          { header: "Jumlah (Rp)", accessor: (r) => Number(r.amount || 0) },
          { header: "Status", accessor: (r) => STATUS_LABEL[r.status] || r.status },
          { header: "Diinput Oleh", accessor: (r) => r.employee?.name || r.user?.name || "-" },
          { header: "Keterangan", accessor: (r) => r.notes || "-" },
        ],
        `pemasukan-${todayISO()}.xlsx`
      );
    } catch {
      alert("Gagal menyiapkan file Excel. Coba lagi.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Monitoring & Rekap Pemasukan"
        description="Pencatatan realisasi omset kasir dan penerimaan penjualan retail harian."
        actions={
          <>
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-white border border-idm-blue text-idm-blue hover:bg-blue-50 px-3.5 py-2 rounded-xl font-bold text-body-sm shadow-xs transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                {exporting ? "hourglass_top" : "download"}
              </span>
              {exporting ? "Menyiapkan..." : "Unduh Data"}
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 bg-idm-blue hover:bg-idm-blue-dark text-white px-4 py-2 rounded-xl font-bold text-body-sm shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>Catat Pemasukan
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <KpiCard
          icon="payments"
          accent="blue"
          label="Total Pemasukan"
          value={formatRupiah(totalSemua, { compact: true })}
          footerLeft={`${totalTransaksiSemua} total transaksi`}
        />
        <KpiCard
          icon="receipt_long"
          accent="yellow"
          label="Rata-rata / Transaksi"
          value={formatRupiah(rataRataSemua, { compact: true })}
          footerLeft="Seluruh transaksi"
        />
        <KpiCard
          icon="storefront"
          accent="tricolor"
          label="Gerai Terpantau"
          value={isManager ? "Semua Gerai" : user?.store?.name || "-"}
          footerLeft={isManager ? "Seluruh kabupaten" : user?.store?.store_code}
        />
      </div>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">account_balance_wallet</span>
            Daftar Transaksi Pemasukan
          </span>
        }
        description="Riwayat realisasi kas harian seluruh gerai"
        actions={<TableSearch value={search} onChange={handleSearch} placeholder="Cari gerai, penginput..." />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Gerai</th>
                <th className="py-2.5 px-3 text-right">Jumlah</th>
                <th className="py-2.5 px-3">Diinput Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-body-sm">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-emerald-50/30 transition-colors">
                  <td className="py-3 px-3 whitespace-nowrap text-text-muted font-medium text-[12px]">
                    {formatDate(row.date)}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-[13px] text-on-surface">{row.store?.name}</div>
                    <span className="text-[11px] text-idm-blue font-semibold font-mono">
                      {row.store?.store_code}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700 text-[13px]">
                    {formatRupiah(row.amount)}
                  </td>
                  <td className="py-3 px-3 text-[12px] text-text-muted">{row.employee?.name || row.user?.name}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-muted text-sm">
                    {search
                      ? `Tidak ada transaksi yang cocok dengan "${search}".`
                      : "Belum ada transaksi pemasukan."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          lastPage={meta?.last_page || 1}
          from={meta?.from || 0}
          to={meta?.to || 0}
          total={meta?.total || 0}
          onChange={setPage}
          label="transaksi"
        />
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Catat Pemasukan Kasir"
        description="Input data penerimaan kas harian gerai Indomaret"
        footer={
          <>
            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Tersambung ke backend
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-text-muted hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                form="form-pemasukan"
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-idm-blue hover:bg-idm-blue-dark text-white text-sm font-bold shadow-sm disabled:opacity-60 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                {saving ? "Menyimpan..." : "Simpan Pemasukan"}
              </button>
            </div>
          </>
        }
      >
        <form id="form-pemasukan" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {isManager && (
              <Field label="Gerai Indomaret" code="store_id" required>
                <InputShell icon="storefront">
                  <select
                    required
                    className={inputClass}
                    value={form.store_id}
                    onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}
                  >
                    <option value="">Pilih gerai...</option>
                    {storeList.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.store_code} • {i.name}
                      </option>
                    ))}
                  </select>
                </InputShell>
              </Field>
            )}
            <Field label="Tanggal Transaksi" code="date" required>
              <InputShell icon="calendar_today">
                <input
                  type="date"
                  required
                  className={inputClass}
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </InputShell>
            </Field>
          </div>

          <Field label="Nominal Pemasukan" code="amount" required>
            <InputShell icon="payments">
              <span className="text-[11px] text-text-muted">Rp</span>
              <input
                type="number"
                min="0"
                required
                className={inputClass}
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </InputShell>
          </Field>

          <Field label="Keterangan (opsional)">
            <InputShell icon="notes">
              <input
                className={inputClass}
                placeholder="cth. Setoran shift pagi"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </InputShell>
          </Field>

          <EmployeeInputToggle
            mode={form.mode}
            onModeChange={(mode) => setForm((f) => ({ ...f, mode }))}
            name={form.employee_name}
            onNameChange={(v) => setForm((f) => ({ ...f, employee_name: v }))}
            password={form.employee_password}
            onPasswordChange={(v) => setForm((f) => ({ ...f, employee_password: v }))}
            employeeOptions={employeeList}
          />

          {formError && (
            <div className="flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {formError}
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
