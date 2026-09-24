import { useEffect, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import SectionCard from "../../components/ui/SectionCard";
import { Field, InputShell, inputClass } from "../../components/ui/InputShell";
import KasirIdentityFields from "../../components/kasir/KasirIdentityFields";
import SubmitBar from "../../components/kasir/SubmitBar";
import { PendingBanner, ErrorNote, SuccessNote } from "../../components/kasir/FormFeedback";
import RiwayatTransaksi from "../../components/kasir/RiwayatTransaksi";
import useKasirRiwayat from "../../hooks/useKasirRiwayat";
import { useAuth } from "../../context/AuthContext";
import { createExpense, listItemCategories, listEmployees } from "../../api/resources";
import { emptyBarang, apiErrorMessage } from "../../lib/kasir";

export default function InputBarangKeluar() {
  const { user } = useAuth();
  const { riwayatBarang, loading, pendingCount, reload } = useKasirRiwayat();
  const [categoryList, setCategoryList] = useState([]);
  const [employeeList, setEmployeeList] = useState([]);
  const [form, setForm] = useState(emptyBarang());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    listItemCategories({ active_only: true }).then(setCategoryList).catch(() => {});
    listEmployees().then(setEmployeeList).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await createExpense({
        item_category_id: Number(form.item_category_id),
        date: form.date,
        quantity: Number(form.quantity),
        unit: form.unit || "pcs",
        value: Number(form.value),
        notes: form.notes || undefined,
        employee_name: form.employee_name,
        employee_password: form.employee_password,
      });
      setForm(emptyBarang());
      setSuccess("Barang keluar berhasil dikirim, menunggu persetujuan supervisor.");
      reload();
    } catch (err) {
      setError(apiErrorMessage(err, "Gagal menyimpan data. Periksa kembali isian Anda."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Input Barang Keluar"
        description={`Catat barang keluar untuk ${
          user?.store?.name || "gerai Anda"
        }. Transaksi berstatus menunggu persetujuan sampai diverifikasi supervisor.`}
      />

      <PendingBanner count={pendingCount} />

      <SectionCard
        title="Form Barang Keluar"
        description="Dikelompokkan per kategori barang, bukan per produk spesifik."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Kategori Produk" required>
              <InputShell icon="category">
                <select
                  required
                  className={inputClass}
                  value={form.item_category_id}
                  onChange={(e) => setForm((f) => ({ ...f, item_category_id: e.target.value }))}
                >
                  <option value="">Pilih kategori...</option>
                  {categoryList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </InputShell>
            </Field>
            <Field label="Tanggal Keluar" required>
              <InputShell icon="calendar_today">
                <input
                  type="date"
                  required
                  className={inputClass}
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </InputShell>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Jumlah Barang" required>
              <InputShell icon="scale">
                <input
                  type="number"
                  min="1"
                  required
                  className={inputClass}
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
                <span className="text-[11px] text-text-muted shrink-0">{form.unit || "pcs"}</span>
              </InputShell>
            </Field>
            <Field label="Total Biaya" required>
              <InputShell icon="payments">
                <span className="text-[11px] text-text-muted">Rp</span>
                <input
                  type="number"
                  min="0"
                  required
                  className={inputClass}
                  placeholder="0"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                />
              </InputShell>
            </Field>
          </div>

          <Field label="Keterangan (opsional)">
            <InputShell icon="notes">
              <input
                className={inputClass}
                placeholder="cth. Stok opname harian"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </InputShell>
          </Field>

          <KasirIdentityFields
            name={form.employee_name}
            onNameChange={(v) => setForm((f) => ({ ...f, employee_name: v }))}
            password={form.employee_password}
            onPasswordChange={(v) => setForm((f) => ({ ...f, employee_password: v }))}
            employeeOptions={employeeList}
            listId="employee-suggestions-barang"
          />

          <SubmitBar saving={saving} label="Kirim Barang Keluar" color="bg-idm-red hover:bg-idm-red-dark" />

          <ErrorNote message={error} />
          <SuccessNote message={success} />
        </form>
      </SectionCard>

      <RiwayatTransaksi jenis="barang" rows={riwayatBarang} loading={loading} onReload={reload} />
    </>
  );
}
