export default function SubmitBar({ saving, label, color }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className={`w-full sm:w-auto flex items-center justify-center gap-1.5 ${color} text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm disabled:opacity-60 transition-colors`}
    >
      <span className="material-symbols-outlined text-[18px]">send</span>
      {saving ? "Mengirim..." : label}
    </button>
  );
}
