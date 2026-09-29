import React, { useState } from 'react';
import { 
  Bell, X, CheckCheck, Check, Trash2, 
  ExternalLink, Sparkles, Inbox, RefreshCw 
} from 'lucide-react';
import { Notification } from '../../types';
import { LinkifiedText, extractUrls, normalizeUrl } from '../../utils/linkUtils';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onRefresh?: () => void;
  currentUserRole?: string;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onRefresh,
  currentUserRole
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const displayedNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const handleMarkAll = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      await onMarkAllAsRead();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center relative">
              <Bell className="w-4 h-4 stroke-[2.2]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#0A9D8F] ring-2 ring-white animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-950">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">Class announcements, links & alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Refresh notifications"
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close notifications"
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar & Actions */}
        <div className="px-5 py-2.5 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-gray-200/60 p-0.5 rounded-xl">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === 'unread'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={isMarkingAll}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0A9D8F] hover:text-[#087A6F] hover:underline cursor-pointer disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>

        {/* Notification List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-transparent">
          {displayedNotifications.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                <Inbox className="w-7 h-7 stroke-[1.5]" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                {filter === 'unread'
                  ? "You've read all your messages. Switch to 'All' to review previous updates."
                  : 'When instructors or administrators broadcast live session links, class notes, or announcements, you will receive them right here.'}
              </p>
            </div>
          ) : (
            displayedNotifications.map((notification) => {
              const detectedUrls = extractUrls(notification.message);
              const dedicatedLink = notification.link?.trim();
              const actionUrl = dedicatedLink || (detectedUrls.length === 1 ? detectedUrls[0] : null);

              return (
                <div
                  key={notification.id}
                  className={`p-4 rounded-2xl border transition-all text-left relative group ${
                    !notification.is_read
                      ? 'bg-[#0A9D8F]/5 border-[#0A9D8F]/25 shadow-xs'
                      : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                >
                  {/* Top row: Sender Tag / Unread green badge / Date */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {!notification.is_read && (
                        <span 
                          className="w-2 h-2 rounded-full bg-[#0A9D8F] shrink-0" 
                          title="Unread notification"
                        />
                      )}
                      {notification.sender_name ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                          {notification.sender_role === 'teacher' ? 'Instructor: ' : 'Admin: '}
                          {notification.sender_name}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-[#0A9D8F]">
                          Ingenium Academy
                        </span>
                      )}
                      {notification.category && (
                        <span className="text-[10px] font-medium text-gray-400 capitalize">
                          • {notification.category}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-medium text-gray-400 shrink-0">
                      {formatRelativeTime(notification.created_at)}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="text-xs sm:text-sm font-bold text-gray-950 mb-1.5 leading-snug">
                    {notification.title}
                  </h4>

                  {/* Message body with clickable links */}
                  <div className="text-xs text-gray-600 leading-relaxed break-words">
                    <LinkifiedText text={notification.message} />
                  </div>

                  {/* Action Link button if explicit link or detected url */}
                  {actionUrl && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100/80 flex items-center justify-between">
                      <a
                        href={normalizeUrl(actionUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!notification.is_read) {
                            onMarkAsRead(notification.id);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#087A6F] active:scale-98 transition-all cursor-pointer shadow-xs"
                      >
                        <span>Open Attached Link</span>
                        <ExternalLink className="w-3.5 h-3.5 stroke-[2.2]" />
                      </a>
                    </div>
                  )}

                  {/* Card actions: Mark Read / Delete */}
                  <div className="mt-3 flex items-center justify-end gap-2 pt-1">
                    {!notification.is_read ? (
                      <button
                        onClick={() => onMarkAsRead(notification.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0A9D8F] hover:text-[#087A6F] px-2 py-1 rounded-lg hover:bg-[#0A9D8F]/10 transition-colors cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Mark as read</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1 italic">
                        <CheckCheck className="w-3 h-3 text-gray-400" />
                        Read
                      </span>
                    )}

                    {onDelete && (
                      <button
                        onClick={() => onDelete(notification.id)}
                        className="p-1 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/70 text-center shrink-0">
          <p className="text-[11px] text-gray-400">
            Ingenium Tech Academy • Real-Time Notification Center
          </p>
        </div>
      </div>
    </div>
  );
};
