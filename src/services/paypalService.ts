import { CheckoutInitiateResponse, Order } from '../types';
import { realtimeSync } from './realtimeSync';

export interface InitiatePayPalParams {
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

export const paypalService = {
  /**
   * Calls the server-side PayPal order creation API (/api/paypal/create-order)
   * Client NEVER sees or handles PAYPAL_CLIENT_SECRET.
   */
  async initiateCheckout(params: InitiatePayPalParams): Promise<CheckoutInitiateResponse> {
    const response = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to initialize PayPal checkout.');
    }

    realtimeSync.notifyMutation('orders', 'INSERT');
    realtimeSync.notifyMutation('payments', 'INSERT');

    return data as CheckoutInitiateResponse;
  },

  /**
   * Calls the server-side PayPal capture endpoint (/api/paypal/capture-order)
   * The server captures the payment with PayPal and authoritatively fulfills course access.
   */
  async captureOrder(params: { orderId?: string; paypalOrderId?: string; status?: string }): Promise<any> {
    const response = await fetch('/api/paypal/capture-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to capture and verify PayPal payment.');
    }

    if (data.status === 'completed') {
      realtimeSync.notifyMutation('orders', 'UPDATE');
      realtimeSync.notifyMutation('payments', 'UPDATE');
      realtimeSync.notifyMutation('enrollments', 'INSERT');
      realtimeSync.notifyMutation('course_selections', 'UPDATE');
    }

    return data;
  },

  /**
   * Checks order status directly from server endpoint
   */
  async checkStatus(params: { orderId?: string; paypalOrderId?: string; ref?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params.orderId) queryParams.set('order_id', params.orderId);
    if (params.paypalOrderId) queryParams.set('token', params.paypalOrderId);
    if (params.ref) queryParams.set('ref', params.ref);

    const response = await fetch(`/api/paypal/check-status?${queryParams.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to query order status.');
    }
    return response.json();
  }
};
