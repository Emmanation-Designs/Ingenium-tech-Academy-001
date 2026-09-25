import React, { useState } from 'react';
import { Order, Payment } from '../../types';
import { 
  CreditCard, Search, CheckCircle2, Clock, XCircle, 
  RefreshCw, ChevronRight, ExternalLink, Calendar, Filter
} from 'lucide-react';

interface AdminOrdersViewProps {
  orders: Order[];
  payments: Payment[];
  onRefresh?: () => void;
  isSyncing?: boolean;
}

export const AdminOrdersView: React.FC<AdminOrdersViewProps> = ({
  orders,
  payments,
  onRefresh,
  isSyncing = false
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      !search ? true : (
        (o.order_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.student_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.student_email || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.payment_reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.wittypay_reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.paypal_order_id || '').toLowerCase().includes(search.toLowerCase())
      );

    const matchesStatus = statusFilter === 'all' ? true : o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRevenueNGN = orders
    .filter(o => o.status === 'completed')
    .reduce((acc, o) => acc + Number(o.total_amount || 0), 0);

  const completedOrdersCount = orders.filter(o => o.status === 'completed').length;
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;

  return (
    <div className="space-y-4 pb-20">
      
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs">
          <p className="text-xs font-semibold text-gray-500">Completed Payments</p>
          <p className="text-xl font-black text-[#0A9D8F] tracking-tight mt-0.5">
            ₦{totalRevenueNGN.toLocaleString()} NGN
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Processed via Wittypay</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs">
          <p className="text-xs font-semibold text-gray-500">Fulfilled Orders</p>
          <p className="text-xl font-black text-gray-900 tracking-tight mt-0.5">
            {completedOrdersCount}
          </p>
          <p className="text-[11px] text-emerald-600 mt-1">Instant enrollment active</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs">
          <p className="text-xs font-semibold text-gray-500">Pending Checkout Orders</p>
          <p className="text-xl font-black text-amber-600 tracking-tight mt-0.5">
            {pendingOrdersCount}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Awaiting customer payment</p>
        </div>
      </div>

      {/* Filters & Search Row */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search by student, order # or ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 p-1 rounded-xl text-xs">
              {(['all', 'completed', 'pending', 'failed'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                    statusFilter === tab 
                      ? 'bg-white text-gray-900 shadow-xs' 
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isSyncing}
                title="Refresh orders from database"
                className="p-2 border border-gray-200 bg-white rounded-xl text-gray-600 hover:text-[#0A9D8F] transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#0A9D8F]' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Orders Table */}
        <div className="divide-y divide-gray-100 overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No orders found matching the filter criteria.
            </div>
          ) : (
            filteredOrders.map(order => (
              <div 
                key={order.id} 
                onClick={() => setSelectedOrder(order)}
                className="py-3.5 flex items-center justify-between hover:bg-gray-50/80 px-2 rounded-xl cursor-pointer transition-all gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    order.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-600'
                      : order.status === 'failed'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}>
                    {order.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : order.status === 'failed' ? (
                      <XCircle className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-950 truncate">{order.order_number}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        order.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : order.status === 'failed'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                      {order.student_name || 'Student'} ({order.student_email || 'No email'}) • {order.items?.length || 1} course(s)
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <span className="text-xs font-black text-gray-950 block">
                      {order.currency === 'USD' ? '$' : order.currency === 'EUR' ? '€' : '₦'}{Number(order.total_amount).toLocaleString()} {order.currency}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-950">Order #{selectedOrder.order_number}</h3>
                <p className="text-[11px] text-gray-400">Created {new Date(selectedOrder.created_at).toLocaleString()}</p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Student Name:</span>
                <span className="font-semibold text-gray-900">{selectedOrder.student_name || 'Student'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Student Email:</span>
                <span className="font-semibold text-gray-900">{selectedOrder.student_email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Wittypay Reference:</span>
                <span className="font-mono font-semibold text-gray-800 text-[11px]">{selectedOrder.wittypay_reference || selectedOrder.payment_reference || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Order Status:</span>
                <span className={`font-bold capitalize ${
                  selectedOrder.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'
                }`}>{selectedOrder.status}</span>
              </div>
            </div>

            {/* Purchased Items */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-800">Purchased Course Items</h4>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {(selectedOrder.items || []).map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-gray-900">{item.course_title}</p>
                      <p className="text-[10px] text-gray-400">{item.schedule_label || 'Standard Schedule'}</p>
                    </div>
                    <span className="font-bold text-[#0A9D8F]">₦{Number(item.unit_price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[#E6F5F4]/60 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">Total Amount:</span>
              <span className="text-base font-black text-[#087A6F]">
                ₦{Number(selectedOrder.total_amount).toLocaleString()} NGN
              </span>
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
