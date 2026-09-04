import React, { useState, useEffect } from 'react';
import { Menu, Bell, RefreshCw, Radio } from 'lucide-react';
import { formatTimeAgo } from '../../services/realtimeSync';

interface AdminHeaderProps {
  title: string;
  onOpenMenu: () => void;
  rightAction?: React.ReactNode;
  unreadCount?: number;
  isSyncing?: boolean;
  onRefresh?: () => void;
  lastSyncedAt?: Date | null;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  title,
  onOpenMenu,
  rightAction,
  unreadCount = 0,
  isSyncing = false,
  onRefresh,
  lastSyncedAt
}) => {
  // Re-calculate relative time every 5 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  const timeAgoText = formatTimeAgo(lastSyncedAt);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100/80 px-4 py-3 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="p-1.5 rounded-lg text-gray-700 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Real-time sync status indicator & manual trigger */}
        {onRefresh && (
          <div className="flex items-center gap-1.5">
            {/* Live Indicator Pill */}
            <div 
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                isSyncing 
                  ? 'bg-teal-50 border-teal-200 text-[#0A9D8F]' 
                  : 'bg-emerald-50 border-emerald-200/70 text-emerald-700'
              }`}
              title={`Real-time auto-refresh active. Last synced: ${timeAgoText}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-[#0A9D8F] animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
              <span>{isSyncing ? 'Syncing...' : 'Live'}</span>
              <span className="text-[10px] text-gray-400 font-normal hidden md:inline">
                • {timeAgoText}
              </span>
            </div>

            {/* Manual Sync Button */}
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              title={`Auto-syncing smart in real-time. Last updated: ${timeAgoText}. Click to refresh now.`}
              aria-label="Refresh database records"
              className="p-1.5 rounded-lg text-gray-500 hover:text-[#0A9D8F] hover:bg-teal-50/60 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#0A9D8F]' : ''}`} />
            </button>
          </div>
        )}

        {/* Custom Header Right Action (e.g. Add buttons) */}
        {rightAction ? (
          rightAction
        ) : (
          <div className="relative">
            <button
              aria-label="Notifications"
              className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-all cursor-pointer relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#0A9D8F]" />
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
