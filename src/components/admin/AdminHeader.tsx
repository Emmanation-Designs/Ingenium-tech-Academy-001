import React from 'react';
import { Menu, Bell } from 'lucide-react';

interface AdminHeaderProps {
  title: string;
  onOpenMenu: () => void;
  rightAction?: React.ReactNode;
  unreadCount?: number;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  title,
  onOpenMenu,
  rightAction,
  unreadCount = 0
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100/80 px-4 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="p-1.5 rounded-lg text-gray-700 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
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
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#00B074]" />
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
