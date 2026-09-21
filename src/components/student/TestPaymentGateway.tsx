import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';

export const TestPaymentGateway: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order_id') || '';
  const ref = urlParams.get('ref') || '';
  const amount = urlParams.get('amount') || '120000';

  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulateWebhook = async (status: 'success' | 'failed') => {
    try {
      setProcessing(true);
      setError(null);
      setStatusMessage(`Submitting payment ${status} event to Wittypay webhook...`);

      const webhookPayload = {
        event: status === 'success' ? 'payment.success' : 'payment.failed',
        reference: ref,
        status: status,
        amount: Number(amount),
        currency: 'NGN',
        metadata: {
          order_id: orderId,
          reference: ref
        },
        data: {
          reference: ref,
          status: status,
          amount: Number(amount),
          channel: 'card',
          paid_at: new Date().toISOString()
        }
      };

      const res = await fetch('/api/wittypay/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!res.ok) {
        throw new Error('Webhook rejected event.');
      }

      setStatusMessage(status === 'success' 
        ? 'Payment successfully verified! Your classroom access has been automatically activated.' 
        : 'Payment was marked as failed.'
      );

      // Redirect back to student classroom after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 1800);

    } catch (err: any) {
      setError(err.message || 'Error executing webhook simulation.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-zinc-200 space-y-6">
        <div className="text-center space-y-2">
          <BrandLogo size="sm" showText={true} className="mx-auto" />
          <h2 className="text-lg font-bold text-zinc-900 pt-2">Wittypay Gateway Simulator</h2>
          <p className="text-xs text-zinc-500">
            Ingenium Tech Academy Wittypay Sandbox Test Environment
          </p>
        </div>

        <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-500">Order Reference:</span>
            <span className="font-bold text-zinc-800 truncate max-w-[200px]">{ref || orderId || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Amount Due:</span>
            <span className="font-bold text-[#0A9D8F]">₦{Number(amount).toLocaleString()} NGN</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Mode:</span>
            <span className="font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Test / Sandbox</span>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {statusMessage && (
          <div className="p-3.5 bg-emerald-50 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="space-y-2.5">
          <button
            onClick={() => handleSimulateWebhook('success')}
            disabled={processing}
            className="w-full py-3.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white font-semibold text-xs transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Webhook...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Simulate Successful Payment (Instant Enrollment)</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleSimulateWebhook('failed')}
            disabled={processing}
            className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-xs transition-all cursor-pointer disabled:opacity-50"
          >
            Simulate Failed Payment
          </button>

          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-2 text-zinc-400 hover:text-zinc-600 text-xs text-center"
          >
            Cancel and return to Academy
          </button>
        </div>
      </div>
    </div>
  );
};
