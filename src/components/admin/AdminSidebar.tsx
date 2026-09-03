import React from 'react';
import { 
  Home, BookOpen, Layers, Clock, Inbox, Users, 
  GraduationCap, ShieldCheck, BarChart2, Settings, 
  LogOut, X, ChevronDown, Check
} from 'lucide-react';
import { Profile } from '../../types';

export type AdminTab = 
  | 'dashboard' 
  | 'courses' 
  | 'categories' 
  | 'times' 
  | 'requests' 
  | 'students' 
  | 'instructors' 
  | 'enrollments' 
  | 'reports' 
  | 'settings';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  currentUser: Profile;
  onLogout: () => void;
  pendingRequestsCount: number;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  currentUser,
  onLogout,
  pendingRequestsCount
}) => {
  const navItems = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: Home },
    { id: 'courses' as AdminTab, label: 'Courses', icon: BookOpen },
    { id: 'categories' as AdminTab, label: 'Categories', icon: Layers },
    { id: 'times' as AdminTab, label: 'Class Times', icon: Clock },
    { 
      id: 'requests' as AdminTab, 
      label: 'Course Requests', 
      icon: Inbox, 
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined 
    },
    { id: 'students' as AdminTab, label: 'Students', icon: Users },
    { id: 'instructors' as AdminTab, label: 'Instructors', icon: GraduationCap },
    { id: 'enrollments' as AdminTab, label: 'Enrollments', icon: ShieldCheck },
    { id: 'reports' as AdminTab, label: 'Reports', icon: BarChart2 },
    { id: 'settings' as AdminTab, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Slideout Drawer / Persistent Desktop Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[280px] bg-white z-50 flex flex-col border-r border-gray-100 shadow-xl transition-transform duration-250 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header with Ingenium Logo */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0A9D8F] flex items-center justify-center shadow-xs">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-gray-950 block leading-tight">
                INGENIUM TECH
              </span>
              <span className="text-[10px] font-bold text-gray-400 tracking-wider block">
                ACADEMY ADMIN
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close menu"
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Profile Box */}
        <div className="p-4 mx-3 my-3 bg-gray-50/80 rounded-2xl border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0A9D8F]/15 border border-[#0A9D8F]/30 flex items-center justify-center text-[#0A9D8F] font-bold text-sm">
              {currentUser.full_name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-900 truncate max-w-[130px]">
                {currentUser.full_name || 'Admin User'}
              </p>
              <p className="text-[11px] text-gray-500 font-medium">
                {currentUser.role === 'admin' ? 'Super Admin' : 'Admin'}
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#E6F5F4] text-[#0A9D8F]'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#0A9D8F]' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="bg-[#0A9D8F] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Logout */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50/60 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
