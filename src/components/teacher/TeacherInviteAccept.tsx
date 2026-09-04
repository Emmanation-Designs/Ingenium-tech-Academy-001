import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, Mail, Lock, User, Phone, Globe, 
  CheckCircle, AlertCircle, Loader2, ArrowRight, Check
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { Profile } from '../../types';

interface TeacherInviteAcceptProps {
  token: string;
  currentUser?: Profile | null;
  onSuccess: (profile: Profile) => void;
  onGoToSignIn: () => void;
  onContinueToDashboard?: () => void;
}

export const TeacherInviteAccept: React.FC<TeacherInviteAcceptProps> = ({
  token,
  currentUser,
  onSuccess,
  onGoToSignIn,
  onContinueToDashboard
}) => {
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [invitationData, setInvitationData] = useState<{
    valid: boolean;
    invited_email?: string;
    reason?: string;
    message?: string;
  } | null>(null);

  // Form mode: 'register' (new teacher) or 'existing_login' (existing user claiming invite)
  const [mode, setMode] = useState<'register' | 'existing_login'>('register');

  // Form fields
  const [fullName, setFullName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('Africa/Lagos');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Validate token on mount
  useEffect(() => {
    let isMounted = true;
    const validateToken = async () => {
      setIsValidating(true);
      setErrorMsg(null);
      try {
        const res = await dataService.teacherInvitations.validateInvitation(token);
        if (isMounted) {
          setInvitationData(res);
        }
      } catch (err: any) {
        if (isMounted) {
          setInvitationData({
            valid: false,
            reason: 'error',
            message: err.message || 'Failed to validate invitation.'
          });
        }
      } finally {
        if (isMounted) setIsValidating(false);
      }
    };

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // 2. Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationData?.invited_email) return;
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await dataService.auth.signUpTeacherWithInvite(
        token,
        invitationData.invited_email,
        password,
        fullName,
        phone,
        'Nigeria',
        timezone
      );

      if (result.error || !result.user) {
        setErrorMsg(result.error || 'Failed to complete teacher registration.');
        setIsSubmitting(false);
        return;
      }

      onSuccess(result.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  // 3. Handle Existing User Login to Claim Invite
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationData?.invited_email) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const result = await dataService.auth.signInTeacherWithInvite(
        token,
        invitationData.invited_email,
        password
      );

      if (result.error || !result.user) {
        setErrorMsg(result.error || 'Failed to sign in and claim invitation.');
        setIsSubmitting(false);
        return;
      }

      onSuccess(result.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during sign in.');
      setIsSubmitting(false);
    }
  };

  // Loading State
  if (isValidating) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans text-gray-900">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm max-w-sm w-full text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#0A9D8F] animate-spin mx-auto" />
          <h3 className="text-sm font-bold text-gray-950">Validating Teacher Invitation</h3>
          <p className="text-xs text-gray-500">Checking credentials with Ingenium Tech Academy...</p>
        </div>
      </div>
    );
  }

  // Invalid / Expired / Revoked / Claimed State
  if (!invitationData?.valid) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans text-gray-900">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center mx-auto border border-zinc-200">
            <AlertCircle className="w-6 h-6 stroke-[2]" />
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-950">Invalid or Expired Invitation</h2>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              {invitationData?.message || 'This teacher invitation is not recognized or has expired.'}
            </p>
          </div>

          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-[11px] text-gray-600 text-left space-y-1">
            <p className="font-semibold text-gray-900">Next steps:</p>
            <p>• If you believe this is an error, please reach out to the Ingenium Tech Academy administration to generate a new invitation.</p>
            <p>• Teacher accounts can only be activated through verified invitations.</p>
          </div>

          <button
            type="button"
            onClick={currentUser && onContinueToDashboard ? onContinueToDashboard : onGoToSignIn}
            className="w-full py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
          >
            {currentUser && onContinueToDashboard ? 'Return to Dashboard' : 'Return to Sign In'}
          </button>
        </div>
      </div>
    );
  }

  // Valid Invitation Registration Screen
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans text-gray-900">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-lg max-w-md w-full overflow-hidden">
        
        {/* Top Header Banner */}
        <div className="bg-zinc-950 p-6 text-white text-center space-y-2 relative">
          <div className="w-12 h-12 rounded-2xl bg-[#0A9D8F] text-white flex items-center justify-center mx-auto shadow-sm">
            <GraduationCap className="w-6 h-6 stroke-[2]" />
          </div>
          <h1 className="text-sm font-extrabold uppercase tracking-wider text-white">
            Ingenium Tech Academy
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-[11px] font-bold border border-white/20">
            <Check className="w-3 h-3 text-[#0A9D8F]" />
            <span>Verified Teacher Invitation</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-gray-950">
              {mode === 'register' ? 'Set Up Instructor Account' : 'Claim Invitation with Existing Account'}
            </h2>
            <p className="text-xs text-gray-500">
              Complete your profile to access your classes, cohort schedules, and live Google Meet sessions.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Bound Email Notice */}
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Invitation Issued To (Locked)
            </span>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-950">
              <Mail className="w-4 h-4 text-[#0A9D8F]" />
              <span>{invitationData.invited_email}</span>
            </div>
            <p className="text-[10px] text-gray-500">
              For security, this teacher invitation is strictly bound to this address.
            </p>
          </div>

          {/* Current User Session Handling */}
          {currentUser && (
            currentUser.email?.toLowerCase().trim() === invitationData.invited_email?.toLowerCase().trim() ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Signed in as {currentUser.email}</span>
                </div>
                <p className="text-xs text-emerald-700">
                  You are already logged into this account. Click below to activate your teacher privileges and open your instructor workspace.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    setIsSubmitting(true);
                    setErrorMsg(null);
                    try {
                      const res = await dataService.teacherInvitations.claimInvitation(token, currentUser.id);
                      if (!res.success) {
                        setErrorMsg(res.message || 'Failed to activate teacher account.');
                        setIsSubmitting(false);
                        return;
                      }
                      const updated = await dataService.auth.getCurrentUser();
                      if (updated) {
                        onSuccess(updated);
                      } else {
                        onSuccess({ ...currentUser, role: 'teacher' });
                      }
                    } catch (e: any) {
                      setErrorMsg(e.message || 'Failed to activate teacher account.');
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#0A9D8F]/90 transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                  <span>Accept & Activate Teacher Role</span>
                </button>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Currently Signed In: {currentUser.email}</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  This invitation is strictly bound to <strong>{invitationData.invited_email}</strong>. To accept it, please sign out of your current account.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await dataService.auth.signOut();
                      window.location.reload();
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors cursor-pointer text-center"
                  >
                    Sign Out to Accept
                  </button>
                  {onContinueToDashboard && (
                    <button
                      type="button"
                      onClick={onContinueToDashboard}
                      className="py-2 px-3 rounded-xl border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer text-center"
                    >
                      Return to Dashboard
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {!currentUser && (mode === 'register' ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Ada Lovelace"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0A9D8F] focus:ring-1 focus:ring-[#0A9D8F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Create Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0A9D8F] focus:ring-1 focus:ring-[#0A9D8F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0A9D8F] focus:ring-1 focus:ring-[#0A9D8F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="+234..."
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    Timezone
                  </label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={timezone}
                      onChange={e => setTimezone(e.target.value)}
                      className="w-full pl-8 pr-2 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                    >
                      <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                      <option value="UTC">UTC / GMT</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !fullName.trim() || !password}
                className="w-full py-3 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#0A9D8F]/90 transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Activate Teacher Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setMode('existing_login')}
                  className="text-xs text-[#0A9D8F] font-bold hover:underline cursor-pointer"
                >
                  Already have an Ingenium account with this email? Sign in to claim
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Enter Password for {invitationData.invited_email}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Enter your existing password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !password}
                className="w-full py-3 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#0A9D8F]/90 transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in & Activating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In & Activate Teacher Role</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs text-gray-600 font-bold hover:underline cursor-pointer"
                >
                  Need to create a new password? Switch back
                </button>
              </div>
            </form>
          ))}

          <div className="pt-3 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={onGoToSignIn}
              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Cancel and return to standard Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
