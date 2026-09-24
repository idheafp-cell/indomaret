const accentMap = {
  blue: "bg-idm-blue",
  red: "bg-idm-red",
  yellow: "bg-idm-yellow",
  tricolor: "bg-gradient-to-r from-idm-blue via-idm-red to-idm-yellow",
};

const iconBgMap = {
  blue: "bg-blue-50 border-blue-100 text-idm-blue",
  red: "bg-red-50 border-red-100 text-idm-red",
  yellow: "bg-amber-50 border-amber-100 text-[#b88200]",
};

export default function KpiCard({ icon, accent = "blue", badge, label, value, valueClassName, footerLeft, footerRight }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-border-subtle flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-1 ${accentMap[accent]}`} />
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${iconBgMap[accent] || iconBgMap.blue}`}>
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
          </div>
          {badge}
        </div>
        <p className="text-body-sm text-text-muted font-medium mb-1">{label}</p>
        <h3 className={`text-title-stat tracking-tight ${valueClassName || "text-on-surface"}`}>{value}</h3>
      </div>
      {(footerLeft || footerRight) && (
        <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between text-[12px] text-text-muted">
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </div>
      )}
    </div>
  );
}

export function TrendBadge({ up = true, children }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full font-bold text-[11px] border ${
        up
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-idm-red border-red-200"
      }`}
    >
      <span className="material-symbols-outlined text-[14px]">{up ? "arrow_upward" : "arrow_downward"}</span>
      {children}
    </span>
  );
}
