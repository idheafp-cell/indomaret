import { useEffect, useRef, useState } from "react";

/**
 * Satu tombol "Filter" di header tabel. Di dalamnya:
 *  - Urutkan berdasarkan kolom tabel (mis. Total Beban tertinggi/terendah)
 *  - Rentang tanggal (Dari – Sampai)
 *  - Status, Kategori (kalau dikirim)
 *
 * Semua pilihan langsung diterapkan (tanpa tombol "Terapkan") dan dikirim ke
 * backend, jadi urutan & filter berlaku untuk SELURUH data — bukan cuma
 * baris di halaman yang sedang terbuka.
 */
export const DEFAULT_TABLE_FILTERS = {
  sort: "date_desc",
  start_date: "",
  end_date: "",
  status: "",
  item_category_id: "",
};

/** Buang field kosong / default supaya query string tetap bersih. */
export function filtersToParams(filters) {
  const params = {};
  Object.entries(filters).forEach(([key, val]) => {
    if (val === "" || val == null) return;
    if (key === "sort" && val === DEFAULT_TABLE_FILTERS.sort) return;
    params[key] = val;
  });
  return params;
}

export function countActiveFilters(filters) {
  const keys = Object.keys(filtersToParams(filters));
  // "Dari" + "Sampai" dihitung satu filter (rentang tanggal).
  const hasDate = keys.includes("start_date") || keys.includes("end_date");
  return keys.filter((k) => k !== "start_date" && k !== "end_date").length + (hasDate ? 1 : 0);
}

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "approved", label: "Disetujui" },
  { value: "pending", label: "Menunggu" },
  { value: "rejected", label: "Ditolak" },
];

const selectClass =
  "w-full text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 outline-none focus:bg-white focus:border-idm-blue";

export default function TableFilter({ value, onChange, sortGroups, categories }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const activeCount = countActiveFilters(value);

  // Tutup panel kalau klik di luar atau tekan Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
          activeCount > 0
            ? "bg-idm-blue border-idm-blue text-white hover:bg-idm-blue-dark"
            : "bg-white border-slate-200 text-on-surface hover:bg-slate-50"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">tune</span>
        Filter
        {activeCount > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-white text-idm-blue text-[11px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-[min(360px,calc(100vw-2rem))] bg-white border border-slate-200 rounded-2xl shadow-xl">
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Urutkan */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Urutkan</h3>
              <div className="space-y-1.5">
                {sortGroups.map((group) => (
                  <div key={group.label} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                      <span className="material-symbols-outlined text-[16px] text-text-muted">{group.icon}</span>
                      {group.label}
                    </span>
                    <div className="flex gap-1">
                      {group.options.map((opt) => {
                        const active = value.sort === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => set({ sort: opt.value })}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                              active
                                ? "bg-idm-blue border-idm-blue text-white"
                                : "bg-white border-slate-200 text-text-muted hover:text-on-surface hover:bg-slate-50"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Rentang tanggal */}
            <section className="border-t border-slate-100 pt-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Rentang Tanggal</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-text-muted font-semibold">
                  Dari
                  <input
                    type="date"
                    className={`${selectClass} mt-1`}
                    value={value.start_date}
                    max={value.end_date || undefined}
                    onChange={(e) => set({ start_date: e.target.value })}
                  />
                </label>
                <label className="text-[11px] text-text-muted font-semibold">
                  Sampai
                  <input
                    type="date"
                    className={`${selectClass} mt-1`}
                    value={value.end_date}
                    min={value.start_date || undefined}
                    onChange={(e) => set({ end_date: e.target.value })}
                  />
                </label>
              </div>
            </section>

            {/* Filter lain */}
            <section className="border-t border-slate-100 pt-4 space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Saring Data</h3>
              <select className={selectClass} value={value.status} onChange={(e) => set({ status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {categories && categories.length > 0 && (
                <select
                  className={selectClass}
                  value={value.item_category_id}
                  onChange={(e) => set({ item_category_id: e.target.value })}
                >
                  <option value="">Semua kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </section>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl">
            <button
              type="button"
              disabled={activeCount === 0}
              onClick={() => onChange({ ...DEFAULT_TABLE_FILTERS })}
              className="text-xs font-bold text-idm-red hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Reset semua
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-idm-blue hover:bg-idm-blue-dark text-white text-xs font-bold"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
