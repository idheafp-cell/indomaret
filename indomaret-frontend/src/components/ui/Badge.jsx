const variants = {
  blue: "bg-blue-50 text-idm-blue border-blue-200",
  red: "bg-red-50 text-idm-red border-red-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function Badge({ variant = "blue", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-bold text-[11px] ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
