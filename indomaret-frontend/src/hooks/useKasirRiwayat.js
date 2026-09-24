import { useCallback, useEffect, useMemo, useState } from "react";
import { listExpenses, listIncomes } from "../api/resources";
import { useAuth } from "../context/AuthContext";

/**
 * Memuat transaksi yang disubmit lewat akun kasir yang sedang login, lalu
 * memecahnya jadi riwayat barang keluar & riwayat pemasukan (urut terbaru).
 * Tiap halaman input menampilkan riwayat jenisnya sendiri tepat di bawah
 * form, plus `pendingCount` gabungan untuk banner di atas form.
 */
export default function useKasirRiwayat() {
  const { user } = useAuth();
  const [expenseRows, setExpenseRows] = useState([]);
  const [incomeRows, setIncomeRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      listExpenses({ per_page: 50 }).catch(() => ({ data: [] })),
      listIncomes({ per_page: 50 }).catch(() => ({ data: [] })),
    ])
      .then(([exp, inc]) => {
        setExpenseRows(exp.data || []);
        setIncomeRows(inc.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const riwayat = useMemo(() => {
    const own = (rows, jenis) => rows.filter((r) => r.user_id === user?.id).map((r) => ({ ...r, jenis }));
    return [...own(expenseRows, "barang"), ...own(incomeRows, "pemasukan")].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }, [expenseRows, incomeRows, user]);

  const riwayatBarang = useMemo(() => riwayat.filter((r) => r.jenis === "barang"), [riwayat]);
  const riwayatPemasukan = useMemo(() => riwayat.filter((r) => r.jenis === "pemasukan"), [riwayat]);

  const pendingCount = riwayat.filter((r) => r.status === "pending").length;
  const rejectedCount = riwayat.filter((r) => r.status === "rejected").length;
  const approvedCount = riwayat.filter((r) => r.status === "approved").length;

  return {
    riwayat,
    riwayatBarang,
    riwayatPemasukan,
    loading,
    reload,
    pendingCount,
    rejectedCount,
    approvedCount,
  };
}
