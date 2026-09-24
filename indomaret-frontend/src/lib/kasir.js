import { todayISO } from "./format";

/**
 * Konstanta & bentuk form yang dipakai bersama oleh halaman-halaman kasir
 * (Input Barang Keluar, Input Pemasukan, Riwayat). Sengaja dipisah dari
 * file komponen supaya tiap file komponen hanya meng-export komponen
 * (aturan react-refresh / fast refresh).
 */

export const STATUS_BADGE = {
  pending: { variant: "amber", label: "Menunggu Persetujuan", icon: "hourglass_top" },
  approved: { variant: "emerald", label: "Disetujui", icon: "check_circle" },
  rejected: { variant: "red", label: "Ditolak", icon: "cancel" },
};

export function emptyBarang() {
  return {
    item_category_id: "",
    date: todayISO(),
    quantity: "",
    unit: "pcs",
    value: "",
    notes: "",
    employee_name: "",
    employee_password: "",
  };
}

export function emptyPemasukan() {
  return {
    date: todayISO(),
    amount: "",
    notes: "",
    employee_name: "",
    employee_password: "",
  };
}

/** Ambil pesan error paling relevan dari response validasi Laravel. */
export function apiErrorMessage(err, fallback) {
  const errs = err?.response?.data?.errors;
  const msg = errs ? Object.values(errs)[0]?.[0] : err?.response?.data?.message;
  return msg || fallback;
}
