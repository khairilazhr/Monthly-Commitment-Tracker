import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { CreditCard, Mail, Lock, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

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
      localStorage.removeItem('is_local_mode');
      localStorage.removeItem('local_user');
      onAuthSuccess();
    } catch (err: any) {
      console.error("Firebase Auth error:", err);
      const code = err.code || '';

      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError(isSignUp ? 'Unable to create account with these credentials.' : 'Incorrect email or password. If you haven’t registered yet, tap "Create Account".');
      } else if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please tap "Sign In" instead.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (code === 'auth/operation-not-allowed') {
        setError('Email/Password provider is not enabled in Firebase. Please enable Email/Password in Firebase Console → Authentication → Sign-in method.');
      } else if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid') {
        setError('Invalid Firebase API key. Please check your VITE_FIREBASE_API_KEY environment variable.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network connection error. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    localStorage.setItem('is_local_mode', 'true');
    localStorage.setItem('local_user', JSON.stringify({ 
      uid: 'local_guest', 
      email: 'guest@offline.local', 
      isAnonymous: true 
    }));
    onAuthSuccess();
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col justify-between items-center px-4 py-8 sm:py-12" id="auth-screen-root">
      
      {/* Top Spacer */}
      <div className="w-full" />

      {/* Main Container */}
      <div className="w-full max-w-[390px] flex flex-col items-center animate-ios-sheet" id="auth-container">
        
        {/* iOS App Icon (Squircle) */}
        <div className="relative mb-5" id="ios-app-icon">
          <div className="w-20 h-20 sm:w-22 sm:h-22 bg-gradient-to-b from-[#007AFF] to-[#0051B3] rounded-[22px] sm:rounded-[26px] shadow-[0_12px_28px_rgba(0,122,255,0.28)] flex items-center justify-center text-white border border-white/20">
            <CreditCard size={38} strokeWidth={2.2} />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow-md text-[#007AFF]">
            <Sparkles size={13} strokeWidth={2.5} />
          </div>
        </div>

        {/* Header Text */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-[28px] font-bold text-[#1C1C1E] tracking-tight leading-tight">
            Commitments
          </h1>
          <p className="text-xs sm:text-[13px] text-[#8E8E93] mt-1 font-normal max-w-[280px]">
            Financial installment & subscription planner
          </p>
        </div>

        {/* iOS Inset Card */}
        <div className="w-full bg-white rounded-[22px] border border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-5" id="auth-card">
          
          {/* iOS Segmented Control */}
          <div className="bg-[#767680]/12 p-1 rounded-xl flex items-center" id="auth-mode-segmented-control">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                !isSignUp 
                  ? 'bg-white text-[#1C1C1E] shadow-[0_2px_6px_rgba(0,0,0,0.12)]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E]'
              }`}
              id="auth-tab-signin"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                isSignUp 
                  ? 'bg-white text-[#1C1C1E] shadow-[0_2px_6px_rgba(0,0,0,0.12)]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E]'
              }`}
              id="auth-tab-signup"
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="p-3 bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs rounded-xl font-medium flex items-center gap-2 animate-shake" id="auth-error-banner">
              <span>{error}</span>
            </div>
          )}

          {/* Form with iOS Inset Grouped Fields */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            
            <div className="bg-[#F2F2F7] rounded-xl overflow-hidden border border-[#E5E5EA] divide-y divide-[#E5E5EA]">
              {/* Email Row */}
              <div className="flex items-center px-3.5 py-3">
                <span className="text-[#8E8E93] mr-3 shrink-0">
                  <Mail size={17} strokeWidth={2} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full bg-transparent text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none font-normal"
                  id="auth-input-email"
                />
              </div>

              {/* Password Row */}
              <div className="flex items-center px-3.5 py-3">
                <span className="text-[#8E8E93] mr-3 shrink-0">
                  <Lock size={17} strokeWidth={2} />
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-transparent text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none font-normal"
                  id="auth-input-password"
                />
              </div>
            </div>

            {/* Primary Action Button (iOS Style) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#007AFF] hover:bg-[#0066D6] active:scale-[0.98] disabled:bg-[#007AFF]/50 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,122,255,0.25)]"
              id="auth-submit-btn"
            >
              {loading ? (
                <span>Please wait...</span>
              ) : (
                <>
                  <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight size={15} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#E5E5EA]"></div>
            <span className="flex-shrink mx-3 text-[11px] text-[#8E8E93] font-medium">or</span>
            <div className="flex-grow border-t border-[#E5E5EA]"></div>
          </div>

          {/* Guest / Offline Mode Option */}
          <button
            type="button"
            onClick={handleGuestMode}
            className="w-full py-2.5 bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-[0.98] text-[#1C1C1E] rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border border-[#E5E5EA]"
            id="auth-guest-btn"
          >
            <span>Continue as Guest (Offline Mode)</span>
          </button>
        </div>
      </div>

      {/* Footer Security Note & Signature */}
      <div className="text-center text-[11px] text-[#8E8E93] space-y-1 mt-6" id="auth-footer">
        <div className="flex items-center gap-1.5 justify-center">
          <ShieldCheck size={13} strokeWidth={2} className="text-[#34C759]" />
          <span>Secured with Apple-grade cloud encryption & Firestore</span>
        </div>
        <p className="text-[10px] text-[#AEAEB2]">
          Crafted by <span className="font-semibold text-[#8E8E93]">Kai</span>
        </p>
      </div>
    </div>
  );
}
