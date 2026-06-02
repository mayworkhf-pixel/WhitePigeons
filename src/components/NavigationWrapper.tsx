'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';
import PasscodeModal from './PasscodeModal';
import { useRouter } from 'next/navigation';
import { 
  Bell, 
  Terminal, 
  Settings, 
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
  Unlock,
  Info,
  ArrowRight
} from 'lucide-react';

interface NavigationWrapperProps {
  children: React.ReactNode;
}

export default function NavigationWrapper({ children }: NavigationWrapperProps) {
  const router = useRouter();
  const { 
    user, 
    loading, 
    notifications, 
    logs,
    logout,
    activeTab,
    setActiveTab,
    refreshUser,
    addNotification,
    API_BASE_URL
  } = useApp();
  
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [showConsole, setShowConsole] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [gatewayTab, setGatewayTab] = useState<'register' | 'login'>('register');
  const [registerForm, setRegisterForm] = useState({ inGameId: '', firstName: '', lastName: '', password: '' });
  const [loginForm, setLoginForm] = useState({ password: '' });
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [gatewaySuccess, setGatewaySuccess] = useState<string | null>(null);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGatewayLoading(true);
    setGatewayError(null);
    setGatewaySuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGatewaySuccess(data.message || 'Registration submitted! Awaiting admin approval.');
        addNotification('Registration Submitted', 'Awaiting administrator approval.', 'success');
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
    setMounted(true);
  }, []);

  // Admin panel tabs removed — bottom button is the sole admin entry point
  const adminPanelTabs: { category: string; items: any[] }[] = [];

  // Main sidebar tabs definitions
  const mainSidebarTabs = [
    { category: 'MAIN', items: [
      { id: 'about-us', label: 'About Us', icon: Info, text: 'About-Us' }
    ]},
    { category: 'MEMBER MANAGEMENT', items: [
      { id: 'role-request', label: 'Role-Request', icon: ClipboardList, text: 'Role-Request' },
      { id: 'rolereq-review', label: 'RoleReq-Review', icon: UserCheck, text: 'RoleReq-Review', adminOnly: true },
      { id: 'strikes', label: 'Strikes', icon: AlertTriangle, text: 'Strikes' },
      { id: 'tickets', label: 'Tickets', icon: Ticket, text: 'Tickets' },
      { id: 'check-balance', label: 'Check-Balance', icon: Coins, text: 'Check-Balance' }
    ]},
    { category: 'ACTIVITY & LEADERBOARDS', items: [
      { id: 'leaderboard', label: 'Leaderboard', icon: TrendingUp, text: 'Leaderboard' },
      { id: 'long-time-kill-list', label: 'All Time Kills Leaderboard', icon: Flame, text: 'All Time Kills Leaderboard' },
      { id: 'weekly-kill-list', label: 'Weekly Kills Leaderboard', icon: Flame, text: 'Weekly Kills Leaderboard' },
      { id: 'submit-activity', label: 'Submit-Activity', icon: Send, text: 'submit-activity' },
      { id: 'activity-results', label: 'Activity-Results', icon: CheckCircle, text: 'Activity-Results' },
      { id: 'activity-points-leaderboard', label: 'Activity-Points-LeaderBoard', icon: Award, text: 'Activity-Points-LeaderBoard' }
    ]},
    { category: 'POINTS & SHOP', items: [
      { id: 'point-shop', label: 'Point-Shop', icon: ShoppingBag, text: 'point-shop' },
      { id: 'activity-review', label: 'Activity-Review', icon: FileCheck, text: 'Activity-Review', adminOnly: true },
      { id: 'order-details', label: 'Order-Details', icon: Package, text: 'order-details' }
    ]},
    { category: 'BONUS & FINANCE', items: [
      { id: 'bonus-admin-panel', label: 'Bonus-Admin-Panel', icon: Sliders, text: 'Bonus-Admin-Panel', adminOnly: true },
      { id: 'bonus-approval', label: 'Bonus-Approval', icon: CheckSquare, text: 'Bonus-Approval', adminOnly: true },
      { id: 'bizwar-collect', label: 'Bizwar-Collect', icon: Factory, text: 'Bizwar-Collect' },
      { id: 'rp-collect', label: 'RP-Collect', icon: Trophy, text: 'RP-Collect' },
      { id: 'public-winlog', label: 'Public-Winlog', icon: Award, text: 'Public-Winlog' }
    ]},
    { category: 'EVENTS & SIGNUPS', items: [
      { id: 'rp-signup', label: 'RP-Signup', icon: Users, text: 'RP-Signup' },
      { id: 'informal-signup', label: 'Informal-Signup', icon: Radio, text: 'Informal-Signup' },
      { id: 'public-informallog', label: 'Public-InformalLog', icon: FileCheck, text: 'public-informallog' },
      { id: 'top-10-list', label: 'Top-10-List', icon: Shield, text: 'Top-10-List' }
    ]}
  ];

  const sidebarTabs = [...adminPanelTabs, ...mainSidebarTabs];



  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#09090f] border-r border-[#141320] font-sans text-[12px] select-none">

      {/* Tabs list navigation */}
      <div className="flex-1 py-3 px-2.5">
        {sidebarTabs.map((cat, idx) => (
          <div key={idx}>
            <div className={`text-[9px] font-semibold tracking-[0.15em] text-zinc-600 uppercase mb-1 px-2.5 ${idx === 0 ? 'mt-1' : 'mt-3'}`}>
              {cat.category}
            </div>
            
            <div>
              {cat.items.map((item) => {
                // If it is an admin-only tab and user is not admin authenticated, hide it completely
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
                        // Standard tab change. If not currently on home/portal page, redirect to root tab
                        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
                          router.push(`/?tab=${item.id}`);
                        } else {
                          setActiveTab(item.id);
                        }
                      }
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 text-[12px] font-sans transition-smooth cursor-pointer ${
                      isActive 
                        ? 'bg-purple-500/10 border-l-[3px] border-l-purple-500 text-white font-semibold pl-2.5 pr-2.5 py-[5px] rounded-r-lg rounded-l-none'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#13121d] pl-3 pr-2.5 py-[5px] rounded-lg border-l-[3px] border-l-transparent'
                    }`}
                  >
                    <item.icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-purple-400' : 'text-zinc-500'}`} />
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Admin Panel Gateway */}
      <div className="p-2.5 border-t border-[#141320] bg-[#09090f] shrink-0">
        {user?.admin_authenticated ? (
          <button 
            onClick={() => router.push('/admin')}
            className="w-full flex items-center gap-2.5 bg-[#0e0e16] border border-[#1c1a2a] rounded-lg p-2.5 text-green-400 hover:text-green-300 hover:border-green-800/40 transition-smooth cursor-pointer"
          >
            <Shield className="w-4 h-4 shrink-0 text-green-400" />
            <div className="flex-1 text-left">
              <div className="text-[12px] font-semibold">Admin Panel</div>
              <div className="text-[8px] text-zinc-500 mt-0.5">Authenticated</div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
          </button>
        ) : (
          <button 
            onClick={() => setIsPasscodeModalOpen(true)}
            className="w-full flex items-center gap-2.5 bg-[#0e0e16] border border-[#1c1a2a] rounded-lg p-2.5 text-purple-400 hover:text-purple-300 hover:border-purple-800/40 transition-smooth cursor-pointer"
          >
            <Shield className="w-4 h-4 shrink-0" />
            <div className="flex-1 text-left">
              <div className="text-[12px] font-semibold">Access Admin Console</div>
              <div className="text-[8px] text-zinc-500 mt-0.5">Administrator Access</div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
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
                src="/logo.png" 
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
            {(!user || user.status !== 'pending') && (
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
            {gatewaySuccess && (
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
                  Submit Registration
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
                  Log In
                </button>
              </form>
            )}

            {/* Footer Admin Entry Link */}
            <div className="mt-8 border-t border-[#1c1a2a]/60 pt-4 text-center">
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

  return (
    <div className="min-h-screen flex relative z-20 bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-[#09090f] border-r border-[#141320] shrink-0 h-screen sticky top-0">
        <div className="w-full h-full">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Main Core View Area */}
      <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden pb-12">
        
        {/* Top Header Grid HUD */}
        <header className="bg-[#09090f]/90 backdrop-blur-xl border-b border-[#141320] sticky top-0 z-40 px-6 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Hamburger menu for mobile */}
            <button 
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="lg:hidden p-1.5 hover:bg-zinc-900 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Page Title */}
            <div className="flex flex-col">
              <span className="font-title font-bold text-lg text-white uppercase tracking-tight leading-none">
                {activeTab === 'home' ? 'Dashboard' : activeTab.toUpperCase().replace(/-/g, ' ')}
              </span>
              <span className="text-[11px] text-zinc-500 mt-0.5">
                {activeTab === 'home' ? 'Welcome back, White Pigeons Family' : `Sync pipeline details for ${activeTab.replace(/-/g, ' ')}`}
              </span>
            </div>

            {/* Profile widget */}
            <div className="flex items-center gap-4">
              {/* User block */}
              {loading ? (
                <div className="w-7 h-7 rounded-full border border-t-transparent border-purple-500 animate-spin" />
              ) : user ? (
                <div className="flex items-center gap-3 bg-[#111118] border border-[#1c1a2a] rounded-lg p-1.5 pr-3">
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

        {/* Mobile Sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 lg:hidden flex">
            <div className="w-60 h-full relative">
              {renderSidebarContent()}
              <button 
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute top-4 -right-10 p-1.5 bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-900 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
          </div>
        )}

        {/* Sub-Layout Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
          {children}
        </main>
      </div>

      <PasscodeModal 
        isOpen={isPasscodeModalOpen} 
        onClose={() => setIsPasscodeModalOpen(false)} 
        onSuccess={() => router.push('/admin')}
      />
    </div>
  );
}
