'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';
import PasscodeModal from './PasscodeModal';
import { useRouter } from 'next/navigation';
import {
  Flame, 
  Users, 
  ShieldAlert, 
  Trophy, 
  FileCheck, 
  ShoppingBag, 
  ChevronDown,
  ChevronRight,
  X,
  Radio,
  ClipboardList,
  UserCheck,
  AlertTriangle,
  Ticket,
  Coins,
  TrendingUp,
  Send,
  CheckCircle,
  Award,
  Package,
  Sliders,
  CheckSquare,
  Factory,
  Shield,
  Menu,
  Lock,
  Info,
  ArrowRight,
  Wifi,
  WifiOff,
  Loader2,
  Gauge,
  Bot,
  Activity
} from 'lucide-react';

interface NavigationWrapperProps {
  children: React.ReactNode;
}

export default function NavigationWrapper({ children }: NavigationWrapperProps) {
  const router = useRouter();
  const { 
    user, 
    loading, 
    botReady,
    connectionState,
    latencyMs,
    activeUsers,
    notifications, 
    logs,
    dismissNotification,
    logout,
    activeTab,
    setActiveTab,
    refreshUser,
    addNotification,
    API_BASE_URL
  } = useApp();
  
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [gatewayTab, setGatewayTab] = useState<'register' | 'login'>('register');
  const [registerForm, setRegisterForm] = useState({ inGameId: '', firstName: '', lastName: '', password: '' });
  const [loginForm, setLoginForm] = useState({ password: '' });
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [gatewaySuccess, setGatewaySuccess] = useState<string | null>(null);

  const [registeredInGameId, setRegisteredInGameId] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<'pending' | 'approved' | 'none'>('none');
  const canUseLocalPreview = mounted && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

  const checkRegistrationStatus = React.useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/registration-status?inGameId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setRegistrationStatus(data.status);
        if (data.status === 'none') {
          localStorage.removeItem('wp_registered_id');
          setRegisteredInGameId(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch registration status:', err);
    }
  }, [API_BASE_URL]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = registerForm.inGameId.trim();
    if (!/^\d{2,18}$/.test(id)) {
      setGatewayError('In-game ID must be numeric.');
      return;
    }
    if (registerForm.password.trim().length < 6) {
      setGatewayError('Password must be at least 6 characters.');
      return;
    }
    setGatewayLoading(true);
    setGatewayError(null);
    setGatewaySuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...registerForm, inGameId: id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGatewaySuccess(data.message || 'Registration has been sent and admin will review it soon');
        addNotification('Registration Submitted', 'Awaiting administrator approval.', 'success');
        
        // Save to localStorage & state
        localStorage.setItem('wp_registered_id', registerForm.inGameId);
        setRegisteredInGameId(registerForm.inGameId);
        setRegistrationStatus('pending');

        setRegisterForm({ inGameId: '', firstName: '', lastName: '', password: '' });
      } else {
        throw new Error(data.error || 'Registration failed.');
      }
    } catch (err: any) {
      setGatewayError(err.message || 'Registration failed.');
    } finally {
      setGatewayLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGatewayLoading(true);
    setGatewayError(null);
    setGatewaySuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/member-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginForm.password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addNotification('Authentication Successful', `Welcome back, ${data.user.nickname}`, 'success');
        
        // Clear registration tracking state on successful login
        localStorage.removeItem('wp_registered_id');
        setRegisteredInGameId(null);
        setRegistrationStatus('none');

        if (data.token) {
          localStorage.setItem('wp_session_token', data.token);
        }

        await refreshUser();
      } else {
        throw new Error(data.error || 'Login failed.');
      }
    } catch (err: any) {
      setGatewayError(err.message || 'Login failed.');
    } finally {
      setGatewayLoading(false);
    }
  };

  useEffect(() => {
    if (registeredInGameId) {
      checkRegistrationStatus(registeredInGameId);
      const interval = setInterval(() => {
        checkRegistrationStatus(registeredInGameId);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [registeredInGameId, checkRegistrationStatus]);

  useEffect(() => {
    setMounted(true);
    const storedId = localStorage.getItem('wp_registered_id');
    if (storedId) {
      setRegisteredInGameId(storedId);
    }
  }, []);

  // Admin panel tabs removed — bottom button is the sole admin entry point
  const adminPanelTabs: { category: string; items: any[] }[] = [];

  // Main sidebar tabs definitions
  const mainSidebarTabs = [
    { category: 'MAIN', items: [
      { id: 'about-us', label: 'About Us', icon: Info, text: 'About-Us' }
    ]},
    { category: 'MEMBER MANAGEMENT', items: [
      { id: 'role-request', label: 'Roles', icon: ClipboardList, text: 'Role-Request' },
      { id: 'rolereq-review', label: 'Review', icon: UserCheck, text: 'RoleReq-Review', adminOnly: true },
      { id: 'strikes', label: 'Strikes', icon: AlertTriangle, text: 'Strikes' },
      { id: 'tickets', label: 'Tickets', icon: Ticket, text: 'Tickets' },
      { id: 'check-balance', label: 'Balance', icon: Coins, text: 'Check-Balance' }
    ]},
    { category: 'ACTIVITY & LEADERBOARDS', items: [
      { id: 'leaderboard', label: 'Leaderboard', icon: TrendingUp, text: 'Leaderboard' },
      { id: 'long-time-kill-list', label: 'All Time Kills', icon: Flame, text: 'All Time Kills Leaderboard' },
      { id: 'weekly-kill-list', label: 'Weekly Kills', icon: Flame, text: 'Weekly Kills Leaderboard' },
      { id: 'submit-activity', label: 'Submit', icon: Send, text: 'submit-activity' },
      { id: 'activity-results', label: 'Results', icon: CheckCircle, text: 'Activity-Results' },
      { id: 'activity-points-leaderboard', label: 'Points Board', icon: Award, text: 'Activity-Points-LeaderBoard' }
    ]},
    { category: 'POINTS & SHOP', items: [
      { id: 'point-shop', label: 'Shop', icon: ShoppingBag, text: 'point-shop' },
      { id: 'activity-review', label: 'Activity Review', icon: FileCheck, text: 'Activity-Review', adminOnly: true },
      { id: 'order-details', label: 'Orders', icon: Package, text: 'order-details' }
    ]},
    { category: 'BONUS & FINANCE', items: [
      { id: 'bonus-admin-panel', label: 'Bonus Admin', icon: Sliders, text: 'Bonus-Admin-Panel', adminOnly: true },
      { id: 'bonus-approval', label: 'Approvals', icon: CheckSquare, text: 'Bonus-Approval', adminOnly: true },
      { id: 'bizwar-collect', label: 'Bizwar', icon: Factory, text: 'Bizwar-Collect' },
      { id: 'rp-collect', label: 'RP Collect', icon: Trophy, text: 'RP-Collect' },
      { id: 'public-winlog', label: 'Wins', icon: Award, text: 'Public-Winlog' }
    ]},
    { category: 'EVENTS & SIGNUPS', items: [
      { id: 'rp-signup', label: 'RP Signup', icon: Users, text: 'RP-Signup' },
      { id: 'informal-signup', label: 'Informal', icon: Radio, text: 'Informal-Signup' },
      { id: 'public-informallog', label: 'Informal Logs', icon: FileCheck, text: 'public-informallog' },
      { id: 'top-10-list', label: 'Top 10', icon: Shield, text: 'Top-10-List' }
    ]}
  ];

  const sidebarTabs = [...adminPanelTabs, ...mainSidebarTabs];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#050816] via-[#08111f] to-[#0c1427] border-r border-[#1c1a2a]/45 font-sans text-[11px] select-none wp-sidebar-shell relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full filter blur-2xl pointer-events-none" />
      <div className="p-3.5 border-b border-[#1c1a2a]/45 relative z-10">
        <div className="flex items-center gap-3">
          <img src="/logo.webp" alt="White Pigeon" className="w-9 h-9 object-contain border border-purple-500/20 bg-black/20 rounded-lg" />
          <div className="min-w-0">
            <div className="font-title text-[12px] leading-none font-extrabold uppercase tracking-wider text-white">White Pigeon</div>
            <div className="font-tech text-[8px] uppercase tracking-[0.18em] text-purple-400/90 mt-1">Grand RP EN3</div>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1 font-tech text-[7.5px] uppercase">
          <div className="border border-purple-500/10 bg-purple-500/5 px-1.5 py-1 text-center rounded-md">
            <span className="block text-zinc-500">Gateway</span>
            <span className={connectionState === 'connected' ? 'text-emerald-400' : 'text-amber-400'}>{connectionState}</span>
          </div>
          <div className="border border-purple-500/10 bg-purple-500/5 px-1.5 py-1 text-center rounded-md">
            <span className="block text-zinc-500">Bot</span>
            <span className={botReady ? 'text-emerald-400' : 'text-amber-400'}>{botReady ? 'online' : 'standby'}</span>
          </div>
          <div className="border border-purple-500/10 bg-purple-500/5 px-1.5 py-1 text-center rounded-md">
            <span className="block text-zinc-500">Users</span>
            <span className="text-[#f0f6ff]">{activeUsers}</span>
          </div>
        </div>
      </div>

      {/* Tabs list navigation */}
      <div className="flex-1 py-2 px-2 overflow-y-auto relative z-10">
        {sidebarTabs.map((cat, idx) => (
          <div key={idx} className="mb-2">
            <div className={`text-[7.5px] font-extrabold tracking-[0.18em] text-zinc-500 uppercase mb-2 px-3 ${idx === 0 ? 'mt-1' : 'mt-4'}`}>
              {cat.category}
            </div>
            
            <div className="space-y-1">
              {cat.items.map((item) => {
                if ('adminOnly' in item && item.adminOnly && !user?.admin_authenticated) {
                  return null;
                }

                const isHref = 'href' in item && !!item.href;
                const isActive = mounted && (isHref
                  ? (window.location.pathname === (item as any).href)
                  : (activeTab === item.id && window.location.pathname === '/'));
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (isHref) {
                        router.push((item as any).href);
                      } else {
                        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
                          router.push(`/?tab=${item.id}`);
                        } else {
                          setActiveTab(item.id);
                        }
                      }
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 text-[9.5px] font-title font-black uppercase tracking-wider transition-smooth cursor-pointer px-3 py-2 rounded-lg ${
                      isActive 
                        ? 'wp-active-purple-tab'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#0c1427]/40 border border-transparent'
                    }`}
                  >
                    <item.icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-purple-300' : 'text-zinc-500'}`} />
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Admin Panel Gateway */}
      <div className="p-2 border-t border-[#1c1a2a]/45 bg-[#050816] shrink-0 relative z-10">
        {user?.admin_authenticated ? (
          <button 
            onClick={() => router.push('/admin')}
            className="w-full flex items-center gap-2.5 bg-[#08111f]/60 backdrop-blur-md border border-emerald-500/40 rounded-xl p-2.5 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/70 transition-smooth cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.06)]"
          >
            <Shield className="w-4 h-4 shrink-0 text-emerald-400" />
            <div className="flex-1 text-left">
              <div className="text-[10px] font-title font-black uppercase tracking-wider">Admin Panel</div>
              <div className="text-[8px] text-zinc-500 mt-0.5">Authenticated</div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-650 shrink-0" />
          </button>
        ) : (
          <button 
            onClick={() => setIsPasscodeModalOpen(true)}
            className="w-full flex items-center gap-2.5 bg-[#08111f]/60 backdrop-blur-md border border-[#ffb84d]/40 rounded-xl p-2.5 text-[#ffb84d] hover:text-[#ffd699] hover:border-[#ffb84d]/70 transition-smooth cursor-pointer shadow-[0_0_15px_rgba(255,184,77,0.06)] animate-pulse-slow"
          >
            <Award className="w-4 h-4 shrink-0 text-[#ffb84d]" />
            <div className="flex-1 text-left">
              <div className="text-[10px] font-title font-black uppercase tracking-wider">Access Admin Console</div>
              <div className="text-[8px] text-zinc-500 mt-0.5">Administrator Access</div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#ffb84d]/70 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );

  const isApproved = user && (user.admin_authenticated || !user.status || user.status === 'approved');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090f] text-zinc-500 font-mono text-xs animate-pulse uppercase tracking-wider">
        Initializing Security Node...
      </div>
    );
  }

  if (!isApproved) {
    return (
      <>
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#09090f] text-foreground font-sans relative overflow-hidden p-4">
          {/* Glow decoration */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/5 rounded-full filter blur-[100px] pointer-events-none" />
          
          <div className="w-full max-w-md bg-[#111118] border border-[#1c1a2a] rounded-2xl shadow-2xl relative overflow-hidden p-6 z-10 transition-smooth">
            {/* Top Indicator Strip */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 to-indigo-600" />

            {/* Hub Branding */}
            <div className="flex flex-col items-center text-center mt-2 mb-6">
              <img 
                src="/logo.webp"
                alt="White Pigeons Logo" 
                className="w-56 h-56 object-contain mb-4 drop-shadow-[0_0_35px_rgba(168,85,247,0.4)] hover:scale-105 transition-smooth"
              />
              <h1 className="font-title font-black text-3xl italic tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-200 to-purple-400 uppercase drop-shadow-[0_0_15px_rgba(168,85,247,0.15)] leading-none">
                WHITE PIGEONS
              </h1>
              <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase tracking-[0.2em] block mt-2">
                COMMAND HUB GATEWAY
              </span>
            </div>

            {/* Form Tabs */}
            {(!user || user.status !== 'pending') && (registrationStatus === 'none' || !registeredInGameId) && (
              <div className="flex bg-[#09090f] border border-[#1c1a2a] p-1 rounded-xl mb-6">
                <button
                  onClick={() => { setGatewayTab('register'); setGatewayError(null); setGatewaySuccess(null); }}
                  className={`flex-1 py-2 text-center text-xs font-title font-bold italic tracking-wide rounded-lg transition-smooth cursor-pointer uppercase ${
                    gatewayTab === 'register'
                      ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Register Request
                </button>
                <button
                  onClick={() => { setGatewayTab('login'); setGatewayError(null); setGatewaySuccess(null); }}
                  className={`flex-1 py-2 text-center text-xs font-title font-bold italic tracking-wide rounded-lg transition-smooth cursor-pointer uppercase ${
                    gatewayTab === 'login'
                      ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Player Login
                </button>
              </div>
            )}

            {/* Error and Success Notifications */}
            {gatewayError && (
              <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-3 text-[11px] text-rose-400 font-sans flex items-start gap-2 mb-4 animate-shake">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{gatewayError}</span>
              </div>
            )}
            {gatewaySuccess && !registeredInGameId && (
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3 text-[11px] text-emerald-400 font-sans flex items-start gap-2 mb-4">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{gatewaySuccess}</span>
              </div>
            )}

            {/* Pending Approval Screen */}
            {user && user.status === 'pending' ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 bg-amber-950/20 border border-amber-800/35 rounded-xl flex items-center justify-center text-amber-400 mx-auto animate-pulse">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-title font-bold text-zinc-200 text-sm">REGISTRATION PENDING</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Awaiting Administrator Approval</p>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs mx-auto">
                  Your profile <span className="font-mono text-purple-400">{user.nickname}</span> has been submitted to high command. Please wait for authorization.
                </p>
                <div className="pt-2">
                  <button
                    onClick={logout}
                    className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-[10px] font-title font-bold py-2 px-4 rounded-lg transition-smooth cursor-pointer"
                  >
                    Cancel & Log Out
                  </button>
                </div>
              </div>
            ) : registeredInGameId && registrationStatus === 'pending' ? (
              /* Clean Pending Registration Message */
              <div className="text-center py-8 space-y-5 font-sans">
                <div className="w-14 h-14 bg-purple-950/20 border border-purple-800/35 rounded-xl flex items-center justify-center text-purple-400 mx-auto animate-pulse">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-title font-bold text-zinc-200 text-sm tracking-tight uppercase">Registration Sent</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs mx-auto">
                    Registration has been sent and admin will review it soon
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      localStorage.removeItem('wp_registered_id');
                      setRegisteredInGameId(null);
                      setRegistrationStatus('none');
                      setGatewayError(null);
                      setGatewaySuccess(null);
                    }}
                    className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-[10px] font-title font-bold py-2 px-4 rounded-lg transition-smooth cursor-pointer"
                  >
                    Cancel / Edit Request
                  </button>
                </div>
              </div>
            ) : registeredInGameId && registrationStatus === 'approved' ? (
              /* Clean Approved Registration Message */
              <div className="text-center py-8 space-y-5 font-sans">
                <div className="w-14 h-14 bg-emerald-950/20 border border-emerald-800/35 rounded-xl flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-title font-bold text-zinc-200 text-sm tracking-tight uppercase">Request Approved</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs mx-auto">
                    Your request is approved. You can log in from the Players Login.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      localStorage.removeItem('wp_registered_id');
                      setRegisteredInGameId(null);
                      setRegistrationStatus('none');
                      setGatewayTab('login');
                      setGatewayError(null);
                      setGatewaySuccess(null);
                    }}
                    className="w-full btn-primary-gradient py-2.5 text-white text-xs font-title font-black italic tracking-wide rounded-xl shadow-[0_0_10px_rgba(168,85,247,0.15)] hover:scale-[1.02] active:scale-[0.98] transition-smooth cursor-pointer uppercase font-bold"
                  >
                    Go to Players Login
                  </button>
                </div>
              </div>
            ) : gatewayTab === 'register' ? (
              /* Register Form */
              <form onSubmit={handleRegisterSubmit} className="space-y-4 font-sans text-xs">
                <div>
                  <label className="text-[9px] text-zinc-500 font-black block mb-1">IN-GAME ID (CHARACTER ID)</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. 70941"
                    value={registerForm.inGameId}
                    onChange={e => setRegisterForm(prev => ({ ...prev, inGameId: e.target.value }))}
                    className="w-full bg-[#09090f] border border-[#1c1a2a] rounded-xl p-3 text-zinc-300 focus:border-purple-650/40 outline-none transition-smooth"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-zinc-500 font-black block mb-1">FIRST NAME</label>
                    <input 
                      type="text"
                      required
                      placeholder="First Name"
                      value={registerForm.firstName}
                      onChange={e => setRegisterForm(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full bg-[#09090f] border border-[#1c1a2a] rounded-xl p-3 text-zinc-300 focus:border-purple-650/40 outline-none transition-smooth"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-black block mb-1">LAST NAME</label>
                    <input 
                      type="text"
                      required
                      placeholder="Last Name"
                      value={registerForm.lastName}
                      onChange={e => setRegisterForm(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full bg-[#09090f] border border-[#1c1a2a] rounded-xl p-3 text-zinc-300 focus:border-purple-650/40 outline-none transition-smooth"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 font-black block mb-1">CHOOSE PASSWORD</label>
                  <input 
                    type="password"
                    required
                    placeholder="Enter portal password"
                    value={registerForm.password}
                    onChange={e => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-[#09090f] border border-[#1c1a2a] rounded-xl p-3 text-zinc-300 focus:border-purple-650/40 outline-none transition-smooth"
                  />
                </div>

                <button
                  type="submit"
                  disabled={gatewayLoading}
                  className="w-full btn-primary-gradient py-2.5 text-white text-xs font-title font-black italic tracking-wide rounded-xl shadow-[0_0_10px_rgba(168,85,247,0.15)] hover:scale-[1.02] active:scale-[0.98] transition-smooth cursor-pointer uppercase flex items-center justify-center gap-1.5"
                >
                  {gatewayLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {gatewayLoading ? 'Submitting' : 'Submit Registration'}
                </button>
              </form>
            ) : (
              /* Login Form */
              <form onSubmit={handleLoginSubmit} className="space-y-4 font-sans text-xs">
                <div>
                  <label className="text-[9px] text-zinc-500 font-black block mb-1">PASSWORD</label>
                  <input 
                    type="password"
                    required
                    placeholder="Enter registered password to sign in"
                    value={loginForm.password}
                    onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-[#09090f] border border-[#1c1a2a] rounded-xl p-3 text-zinc-300 focus:border-purple-650/40 outline-none transition-smooth text-center"
                  />
                </div>

                <button
                  type="submit"
                  disabled={gatewayLoading}
                  className="w-full btn-primary-gradient py-2.5 text-white text-xs font-title font-black italic tracking-wide rounded-xl shadow-[0_0_10px_rgba(168,85,247,0.15)] hover:scale-[1.02] active:scale-[0.98] transition-smooth cursor-pointer uppercase flex items-center justify-center gap-1.5"
                >
                  {gatewayLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {gatewayLoading ? 'Authenticating' : 'Log In'}
                </button>
              </form>
            )}

            {/* Footer Admin Entry Link */}
            <div className="mt-8 border-t border-[#1c1a2a]/60 pt-4 text-center">
              {canUseLocalPreview && (
                <button
                  type="button"
                  onClick={async () => {
                    localStorage.setItem('wp_local_preview', 'true');
                    addNotification('Local Preview Enabled', 'Dashboard tabs are unlocked for localhost preview.', 'success');
                    await refreshUser();
                  }}
                  className="mb-3 w-full border border-cyan-500/35 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15 hover:border-cyan-400 text-[10px] font-title font-black italic tracking-wide py-2.5 px-4 transition-smooth cursor-pointer uppercase flex items-center justify-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Open Local Preview
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsPasscodeModalOpen(true)}
                className="text-[10px] text-purple-400 hover:text-purple-300 font-title font-bold italic tracking-wide flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" /> ADMINISTRATOR ACCESS CONTROL
              </button>
            </div>
          </div>
        </div>
        <PasscodeModal 
          isOpen={isPasscodeModalOpen} 
          onClose={() => setIsPasscodeModalOpen(false)} 
          onSuccess={() => router.push('/admin')}
        />
      </>
    );
  }

  const activeTabTitle = activeTab === 'home'
    ? 'Dashboard'
    : activeTab === 'long-time-kill-list'
      ? 'All Time Kills'
      : activeTab === 'weekly-kill-list'
        ? 'Weekly Kills'
      : activeTab.toUpperCase().replace(/-/g, ' ');
  const activeTabSubtitle = activeTab === 'home'
    ? 'Welcome back, White Pigeons Family'
    : `Sync pipeline details for ${activeTabTitle.toLowerCase()}`;

  return (
    <div className="min-h-screen flex relative z-20 bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-52 bg-gradient-to-b from-[#050816] via-[#08111f] to-[#0c1427] border-r border-[#1c1a2a]/45 shrink-0 h-screen sticky top-0 overflow-hidden">
        <div className="w-full h-full">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Main Core View Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen relative overflow-x-hidden pb-12">
        
        {/* Top Header Grid HUD */}
        <header className="bg-[#050816]/75 backdrop-blur-xl border-b border-[#1c1a2a]/45 sticky top-0 z-40 px-4 sm:px-6 py-3 command-topbar">
          <div className="w-full max-w-none flex items-center justify-between gap-4">
            {/* Hamburger menu for mobile */}
            <button 
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="lg:hidden p-1.5 hover:bg-zinc-900 rounded border border-[#1c1a2a]/30 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              aria-label="Open command navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Page Title */}
            <div className="flex flex-col min-w-0">
              <span className="font-title font-black text-base text-white uppercase tracking-wider leading-none truncate">
                {activeTabTitle}
              </span>
              <span className="font-sans text-[9px] uppercase tracking-wider text-zinc-500 mt-1 truncate">
                {activeTabSubtitle}
              </span>
            </div>

            {/* Profile widget */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:flex items-center gap-1.5 border border-purple-500/15 bg-purple-500/5 px-2.5 py-1.5 font-tech text-[9px] uppercase text-purple-200 rounded-lg">
                {connectionState === 'connected' ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
                <span>{latencyMs === null ? '--' : `${latencyMs}ms`}</span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 border border-purple-500/15 bg-purple-500/5 px-2.5 py-1.5 font-tech text-[9px] uppercase text-purple-200 rounded-lg">
                <Bot className={`w-3.5 h-3.5 ${botReady ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span>{botReady ? 'Bot Live' : 'Bot Standby'}</span>
              </div>
              <div className="hidden lg:flex items-center gap-1.5 border border-purple-500/15 bg-purple-500/5 px-2.5 py-1.5 font-tech text-[9px] uppercase text-purple-200 rounded-lg">
                <Gauge className="w-3.5 h-3.5 text-purple-300" />
                <span>{activeUsers} active</span>
              </div>
              {/* User block */}
              {loading ? (
                <div className="w-7 h-7 rounded-full border border-t-transparent border-purple-500 animate-spin" />
              ) : user ? (
                <div className="flex items-center gap-3 bg-[#08111f]/80 border border-purple-500/20 rounded-xl p-1.5 pr-3">
                  <img 
                    src={user.avatar} 
                    alt={user.username} 
                    className="w-8 h-8 rounded-lg border border-purple-500/30"
                  />
                  <div className="hidden sm:block text-left leading-none">
                    <div className="text-[11px] font-bold font-title text-zinc-100 flex items-center gap-1.5">
                      {user.nickname}
                      {user.isTop10 && <span className="text-[7px] bg-accent/20 text-accent font-black px-1.5 py-0.5 rounded-full">TOP 10</span>}
                    </div>
                    <div className="text-[9px] text-zinc-500 font-sans mt-1">
                      {user.admin_authenticated ? 'Admin' : 'Member'}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                </div>
              ) : (
                <button 
                  onClick={() => setIsPasscodeModalOpen(true)}
                  className="btn-primary-gradient px-5 py-2.5 text-sm flex items-center gap-2 rounded-lg font-title font-bold cursor-pointer transition-smooth"
                >
                  ENTER HUB
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Mobile bottom navigation sheet */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 lg:hidden">
            <div className="absolute inset-x-0 bottom-0 h-[82vh] border-t border-[#1c1a2a]/35 bg-[#09090f] shadow-[0_-18px_60px_rgba(0,0,0,0.65)]">
              {renderSidebarContent()}
              <button 
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute top-3 right-3 p-1.5 bg-zinc-950 text-zinc-400 hover:text-white border border-[#1c1a2a]/30 rounded cursor-pointer"
                aria-label="Close command navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="absolute inset-0 -z-10" onClick={() => setMobileSidebarOpen(false)} />
          </div>
        )}

        {/* Sub-Layout Content */}
        <main className="flex-1 w-full max-w-none px-3 sm:px-5 xl:px-6 py-5 min-w-0">
          {children}
        </main>
      </div>

      {connectionState === 'disconnected' && !user?.admin_authenticated && (
        <div className="fixed inset-0 z-[60] bg-[#050816]/92 backdrop-blur-md flex items-center justify-center px-6">
          <div className="text-center font-tech uppercase tracking-[0.18em]">
            <div className="mx-auto mb-5 w-16 h-16 border border-[#ff9f1c]/40 bg-[#ff9f1c]/10 flex items-center justify-center pulse-reconnect">
              <WifiOff className="w-7 h-7 text-[#ff9f1c]" />
            </div>
            <div className="font-title text-2xl font-black text-[#f0f6ff]">Connection Lost</div>
            <div className="mt-2 text-[11px] text-zinc-500">Attempting to re-establish backend telemetry</div>
            
            <button
              type="button"
              onClick={() => setIsPasscodeModalOpen(true)}
              className="mt-6 mx-auto bg-purple-950/20 hover:bg-purple-950/40 text-purple-400 border border-purple-900/30 hover:border-purple-800/50 py-2.5 px-4 rounded-xl text-[10px] font-sans font-bold transition-smooth flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.1)]"
            >
              Access Offline Console
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-12 right-4 z-50 w-[min(360px,calc(100vw-2rem))] space-y-2">
        {notifications.slice(0, 4).map(notification => (
          <button
            key={notification.id}
            type="button"
            onClick={() => dismissNotification(notification.id)}
            className={`w-full text-left border bg-[#050816]/95 backdrop-blur px-4 py-3 shadow-2xl toast-enter rounded-lg ${
              notification.type === 'success'
                ? 'border-emerald-400/35'
                : notification.type === 'error'
                  ? 'border-red-400/35'
                  : notification.type === 'warning'
                    ? 'border-[#ff9f1c]/45'
                    : 'border-purple-500/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <Activity className={`w-4 h-4 mt-0.5 shrink-0 ${
                notification.type === 'success'
                  ? 'text-emerald-400'
                  : notification.type === 'error'
                    ? 'text-red-400'
                    : notification.type === 'warning'
                      ? 'text-[#ff9f1c]'
                      : 'text-purple-300'
              }`} />
              <div className="min-w-0">
                <div className="font-title text-sm font-bold uppercase text-[#f0f6ff] leading-none">{notification.title}</div>
                <div className="mt-1 text-[11px] text-zinc-400 leading-snug">{notification.message}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 lg:left-52 right-0 z-40 h-9 border-t border-[#1c1a2a]/45 bg-[#050816]/95 backdrop-blur px-3 sm:px-5 flex items-center justify-between gap-3 font-tech text-[10px] uppercase text-zinc-500">
        <div className="truncate">
          <span className="text-purple-400">Last action:</span>{' '}
          <span className="text-zinc-300">{logs[0]?.message || 'Awaiting command activity'}</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <span>{activeUsers} users</span>
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} sync</span>
        </div>
      </div>

      <PasscodeModal 
        isOpen={isPasscodeModalOpen} 
        onClose={() => setIsPasscodeModalOpen(false)} 
        onSuccess={() => router.push('/admin')}
      />
    </div>
  );
}
