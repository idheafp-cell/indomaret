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
import { createIncome, listEmployees } from "../../api/resources";
import { emptyPemasukan, apiErrorMessage } from "../../lib/kasir";

export default function InputPemasukan() {
  const { user } = useAuth();
  const { riwayatPemasukan, loading, pendingCount, reload } = useKasirRiwayat();
  const [employeeList, setEmployeeList] = useState([]);
  const [form, setForm] = useState(emptyPemasukan());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    listEmployees().then(setEmployeeList).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await createIncome({
        date: form.date,
        amount: Number(form.amount),
        notes: form.notes || undefined,
        employee_name: form.employee_name,
        employee_password: form.employee_password,
      });
      setForm(emptyPemasukan());
      setSuccess("Pemasukan berhasil dikirim, menunggu persetujuan supervisor.");
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
        title="Input Pemasukan"
        description={`Catat setoran/pemasukan harian ${
          user?.store?.name || "gerai Anda"
        }. Transaksi berstatus menunggu persetujuan sampai diverifikasi supervisor.`}
      />

      <PendingBanner count={pendingCount} />

      <SectionCard title="Form Pemasukan" description="Isi nominal dan tanggal penerimaannya.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Nominal Pemasukan" required>
              <InputShell icon="payments">
                <span className="text-[11px] text-text-muted">Rp</span>
                <input
                  type="number"
                  min="0"
                  required
                  className={inputClass}
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </InputShell>
            </Field>
            <Field label="Tanggal Transaksi" required>
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

          <Field label="Keterangan (opsional)">
            <InputShell icon="notes">
              <input
                className={inputClass}
                placeholder="cth. Setoran shift pagi"
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
            listId="employee-suggestions-pemasukan"
          />

          <SubmitBar saving={saving} label="Kirim Pemasukan" color="bg-idm-blue hover:bg-idm-blue-dark" />

          <ErrorNote message={error} />
          <SuccessNote message={success} />
        </form>
      </SectionCard>

      <RiwayatTransaksi jenis="pemasukan" rows={riwayatPemasukan} loading={loading} onReload={reload} />
    </>
  );
}
