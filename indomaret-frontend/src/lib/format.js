/**
 * Helper format angka & tanggal gaya Indomaret dashboard (Rp, ringkas Miliar/Juta, dsb).
 */

export function formatRupiah(value, { compact = false } = {}) {
  const num = Number(value) || 0;

  if (compact) {
    if (Math.abs(num) >= 1_000_000_000) {
      return `Rp ${(num / 1_000_000_000).toLocaleString("id-ID", {
        maximumFractionDigits: 2,
      })} M`;
    }
    if (Math.abs(num) >= 1_000_000) {
      return `Rp ${(num / 1_000_000).toLocaleString("id-ID", {
        maximumFractionDigits: 1,
      })} Jt`;
    }
  }

  return `Rp ${num.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

export function formatDate(value, options = {}) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  });
}

export function formatPercent(value, decimals = 1) {
  return `${Number(value || 0).toFixed(decimals)}%`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
