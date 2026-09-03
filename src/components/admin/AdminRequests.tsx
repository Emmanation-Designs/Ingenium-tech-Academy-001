import React, { useState } from 'react';
import { 
  Inbox, SlidersHorizontal, CheckCircle2, 
  XCircle, Clock, ChevronRight, X, ExternalLink,
  Check, Loader2
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
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const filtered = selections.filter(s => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  const handleApprove = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProcessingId(id);
    try {
      await onApprove(id);
      showNotification('Course request successfully approved! Enrollment activated.', 'success');
      if (selectedRequest?.id === id) {
        onSelectRequest(null);
      }
    } catch (e: any) {
      showNotification('Error approving request: ' + (e.message || 'Please check connection'), 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProcessingId(id);
    try {
      await onReject(id);
      showNotification('Course request rejected.', 'success');
      if (selectedRequest?.id === id) {
        onSelectRequest(null);
      }
    } catch (e: any) {
      showNotification('Error rejecting request: ' + (e.message || 'Please check connection'), 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const formatPrice = (price?: number, currency: string = 'USD') => {
    if (price === undefined || price === null) return 'Free / Grant';
    const sym = currency === 'NGN' ? '₦' : currency === 'EUR' ? '€' : '$';
    return `${sym}${Number(price).toLocaleString()}`;
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Toast Notification */}
      {statusMessage && (
        <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
          statusMessage.type === 'success'
            ? 'bg-[#E6F5F4] border-[#0A9D8F]/30 text-[#087A6F]'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#0A9D8F] shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button 
            onClick={() => setStatusMessage(null)}
            className="text-gray-400 hover:text-gray-700 p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(tab => {
          const isActive = filter === tab;
          const label = tab.charAt(0).toUpperCase() + tab.slice(1);
          const count = selections.filter(s => tab === 'all' ? true : s.status === tab).length;

          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 pb-2.5 text-xs font-semibold text-center transition-all cursor-pointer relative flex items-center justify-center gap-1.5 ${
                isActive ? 'text-[#0A9D8F]' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <span>{label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                isActive ? 'bg-[#0A9D8F]/15 text-[#0A9D8F]' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A9D8F]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Requests List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center my-6 space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-gray-950">No course requests in this tab.</h4>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            When students select courses and submit their schedule choices, they will appear here for verification and one-click approval.
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
            const isProcessingThis = processingId === req.id;

            return (
              <div
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className="bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs hover:border-gray-200 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
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
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] font-bold text-gray-900">
                        {req.course_title || 'Course'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        • {req.schedule_label || 'Default Time'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                  <div className="text-left sm:text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                      req.status === 'approved'
                        ? 'bg-[#E6F5F4] text-[#0A9D8F]'
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

                  {/* Quick Action for Pending Requests */}
                  {req.status === 'pending' && (
                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleApprove(req.id, e)}
                        disabled={isProcessingThis}
                        title="Approve Request"
                        className="px-3 py-1.5 bg-[#0A9D8F] hover:bg-[#087A6F] text-white font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-xs"
                      >
                        {isProcessingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Approve</span>
                      </button>

                      <button
                        onClick={(e) => handleReject(req.id, e)}
                        disabled={isProcessingThis}
                        title="Reject Request"
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
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
                  <span className="font-black text-sm text-[#0A9D8F]">
                    {formatPrice(selectedRequest.price_snapshot, selectedRequest.currency_snapshot)}
                  </span>
                </div>
              </div>

              {/* Current Status */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-gray-500 font-medium">Current Status:</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  selectedRequest.status === 'approved'
                    ? 'bg-[#E6F5F4] text-[#0A9D8F]'
                    : selectedRequest.status === 'rejected'
                    ? 'bg-gray-200 text-gray-700'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                </span>
              </div>

              {/* WhatsApp Payment Reminder Note */}
              <div className="p-3 bg-[#E6F5F4] rounded-xl border border-[#0A9D8F]/20 text-[11px] text-gray-800 leading-relaxed font-medium">
                Verify that the student completed payment via WhatsApp before approving enrollment.
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleReject(selectedRequest.id)}
                disabled={processingId === selectedRequest.id || selectedRequest.status === 'rejected'}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {processingId === selectedRequest.id ? 'Processing...' : 'Reject'}
              </button>

              <button
                onClick={() => handleApprove(selectedRequest.id)}
                disabled={processingId === selectedRequest.id || selectedRequest.status === 'approved'}
                className="flex-1 py-2.5 bg-[#0A9D8F] hover:bg-[#087A6F] text-white font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-xs flex items-center justify-center gap-1.5"
              >
                {processingId === selectedRequest.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : selectedRequest.status === 'approved' ? (
                  'Approved'
                ) : (
                  'Approve Request'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
