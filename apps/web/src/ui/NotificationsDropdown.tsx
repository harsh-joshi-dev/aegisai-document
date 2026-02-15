import { useState, useRef, useEffect } from 'react';
import { Bell, FileText, AlertTriangle } from 'lucide-react';
import { useMockStore } from '../state/mockStore';
import { useMockAuth } from '../state/mockAuth';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export function NotificationsDropdown() {
  const { notifications, markNotificationsRead } = useMockStore();
  const { user } = useMockAuth();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const myNotifications = notifications.filter(
    (n) => n.userId === user?.email
  );
  const unread = myNotifications.filter((n) => !n.read);
  const unreadCount = unread.length;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const markAllRead = () => {
    if (unread.length > 0) {
      markNotificationsRead(unread.map((n) => n.id));
    }
    setOpen(false);
  };

  const handleNotificationClick = (id: string, read: boolean) => {
    if (!read) markNotificationsRead([id]);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full border border-[#030304]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[420px] flex flex-col rounded-xl border border-white/10 bg-[#0e0e11] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 max-h-[360px] custom-scrollbar">
            {myNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <Bell size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1">You’ll see assigns and alerts here</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {myNotifications.slice(0, 50).map((n) => {
                  const isAssign = n.type === 'assign' || n.type === 'request_info';
                  const isEscalation = n.type === 'escalation';
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, !!n.read)}
                      className={`flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer ${
                        !n.read ? 'bg-indigo-500/5' : ''
                      }`}
                    >
                      <div
                        className={`shrink-0 mt-0.5 p-2 rounded-lg ${
                          isEscalation
                            ? 'bg-amber-500/10 text-amber-400'
                            : isAssign
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {isEscalation ? (
                          <AlertTriangle size={14} />
                        ) : (
                          <FileText size={14} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 leading-snug">
                          {n.message}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {format(new Date(n.ts), 'MMM d, h:mm a')}
                        </p>
                        {n.docId && (
                          <Link
                            to={`/document/${n.docId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block"
                          >
                            View document →
                          </Link>
                        )}
                      </div>
                      {!n.read && (
                        <div className="shrink-0 mt-1.5">
                          <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
