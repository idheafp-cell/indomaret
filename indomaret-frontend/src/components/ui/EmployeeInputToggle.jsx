import { Field, InputShell, inputClass } from "./InputShell";

/**
 * Toggle "siapa yang input transaksi ini" — sesuai alur yang diminta:
 * supervisor login dengan akun sendiri, TAPI kalau yang benar-benar
 * mengetik transaksi adalah kasir/karyawan, mereka wajib isi nama +
 * password singkat miliknya (dibuatkan supervisor) supaya tercatat di
 * kolom employee_id untuk audit.
 */
export default function EmployeeInputToggle({ mode, onModeChange, name, onNameChange, password, onPasswordChange, employeeOptions = [] }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
      <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 w-fit mb-3">
        <button
          type="button"
          onClick={() => onModeChange("self")}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
            mode === "self" ? "bg-idm-blue text-white" : "text-text-muted"
          }`}
        >
          Saya Sendiri (Supervisor)
        </button>
        <button
          type="button"
          onClick={() => onModeChange("employee")}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
            mode === "employee" ? "bg-idm-blue text-white" : "text-text-muted"
          }`}
        >
          Kasir / Karyawan
        </button>
      </div>

      {mode === "employee" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nama Kasir" code="employee_name">
            <InputShell icon="badge">
              <input
                list="employee-suggestions"
                className={inputClass}
                placeholder="cth. Kasir Satu"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                required={mode === "employee"}
              />
            </InputShell>
            <datalist id="employee-suggestions">
              {employeeOptions.map((e) => (
                <option key={e.id} value={e.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Password Kasir" code="employee_password">
            <InputShell icon="lock">
              <input
                type="password"
                className={inputClass}
                placeholder="Password milik kasir"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                required={mode === "employee"}
              />
            </InputShell>
          </Field>
        </div>
      )}
      {mode === "self" && (
        <p className="text-[11px] text-text-muted flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">info</span>
          Transaksi akan tercatat atas nama akun Anda yang sedang login.
        </p>
      )}
    </div>
  );
}
