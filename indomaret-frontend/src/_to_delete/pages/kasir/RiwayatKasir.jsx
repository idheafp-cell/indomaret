import { useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import SectionCard from "../../components/ui/SectionCard";
import KpiCard from "../../components/ui/KpiCard";
import Badge from "../../components/ui/Badge";
import useKasirRiwayat from "../../hooks/useKasirRiwayat";
import { STATUS_BADGE } from "../../lib/kasir";
import { formatRupiah, formatNumber, formatDate } from "../../lib/format";

const FILTERS = [
  { key: "semua", label: "Semua" },
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
];

export default function RiwayatKasir() {
  const { riwayat, loading, reload, pendingCount, approvedCount, rejectedCount } = useKasirRiwayat();
  const [filter, setFilter] = useState("semua");

  const rows = useMemo(
    () => (filter === "semua" ? riwayat : riwayat.filter((r) => r.status === filter)),
    [riwayat, filter]
  );

  return (
    <>
      <PageHeader
        breadcrumb={["Kasir", "Riwayat Transaksi"]}
        title="Riwayat Transaksi Anda"
        description="Semua barang keluar & pemasukan yang dikirim lewat akun kasir gerai ini, lengkap dengan status persetujuannya."
        actions={
          <button
            onClick={reload}
            type="button"
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl font-bold text-body-sm text-on-surface shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Muat Ulang
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KpiCard
          icon="pending_actions"
          accent="yellow"
          label="Menunggu Persetujuan"
          value={`${pendingCount} Transaksi`}
          footerLeft="Belum dihitung ke laporan"
        />
        <KpiCard
          icon="check_circle"
          accent="blue"
          label="Sudah Disetujui"
          value={`${approvedCount} Transaksi`}
          footerLeft="Sudah masuk laporan gerai"
        />
        <KpiCard
          icon="cancel"
          accent="red"
          label="Ditolak"
          value={`${rejectedCount} Transaksi`}
          footerLeft={rejectedCount > 0 ? "Periksa alasan & input ulang" : "Tidak ada penolakan"}
        />
      </div>

      <SectionCard
        title="Daftar Transaksi"
        description="Transaksi yang ditolak menampilkan alasan dari supervisor — perbaiki lalu kirim ulang lewat menu input."
        actions={
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                type="button"
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  filter === f.key ? "bg-idm-blue text-white shadow-sm" : "text-text-muted hover:text-on-surface"
                }`}
              >
                {f.label}
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
                <th className="py-2.5 px-3">Kasir Bertugas</th>
                <th className="py-2.5 px-3 text-right">Nilai</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-body-sm">
              {rows.map((row) => {
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
                    <td className="py-3 px-3 text-[12px] text-text-muted">{row.employee?.nama || "-"}</td>
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
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-text-muted text-sm">
                    {filter === "semua"
                      ? "Belum ada transaksi yang diinput."
                      : "Tidak ada transaksi dengan status ini."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
