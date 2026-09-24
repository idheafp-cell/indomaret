/**
 * Kotak pencarian kecil untuk header tabel. Nilainya dikirim ke backend
 * sebagai query `search` (bukan memfilter baris yang sudah di-paginate),
 * supaya hasilnya mencakup seluruh data, bukan cuma halaman yang terbuka.
 */
export default function TableSearch({ value, onChange, placeholder = "Cari..." }) {
  return (
    <div className="relative w-full sm:w-64">
      <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[16px]">
        search
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-idm-blue outline-none w-full"
      />
      {value && (
        <button
          type="button"
          aria-label="Hapus pencarian"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  );
}
