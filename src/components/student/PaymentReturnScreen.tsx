import React, { useState, useEffect } from 'react';
import { BrandLogo } from '../common/BrandLogo';
import { 
  CheckCircle2, Clock, XCircle, Loader2, ArrowRight, 
  RefreshCw, BookOpen, ShieldCheck, Home
} from 'lucide-react';

interface PaymentReturnScreenProps {
  onContinueToApp?: () => void;
}

export const PaymentReturnScreen: React.FC<PaymentReturnScreenProps> = ({
  onContinueToApp
}) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'pending' | 'completed' | 'failed' | 'cancelled' | 'not_found'>('pending');
  const [orderData, setOrderData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getParams = () => {
    try {
      const url = new URL(window.location.href);
      const orderId = url.searchParams.get('order_id') || '';
      const ref = url.searchParams.get('ref') || url.searchParams.get('reference') || '';
      const gateway = url.searchParams.get('gateway') || '';
      const token = url.searchParams.get('token') || ''; // PayPal order ID
      const payerId = url.searchParams.get('PayerID') || '';
      const urlStatus = url.searchParams.get('status') || '';
      return { orderId, ref, gateway, token, payerId, urlStatus };
    } catch (e) {
      return { orderId: '', ref: '', gateway: '', token: '', payerId: '', urlStatus: '' };
    }
  };

  const { orderId, ref, gateway, token, payerId, urlStatus } = getParams();
  const isPayPal = gateway === 'paypal' || Boolean(token) || Boolean(payerId);
  const gatewayName = isPayPal ? 'PayPal' : 'Wittypay';

  const verifyPayment = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      if (!orderId && !ref && !token) {
        setStatus('not_found');
        setLoading(false);
        return;
      }

      // If user cancelled directly on PayPal hosted checkout
      if (urlStatus === 'cancelled') {
        setStatus('cancelled');
        if (isPayPal && (orderId || token)) {
          // Inform backend to record cancellation idempotently
          await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, paypalOrderId: token, status: 'cancelled' })
          }).catch(() => {});
        }
        setLoading(false);
        return;
      }

      if (isPayPal) {
        // Authoritatively capture & verify PayPal payment server-side
        const response = await fetch('/api/paypal/capture-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderId || undefined,
            paypalOrderId: token || undefined,
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          if (data.status === 'cancelled') {
            setStatus('cancelled');
          } else {
            setStatus('failed');
            setErrorMessage(data.error || 'PayPal payment could not be verified.');
          }
          setOrderData(data);
          return;
        }

        setOrderData(data);
        if (data.status === 'completed') {
          setStatus('completed');
        } else {
          setStatus('pending');
        }

      } else {
        // Wittypay flow: Query server-side check-status
        const queryParams = new URLSearchParams();
        if (orderId) queryParams.set('order_id', orderId);
        if (ref) queryParams.set('ref', ref);

        const response = await fetch(`/api/wittypay/check-status?${queryParams.toString()}`);
        if (!response.ok) {
          if (response.status === 404) {
            setStatus('not_found');
            return;
          }
          throw new Error('Unable to verify order status with academy server.');
        }

        const data = await response.json();
        setOrderData(data);

        if (data.status === 'completed') {
          setStatus('completed');
        } else if (data.status === 'failed') {
          setStatus('failed');
        } else {
          setStatus('pending');
        }
      }

    } catch (err: any) {
      console.warn(`[Payment Return] Status check warning:`, err.message);
      setErrorMessage(err.message || 'Error communicating with academy verification service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyPayment();

    // Auto-poll up to 3 times every 4 seconds if still pending
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (attempts <= 3 && status === 'pending') {
        verifyPayment();
      } else {
        clearInterval(interval);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleGoHome = () => {
    if (onContinueToApp) {
      onContinueToApp();
    } else {
      window.location.href = '/';
    }
  };

  const getCurrencySymbol = (currency?: string) => {
    if (currency === 'EUR') return '€';
    if (currency === 'USD') return '$';
    return '₦';
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100/80 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Academy Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2 pb-2">
          <BrandLogo size="md" showText={true} />
          <p className="text-[11px] font-semibold text-[#0A9D8F] tracking-wide uppercase mt-1">
            Payment Verification & Enrollment
          </p>
        </div>

        {/* State Display */}
        {loading ? (
          <div className="py-8 flex flex-col items-center text-center space-y-3">
            <Loader2 className="w-10 h-10 text-[#0A9D8F] animate-spin" />
            <h3 className="text-sm font-bold text-gray-900">Verifying {gatewayName} Payment...</h3>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              Confirming transaction status with the payment gateway server-side. Please hold on.
            </p>
          </div>
        ) : status === 'completed' ? (
          /* Payment Completed & Verified */
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">Payment Verified & Course Enrolled!</h3>
              <p className="text-xs text-emerald-700 font-medium">
                Admission is complete. Your classroom access is active.
              </p>
            </div>

            {orderData && (
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-gray-500">Order Reference:</span>
                  <span className="font-mono font-bold text-gray-800">{orderData.order_number || ref || token}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Gateway:</span>
                  <span className="font-semibold text-gray-800">{isPayPal ? 'PayPal Live' : 'Wittypay'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Amount Paid:</span>
                  <span className="font-bold text-[#0A9D8F]">
                    {getCurrencySymbol(orderData.currency)}{Number(orderData.total_amount || 0).toLocaleString()} {orderData.currency}
                  </span>
                </div>
                {orderData.items && orderData.items.length > 0 && (
                  <div className="pt-2 border-t border-gray-200/60">
                    <p className="text-[11px] font-semibold text-gray-500 mb-1">Enrolled Courses:</p>
                    {orderData.items.map((it: any, idx: number) => (
                      <p key={idx} className="text-gray-800 font-medium truncate">• {it.course_title}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleGoHome}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white font-semibold text-xs transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Go to My Learning & Classroom</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : status === 'pending' ? (
          /* Payment Pending Gateway Confirmation */
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100 shadow-xs">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">Awaiting Gateway Confirmation</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                Your transaction has been submitted to {gatewayName}. Course access activates automatically as soon as final confirmation is registered.
              </p>
            </div>

            {(ref || token) && (
              <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-[11px] text-zinc-500 flex justify-between">
                <span>Reference:</span>
                <span className="font-mono font-semibold text-zinc-800">{token || ref}</span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                onClick={verifyPayment}
                className="w-full py-3 px-4 rounded-xl border border-[#0A9D8F] text-[#0A9D8F] hover:bg-[#E6F5F4]/60 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Confirmation Again</span>
              </button>

              <button
                onClick={handleGoHome}
                className="w-full py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return to Student Dashboard</span>
              </button>
            </div>
          </div>
        ) : status === 'cancelled' ? (
          /* Payment Cancelled */
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100 shadow-xs">
              <XCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">Payment Cancelled</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                The checkout session was cancelled. No charges were captured, and course access was not granted.
              </p>
            </div>

            <button
              onClick={handleGoHome}
              className="w-full py-3.5 px-4 rounded-xl bg-gray-900 hover:bg-black text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Return to Course Catalog</span>
            </button>
          </div>
        ) : (
          /* Payment Failed or Not Found */
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100 shadow-xs">
              <XCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">Payment Not Completed</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                {errorMessage || `The payment session was either cancelled or could not be completed on ${gatewayName}. No charges were captured for course enrollment.`}
              </p>
            </div>

            <button
              onClick={handleGoHome}
              className="w-full py-3.5 px-4 rounded-xl bg-gray-900 hover:bg-black text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Return to Course Catalog</span>
            </button>
          </div>
        )}

        {/* Security badge footer */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0A9D8F]" />
          <span>Ingenium Tech Academy • Official Payment Gateway Integration</span>
        </div>

      </div>
    </div>
  );
};
