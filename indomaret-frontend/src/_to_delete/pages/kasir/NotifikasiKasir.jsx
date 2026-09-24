import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import SectionCard from "../../components/ui/SectionCard";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "../../api/resources";

const TYPE_META = {
  transaksi_menunggu_persetujuan: { icon: "pending_actions", color: "text-idm-yellow bg-amber-50" },
  transaksi_disetujui: { icon: "check_circle", color: "text-emerald-600 bg-emerald-50" },
  transaksi_ditolak: { icon: "cancel", color: "text-idm-red bg-red-50" },
};

function waktuLengkap(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotifikasiKasir() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listNotifications({ per_page: 50 })
      .then((res) => {
        setItems(res.data || []);
        setUnreadCount(res.unread_count || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRead(item) {
    if (item.read_at) return;
    await markNotificationRead(item.id).catch(() => {});
    load();
  }

  async function handleReadAll() {
    await markAllNotificationsRead().catch(() => {});
    load();
  }

  return (
    <>
      <PageHeader
        breadcrumb={["Kasir", "Notifikasi"]}
        title="Notifikasi"
        description="Pemberitahuan saat transaksi yang Anda kirim disetujui atau ditolak supervisor."
        actions={
          unreadCount > 0 && (
            <button
              onClick={handleReadAll}
              type="button"
              className="flex items-center gap-1.5 bg-idm-blue hover:bg-idm-blue-dark text-white px-4 py-2 rounded-xl font-bold text-body-sm shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">done_all</span>
              Tandai Semua Dibaca
            </button>
          )
        }
      />

      <SectionCard
        title="Semua Notifikasi"
        description={
          unreadCount > 0 ? `${unreadCount} notifikasi belum dibaca` : "Semua notifikasi sudah dibaca"
        }
      >
        <div className="divide-y divide-border-subtle -mx-1">
          {loading && <div className="py-8 text-center text-sm text-text-muted">Memuat notifikasi...</div>}

          {!loading && items.length === 0 && (
            <div className="py-12 text-center text-text-muted text-sm flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-[32px] text-slate-300">notifications_off</span>
              Belum ada notifikasi.
            </div>
          )}

          {items.map((item) => {
            const meta = TYPE_META[item.type] || { icon: "info", color: "text-idm-blue bg-blue-50" };
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleRead(item)}
                className={`w-full text-left px-3 py-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors rounded-xl ${
                  !item.read_at ? "bg-blue-50/40" : ""
                }`}
              >
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                  <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-bold text-on-surface leading-snug">{item.title}</span>
                  <span className="block text-[12px] text-text-muted leading-snug mt-1">{item.body}</span>
                  <span className="block text-[10.5px] text-text-muted/80 mt-1.5">
                    {waktuLengkap(item.created_at)}
                  </span>
                </span>
                {!item.read_at && <span className="w-2 h-2 rounded-full bg-idm-blue mt-2 shrink-0" />}
              </button>
            );
          })}
        </div>
      </SectionCard>
    </>
  );
}
