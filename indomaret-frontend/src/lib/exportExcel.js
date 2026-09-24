import * as XLSX from "xlsx";

/**
 * Ekspor daftar baris ke file .xlsx dan langsung memicu unduhan di browser
 * (SheetJS murni di sisi klien, tidak lewat backend). Dipakai oleh tombol
 * "Unduh Data (Excel)" di halaman-halaman daftar transaksi — menggantikan
 * fitur unduh laporan PDF yang lama.
 *
 * @param {object[]} rows - data mentah (array of object apa saja)
 * @param {{header: string, accessor: (row: object) => any}[]} columns
 * @param {string} filename - termasuk ekstensi, mis. "barang-keluar.xlsx"
 */
export function exportRowsToExcel(rows, columns, filename) {
  const data = rows.map((row) => {
    const record = {};
    columns.forEach((col) => {
      record[col.header] = col.accessor(row);
    });
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  // Lebar kolom menyesuaikan panjang judul supaya tidak terpotong saat dibuka.
  worksheet["!cols"] = columns.map((col) => ({ wch: Math.max(col.header.length + 2, 14) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, filename);
}
