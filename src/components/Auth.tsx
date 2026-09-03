import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Profile } from '../types';
import { Mail, Lock, User, Phone, Globe, ChevronLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';

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
  const [phone, setPhone] = useState('');
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
        if (!fullName || !email || !password) {
          setError('Please fill in all required fields.');
          setLoading(false);
          return;
        }
        const { user, error: registerError } = await dataService.auth.signUp(
          email,
          password,
          fullName,
          phone,
          country,
          timezone
        );
        if (registerError) {
          setError(registerError);
        } else if (user) {
          setSuccessMsg('Account created successfully! Logging you in...');
          setTimeout(() => {
            onSuccess(user);
          }, 1500);
        }
      } else {
        // Forgot password flow
        if (!email) {
          setError('Please provide your email address.');
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
    <div className="flex items-center justify-center min-h-screen dot-grid text-white px-4 py-8 font-sans">
      <div className="w-full max-w-[420px] bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl relative transition-all duration-300">
        
        {/* Back navigation */}
        <button
          onClick={() => {
            if (mode !== 'signin') {
              setMode('signin');
              setError(null);
              setSuccessMsg(null);
            } else if (onBackToOnboarding) {
              onBackToOnboarding();
            }
          }}
          className="absolute top-6 left-6 p-2 rounded-full border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-white active:translate-y-0.5 transition-all cursor-pointer"
          aria-label="Go back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Logo and Brand Header */}
        <div className="text-center mt-12 mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800 mb-3 shadow-lg">
            <span className="text-[#0A9D8F] font-extrabold text-xl">I</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">
            Ingenium Tech Academy
          </h1>
          <p className="text-xs font-semibold text-zinc-400 mt-1 uppercase tracking-widest">
            {mode === 'signin' && 'Welcome Back'}
            {mode === 'signup' && 'Student Registration'}
            {mode === 'forgot' && 'Reset Password'}
          </p>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/20 border border-red-900/50 rounded-xl text-xs font-semibold text-red-400 flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0"></span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-xl text-xs font-semibold text-[#0A9D8F] flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-[#0A9D8F] shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {mode === 'signup' && (
            <>
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="E.g. John Doe"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:border-[#0A9D8F] focus:ring-1 focus:ring-[#0A9D8F]/30 focus:outline-none transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Phone Number (WhatsApp Preferred)</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="E.g. +234 803 123 4567"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:border-[#0A9D8F] focus:ring-1 focus:ring-[#0A9D8F]/30 focus:outline-none transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Country & Timezone Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="E.g. Nigeria"
                    className="w-full px-4 py-3 text-sm bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:border-[#0A9D8F] focus:ring-1 focus:ring-[#0A9D8F]/30 focus:outline-none transition-all font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-3 text-sm bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:border-[#0A9D8F] focus:ring-1 focus:ring-[#0A9D8F]/30 focus:outline-none transition-all font-bold"
                  >
                    <option value="Africa/Lagos">Africa/Lagos</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Chicago">America/Chicago</option>
                    <option value="Asia/Dubai">Asia/Dubai</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1.5">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E.g. student@example.com"
                className="w-full pl-10 pr-4 py-3 text-sm bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:border-[#0A9D8F] focus:ring-1 focus:ring-[#0A9D8F]/30 focus:outline-none transition-all font-semibold"
              />
            </div>
          </div>

          {/* Password (only for Signin and Signup) */}
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-zinc-400">Password *</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs font-bold text-[#0A9D8F] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-12 py-3 text-sm bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:border-[#0A9D8F] focus:ring-1 focus:ring-[#0A9D8F]/30 focus:outline-none transition-all font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors cursor-pointer p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white font-extrabold text-sm border border-zinc-800 shadow-lg active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait...' : (
              mode === 'signin' ? 'Sign In' : 
              mode === 'signup' ? 'Register Account' : 
              'Send Instructions'
            )}
          </button>
        </form>

        {/* Mode Switchers */}
        <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
          {mode === 'signin' ? (
            <p className="text-xs font-semibold text-zinc-400">
              New to Ingenium?{' '}
              <button
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-white font-black hover:underline cursor-pointer"
              >
                Create an Account
              </button>
            </p>
          ) : (
            <p className="text-xs font-semibold text-zinc-400">
              Already have an account?{' '}
              <button
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-white font-black hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
