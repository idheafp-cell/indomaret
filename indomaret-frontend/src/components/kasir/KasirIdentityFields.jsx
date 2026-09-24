import { Field, InputShell, inputClass } from "../ui/InputShell";

/**
 * Akun login kasir dipakai BERSAMA oleh semua kasir fisik di satu gerai,
 * jadi tiap transaksi tetap wajib ditandatangani nama + password kasir
 * individu (tabel `employees`) sebagai jejak audit siapa yang benar-benar
 * menginput.
 */
export default function KasirIdentityFields({
  name,
  onNameChange,
  password,
  onPasswordChange,
  employeeOptions = [],
  listId,
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
      <p className="text-[11px] font-bold text-on-surface mb-2 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[15px] text-idm-blue">badge</span>
        Identitas Kasir yang Bertugas (wajib diisi untuk audit)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nama Kasir" required>
          <InputShell icon="person">
            <input
              list={listId}
              required
              className={inputClass}
              placeholder="cth. Kasir Satu"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </InputShell>
          <datalist id={listId}>
            {employeeOptions.map((e) => (
              <option key={e.id} value={e.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Password Kasir" required>
          <InputShell icon="lock">
            <input
              type="password"
              required
              className={inputClass}
              placeholder="Password milik kasir"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </InputShell>
        </Field>
      </div>
    </div>
  );
}
