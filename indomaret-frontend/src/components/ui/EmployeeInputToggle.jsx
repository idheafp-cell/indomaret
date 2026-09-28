import { useState } from "react";
import { Field, InputShell, inputClass } from "./InputShell";


export default function EmployeeInputToggle({ mode, onModeChange, name, onNameChange, password, onPasswordChange, employeeOptions = [] }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSelectEmployee = (employeeName) => {
    onNameChange(employeeName);
    setDropdownOpen(false);
  };

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
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 focus:bg-white focus:border-idm-blue transition-colors text-left"
              >
                <span className="material-symbols-outlined text-idm-blue text-[18px]">badge</span>
                <span className="text-xs font-medium text-on-surface flex-1">{name || "Pilih kasir..."}</span>
                <span className={`material-symbols-outlined text-[16px] text-text-muted transition-transform ${dropdownOpen ? "rotate-180" : ""}`}>
                  expand_more
                </span>
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10">
                  <button
                    type="button"
                    onClick={() => handleSelectEmployee("")}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-text-muted hover:bg-slate-50 border-b border-slate-100"
                  >
                    Pilih kasir...
                  </button>
                  {employeeOptions.length > 0 ? (
                    employeeOptions.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => handleSelectEmployee(emp.name)}
                        className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                          name === emp.name
                            ? "bg-idm-blue bg-opacity-10 text-idm-blue"
                            : "text-on-surface hover:bg-slate-50"
                        }`}
                      >
                        {emp.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-text-muted">Tidak ada kasir</div>
                  )}
                </div>
              )}
            </div>
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
