/**
 * Banner jumlah transaksi yang masih menunggu persetujuan supervisor,
 * ditampilkan di atas form input kasir. Detail per transaksinya ada di
 * tabel riwayat tepat di bawah form.
 */
export function PendingBanner({ count }) {
  if (!count) return null;

  return (
    <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-900">
      <span className="material-symbols-outlined text-[20px]">pending_actions</span>
      <span className="text-sm font-semibold">
        {count} transaksi Anda masih menunggu persetujuan supervisor.
      </span>
    </div>
  );
}

export function ErrorNote({ message }) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
      <span className="material-symbols-outlined text-[16px]">error</span>
      {message}
    </div>
  );
}

export function SuccessNote({ message }) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-semibold">
      <span className="material-symbols-outlined text-[16px]">check_circle</span>
      {message}
    </div>
  );
}
