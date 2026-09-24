export default function Modal({ open, onClose, title, description, children, footer, maxWidth = "max-w-lg" }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={`relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8`}>
        <div className="h-1.5 w-full flex shrink-0">
          <div className="h-full w-1/3 bg-idm-blue" />
          <div className="h-full w-1/3 bg-idm-red" />
          <div className="h-full w-1/3 bg-idm-yellow" />
        </div>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <h3 className="text-[18px] font-bold text-on-surface tracking-tight">{title}</h3>
            {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
          </div>
          <button
            aria-label="Close modal"
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-slate-100 hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/60 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

export function FieldShell({ label, code, icon, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-on-surface mb-1.5 flex items-center justify-between">
        <span>
          {label} {code && <code className="text-[10px] font-mono text-idm-blue font-normal">({code})</code>}
        </span>
      </label>
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl focus-within:bg-white focus-within:border-idm-blue transition-colors">
        {icon && <span className="material-symbols-outlined text-idm-blue text-[18px]">{icon}</span>}
        {children}
      </div>
    </div>
  );
}
