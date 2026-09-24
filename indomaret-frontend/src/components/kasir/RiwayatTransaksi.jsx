import { useMemo, useState } from "react";
import SectionCard from "../ui/SectionCard";
import Badge from "../ui/Badge";
import Pagination from "../ui/Pagination";
import usePaginatedRows from "../../hooks/usePaginatedRows";
import { STATUS_BADGE } from "../../lib/kasir";
import { formatRupiah, formatNumber, formatDate } from "../../lib/format";

const FILTERS = [
  { key: "semua", label: "Semua" },
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
];

/**
 * Riwayat transaksi milik akun kasir yang sedang login, ditampilkan tepat di
 * bawah form input yang bersangkutan: halaman Barang Keluar hanya memuat
 * riwayat barang keluar, halaman Pemasukan hanya riwayat pemasukan.
 */
export default function RiwayatTransaksi({ jenis, rows, loading, onReload }) {
  const [filter, setFilter] = useState("semua");
  const isBarang = jenis === "barang";

  const visible = useMemo(
    () => (filter === "semua" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter]
  );

  const halaman = usePaginatedRows(visible, 10);

  return (
    <SectionCard
      title={isBarang ? "Riwayat Barang Keluar Anda" : "Riwayat Pemasukan Anda"}
      description="Transaksi yang ditolak bisa diperbaiki lalu dikirim ulang lewat form di atas."
      actions={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                type="button"
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${
                  filter === f.key ? "bg-idm-blue text-white shadow-sm" : "text-text-muted hover:text-on-surface"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={onReload}
            type="button"
            aria-label="Muat ulang riwayat"
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-slate-200 text-on-surface-variant hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
              <th className="py-2.5 px-3">Tanggal</th>
              {isBarang && <th className="py-2.5 px-3">Kategori</th>}
              <th className="py-2.5 px-3">Kasir Bertugas</th>
              <th className="py-2.5 px-3 text-right">{isBarang ? "Jumlah & Biaya" : "Nominal"}</th>
              <th className="py-2.5 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle text-body-sm">
            {halaman.pageRows.map((row) => {
              const badge = STATUS_BADGE[row.status] || STATUS_BADGE.approved;
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 whitespace-nowrap text-text-muted font-medium text-[12px]">
                    {formatDate(row.date)}
                  </td>
                  {isBarang && (
                    <td className="py-3 px-3 text-[13px] font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-idm-red text-[16px]">outbox</span>
                        {row.item_category?.name || "-"}
                      </span>
                    </td>
                  )}
                  <td className="py-3 px-3 text-[12px] text-text-muted">{row.employee?.name || "-"}</td>
                  <td className="py-3 px-3 text-right font-bold text-[13px]">
                    {isBarang
                      ? `${formatRupiah(row.value)} (${formatNumber(row.quantity)} ${row.unit})`
                      : formatRupiah(row.amount)}
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant={badge.variant}>
                      <span className="material-symbols-outlined text-[13px]">{badge.icon}</span>
                      {badge.label}
                    </Badge>
                  </td>
                </tr>
              );
            })}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={isBarang ? 5 : 4} className="py-8 text-center text-text-muted text-sm">
                  {filter === "semua"
                    ? `Belum ada ${isBarang ? "barang keluar" : "pemasukan"} yang Anda input.`
                    : "Tidak ada transaksi dengan status ini."}
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
  );
}
