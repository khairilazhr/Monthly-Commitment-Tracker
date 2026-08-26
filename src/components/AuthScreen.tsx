import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously 
} from 'firebase/auth';
import { Landmark, Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        console.warn('Email Auth is not enabled in Firebase. Transitioning to local sandbox mode.');
        localStorage.setItem('is_local_mode', 'true');
        localStorage.setItem('local_user', JSON.stringify({ uid: 'local_guest', email: email || 'guest@local.app', isAnonymous: false }));
        onAuthSuccess();
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousAuth = async () => {
    setError('');
    setLoading(true);
    try {
      await signInAnonymously(auth);
      localStorage.setItem('is_local_mode', 'false');
      onAuthSuccess();
    } catch (err: any) {
      console.warn('Anonymous auth failed, attempting fallback email guest account...', err);
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        const fallbackEmail = 'guest@commitments.app';
        const fallbackPassword = 'GuestPassword123!';
        try {
          await signInWithEmailAndPassword(auth, fallbackEmail, fallbackPassword);
          localStorage.setItem('is_local_mode', 'false');
          onAuthSuccess();
        } catch (signInErr: any) {
          // If the guest account doesn't exist yet, try creating it
          if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/user-disabled') {
            try {
              await createUserWithEmailAndPassword(auth, fallbackEmail, fallbackPassword);
              localStorage.setItem('is_local_mode', 'false');
              onAuthSuccess();
            } catch (signUpErr: any) {
              console.warn('Firebase email auth also disabled. Transitioning to local sandbox mode.', signUpErr);
              localStorage.setItem('is_local_mode', 'true');
              localStorage.setItem('local_user', JSON.stringify({ uid: 'local_guest', email: 'guest@local.app', isAnonymous: true }));
              onAuthSuccess();
            }
          } else if (signInErr.code === 'auth/operation-not-allowed' || signInErr.code === 'auth/admin-restricted-operation') {
            console.warn('Firebase Auth providers are disabled. Bypassing and launching Local Sandbox Mode.');
            localStorage.setItem('is_local_mode', 'true');
            localStorage.setItem('local_user', JSON.stringify({ uid: 'local_guest', email: 'guest@local.app', isAnonymous: true }));
            onAuthSuccess();
          } else {
            console.warn('Fallback guest email login failed. Transitioning to local sandbox mode.', signInErr);
            localStorage.setItem('is_local_mode', 'true');
            localStorage.setItem('local_user', JSON.stringify({ uid: 'local_guest', email: 'guest@local.app', isAnonymous: true }));
            onAuthSuccess();
          }
        }
      } else {
        // Any other non-restriction error (e.g. network/offline)
        console.warn('Guest login error. Transitioning to local sandbox mode.', err);
        localStorage.setItem('is_local_mode', 'true');
        localStorage.setItem('local_user', JSON.stringify({ uid: 'local_guest', email: 'guest@local.app', isAnonymous: true }));
        onAuthSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4" id="auth-screen-root">
      {/* Brand Header */}
      <div className="mb-8 text-center" id="auth-header">
        <div className="inline-flex p-3.5 bg-indigo-600 text-white rounded-3xl shadow-lg shadow-indigo-600/20 mb-3">
          <Landmark size={32} />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">Monthly Commitment Tracker</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
          Securely organize your installments, subscriptions, and recurring payments.
        </p>
      </div>

      {/* Auth Card */}
      <div className="bg-white max-w-sm w-full rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6" id="auth-card">
        <div>
          <h2 className="text-lg font-bold text-slate-800 font-sans tracking-tight">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            {isSignUp ? 'Store your data permanently on the cloud' : 'Access your financial commit records'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl font-bold animate-shake" id="auth-error-banner">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {/* Email input */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail size={16} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-sans font-medium"
                id="auth-input-email"
              />
            </div>
          </div>

          {/* Password input */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-sans font-medium"
                id="auth-input-password"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 active:scale-95"
            id="auth-submit-btn"
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-100"></div>
          <span className="flex-shrink mx-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">Or continue as</span>
          <div className="flex-grow border-t border-slate-100"></div>
        </div>

        {/* Guest access */}
        <button
          onClick={handleAnonymousAuth}
          disabled={loading}
          className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 disabled:bg-slate-100 text-slate-700 rounded-xl text-sm font-bold border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
          id="auth-guest-btn"
        >
          <UserIcon size={16} className="text-slate-500" />
          {loading ? 'Please wait...' : 'Enter as Guest'}
        </button>

        {/* Mode switcher */}
        <div className="text-center pt-2">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
            id="auth-mode-switch-btn"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>

      <div className="mt-8 text-center text-[11px] text-slate-400 max-w-xs flex items-center gap-1 justify-center">
        <ShieldCheck size={14} className="text-slate-400" />
        <span>End-to-end cloud protection with secure Firestore permissions.</span>
      </div>
    </div>
  );
}
