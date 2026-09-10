import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, BookOpen, Inbox, ShieldCheck, ChevronDown, 
  ArrowUpRight, Plus, ExternalLink, Clock, RefreshCw,
  TrendingUp, TrendingDown, Calendar, Check
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { Profile, Course, CourseSelection, Enrollment } from '../../types';
import { formatTimeAgo } from '../../services/realtimeSync';

interface AdminDashboardProps {
  students: Profile[];
  courses: Course[];
  selections: CourseSelection[];
  enrollments: Enrollment[];
  onNavigate: (tab: any) => void;
  onOpenRequest: (selection: CourseSelection) => void;
  currentUser: Profile;
  isSyncing?: boolean;
  onRefresh?: () => void;
  lastSyncedAt?: Date | null;
}

type TimeRangeOption = '7d' | '30d' | '90d' | 'all';
type ViewModeOption = 'cumulative' | 'daily';

const TIME_RANGE_LABELS: Record<TimeRangeOption, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'all': 'All time'
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  students,
  courses,
  selections,
  enrollments,
  onNavigate,
  onOpenRequest,
  currentUser,
  isSyncing = false,
  onRefresh,
  lastSyncedAt
}) => {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('30d');
  const [viewMode, setViewMode] = useState<ViewModeOption>('cumulative');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  // Update relative time readout every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pendingRequests = selections.filter(s => s.status === 'pending');
  const activeEnrollments = enrollments.filter(e => e.status === 'active');
  const recentRequests = selections.slice(0, 4);
  const timeAgoText = formatTimeAgo(lastSyncedAt);

  // ----------------------------------------------------------------------
  // Real Data Aggregation and Date Bucketing
  // ----------------------------------------------------------------------
  const { chartData, periodTotal, prevPeriodChange, peakCount } = useMemo(() => {
    const now = new Date();
    // Normalize today to end of day
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let daysCount = 30;
    if (timeRange === '7d') daysCount = 7;
    else if (timeRange === '90d') daysCount = 90;
    else if (timeRange === 'all') {
      // Find earliest enrollment or 180 days ago
      const earliestTs = activeEnrollments.reduce((min, e) => {
        const ts = new Date(e.created_at || e.approved_at || Date.now()).getTime();
        return ts < min ? ts : min;
      }, Date.now());
      const diffDays = Math.ceil((endOfToday.getTime() - earliestTs) / (1000 * 60 * 60 * 24));
      daysCount = Math.max(30, Math.min(diffDays + 5, 365));
    }

    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (daysCount - 1), 0, 0, 0, 0);
    const priorPeriodStartDate = new Date(startDate.getTime() - daysCount * 24 * 60 * 60 * 1000);

    // Map each active enrollment to a timestamp
    const enrollmentTimes = activeEnrollments.map(e => ({
      ...e,
      timestamp: new Date(e.created_at || e.approved_at || Date.now()).getTime()
    }));

    // Count in current period vs prior period
    const inCurrentPeriod = enrollmentTimes.filter(
      e => e.timestamp >= startDate.getTime() && e.timestamp <= endOfToday.getTime()
    );
    const inPriorPeriod = enrollmentTimes.filter(
      e => e.timestamp >= priorPeriodStartDate.getTime() && e.timestamp < startDate.getTime()
    );

    let changePercentage: number | null = null;
    if (inPriorPeriod.length > 0) {
      changePercentage = Math.round(((inCurrentPeriod.length - inPriorPeriod.length) / inPriorPeriod.length) * 100);
    } else if (inCurrentPeriod.length > 0) {
      changePercentage = 100;
    }

    // Generate buckets
    // If daysCount <= 31, generate daily points
    // If daysCount > 31, generate intervals (e.g. 15-20 points)
    const points: Array<{
      dateLabel: string;
      fullDate: string;
      newCount: number;
      cumulativeCount: number;
      value: number;
    }> = [];

    const stepDays = daysCount > 60 ? Math.ceil(daysCount / 20) : 1;
    let runningCumulative = enrollmentTimes.filter(e => e.timestamp < startDate.getTime()).length;
    let maxVal = 0;

    let cursor = new Date(startDate.getTime());
    while (cursor <= endOfToday) {
      const bucketStart = new Date(cursor.getTime());
      const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + stepDays - 1, 23, 59, 59, 999);
      const actualEnd = bucketEnd > endOfToday ? endOfToday : bucketEnd;

      const newInBucket = enrollmentTimes.filter(
        e => e.timestamp >= bucketStart.getTime() && e.timestamp <= actualEnd.getTime()
      ).length;

      runningCumulative += newInBucket;

      const dateLabel = daysCount <= 7 
        ? bucketStart.toLocaleDateString('en-US', { weekday: 'short' })
        : daysCount <= 31 
        ? bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const fullDate = bucketStart.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });

      const val = viewMode === 'cumulative' ? runningCumulative : newInBucket;
      if (val > maxVal) maxVal = val;

      points.push({
        dateLabel,
        fullDate,
        newCount: newInBucket,
        cumulativeCount: runningCumulative,
        value: val
      });

      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + stepDays, 0, 0, 0, 0);
    }

    return {
      chartData: points,
      periodTotal: inCurrentPeriod.length,
      prevPeriodChange: changePercentage,
      peakCount: maxVal
    };
  }, [activeEnrollments, timeRange, viewMode]);

  return (
    <div className="space-y-5 pb-20">
      {/* Welcome Banner & Live Auto-Refresh Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-gray-950 tracking-tight">
            Welcome back, {currentUser.full_name?.split(' ')[0] || 'Admin'}!
          </h2>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Here's what's happening today in real-time.
          </p>
        </div>

        {/* Live sync pill & quick refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div 
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isSyncing 
                ? 'bg-teal-50 border-teal-200 text-[#0A9D8F]' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-[#0A9D8F] animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
            <span>{isSyncing ? 'Refreshing...' : 'Live Sync'}</span>
            <span className="text-[11px] text-gray-500 font-normal pl-1.5 border-l border-emerald-200/80">
              {timeAgoText}
            </span>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              title="Click to sync latest records immediately"
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:text-[#0A9D8F] hover:border-[#0A9D8F]/50 active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#0A9D8F]' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* 2x2 Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {/* Total Students */}
        <div 
          onClick={() => onNavigate('students')}
          className="bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs hover:border-gray-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-full bg-[#E6F5F4] flex items-center justify-center text-[#0A9D8F]">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-500">Total Students</p>
          <p className="text-2xl font-black text-gray-950 tracking-tight mt-0.5">
            {students.length}
          </p>
          <p className="text-[11px] text-gray-400 font-medium mt-1">
            Registered accounts
          </p>
        </div>

        {/* Total Courses */}
        <div 
          onClick={() => onNavigate('courses')}
          className="bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs hover:border-gray-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-full bg-[#E6F5F4] flex items-center justify-center text-[#0A9D8F]">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-500">Total Courses</p>
          <p className="text-2xl font-black text-gray-950 tracking-tight mt-0.5">
            {courses.length}
          </p>
          <p className="text-[11px] text-gray-400 font-medium mt-1">
            Academy curriculum
          </p>
        </div>

        {/* Pending Requests */}
        <div 
          onClick={() => onNavigate('requests')}
          className="bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs hover:border-gray-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-full bg-[#E6F5F4] flex items-center justify-center text-[#0A9D8F]">
              <Inbox className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-500">Pending Requests</p>
          <p className="text-2xl font-black text-gray-950 tracking-tight mt-0.5">
            {pendingRequests.length}
          </p>
          <p className="text-[11px] text-gray-400 font-medium mt-1">
            Awaiting verification
          </p>
        </div>

        {/* Approved Enrollments */}
        <div 
          onClick={() => onNavigate('enrollments')}
          className="bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs hover:border-gray-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-full bg-[#E6F5F4] flex items-center justify-center text-[#0A9D8F]">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-500">Approved Enrollments</p>
          <p className="text-2xl font-black text-gray-950 tracking-tight mt-0.5">
            {activeEnrollments.length}
          </p>
          <p className="text-[11px] text-gray-400 font-medium mt-1">
            Active admissions
          </p>
        </div>
      </div>

      {/* Enrollments Overview Card with Real Dynamic Analytics */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-950">Enrollments Overview</h3>
              <span className="text-[11px] font-bold text-[#0A9D8F] bg-[#E6F5F4] px-2 py-0.5 rounded-full">
                {periodTotal} verified in period
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Live verified course admissions plotted by real enrollment dates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle (Cumulative vs Daily) */}
            <div className="inline-flex bg-gray-100 p-0.5 rounded-xl text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('cumulative')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'cumulative'
                    ? 'bg-white text-gray-950 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Cumulative
              </button>
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'daily'
                    ? 'bg-white text-gray-950 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                New / Period
              </button>
            </div>

            {/* Interactive Time Range Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 text-xs font-semibold text-gray-800 transition-all cursor-pointer shadow-2xs"
              >
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>{TIME_RANGE_LABELS[timeRange]}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-in fade-in zoom-in-95">
                  {(Object.keys(TIME_RANGE_LABELS) as TimeRangeOption[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setTimeRange(key);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between cursor-pointer"
                    >
                      <span className={timeRange === key ? 'font-bold text-[#0A9D8F]' : ''}>
                        {TIME_RANGE_LABELS[key]}
                      </span>
                      {timeRange === key && <Check className="w-3.5 h-3.5 text-[#0A9D8F]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Real Dynamic Chart */}
        <div className="w-full h-[180px] pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
            >
              <defs>
                <linearGradient id="enrollmentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0A9D8F" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0A9D8F" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis 
                dataKey="dateLabel" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                interval={timeRange === '30d' ? 4 : timeRange === '90d' ? 2 : 'preserveStartEnd'}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(4, Math.ceil(dataMax * 1.25))]}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-gray-950 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-gray-800 pointer-events-none">
                        <p className="text-[10px] text-gray-400 font-medium">{data.fullDate}</p>
                        <p className="font-extrabold text-[#2DD4BF] text-sm mt-0.5">
                          {data.value} {viewMode === 'cumulative' ? 'Total Enrolled' : 'New Admissions'}
                        </p>
                        {viewMode === 'cumulative' && (
                          <p className="text-[10px] text-gray-300 mt-0.5">
                            +{data.newCount} on this day
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#0A9D8F" 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#enrollmentGrad)" 
                activeDot={{ r: 5, fill: '#0A9D8F', stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Dynamic Period Summary Footer */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Period Trend:</span>
            {prevPeriodChange !== null ? (
              <span className={`inline-flex items-center gap-1 font-bold ${
                prevPeriodChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {prevPeriodChange >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {prevPeriodChange >= 0 ? `+${prevPeriodChange}%` : `${prevPeriodChange}%`} vs prior period
              </span>
            ) : (
              <span className="text-gray-400 font-normal">Baseline period</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-gray-500 text-[11px]">
            <span>Total Active Academy Admissions: <strong className="text-gray-900 font-bold">{activeEnrollments.length}</strong></span>
            {periodTotal === 0 && (
              <span className="text-amber-600 font-medium">
                (No new approvals within {TIME_RANGE_LABELS[timeRange].toLowerCase()})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Recent Course Requests Preview */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100/90 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-950">Recent Course Requests</h3>
          <button 
            onClick={() => onNavigate('requests')}
            className="text-xs font-semibold text-[#0A9D8F] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentRequests.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400 font-medium">
            No course requests yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentRequests.map(req => (
              <div 
                key={req.id} 
                onClick={() => onOpenRequest(req)}
                className="py-3 flex items-center justify-between hover:bg-gray-50/70 rounded-xl px-2 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center">
                    {req.student_name?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-950 leading-tight">
                      {req.student_name || 'Student'}
                    </p>
                    <p className="text-[11px] text-gray-500 font-medium truncate max-w-[150px]">
                      {req.course_title || 'Course'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                    req.status === 'approved' 
                      ? 'bg-[#E6F5F4] text-[#0A9D8F]' 
                      : req.status === 'rejected'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {req.status?.charAt(0).toUpperCase() + req.status?.slice(1)}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {req.price_snapshot ? `${req.currency_snapshot === 'NGN' ? '₦' : req.currency_snapshot === 'EUR' ? '€' : '$'}${Number(req.price_snapshot).toLocaleString()}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
