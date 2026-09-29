import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Profile } from '../types';
import {
  Mail,
  Lock,
  User,
  Globe,
  ChevronLeft,
  CheckCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  AlertCircle,
  Loader2,
  Clock
} from 'lucide-react';
import { BrandLogo } from './common/BrandLogo';
import { formatCapitalizedName, sanitizeCapitalizedInput } from '../utils/nameFormatter';

interface AuthProps {
  onSuccess: (user: Profile) => void;
  onBackToOnboarding?: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onSuccess, onBackToOnboarding }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [timezone, setTimezone] = useState('Africa/Lagos');

  // Status handlers
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-detect timezone
  useEffect(() => {
    try {
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detectedTz) {
        setTimezone(detectedTz);
      }
    } catch {
      // Fallback
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { user, error: loginError } = await dataService.auth.signIn(email, password);
        if (loginError) {
          setError(loginError);
        } else if (user) {
          onSuccess(user);
        }
      } else if (mode === 'signup') {
        const cleanFullName = formatCapitalizedName(fullName, 'Student');
        if (!cleanFullName || !email || !password) {
          setError('Please fill in all required fields.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }

        const { user, error: registerError } = await dataService.auth.signUp(
          email,
          password,
          cleanFullName,
          '',
          country,
          timezone
        );
        if (registerError) {
          setError(registerError);
        } else if (user) {
          setSuccessMsg('Account created successfully! Welcome to Ingenium Tech Academy.');
          setTimeout(() => {
            onSuccess(user);
          }, 1200);
        }
      } else {
        // Forgot password flow
        if (!email) {
          setError('Please enter your email address.');
          setLoading(false);
          return;
        }
        const { success, error: resetError } = await dataService.auth.forgotPassword(email);
        if (resetError) {
          setError(resetError);
        } else if (success) {
          setSuccessMsg('Password reset instructions have been sent to your email.');
          setEmail('');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F6F8] sm:bg-[#EDF2F0] flex items-center justify-center p-0 sm:p-4 md:p-6 select-none font-sans overflow-x-hidden">
      {/* Mobile/Desktop Card Frame */}
      <div className="w-full max-w-[460px] min-h-screen sm:min-h-auto bg-white sm:rounded-[36px] sm:shadow-2xl sm:border sm:border-[#0A9D8F]/15 flex flex-col justify-between relative overflow-hidden transition-all duration-300">
        
        {/* CORNER ORGANIC BRAND WAVES (TOP-LEFT) */}
        <svg
          className="absolute top-0 left-0 w-36 sm:w-44 h-36 sm:h-44 pointer-events-none z-0"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 0 0 L 150 0 C 120 70 60 110 0 130 Z"
            fill="#10B981"
            fillOpacity="0.2"
          />
          <path
            d="M 0 0 L 120 0 C 100 60 50 90 0 100 Z"
            fill="#0A9D8F"
            fillOpacity="0.45"
          />
          <path
            d="M 0 0 L 85 0 C 75 45 40 70 0 80 Z"
            fill="#0A9D8F"
          />
          <path
            d="M 0 145 C 70 125 135 75 160 0"
            stroke="#0A9D8F"
            strokeWidth="1.5"
            strokeOpacity="0.35"
            fill="none"
          />
        </svg>

        {/* CORNER ORGANIC BRAND WAVES (BOTTOM-RIGHT) */}
        <svg
          className="absolute bottom-0 right-0 w-40 sm:w-52 h-40 sm:h-52 pointer-events-none z-0"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="160"
            cy="160"
            r="90"
            fill="#E6F5F4"
            fillOpacity="0.8"
          />
          <path
            d="M 200 200 L 200 80 C 130 95 85 145 70 200 Z"
            fill="#10B981"
            fillOpacity="0.25"
          />
          <path
            d="M 200 200 L 200 115 C 150 130 115 165 105 200 Z"
            fill="#0A9D8F"
          />
          <path
            d="M 200 200 L 200 140 C 165 150 140 175 130 200 Z"
            fill="#065F56"
          />
          <path
            d="M 50 200 C 70 130 130 70 200 50"
            stroke="#0A9D8F"
            strokeWidth="1.5"
            strokeOpacity="0.35"
            fill="none"
          />
        </svg>

        {/* TOP HEADER: Navigation & Logo */}
        <div className="relative z-10 pt-6 sm:pt-8 px-6 sm:px-8">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <button
              type="button"
              onClick={() => {
                if (mode !== 'signin') {
                  setMode('signin');
                  setError(null);
                  setSuccessMsg(null);
                } else if (onBackToOnboarding) {
                  onBackToOnboarding();
                }
              }}
              className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200/80 text-gray-700 hover:text-gray-950 hover:bg-gray-100 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5 -ml-0.5" />
            </button>

            {/* Brand Logo Centered */}
            <div className="flex items-center gap-2.5">
              <BrandLogo iconOnly size={36} className="shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-xl font-black text-gray-950 tracking-tight leading-none">
                  Ingenium
                </span>
                <span className="text-[11px] font-bold text-[#0A9D8F] tracking-normal leading-tight mt-0.5">
                  Tech Academy
                </span>
              </div>
            </div>

            {/* Balancer Spacer */}
            <div className="w-9"></div>
          </div>
        </div>

        {/* MAIN BODY */}
        <div className="relative z-10 flex-1 px-6 sm:px-8 pt-5 pb-6">
          
          {/* Segmented Mode Toggle (Sign In / Create Account) */}
          {mode !== 'forgot' && (
            <div className="flex p-1 bg-gray-100/90 rounded-full border border-gray-200/70 w-full max-w-[300px] mx-auto mb-5 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-[#0A9D8F] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-950'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-[#0A9D8F] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-950'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Headline & Subtitle */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-950 tracking-tight leading-tight">
              {mode === 'signin' && (
                <>
                  <span>Welcome </span>
                  <span className="text-[#0A9D8F]">back</span>
                </>
              )}
              {mode === 'signup' && (
                <>
                  <span>Join our </span>
                  <span className="text-[#0A9D8F]">academy</span>
                </>
              )}
              {mode === 'forgot' && (
                <>
                  <span>Reset your </span>
                  <span className="text-[#0A9D8F]">password</span>
                </>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1.5 max-w-[320px] mx-auto leading-relaxed">
              {mode === 'signin' && 'Enter your credentials to access your courses, classroom, and dashboard.'}
              {mode === 'signup' && 'Create your student account to enroll in world-class tech training.'}
              {mode === 'forgot' && 'Enter your email address and we will send recovery instructions.'}
            </p>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-start gap-2.5 shadow-2xs animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 bg-[#E6F5F4] border border-[#0A9D8F]/30 rounded-2xl text-xs font-semibold text-[#065F56] flex items-start gap-2.5 shadow-2xs animate-fade-in">
              <CheckCircle className="w-4 h-4 text-[#0A9D8F] shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* SIGNUP: Full Name */}
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">
                  Full Name <span className="text-[#0A9D8F]">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(sanitizeCapitalizedInput(e.target.value))}
                    placeholder="E.g. Sarah Jenkins"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-gray-50/70 hover:bg-white focus:bg-white border border-gray-200 focus:border-[#0A9D8F] focus:ring-4 focus:ring-[#0A9D8F]/10 rounded-2xl text-gray-900 placeholder-gray-400 font-medium transition-all outline-none"
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700">
                Email Address <span className="text-[#0A9D8F]">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full pl-10 pr-4 py-3 text-sm bg-gray-50/70 hover:bg-white focus:bg-white border border-gray-200 focus:border-[#0A9D8F] focus:ring-4 focus:ring-[#0A9D8F]/10 rounded-2xl text-gray-900 placeholder-gray-400 font-medium transition-all outline-none"
                />
              </div>
            </div>

            {/* SIGNUP: Country & Timezone */}
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">Country</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Nigeria"
                      className="w-full pl-8 pr-3 py-2.5 text-xs bg-gray-50/70 hover:bg-white focus:bg-white border border-gray-200 focus:border-[#0A9D8F] focus:ring-4 focus:ring-[#0A9D8F]/10 rounded-xl text-gray-900 font-medium transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">Timezone</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 text-xs bg-gray-50/70 hover:bg-white focus:bg-white border border-gray-200 focus:border-[#0A9D8F] focus:ring-4 focus:ring-[#0A9D8F]/10 rounded-xl text-gray-900 font-bold transition-all outline-none"
                    >
                      <option value="Africa/Lagos">Africa/Lagos</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="America/Chicago">America/Chicago</option>
                      <option value="Asia/Dubai">Asia/Dubai</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Password (for Sign In & Sign Up) */}
            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-700">
                    Password <span className="text-[#0A9D8F]">*</span>
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs font-bold text-[#0A9D8F] hover:text-[#088276] hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-10 pr-11 py-3 text-sm bg-gray-50/70 hover:bg-white focus:bg-white border border-gray-200 focus:border-[#0A9D8F] focus:ring-4 focus:ring-[#0A9D8F]/10 rounded-2xl text-gray-900 placeholder-gray-400 font-medium transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1.5 cursor-pointer rounded-lg hover:bg-gray-100"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Rich Value Prop Callout in Signup mode */}
            {mode === 'signup' && (
              <div className="bg-[#E6F5F4]/80 border border-[#0A9D8F]/25 rounded-2xl p-3 flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-[#0A9D8F] shrink-0" />
                <p className="text-[11px] text-[#065F56] font-medium leading-snug">
                  Includes live mentoring, hands-on lab access, and verifiable graduation credentials.
                </p>
              </div>
            )}

            {/* Action CTA Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-4 px-6 rounded-full bg-[#0A9D8F] hover:bg-[#088276] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-[#0A9D8F]/25 flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === 'signin' && 'Sign In'}
                    {mode === 'signup' && 'Create Student Account'}
                    {mode === 'forgot' && 'Send Recovery Link'}
                  </span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Security and Trust Footer Banner */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-gray-400">
            <ShieldCheck className="w-4 h-4 text-[#0A9D8F]" />
            <span>256-bit SSL encrypted · Secure Ingenium Authentication</span>
          </div>
        </div>

        {/* BOTTOM FOOTER LINK */}
        <div className="relative z-10 px-6 sm:px-8 pb-7 pt-2 text-center border-t border-gray-100 bg-gray-50/50">
          {mode === 'signin' && (
            <p className="text-xs sm:text-sm text-gray-600 font-medium">
              New to Ingenium?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-[#0A9D8F] font-bold underline underline-offset-4 hover:text-[#088276] cursor-pointer transition-colors"
              >
                Create an Account
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p className="text-xs sm:text-sm text-gray-600 font-medium">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-[#0A9D8F] font-bold underline underline-offset-4 hover:text-[#088276] cursor-pointer transition-colors"
              >
                Sign In
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <p className="text-xs sm:text-sm text-gray-600 font-medium">
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-[#0A9D8F] font-bold underline underline-offset-4 hover:text-[#088276] cursor-pointer transition-colors"
              >
                Back to Sign In
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
export default Auth;
