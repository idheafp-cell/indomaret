export default function ProgressBar({ percent, color = "#145fa0", height = "h-1.5" }) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className={`w-full bg-slate-100 rounded-full ${height} overflow-hidden`}>
      <div className={`${height} rounded-full transition-all`} style={{ width: `${safe}%`, backgroundColor: color }} />
    </div>
  );
}
