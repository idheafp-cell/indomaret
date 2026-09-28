import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStoreMapSummary } from "../../api/resources";
import { formatRupiah, formatNumber } from "../../lib/format";

/**
 * Isi pop-up satu gerai di peta, mengikuti desain Stitch
 * "peta_lokasi_popup_*": tiga KPI di atas, lalu tiga tab
 * (Distribusi / Tren Harian / Top Penjualan).
 *
 * Datanya diambil saat pop-up dibuka lewat GET
 * /api/stores/{id}/map-summary — bukan ikut dikirim di
 * /api/stores/map — supaya request awal peta tetap ringan.
 *
 * Untuk supervisor, gerai selain miliknya datang dengan
 * `show_amounts: false` dari backend; pop-up-nya cuma menampilkan info
 * lokasi dan tidak melakukan request sama sekali.
 */

const TABS = [
  { key: "distribusi", label: "Distribusi", icon: "inventory_2" },
  { key: "tren", label: "Tren Harian", icon: "trending_up" },
  { key: "top", label: "Top Penjualan", icon: "military_tech" },
];

export default function StorePopupCard({ gerai }) {
  const bolehLihatAngka = gerai.show_amounts !== false;
  const [tab, setTab] = useState("distribusi");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(bolehLihatAngka);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bolehLihatAngka) return;
    let batal = false;
    setLoading(true);
    setError("");
    getStoreMapSummary(gerai.id)
      .then((res) => {
        if (!batal) setData(res);
      })
      .catch(() => {
        if (!batal) setError("Gagal memuat ringkasan gerai.");
      })
      .finally(() => {
        if (!batal) setLoading(false);
      });
    return () => {
      batal = true;
    };
  }, [gerai.id, bolehLihatAngka]);

  return (
    <div className="w-[404px] max-w-full">
      <div className="flex items-start gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-extrabold text-[14px] text-slate-900 leading-tight">
              <span className="font-mono text-idm-blue">{gerai.store_code}</span> {gerai.name}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Aktif
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 leading-snug">
            {gerai.address}
            {gerai.district ? ` • Kec. ${gerai.district}` : ""}
          </div>
        </div>
      </div>

      {!bolehLihatAngka ? (
        <div className="mt-3 flex items-start gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500">
          <span className="material-symbols-outlined text-[15px] leading-none mt-px">lock</span>
          <span>Data keuangan gerai ini hanya bisa dilihat manager.</span>
        </div>
      ) : loading ? (
        <div className="mt-3 h-[236px] flex items-center justify-center text-slate-400 text-xs gap-2">
          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          Memuat ringkasan gerai...
        </div>
      ) : error ? (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-idm-red font-semibold">
          <span className="material-symbols-outlined text-[15px]">error</span>
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <KpiBox
              tone="emerald"
              label="Transaksi Harian"
              value={formatNumber(data.transactions_today)}
              footer={
                data.transactions_delta_percent === null
                  ? "Tidak ada data kemarin"
                  : `${data.transactions_delta_percent >= 0 ? "▲" : "▼"} ${Math.abs(
                      data.transactions_delta_percent
                    )}% vs kemarin`
              }
            />
            <KpiBox
              tone="blue"
              label="Barang Keluar"
              value={formatNumber(data.units_out_today)}
              unit="Unit"
              footer="Hari ini"
            />
            <KpiBox
              tone="amber"
              label="Margin Laba"
              value={data.margin_percent === null ? "–" : `${data.margin_percent}%`}
              footer="Bulan berjalan"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl mt-3">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 px-2 py-1.5 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${
                  tab === t.key ? "bg-white text-idm-blue shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-2.5">
            {tab === "distribusi" && <TabDistribusi rows={data.distribution} />}
            {tab === "tren" && <TabTren rows={data.daily_trend} />}
            {tab === "top" && <TabTop rows={data.top_sales} />}
          </div>
        </>
      )}

      {bolehLihatAngka && (
        <Link
          to={`/gerai/${gerai.id}`}
          className="inline-flex items-center gap-1 mt-3 text-idm-blue font-bold text-[11px] hover:underline"
        >
          Lihat detail gerai <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
        </Link>
      )}
    </div>
  );
}

const TONES = {
  emerald: { box: "bg-emerald-50/70 border-emerald-200", value: "text-emerald-700", footer: "text-emerald-600" },
  blue: { box: "bg-blue-50/70 border-blue-200", value: "text-idm-blue", footer: "text-slate-500" },
  amber: { box: "bg-amber-50/70 border-amber-200", value: "text-amber-700", footer: "text-slate-500" },
};

function KpiBox({ tone, label, value, unit, footer }) {
  const c = TONES[tone] || TONES.blue;
  return (
    <div className={`rounded-xl border px-2.5 py-2 text-center ${c.box}`}>
      <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500 leading-tight">{label}</div>
      <div className={`font-extrabold text-[18px] leading-tight mt-0.5 ${c.value}`}>
        {value}
        {unit && <span className="text-[10px] font-bold ml-0.5">{unit}</span>}
      </div>
      <div className={`text-[9.5px] font-semibold leading-tight mt-0.5 ${c.footer}`}>{footer}</div>
    </div>
  );
}

function EmptyNote({ children }) {
  return <div className="h-[180px] flex items-center justify-center text-[11px] text-slate-400">{children}</div>;
}

/* ---------- Tab 1: Distribusi barang keluar per kategori (unit) ---------- */
function TabDistribusi({ rows = [] }) {
  if (rows.length === 0) {
    return <EmptyNote>Belum ada barang keluar bulan ini.</EmptyNote>;
  }

  const max = Math.max(1, ...rows.map((r) => r.unit));
  const width = 380;
  const height = 150;
  const top = 8;
  const baseline = 120;
  const slot = width / rows.length;
  const barWidth = Math.min(30, slot * 0.55);

  return (
    <div className="rounded-xl border border-slate-200 p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11.5px] font-bold text-slate-800">Distribusi Barang Keluar</span>
        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9.5px] font-bold">
          {rows.length} Kategori
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Distribusi barang keluar per kategori">
        <line x1="0" x2={width} y1={baseline} y2={baseline} stroke="#cbd5e1" strokeWidth="1" />
        {rows.map((r, i) => {
          const h = (r.unit / max) * (baseline - top);
          const x = slot * i + (slot - barWidth) / 2;
          return (
            <g key={r.category}>
              <title>{`${r.category}: ${r.unit} unit`}</title>
              <rect x={x} y={baseline - h} width={barWidth} height={Math.max(1, h)} rx="3" fill="#145fa0" />
              <text
                x={slot * i + slot / 2}
                y={baseline - h - 4}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill="#334155"
              >
                {r.unit}
              </text>
              <text x={slot * i + slot / 2} y={baseline + 12} textAnchor="middle" fontSize="8.5" fill="#64748b">
                {singkat(r.category)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- Tab 2: Tren harian pemasukan vs beban barang keluar ---------- */
function TabTren({ rows = [] }) {
  if (rows.length === 0) {
    return <EmptyNote>Belum ada transaksi pada 7 hari terakhir.</EmptyNote>;
  }

  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const width = 380;
  const height = 150;
  const top = 8;
  const baseline = 120;
  const slot = width / rows.length;
  const barWidth = Math.min(13, slot * 0.28);

  return (
    <div className="rounded-xl border border-slate-200 p-2.5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-[11.5px] font-bold text-slate-800 leading-tight">
            Tren Harian: Pemasukan vs Beban Pasokan
          </div>
          <div className="text-[9.5px] text-slate-500 mt-0.5">Agregat 7 hari terakhir, hanya transaksi disetujui</div>
        </div>
        <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-idm-blue text-[9.5px] font-bold whitespace-nowrap">
          {tanggalPendek(rows[0].date)} – {tanggalPendek(rows[rows.length - 1].date)}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[9.5px] text-slate-500 font-semibold mb-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-idm-blue" /> Pemasukan Kasir
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-idm-red" /> Beban Barang Keluar
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Tren pemasukan vs pengeluaran 7 hari">
        <line x1="0" x2={width} y1={baseline} y2={baseline} stroke="#cbd5e1" strokeWidth="1" />
        {rows.map((r, i) => {
          const ha = (r.income / max) * (baseline - top);
          const hb = (r.expense / max) * (baseline - top);
          const cx = slot * i + slot / 2;
          return (
            <g key={r.date}>
              <title>{`${tanggalPendek(r.date)} — masuk ${formatRupiah(r.income, {
                compact: true,
              })}, keluar ${formatRupiah(r.expense, { compact: true })}`}</title>
              <rect x={cx - barWidth - 1} y={baseline - ha} width={barWidth} height={Math.max(1, ha)} rx="2.5" fill="#145fa0" />
              <rect x={cx + 1} y={baseline - hb} width={barWidth} height={Math.max(1, hb)} rx="2.5" fill="#bf3339" />
              <text x={cx} y={baseline + 12} textAnchor="middle" fontSize="8.5" fill="#64748b">
                {tanggalPendek(r.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- Tab 3: Peringkat kategori berdasarkan nilai barang keluar ---------- */
function TabTop({ rows = [] }) {
  if (rows.length === 0) {
    return <EmptyNote>Belum ada data kategori bulan ini.</EmptyNote>;
  }

  const peringkat = rows.slice(0, 5);
  const maxPersen = Math.max(1, ...peringkat.map((r) => r.percent));

  return (
    <div className="rounded-xl border border-slate-200 p-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11.5px] font-bold text-slate-800">Peringkat Kategori Terbesar</span>
        <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-idm-blue text-[9.5px] font-bold">
          Bulan berjalan
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {peringkat.map((r, i) => (
          <div key={r.category} className="flex items-center gap-2">
            <span
              className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[9.5px] font-extrabold ${
                i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-800 truncate">{r.category}</span>
                <span className="text-[11px] font-bold text-idm-blue whitespace-nowrap">
                  {formatRupiah(r.value, { compact: true })}
                  <span className="text-slate-400 font-semibold ml-1">({r.percent}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                <div
                  className="h-full rounded-full bg-idm-blue"
                  style={{ width: `${Math.max(3, (r.percent / maxPersen) * 100)}%` }}
                />
              </div>
              <div className="text-[9.5px] text-slate-500 mt-0.5">{formatNumber(r.unit)} unit keluar</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function singkat(nama = "") {
  return nama.length > 11 ? `${nama.slice(0, 10)}…` : nama;
}

function tanggalPendek(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}
