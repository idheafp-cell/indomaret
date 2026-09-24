import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import KpiCard, { TrendBadge } from "../components/ui/KpiCard";
import SectionCard from "../components/ui/SectionCard";
import ProgressBar from "../components/ui/ProgressBar";
import DualBarChart from "../components/charts/DualBarChart";
import { useAuth } from "../context/AuthContext";
import { getDashboard, listStores, listExpenses, listIncomes } from "../api/resources";
import { formatRupiah, formatDate, todayISO } from "../lib/format";

const CATEGORY_COLORS = ["#005baa", "#d61c24", "#fdb813", "#475569", "#0ea5e9", "#be123c", "#ca8a04"];

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function Dashboard() {
  const { user, isManager } = useAuth();
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState({
    store_id: "",
    start_date: firstDayOfMonth(),
    end_date: todayISO(),
  });
  const [data, setData] = useState(null);
  const [recentOut, setRecentOut] = useState([]);
  const [recentIn, setRecentIn] = useState([]);
  const [activeTab, setActiveTab] = useState("out");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isManager) {
      listStores().then(setStores).catch(() => {});
    }
  }, [isManager]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = { start_date: filters.start_date, end_date: filters.end_date };
    if (filters.store_id) params.store_id = filters.store_id;

    Promise.all([
      getDashboard(params),
      listExpenses({ ...params, per_page: 5 }),
      listIncomes({ ...params, per_page: 5 }),
    ])
      .then(([dash, out, inc]) => {
        if (cancelled) return;
        setData(dash);
        setRecentOut(out.data || []);
        setRecentIn(inc.data || []);
      })
      .catch(() => !cancelled && setError("Gagal memuat data dashboard. Pastikan backend Laravel berjalan."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [filters]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    data.daily_income_trend?.forEach((d) => map.set(d.date, { label: d.date, a: d.total, b: 0 }));
    data.daily_expense_trend?.forEach((d) => {
      const existing = map.get(d.date) || { label: d.date, a: 0, b: 0 };
      existing.b = d.total;
      map.set(d.date, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const ringkasan = data?.summary || { total_income: 0, total_expense: 0, estimated_profit: 0 };
  const marginPct = ringkasan.total_income
    ? (ringkasan.estimated_profit / ringkasan.total_income) * 100
    : 0;

  return (
    <>
      <PageHeader
        title="Monitoring Pendapatan Gerai"
        description="Pemantauan arus kasir, beban barang keluar, dan margin gerai Indomaret."
      />

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {isManager && (
            <FilterSelect
              icon="storefront"
              label="Gerai Indomaret"
              value={filters.store_id}
              onChange={(v) => setFilters((f) => ({ ...f, store_id: v }))}
              options={[{ value: "", label: `Semua Gerai (${stores.length})` }, ...stores.map((i) => ({
                value: i.id,
                label: `${i.store_code} - ${i.name}`,
              }))]}
            />
          )}
          <FilterDate
            label="Dari Tanggal"
            value={filters.start_date}
            onChange={(v) => setFilters((f) => ({ ...f, start_date: v }))}
          />
          <FilterDate
            label="Sampai Tanggal"
            value={filters.end_date}
            onChange={(v) => setFilters((f) => ({ ...f, end_date: v }))}
          />
        </div>
        {error && (
          <div className="text-xs font-semibold text-idm-red flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          icon="payments"
          accent="blue"
          badge={<TrendBadge up>Pemasukan</TrendBadge>}
          label="Total Pemasukan"
          value={loading ? "…" : formatRupiah(ringkasan.total_income, { compact: true })}
          footerLeft="Periode terpilih"
          footerRight={<span className="font-semibold text-emerald-700">Real-time</span>}
        />
        <KpiCard
          icon="outbox"
          accent="red"
          badge={<TrendBadge up={false}>Beban</TrendBadge>}
          label="Beban Barang Keluar"
          value={loading ? "…" : formatRupiah(ringkasan.total_expense, { compact: true })}
          valueClassName="text-idm-red"
          footerLeft="Per kategori barang"
          footerRight="Bukan per produk"
        />
        <KpiCard
          icon="account_balance_wallet"
          accent="yellow"
          badge={
            <span className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
              Margin {marginPct.toFixed(1)}%
            </span>
          }
          label="Estimasi Laba"
          value={loading ? "…" : formatRupiah(ringkasan.estimated_profit, { compact: true })}
          valueClassName="text-emerald-700"
          footerLeft="Pemasukan - Pengeluaran"
          footerRight={marginPct >= 0 ? "Positif" : "Negatif"}
        />
        <KpiCard
          icon="domain"
          accent="tricolor"
          badge={
            data?.store_count && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-idm-blue border border-blue-200 font-bold text-[11px]">
                {data.store_count.active} Aktif
              </span>
            )
          }
          label="Gerai Indomaret"
          value={
            isManager
              ? loading
                ? "…"
                : `${data?.store_count?.total ?? 0} Gerai`
              : user?.store?.name || "-"
          }
          footerLeft={isManager ? "Seluruh kabupaten" : user?.store?.store_code}
          footerRight={isManager ? "" : "Gerai Anda"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <SectionCard
          className="lg:col-span-8"
          bodyClassName="flex-1 flex flex-col"
          title={<span>Tren Harian: Pemasukan vs Beban Barang Keluar</span>}
          description={
            <>
              Perbandingan harian <span className="inline-block w-2.5 h-2.5 rounded-sm bg-idm-blue align-middle mr-0.5" />{" "}
              Pemasukan vs <span className="inline-block w-2.5 h-2.5 rounded-sm bg-idm-red align-middle mr-0.5" /> Beban
              Barang Keluar pada periode terpilih
            </>
          }
        >
          <DualBarChart data={chartData} />
          <div className="flex items-center gap-4 pt-3 text-xs font-semibold text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-idm-blue" /> Pemasukan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-idm-red" /> Barang Keluar
            </span>
          </div>
        </SectionCard>

        <SectionCard
          className="lg:col-span-4"
          title="Pengeluaran per Kategori"
          description="Breakdown nilai barang keluar per kategori"
          icon="pie_chart"
        >
          <div className="flex flex-col gap-2">
            {(data?.expense_by_category || []).length === 0 && (
              <p className="text-sm text-text-muted">Belum ada data.</p>
            )}
            {(data?.expense_by_category || []).map((item, idx) => {
              const pct = ringkasan.total_expense
                ? (item.total_value / ringkasan.total_expense) * 100
                : 0;
              const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
              return (
                <div key={item.category} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-body-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-on-surface text-[12px]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      {item.category}
                    </span>
                    <span className="font-bold text-on-surface text-[12px]">
                      {pct.toFixed(0)}%{" "}
                      <span className="text-text-muted font-normal text-[11px]">
                        ({formatRupiah(item.total_value, { compact: true })})
                      </span>
                    </span>
                  </div>
                  <ProgressBar percent={pct} color={color} />
                </div>
              );
            })}
          </div>

          {isManager && data?.top_stores_by_income?.length > 0 && (
            <div className="pt-3 mt-3 border-t border-border-subtle">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">
                Top Gerai Pemasukan
              </span>
              <div className="space-y-2">
                {data.top_stores_by_income.map((t) => (
                  <div
                    key={t.store_code}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div>
                      <div className="font-bold text-on-surface text-[13px]">{t.store}</div>
                      <span className="text-[11px] text-text-muted font-mono">{t.store_code}</span>
                    </div>
                    <div className="font-bold text-idm-blue text-[13px]">
                      {formatRupiah(t.total_income, { compact: true })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-idm-red" />
            Log Transaksi Terbaru
          </span>
        }
        description="5 transaksi terakhir pada periode terpilih"
        actions={
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("out")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === "out" ? "bg-white text-idm-red shadow-xs border border-red-100" : "text-text-muted"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">outbox</span> Barang Keluar
            </button>
            <button
              onClick={() => setActiveTab("in")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === "in" ? "bg-white text-emerald-700 shadow-xs border border-emerald-100" : "text-text-muted"
              }`}
            >
              <span className="material-symbols-outlined text-[15px] text-emerald-600">account_balance_wallet</span>{" "}
              Pemasukan
            </button>
          </div>
        }
      >
        {activeTab === "out" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Gerai</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Diinput Oleh</th>
                  <th className="py-2.5 px-3 text-right">Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-body-sm">
                {recentOut.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/40 transition-colors">
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
                    <td className="py-3 px-3 text-[12px] text-text-muted">
                      {row.employee?.name || row.user?.name}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-idm-red text-[13px]">
                      {formatRupiah(row.value)}
                    </td>
                  </tr>
                ))}
                {recentOut.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-text-muted text-sm">
                      Belum ada transaksi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Gerai</th>
                  <th className="py-2.5 px-3">Diinput Oleh</th>
                  <th className="py-2.5 px-3 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-body-sm">
                {recentIn.map((row) => (
                  <tr key={row.id} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap text-text-muted font-medium text-[12px]">
                      {formatDate(row.date)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[13px] text-on-surface">{row.store?.name}</div>
                      <span className="text-[11px] text-idm-blue font-semibold font-mono">
                        {row.store?.store_code}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[12px] text-text-muted">
                      {row.employee?.name || row.user?.name}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700 text-[13px]">
                      {formatRupiah(row.amount)}
                    </td>
                  </tr>
                ))}
                {recentIn.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-text-muted text-sm">
                      Belum ada transaksi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

function FilterSelect({ icon, label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px] text-idm-blue">{icon}</span> {label}
      </label>
      <div className="relative flex items-center h-11 bg-slate-50 border border-slate-200/80 rounded-xl px-3 focus-within:bg-white focus-within:border-idm-blue transition-all">
        <select
          className="w-full bg-transparent border-none text-[13px] font-medium text-on-surface outline-none cursor-pointer pr-5 focus:ring-0 truncate"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function FilterDate({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px] text-idm-blue">calendar_today</span> {label}
      </label>
      <div className="relative flex items-center h-11 bg-slate-50 border border-slate-200/80 rounded-xl px-3 hover:border-slate-300 transition-all">
        <input
          type="date"
          className="w-full bg-transparent border-none text-[13px] font-medium text-on-surface outline-none focus:ring-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
