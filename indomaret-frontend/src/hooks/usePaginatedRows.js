import { useEffect, useMemo, useState } from "react";

/**
 * Memotong array yang sudah ada di browser jadi per halaman.
 *
 * Dipakai tabel yang datanya dimuat sekaligus (daftar akun, master gerai,
 * antrean persetujuan, riwayat kasir, daftar pegawai). Tabel Barang Keluar &
 * Pemasukan TIDAK memakai ini karena paginasinya dikerjakan server.
 *
 * Halaman otomatis dijepit kalau daftarnya menyusut — misalnya saat
 * pencarian dipersempit sementara posisi masih di halaman 12.
 */
export default function usePaginatedRows(rows = [], perPage = 10) {
  const [page, setPage] = useState(1);

  const total = rows.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    setPage((p) => Math.min(p, lastPage));
  }, [lastPage]);

  const halaman = Math.min(page, lastPage);

  const pageRows = useMemo(
    () => rows.slice((halaman - 1) * perPage, halaman * perPage),
    [rows, halaman, perPage]
  );

  return {
    page: halaman,
    setPage,
    pageRows,
    lastPage,
    total,
    from: total === 0 ? 0 : (halaman - 1) * perPage + 1,
    to: Math.min(halaman * perPage, total),
  };
}
