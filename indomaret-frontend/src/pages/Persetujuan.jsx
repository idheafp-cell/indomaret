import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import KpiCard from "../components/ui/KpiCard";
import Modal from "../components/ui/Modal";
import Pagination from "../components/ui/Pagination";
import usePaginatedRows from "../hooks/usePaginatedRows";
import { useAuth } from "../context/AuthContext";
import {
  listExpenses,
  listIncomes,
  approveExpense,
  rejectExpense,
  approveIncome,
  rejectIncome,
} from "../api/resources";
import { formatRupiah, formatNumber, formatDate } from "../lib/format";

const TABS = [
  { key: "semua", label: "Semua" },
  { key: "barang", label: "Barang Keluar" },
  { key: "pemasukan", label: "Pemasukan" },
];

export default function Persetujuan() {
  const { hasUnscopedAccess } = useAuth();
  const [tab, setTab] = useState("semua");
  const [expenseRows, setExpenseRows] = useState([]);
  const [incomeRows, setIncomeRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null); // { jenis, id, label }
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);
  const [rejectError, setRejectError] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      listExpenses({ status: "pending", per_page: 50 }).catch(() => ({ data: [] })),
      listIncomes({ status: "pending", per_page: 50 }).catch(() => ({ data: [] })),
    ])
      .then(([peng, pem]) => {
        setExpenseRows(peng.data || []);
        setIncomeRows(pem.data || []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const items = useMemo(() => {
    const barang = expenseRows.map((r) => ({ ...r, jenis: "barang" }));
    const pemasukan = incomeRows.map((r) => ({ ...r, jenis: "pemasukan" }));
    const combined = [...barang, ...pemasukan].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (tab === "semua") return combined;
    return combined.filter((r) => r.jenis === tab);
  }, [expenseRows, incomeRows, tab]);

  const halaman = usePaginatedRows(items, 10);

  async function handleApprove(item) {
    setActingId(`${item.jenis}-${item.id}`);
    try {
      if (item.jenis === "barang") await approveExpense(item.id);
      else await approveIncome(item.id);
      load();
    } catch (err) {
      alert(err?.response?.data?.message || "Gagal menyetujui transaksi.");
    } finally {
      setActingId(null);
    }
  }

  function openReject(item) {
    setRejectTarget(item);
    setRejectReason("");
    setRejectError("");
  }

  async function handleReject(e) {
    e.preventDefault();
    if (!rejectTarget) return;
    setRejectSaving(true);
    setRejectError("");
    try {
      if (rejectTarget.jenis === "barang") await rejectExpense(rejectTarget.id, rejectReason);
      else await rejectIncome(rejectTarget.id, rejectReason);
      setRejectTarget(null);
      load();
    } catch (err) {
      const errs = err?.response?.data?.errors;
      const msg = errs ? Object.values(errs)[0]?.[0] : err?.response?.data?.message;
      setRejectError(msg || "Gagal menolak transaksi.");
    } finally {
      setRejectSaving(false);
    }
  }

  const totalPending = expenseRows.length + incomeRows.length;
  const totalNilaiPending =
    expenseRows.reduce((s, r) => s + Number(r.value || 0), 0) +
    incomeRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <>
      <PageHeader
        title="Persetujuan Transaksi Kasir"
        description={
          hasUnscopedAccess
            ? "Tinjau & putuskan transaksi yang disubmit akun kasir dari seluruh gerai."
            : "Tinjau & putuskan transaksi yang disubmit akun kasir gerai Anda."
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <KpiCard
          icon="pending_actions"
          accent="yellow"
          label="Total Menunggu Persetujuan"
          value={`${totalPending} Transaksi`}
          footerLeft={`${expenseRows.length} barang keluar • ${incomeRows.length} pemasukan`}
        />
        <KpiCard
          icon="payments"
          accent="blue"
          label="Estimasi Nilai Tertahan"
          value={formatRupiah(totalNilaiPending, { compact: true })}
          footerLeft="Belum dihitung ke dashboard/laporan"
        />
      </div>

      <SectionCard
        title="Antrean Persetujuan"
        description="Klik Setujui untuk mengonfirmasi, atau Tolak untuk mengembalikan ke kasir dengan alasan."
        actions={
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                type="button"
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  tab === t.key ? "bg-idm-blue text-white shadow-sm" : "text-text-muted hover:text-on-surface"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Jenis</th>
                <th className="py-2.5 px-3">Gerai</th>
                <th className="py-2.5 px-3">Kasir Bertugas</th>
                <th className="py-2.5 px-3 text-right">Nilai</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-body-sm">
              {halaman.pageRows.map((item) => {
                const key = `${item.jenis}-${item.id}`;
                const busy = actingId === key;
                return (
                  <tr key={key} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap text-text-muted font-medium text-[12px]">
                      {formatDate(item.date)}
                    </td>
                    <td className="py-3 px-3 text-[13px] font-semibold">
                      {item.jenis === "barang" ? (
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-idm-red text-[16px]">outbox</span>
                          Barang Keluar
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
                    <td className="py-3 px-3 text-[13px]">
                      <div className="font-bold">{item.store?.name}</div>
                      <span className="text-[11px] text-idm-blue font-mono">{item.store?.store_code}</span>
                    </td>
                    <td className="py-3 px-3 text-[12px] text-text-muted">{item.employee?.name || "-"}</td>
                    <td className="py-3 px-3 text-right font-bold text-[13px]">
                      {item.jenis === "barang"
                        ? `${formatRupiah(item.value)} (${formatNumber(item.quantity)} ${item.unit})`
                        : formatRupiah(item.amount)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleApprove(item)}
                          disabled={busy}
                          type="button"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold text-[12px] disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[15px]">check</span>
                          Setujui
                        </button>
                        <button
                          onClick={() => openReject(item)}
                          disabled={busy}
                          type="button"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-idm-red border border-red-200 hover:bg-red-100 font-bold text-[12px] disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[15px]">close</span>
                          Tolak
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-text-muted text-sm">
                    <span className="flex flex-col items-center gap-1.5">
                      <span className="material-symbols-outlined text-[28px] text-emerald-500">
                        check_circle
                      </span>
                      Tidak ada transaksi yang menunggu persetujuan.
                    </span>
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
          label="transaksi"
        />
      </SectionCard>

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Tolak Transaksi"
        description="Berikan alasan penolakan supaya kasir bisa memperbaiki & mengirim ulang."
        footer={
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setRejectTarget(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-text-muted hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              form="form-reject"
              type="submit"
              disabled={rejectSaving}
              className="px-4 py-2 rounded-xl bg-idm-red hover:bg-idm-red-dark text-white text-sm font-bold shadow-sm disabled:opacity-60"
            >
              {rejectSaving ? "Menyimpan..." : "Tolak Transaksi"}
            </button>
          </div>
        }
      >
        <form id="form-reject" onSubmit={handleReject} className="space-y-3">
          {rejectTarget && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs">
              <div className="font-bold text-on-surface">
                {rejectTarget.jenis === "barang" ? "Barang Keluar" : "Pemasukan"} •{" "}
                {rejectTarget.jenis === "barang"
                  ? formatRupiah(rejectTarget.value)
                  : formatRupiah(rejectTarget.amount)}
              </div>
              <div className="text-text-muted mt-0.5">
                {rejectTarget.store?.name} • {formatDate(rejectTarget.date)}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1.5">Alasan Penolakan</label>
            <textarea
              required
              rows={3}
              maxLength={500}
              className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-idm-blue outline-none px-3 py-2.5"
              placeholder="cth. Nominal tidak sesuai dengan bukti setoran"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          {rejectError && (
            <div className="flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {rejectError}
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
