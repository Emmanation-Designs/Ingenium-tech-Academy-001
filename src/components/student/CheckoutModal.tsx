import React, { useState } from 'react';
import { Course, CourseSchedule, CourseSelection, Profile } from '../../types';
import { wittypayService } from '../../services/wittypayService';
import { 
  CreditCard, ShieldCheck, Check, AlertCircle, Loader2, 
  ChevronLeft, ExternalLink, Lock, CheckCircle2, ArrowRight
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';

interface CheckoutModalProps {
  currentUser: Profile;
  courses: Course[];
  selections: CourseSelection[];
  onClose: () => void;
  onSuccess: (orderId: string) => void;
  singleCourse?: {
    course: Course;
    scheduleId?: string;
    scheduleLabel?: string;
  };
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  currentUser,
  courses,
  selections,
  onClose,
  onSuccess,
  singleCourse
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<{
    orderId: string;
    orderNumber: string;
    checkoutUrl: string;
    amount: number;
  } | null>(null);

  // Prepare items for checkout (either single course or all pending selections)
  const checkoutItems = React.useMemo(() => {
    if (singleCourse) {
      const pricing = singleCourse.course.pricing;
      const unitPrice = pricing?.ngn_price ? Number(pricing.ngn_price) : 120000;
      return [{
        courseId: singleCourse.course.id,
        scheduleId: singleCourse.scheduleId,
        courseTitle: singleCourse.course.title,
        scheduleLabel: singleCourse.scheduleLabel || 'Standard Schedule',
        unitPrice,
        currency: 'NGN'
      }];
    }

    // From selections: gather pending ones
    const pending = selections.filter(s => s.status === 'pending');
    return pending.map(sel => {
      const c = courses.find(course => course.id === sel.course_id);
      const pricing = c?.pricing;
      const unitPrice = pricing?.ngn_price 
        ? Number(pricing.ngn_price) 
        : (sel.price_snapshot && sel.currency_snapshot === 'NGN' ? Number(sel.price_snapshot) : 120000);

      return {
        courseId: sel.course_id,
        scheduleId: sel.schedule_id || undefined,
        selectionId: sel.id,
        courseTitle: sel.course_title || c?.title || 'Selected Course',
        scheduleLabel: sel.schedule_label || 'Standard Schedule',
        unitPrice,
        currency: 'NGN'
      };
    });
  }, [singleCourse, selections, courses]);

  const totalAmount = checkoutItems.reduce((acc, item) => acc + item.unitPrice, 0);

  const handleInitiatePayment = async () => {
    if (checkoutItems.length === 0) {
      setError("No courses selected for payment.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await wittypayService.initiateCheckout({
        studentId: currentUser.id,
        studentEmail: currentUser.email,
        studentName: currentUser.full_name,
        items: checkoutItems,
      });

      setCheckoutResult({
        orderId: result.order_id,
        orderNumber: result.order_number,
        checkoutUrl: result.checkout_url,
        amount: result.amount
      });

    } catch (err: any) {
      console.error('[Checkout] Error initiating payment:', err);
      setError(err.message || 'Unable to start checkout with Wittypay. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToGateway = () => {
    if (checkoutResult?.checkoutUrl) {
      // Open checkout URL in new window or redirect
      window.location.href = checkoutResult.checkoutUrl;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="xs" showText={true} showSubtitle={false} />
            <span className="text-xs text-zinc-400 font-medium">|</span>
            <span className="text-xs font-bold text-zinc-800">Automatic Course Checkout</span>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-full hover:bg-zinc-200/60 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Checkout Notice</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {checkoutResult ? (
            /* Gateway Ready Screen */
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900">Order #{checkoutResult.orderNumber} Created</h3>
                <p className="text-xs text-zinc-500">
                  Total Payable: <strong className="text-zinc-900 font-bold">₦{checkoutResult.amount.toLocaleString()} NGN</strong>
                </p>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-sm mx-auto">
                  Click below to proceed to the secure Wittypay payment gateway. Your admission and classroom access will activate automatically upon payment confirmation.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleProceedToGateway}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white font-semibold text-sm transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Pay Now with Wittypay</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Order Summary Review */
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Courses in Order</h3>
                  <span className="text-[11px] font-semibold text-zinc-500">{checkoutItems.length} course(s)</span>
                </div>

                <div className="divide-y divide-zinc-100 border border-zinc-200/80 rounded-2xl overflow-hidden bg-white">
                  {checkoutItems.map((item, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-zinc-900">{item.courseTitle}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{item.scheduleLabel}</p>
                      </div>
                      <div className="text-right font-bold text-[#0A9D8F]">
                        ₦{item.unitPrice.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-4 bg-[#E6F5F4]/60 border border-[#0A9D8F]/20 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-700 block">Total Due (NGN)</span>
                  <span className="text-[10px] text-zinc-400">Wittypay processes in Nigerian Naira (NGN)</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-[#087A6F]">
                    ₦{totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Student Details snapshot */}
              <div className="p-3.5 bg-zinc-50 border border-zinc-100 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Student:</span>
                  <span className="font-semibold text-zinc-800">{currentUser.full_name || 'Student'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Email:</span>
                  <span className="font-semibold text-zinc-800">{currentUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Gateway:</span>
                  <span className="font-semibold text-zinc-800">Wittypay Automatic Checkout</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleInitiatePayment}
                disabled={loading || checkoutItems.length === 0}
                className="w-full py-3.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white font-semibold text-sm transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Secure Checkout...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Proceed to Wittypay Payment</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
                <Lock className="w-3 h-3 text-[#0A9D8F]" />
                <span>256-bit encrypted checkout. Instant course access upon payment.</span>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
