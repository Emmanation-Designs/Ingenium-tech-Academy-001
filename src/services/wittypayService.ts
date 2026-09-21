import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Order, OrderItem, Payment, WittypayInitiateResponse } from '../types';
import { realtimeSync } from './realtimeSync';

export interface InitiatePaymentParams {
  studentId: string;
  studentEmail: string;
  studentName?: string;
  items: Array<{
    courseId: string;
    scheduleId?: string;
    selectionId?: string;
    courseTitle: string;
    scheduleLabel?: string;
    unitPrice: number;
    currency: string;
  }>;
  customerNote?: string;
}

export const wittypayService = {
  /**
   * Calls the server-side payment initialization API (/api/wittypay/create-payment)
   * The client NEVER holds or sees WITTYPAY_SECRET_KEY.
   */
  async initiateCheckout(params: InitiatePaymentParams): Promise<WittypayInitiateResponse> {
    const response = await fetch('/api/wittypay/create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to initialize payment gateway with Wittypay.');
    }

    realtimeSync.notifyMutation('orders', 'INSERT');
    realtimeSync.notifyMutation('payments', 'INSERT');

    return data as WittypayInitiateResponse;
  },

  /**
   * Fetches orders for a specific student or all orders for admin
   */
  async getOrders(studentId?: string): Promise<Order[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          student:profiles!student_id(email, full_name),
          items:order_items(*)
        `);

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.warn('[Wittypay Service] Error fetching orders with relations:', error.message);
        // Fallback to simple query if joins fail
        let simple = supabase.from('orders').select('*');
        if (studentId) simple = simple.eq('student_id', studentId);
        const { data: flatOrders, error: flatErr } = await simple.order('created_at', { ascending: false });
        if (flatErr) return [];
        return flatOrders as Order[];
      }

      return (data || []).map((o: any) => ({
        ...o,
        student_email: o.student?.email,
        student_name: o.student?.full_name,
        items: o.items || []
      })) as Order[];
    } catch (e) {
      console.error('[Wittypay Service] Exception in getOrders:', e);
      return [];
    }
  },

  /**
   * Checks order status directly from Supabase (authoritative source of truth)
   */
  async getOrderStatus(orderId: string): Promise<Order | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          student:profiles!student_id(email, full_name),
          items:order_items(*)
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        ...data,
        student_email: data.student?.email,
        student_name: data.student?.full_name,
        items: data.items || []
      } as Order;
    } catch (e) {
      console.error('[Wittypay Service] Exception in getOrderStatus:', e);
      return null;
    }
  }
};
