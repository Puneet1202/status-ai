import React, { useState } from 'react';
import { useAppState } from '../lib/app-state';
import { API_BASE_URL } from '../lib/api';

// OTP login — aligned to the production backend (no passwords).
//   Step 1 (email):  POST /api/auth/request-otp  → a 6-digit code is emailed.
//   Step 2 (code):   POST /api/auth/verify-otp   → { user, token } → login().
type Step = 'email' | 'code';

export const AuthScreen: React.FC = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAppState();

  const post = async (path: string, body: object) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'Something went wrong. Please try again.');
    }
    return data;
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await post('/api/auth/request-otp', { email: email.trim() });
      setInfo('We sent a 6-digit code to your email. It expires in 10 minutes.');
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Could not send the code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await post('/api/auth/verify-otp', { email: email.trim(), otp: otp.trim() });
      if (data.user && data.token) {
        login(data.user, data.token);
      } else {
        throw new Error('Unexpected response from server.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const resetToEmail = () => {
    setStep('email');
    setOtp('');
    setError('');
    setInfo('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            {step === 'email' ? 'Sign In' : 'Enter Code'}
          </h2>
          <p className="text-slate-400">
            {step === 'email'
              ? 'Enter your work email and we’ll send you a login code'
              : `We sent a code to ${email}`}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg mb-6 text-sm bg-rose-500/10 border border-rose-500/50 text-rose-400">
            {error}
          </div>
        )}
        {info && !error && (
          <div className="p-3 rounded-lg mb-6 text-sm bg-emerald-500/10 border border-emerald-500/50 text-emerald-400">
            {info}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="name@company.com"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg px-4 py-2.5 mt-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Send Login Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">6-Digit Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onPaste={(e) => {
                  e.preventDefault();
                  const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
                  setOtp(digits);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-4 py-2.5 tracking-[0.5em] text-center text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="000000"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg px-4 py-2.5 mt-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          {step === 'code' ? (
            <button
              type="button"
              onClick={resetToEmail}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              ← Use a different email
            </button>
          ) : (
            <p className="text-slate-500 text-xs">
              You’ll receive a one-time code — no password needed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
