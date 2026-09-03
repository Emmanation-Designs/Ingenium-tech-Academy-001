import React, { useState } from 'react';
import { 
  Inbox, SlidersHorizontal, CheckCircle2, 
  XCircle, Clock, ChevronRight, X, ExternalLink 
} from 'lucide-react';
import { CourseSelection } from '../../types';

interface AdminRequestsProps {
  selections: CourseSelection[];
  onApprove: (selectionId: string) => Promise<void>;
  onReject: (selectionId: string) => Promise<void>;
  selectedRequest: CourseSelection | null;
  onSelectRequest: (req: CourseSelection | null) => void;
}

export const AdminRequests: React.FC<AdminRequestsProps> = ({
  selections,
  onApprove,
  onReject,
  selectedRequest,
  onSelectRequest
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [processing, setProcessing] = useState(false);

  const filtered = selections.filter(s => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  const handleApprove = async (id: string) => {
    setProcessing(true);
    try {
      await onApprove(id);
      onSelectRequest(null);
    } catch (e: any) {
      alert('Error approving request: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(true);
    try {
      await onReject(id);
      onSelectRequest(null);
    } catch (e: any) {
      alert('Error rejecting request: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (price?: number, currency: string = 'USD') => {
    if (price === undefined || price === null) return 'Free / Grant';
    const sym = currency === 'NGN' ? '₦' : currency === 'EUR' ? '€' : '$';
    return `${sym}${Number(price).toLocaleString()}`;
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(tab => {
          const isActive = filter === tab;
          const label = tab.charAt(0).toUpperCase() + tab.slice(1);
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 pb-2.5 text-xs font-semibold text-center transition-all cursor-pointer relative ${
                isActive ? 'text-[#00B074]' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00B074]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Requests List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center my-6 space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#EAFBF3] text-[#00B074] flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-gray-950">No course requests yet.</h4>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            When students select courses and submit their schedule choices, they will appear here for verification and approval.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(req => {
            const dateStr = new Date(req.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <div
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className="bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs hover:border-gray-200 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-xs text-gray-800 shrink-0">
                    {req.student_name?.charAt(0) || 'S'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-950 truncate">
                      {req.student_name || 'Student'}
                    </p>
                    <p className="text-[11px] text-gray-500 font-medium truncate">
                      {req.student_email || 'student@example.com'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-bold text-gray-900">
                        {req.course_title || 'Course'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        • {req.schedule_label || 'Default Time'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                    req.status === 'approved'
                      ? 'bg-[#EAFBF3] text-[#00B074]'
                      : req.status === 'rejected'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </span>
                  <p className="text-xs font-black text-gray-950 mt-1">
                    {formatPrice(req.price_snapshot, req.currency_snapshot)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {dateStr}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Request Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-gray-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-950">Review Course Request</h3>
                <p className="text-[11px] text-gray-400 font-medium">Reference: {selectedRequest.reference_id || selectedRequest.id.slice(0, 8)}</p>
              </div>
              <button
                onClick={() => onSelectRequest(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Student & Course Details */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5">
                <p className="font-bold text-gray-900 text-sm">{selectedRequest.student_name || 'Student'}</p>
                <p className="text-gray-600">{selectedRequest.student_email}</p>
                {selectedRequest.student_country && (
                  <p className="text-gray-500 font-medium">Country: {selectedRequest.student_country}</p>
                )}
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Course & Class Time</span>
                <p className="font-bold text-gray-950">{selectedRequest.course_title}</p>
                <p className="text-gray-600">{selectedRequest.schedule_label || 'Assigned Time'}</p>
                <div className="pt-2 flex justify-between items-center border-t border-gray-200 mt-2">
                  <span className="font-semibold text-gray-600">Agreed Price:</span>
                  <span className="font-black text-sm text-[#00B074]">
                    {formatPrice(selectedRequest.price_snapshot, selectedRequest.currency_snapshot)}
                  </span>
                </div>
              </div>

              {/* WhatsApp Payment Reminder Note */}
              <div className="p-3 bg-[#EAFBF3] rounded-xl border border-[#00B074]/20 text-[11px] text-gray-800 leading-relaxed font-medium">
                Verify that the student completed payment via WhatsApp before approving enrollment.
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleReject(selectedRequest.id)}
                disabled={processing || selectedRequest.status === 'rejected'}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Reject
              </button>

              <button
                onClick={() => handleApprove(selectedRequest.id)}
                disabled={processing || selectedRequest.status === 'approved'}
                className="flex-1 py-2.5 bg-[#00B074] hover:bg-[#00905D] text-white font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-xs flex items-center justify-center gap-1.5"
              >
                {processing ? 'Approving...' : (selectedRequest.status === 'approved' ? 'Approved' : 'Approve Request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
