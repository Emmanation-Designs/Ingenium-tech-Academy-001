import React from 'react';
import { Home, BookOpen, Inbox, Users, Menu } from 'lucide-react';
import { AdminTab } from './AdminSidebar';

interface AdminBottomNavProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  onOpenMenu: () => void;
  pendingRequestsCount: number;
}

export const AdminBottomNav: React.FC<AdminBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenMenu,
  pendingRequestsCount
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 px-3 py-2 flex items-center justify-around shadow-lg">
      <button
        onClick={() => onSelectTab('dashboard')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
          activeTab === 'dashboard' ? 'text-[#00B074]' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Dashboard</span>
      </button>

      <button
        onClick={() => onSelectTab('courses')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
          activeTab === 'courses' ? 'text-[#00B074]' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <BookOpen className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Courses</span>
      </button>

      <button
        onClick={() => onSelectTab('requests')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
          activeTab === 'requests' ? 'text-[#00B074]' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <Inbox className="w-5 h-5" />
        {pendingRequestsCount > 0 && (
          <span className="absolute top-0 right-3 w-4 h-4 bg-[#00B074] text-white text-[9px] font-black rounded-full flex items-center justify-center">
            {pendingRequestsCount}
          </span>
        )}
        <span className="text-[10px] font-semibold">Requests</span>
      </button>

      <button
        onClick={() => onSelectTab('students')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
          activeTab === 'students' ? 'text-[#00B074]' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <Users className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Students</span>
      </button>

      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] font-semibold">More</span>
      </button>
    </nav>
  );
};
