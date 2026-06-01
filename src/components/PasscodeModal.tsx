'use client';

import React, { useState } from 'react';
import { useApp } from './AppContext';
import { Lock, Unlock, X, AlertTriangle, ShieldAlert } from 'lucide-react';

interface PasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PasscodeModal({ isOpen, onClose, onSuccess }: PasscodeModalProps) {
  const { refreshUser, addNotification } = useApp();
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (status !== 'idle') return;
    playBeep(450, 0.05);
    if (passcode.length < 8) {
      setPasscode(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (status !== 'idle') return;
    playBeep(350, 0.05);
    setPasscode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (status !== 'idle') return;
    playBeep(300, 0.08);
    setPasscode('');
  };

  // Beep Audio Utility
  const playBeep = (freq: number, duration: number, type: OscillatorType = 'sine') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passcode || loading) return;

    setLoading(true);
    setStatus('idle');

    try {
      const res = await fetch('http://localhost:5000/api/auth/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passcode })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
        playBeep(880, 0.1, 'triangle');
        setTimeout(() => playBeep(1200, 0.15, 'triangle'), 100);
        addNotification('Authentication Granted', 'Security clearance authorized.', 'success');
        await refreshUser();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        throw new Error(data.error || 'Access Denied');
      }
    } catch (err: any) {
      setStatus('error');
      playBeep(180, 0.45, 'sawtooth');
      addNotification('Access Denied', err.message || 'Passcode rejected.', 'error');
      setPasscode('');
      setTimeout(() => setStatus('idle'), 2000);
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
              type="password"
              value={passcode}
              readOnly
              placeholder="••••••••"
              className={`w-full bg-[#09080d] border rounded-xl p-3 text-center text-lg font-mono tracking-[0.4em] outline-none select-none transition-smooth ${
                status === 'success'
                  ? 'border-green-500/40 text-green-400'
                  : status === 'error'
                    ? 'border-red-500/40 text-red-400'
                    : 'border-[#1e1b29] focus:border-purple-600/40 text-purple-400'
              }`}
            />
          </div>

          {/* Number Pad Grid */}
          <div className="grid grid-cols-3 gap-2.5 font-sans font-black text-sm italic">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num.toString())}
                className="py-3 bg-[#181622]/40 hover:bg-purple-950/20 border border-[#201d2d] hover:border-purple-800/40 text-zinc-300 hover:text-white rounded-xl transition-smooth cursor-pointer active:scale-95"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="py-3 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 hover:border-red-500/20 text-red-400 rounded-xl transition-smooth cursor-pointer text-xs font-sans tracking-wider"
            >
              CLEAR
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="py-3 bg-[#181622]/40 hover:bg-purple-950/20 border border-[#201d2d] hover:border-purple-800/40 text-zinc-300 hover:text-white rounded-xl transition-smooth cursor-pointer active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-zinc-500 hover:text-zinc-300 rounded-xl transition-smooth cursor-pointer"
            >
              ⌫
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
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
