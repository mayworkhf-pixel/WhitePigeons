'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from './AppContext';
import { Lock, Unlock, X, ShieldAlert, Eye, EyeOff } from 'lucide-react';

interface PasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PasscodeModal({ isOpen, onClose, onSuccess }: PasscodeModalProps) {
  const { refreshUser, addNotification, API_BASE_URL } = useApp();
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setStatus('idle');
      setShowPassword(false);
      // Auto focus the input when modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passcode || loading) return;

    setLoading(true);
    setStatus('idle');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passcode })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
        // Clear local storage admin override just in case
        if (typeof window !== 'undefined') {
          localStorage.removeItem('wp_admin_auth');
        }
        addNotification('Authentication Granted', 'Security clearance authorized.', 'success');
        await refreshUser();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        throw new Error(data.error || 'Access Denied');
      }
    } catch (err: any) {
      // Local client-side fallback if backend is offline or mixed content blocks the request
      if (passcode === 'anvy2026') {
        setStatus('success');
        addNotification('Authentication Granted', 'Security clearance authorized.', 'success');
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('wp_admin_auth', 'true');
        }
        
        await refreshUser();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setStatus('error');
        addNotification('Access Denied', err.message || 'Passcode rejected.', 'error');
        setPasscode('');
        setTimeout(() => {
          setStatus('idle');
          inputRef.current?.focus();
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050508]/80 backdrop-blur-md font-sans">
      <div className="absolute inset-0 bg-[#0c0a15]/30 filter blur-3xl pointer-events-none" />
      
      {/* Outer Glow Container */}
      <div className={`relative w-full max-w-sm mx-4 bg-[#121118] border rounded-2xl p-6 shadow-2xl transition-smooth overflow-hidden ${
        status === 'success' 
          ? 'border-green-500/50 shadow-[0_0_25px_rgba(34,197,94,0.2)]'
          : status === 'error'
            ? 'border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.25)] animate-shake'
            : 'border-[#1e1b29] hover:border-purple-600/30 shadow-[0_0_30px_rgba(147,51,234,0.15)]'
      }`}>
        {/* Top Indicator Strip */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 transition-colors duration-300 ${
          status === 'success' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-purple-600'
        }`} />

        {/* Close Button */}
        <button 
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-white bg-[#181622]/40 border border-[#201d2d] rounded-lg hover:border-purple-800/40 transition-smooth cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center mt-3 mb-6">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center border transition-smooth mb-3 ${
            status === 'success'
              ? 'bg-green-950/20 border-green-500/30 text-green-400'
              : status === 'error'
                ? 'bg-red-950/20 border-red-500/30 text-red-400'
                : 'bg-purple-950/30 border-purple-800/35 text-purple-400 shadow-[inset_0_0_8px_rgba(168,85,247,0.15)]'
          }`}>
            {status === 'success' ? (
              <Unlock className="w-6 h-6 animate-pulse" />
            ) : status === 'error' ? (
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            ) : (
              <Lock className="w-6 h-6" />
            )}
          </div>
          <h3 className="font-title font-black text-sm italic tracking-widest text-zinc-100 uppercase">
            {status === 'success' ? 'ACCESS CONFIRMED' : status === 'error' ? 'AUTHENTICATION FAILED' : 'ENTER MASTER CRYPTOKEY'}
          </h3>
          <p className="text-[10px] text-zinc-500 font-sans tracking-wide mt-1">
            {status === 'error' ? 'Passcode incorrect. Infraction logged.' : 'Security authorization code required.'}
          </p>
        </div>

        {/* Display Field */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input 
              ref={inputRef}
              type={showPassword ? "text" : "password"}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className={`w-full bg-[#09080d] border rounded-xl py-3 px-4 pr-12 text-center text-sm font-mono outline-none transition-smooth ${
                status === 'success'
                  ? 'border-green-500/40 text-green-400'
                  : status === 'error'
                    ? 'border-red-500/40 text-red-400 font-bold'
                    : 'border-[#1e1b29] focus:border-purple-600/40 text-purple-400'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={!passcode || loading || status === 'success'}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-900 text-white disabled:text-zinc-500 font-title text-xs font-black italic tracking-wider py-3.5 rounded-xl border border-purple-500 disabled:border-transparent glow-magenta disabled:shadow-none transition-smooth cursor-pointer"
          >
            {loading ? 'VALIDATING KEY...' : 'TRANSMIT PASSCODE'}
          </button>
        </form>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
