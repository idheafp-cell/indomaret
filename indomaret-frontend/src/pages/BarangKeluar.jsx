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
import {
  listExpenses,
  createExpense,
  listItemCategories,
  listStores,
  listEmployees,
} from "../api/resources";
import { exportRowsToExcel } from "../lib/exportExcel";
import { formatRupiah, formatNumber, formatDate, todayISO } from "../lib/format";

const STATUS_LABEL = { approved: "Disetujui", pending: "Menunggu", rejected: "Ditolak" };

export default function BarangKeluar() {
  const { isManager } = useAuth();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [categoryList, setCategoryList] = useState([]);
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
      item_category_id: "",
      date: todayISO(),
      quantity: "",
      unit: "pcs",
      value: "",
      notes: "",
      mode: "self",
      employee_name: "",
      employee_password: "",
    };
  }

  function loadList(p = 1, term = search) {
    setLoading(true);
    listExpenses({ page: p, per_page: 8, search: term || undefined })
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
    listItemCategories({ active_only: true }).then(setCategoryList);
    listEmployees().then(setEmployeeList).catch(() => {});
    if (isManager) listStores().then(setStoreList);
  }, [isManager]);

  // Total kartu KPI diambil dari ringkasan backend (SELURUH data yang cocok
  // filter/pencarian), bukan cuma dijumlahkan dari `rows` halaman ini.
  const totalNilaiSemua = meta?.summary?.total_value ?? 0;
  const totalUnitSemua = meta?.summary?.total_units ?? 0;

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await listExpenses({ search: search || undefined, per_page: 10000 });
      exportRowsToExcel(
        res.data || [],
        [
          { header: "Tanggal", accessor: (r) => formatDate(r.date) },
          { header: "Gerai", accessor: (r) => r.store?.name || "-" },
          { header: "Kode Toko", accessor: (r) => r.store?.store_code || "-" },
          { header: "Kategori", accessor: (r) => r.item_category?.name || "-" },
          { header: "Jumlah", accessor: (r) => Number(r.quantity || 0) },
          { header: "Satuan", accessor: (r) => r.unit || "pcs" },
          { header: "Total Beban (Rp)", accessor: (r) => Number(r.value || 0) },
          { header: "Status", accessor: (r) => STATUS_LABEL[r.status] || r.status },
          { header: "Diinput Oleh", accessor: (r) => r.employee?.name || r.user?.name || "-" },
          { header: "Keterangan", accessor: (r) => r.notes || "-" },
        ],
        `barang-keluar-${todayISO()}.xlsx`
      );
    } catch {
      alert("Gagal menyiapkan file Excel. Coba lagi.");
    } finally {
      setExporting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        item_category_id: Number(form.item_category_id),
        date: form.date,
        quantity: Number(form.quantity),
        unit: form.unit || "pcs",
        value: Number(form.value),
        notes: form.notes || undefined,
      };
      if (isManager) payload.store_id = Number(form.store_id);
      if (form.mode === "employee") {
        payload.employee_name = form.employee_name;
        payload.employee_password = form.employee_password;
      }
      await createExpense(payload);
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

  return (
    <>
      <PageHeader
        title="Monitoring & Mutasi Barang Keluar"
        description="Pencatatan pengeluaran stok barang per kategori dan realisasi beban modal."
        actions={
          <>
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-white border border-slate-200 text-on-surface hover:bg-slate-50 px-3.5 py-2 rounded-xl font-bold text-body-sm shadow-xs transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                {exporting ? "hourglass_top" : "download"}
              </span>
              {exporting ? "Menyiapkan..." : "Unduh Data"}
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 bg-idm-red hover:bg-idm-red-dark text-white px-4 py-2 rounded-xl font-bold text-body-sm shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">outbox</span>Input Barang Keluar
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <KpiCard
          icon="outbox"
          accent="red"
          label="Beban Barang Keluar"
          value={formatRupiah(totalNilaiSemua, { compact: true })}
          valueClassName="text-idm-red"
          footerLeft={`${meta?.total ?? 0} total transaksi`}
        />
        <KpiCard
          icon="inventory_2"
          accent="blue"
          label="Volume Barang"
          value={`${formatNumber(totalUnitSemua)} Unit`}
          footerLeft="Akumulasi seluruh transaksi"
        />
        <KpiCard
          icon="category"
          accent="yellow"
          label="Jumlah Kategori Aktif"
          value={`${categoryList.length} Kategori`}
          footerLeft="Master kategori barang"
        />
      </div>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-idm-red" />
            Daftar Transaksi Barang Keluar
          </span>
        }
        description="Riwayat pengeluaran barang seluruh gerai"
        actions={<TableSearch value={search} onChange={handleSearch} placeholder="Cari gerai, kategori, penginput..." />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Gerai</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Total Beban</th>
                <th className="py-2.5 px-3">Diinput Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-body-sm">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-red-50/30 transition-colors">
                  <td className="py-3 px-3 whitespace-nowrap text-text-muted font-medium text-[12px]">
                    {formatDate(row.date)}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-[13px] text-on-surface">{row.store?.name}</div>
                    <span className="text-[11px] text-idm-blue font-semibold font-mono">
                      {row.store?.store_code}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[13px] font-medium">{row.item_category?.name}</td>
                  <td className="py-3 px-3 text-right text-[13px]">
                    {formatNumber(row.quantity)} {row.unit}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-idm-red text-[13px]">
                    {formatRupiah(row.value)}
                  </td>
                  <td className="py-3 px-3 text-[12px] text-text-muted">{row.employee?.name || row.user?.name}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted text-sm">
                    {search
                      ? `Tidak ada transaksi yang cocok dengan "${search}".`
                      : "Belum ada transaksi barang keluar."}
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
        title="Input Barang Keluar"
        description="Pencatatan mutasi dan pengeluaran barang retail per gerai"
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
                form="form-barang-keluar"
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-idm-red hover:bg-idm-red-dark text-white text-sm font-bold shadow-sm disabled:opacity-60 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                {saving ? "Menyimpan..." : "Simpan Barang Keluar"}
              </button>
            </div>
          </>
        }
      >
        <form id="form-barang-keluar" onSubmit={handleSubmit} className="space-y-4">
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
            <Field label="Kategori Produk" code="item_category_id" required>
              <InputShell icon="category">
                <select
                  required
                  className={inputClass}
                  value={form.item_category_id}
                  onChange={(e) => setForm((f) => ({ ...f, item_category_id: e.target.value }))}
                >
                  <option value="">Pilih kategori...</option>
                  {categoryList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </InputShell>
            </Field>
          </div>

          <Field label="Tanggal Keluar" code="date" required>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Jumlah Barang" code="quantity" required>
              <InputShell icon="scale">
                <input
                  type="number"
                  min="1"
                  required
                  className={inputClass}
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
                <span className="text-[11px] text-text-muted shrink-0">{form.unit || "pcs"}</span>
              </InputShell>
            </Field>
            <Field label="Total Biaya" code="value" required>
              <InputShell icon="payments">
                <span className="text-[11px] text-text-muted">Rp</span>
                <input
                  type="number"
                  min="0"
                  required
                  className={inputClass}
                  placeholder="0"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                />
              </InputShell>
            </Field>
          </div>

          <Field label="Keterangan (opsional)">
            <InputShell icon="notes">
              <input
                className={inputClass}
                placeholder="cth. Stok opname harian"
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
