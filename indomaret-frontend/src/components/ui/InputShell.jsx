// Field style konsisten dengan modal-modal di desain Stitch: label kecil +
// kotak abu-abu dengan ikon, berubah putih & border biru saat fokus.
export function Field({ label, code, required, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-on-surface mb-1.5">
        {label} {required && <span className="text-idm-red">*</span>}{" "}
        {code && <code className="text-[10px] font-mono text-idm-blue font-normal">({code})</code>}
      </label>
      {children}
    </div>
  );
}

export function InputShell({ icon, children }) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl focus-within:bg-white focus-within:border-idm-blue transition-colors">
      {icon && <span className="material-symbols-outlined text-idm-blue text-[18px]">{icon}</span>}
      {children}
    </div>
  );
}

export const inputClass =
  "w-full bg-transparent text-xs font-medium text-on-surface outline-none border-none p-0 focus:ring-0";
