/**
 * Navigasi halaman tabel. Dipakai bersama oleh tabel yang datanya
 * dipaginasi di server (Barang Keluar, Pemasukan) maupun yang dipotong di
 * browser lewat hook usePaginatedRows.
 *
 * Sengaja tidak ikut merender kalau cuma ada satu halaman, supaya tabel
 * pendek tidak kebagian baris kosong di bawahnya.
 */
export default function Pagination({ page, lastPage, from, to, total, onChange, label = "baris" }) {
  if (!lastPage || lastPage <= 1) return null;

  const nomor = nomorHalaman(page, lastPage);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-xs text-text-muted">
      <span>
        Menampilkan <strong className="text-on-surface">{from}</strong>–
        <strong className="text-on-surface">{to}</strong> dari{" "}
        <strong className="text-on-surface">{total}</strong> {label}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-50 disabled:hover:bg-transparent flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[15px]">chevron_left</span>
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        {nomor.map((n, i) =>
          n === "..." ? (
            <span key={`sela-${i}`} className="px-1.5 text-text-muted">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`min-w-[30px] px-2 py-1.5 rounded-lg font-bold transition-colors ${
                n === page
                  ? "bg-idm-blue text-white shadow-sm"
                  : "border border-slate-200 hover:bg-slate-50 text-on-surface"
              }`}
            >
              {n}
            </button>
          )
        )}

        <button
          type="button"
          disabled={page >= lastPage}
          onClick={() => onChange(page + 1)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-50 disabled:hover:bg-transparent flex items-center gap-1"
        >
          <span className="hidden sm:inline">Selanjutnya</span>
          <span className="material-symbols-outlined text-[15px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Daftar nomor halaman yang ditampilkan: selalu halaman pertama & terakhir,
 * plus tetangga halaman aktif. Sisanya diringkas jadi "…" supaya 259 gerai
 * tidak berubah jadi deretan 26 tombol.
 */
function nomorHalaman(page, lastPage) {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, i) => i + 1);
  }

  const hasil = [1];
  const mulai = Math.max(2, page - 1);
  const akhir = Math.min(lastPage - 1, page + 1);

  if (mulai > 2) hasil.push("...");
  for (let n = mulai; n <= akhir; n += 1) hasil.push(n);
  if (akhir < lastPage - 1) hasil.push("...");
  hasil.push(lastPage);

  return hasil;
}
