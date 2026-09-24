import { useCallback, useEffect, useRef, useState } from "react";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../../api/resources";

const POLL_INTERVAL_MS = 20000;

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

const TYPE_ICON = {
  transaction_pending_approval: { icon: "pending_actions", color: "text-idm-yellow bg-amber-50" },
  transaction_approved: { icon: "check_circle", color: "text-emerald-600 bg-emerald-50" },
  transaction_rejected: { icon: "cancel", color: "text-idm-red bg-red-50" },
};

/**
 * Bell notifikasi in-app. Poll berkala (bukan realtime/websocket) ke
 * GET /api/notifications setiap 20 detik + sekali saat mount.
 */
export default function NotificationBell({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);

  const load = useCallback(() => {
    listNotifications({ per_page: 10 })
      .then((res) => {
        setItems(res.data || []);
        setUnreadCount(res.unread_count || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleItemClick(item) {
    if (!item.read_at) {
      await markNotificationRead(item.id).catch(() => {});
      load();
    }
    setOpen(false);
    onNavigate?.(item);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead().catch(() => {});
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Notifikasi"
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 text-on-surface-variant hover:bg-slate-200 transition-colors relative"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-idm-red text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-border-subtle shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between bg-slate-50/70">
            <span className="text-sm font-bold text-on-surface">Notifikasi</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                type="button"
                className="text-[11px] font-bold text-idm-blue hover:underline"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border-subtle">
            {loading && <div className="px-4 py-6 text-center text-xs text-text-muted">Memuat...</div>}
            {!loading && items.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-text-muted">Belum ada notifikasi.</div>
            )}
            {items.map((item) => {
              const meta = TYPE_ICON[item.type] || { icon: "info", color: "text-idm-blue bg-blue-50" };
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  type="button"
                  className={`w-full text-left px-4 py-3 flex items-start gap-2.5 hover:bg-slate-50 transition-colors ${
                    !item.read_at ? "bg-blue-50/40" : ""
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                    <span className="material-symbols-outlined text-[16px]">{meta.icon}</span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-bold text-on-surface leading-snug">{item.title}</span>
                    <span className="block text-[11.5px] text-text-muted leading-snug mt-0.5 line-clamp-2">
                      {item.body}
                    </span>
                    <span className="block text-[10px] text-text-muted/80 mt-1">{timeAgo(item.created_at)}</span>
                  </span>
                  {!item.read_at && <span className="w-2 h-2 rounded-full bg-idm-blue mt-1.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
