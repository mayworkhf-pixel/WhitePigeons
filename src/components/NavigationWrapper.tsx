'use client';

import React, { useState } from 'react';
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
  Unlock
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
    setActiveTab
  } = useApp();
  
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [showConsole, setShowConsole] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);

  // Dynamic admin panel tabs added to the top if authenticated
  const adminPanelTabs = user?.admin_authenticated ? [
    { category: 'ADMIN CONSOLE', items: [
      { id: 'admin-dashboard', label: 'Admin Dashboard', icon: Shield, href: '/admin' }
    ]}
  ] : [];

  // Main sidebar tabs definitions
  const mainSidebarTabs = [
    { category: 'MAIN', items: [
      { id: 'home', label: 'Home', icon: Flame, text: 'Home' }
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
      { id: 'long-time-kill-list', label: 'Long-Time-Kill-List', icon: Flame, text: 'Long-Time-Kill-List' },
      { id: 'weekly-kill-list', label: 'Weekly-Kill-List', icon: Flame, text: 'weekly-Kill-List' },
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

  // Specific visual coloring for icons in sidebar to match style
  const getIconColor = (tabId: string, isActive: boolean) => {
    if (isActive) return 'text-purple-400';
    if (tabId === 'home') return 'text-purple-400/80';
    if (tabId === 'admin-dashboard') return 'text-purple-400';
    if (tabId === 'admin-settings') return 'text-purple-400';
    if (['role-request', 'rolereq-review', 'strikes', 'tickets', 'check-balance'].includes(tabId)) return 'text-zinc-500';
    if (['leaderboard', 'long-time-kill-list', 'weekly-kill-list', 'submit-activity', 'activity-results', 'activity-points-leaderboard'].includes(tabId)) return 'text-red-500/70';
    if (['point-shop', 'activity-review', 'order-details'].includes(tabId)) return 'text-amber-500/70';
    if (['bonus-admin-panel', 'bonus-approval', 'bizwar-collect', 'rp-collect', 'public-winlog'].includes(tabId)) return 'text-green-500/70';
    return 'text-cyan-500/70';
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#070709] border-r border-[#151419] font-sans text-xs select-none">
      
      {/* Brand pigeon shield logo */}
      <div className="p-6 flex flex-col items-center justify-center border-b border-[#131218]/85 text-center bg-gradient-to-b from-[#121118]/20 to-transparent select-none">
        {/* Original Logo with embedded text */}
        <img 
          src="/logo.png" 
          alt="White Pigeons Logo" 
          className="w-40 h-auto object-contain hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)] mb-2"
        />
        <div className="text-[9px] font-tech tracking-[0.2em] text-purple-500 text-glow-magenta font-bold uppercase mt-1">
          TOP FAMILY IN GRAND RP EN3
        </div>
      </div>

      {/* Tabs list navigation */}
      <div className="flex-1 overflow-y-auto py-5 px-4 space-y-5">
        {sidebarTabs.map((cat, idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="px-2.5 text-[9px] font-sans font-black tracking-[0.18em] text-zinc-500 uppercase pb-0.5">
              {cat.category}
            </div>
            
            <div className="space-y-0.5">
              {cat.items.map((item) => {
                // If it is an admin-only tab and user is not admin authenticated, hide it completely
                if ('adminOnly' in item && item.adminOnly && !user?.admin_authenticated) {
                  return null;
                }

                const isHref = 'href' in item && !!item.href;
                const isActive = isHref
                  ? (typeof window !== 'undefined' && window.location.pathname === (item as any).href)
                  : (activeTab === item.id && typeof window !== 'undefined' && window.location.pathname === '/');
                
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
                    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg border text-xs font-sans font-bold transition-smooth cursor-pointer ${
                      isActive 
                        ? 'bg-purple-950/20 border-purple-800/40 text-white font-black shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                        : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[#131218]/45'
                    }`}
                  >
                    <item.icon className={`w-3.5 h-3.5 shrink-0 ${getIconColor(item.id, isActive)}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Admin Panel Gateway */}
      <div className="p-4 border-t border-[#131218]/80 bg-[#070709]">
        {user?.admin_authenticated ? (
          <button 
            onClick={logout}
            className="w-full py-2.5 px-4 bg-red-950/15 hover:bg-red-950/30 border border-red-900/30 hover:border-red-800/50 text-red-400 hover:text-red-300 rounded-xl text-xs font-sans font-bold transition-smooth flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_10px_rgba(239,68,68,0.03)]"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock Admin Console
          </button>
        ) : (
          <button 
            onClick={() => setIsPasscodeModalOpen(true)}
            className="w-full py-2.5 px-4 bg-purple-950/15 hover:bg-purple-950/30 border border-purple-800/30 hover:border-purple-700/50 text-purple-400 hover:text-purple-300 rounded-xl text-xs font-sans font-bold transition-smooth flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.03)]"
          >
            <Unlock className="w-3.5 h-3.5" />
            Access Admin Console
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex relative z-20 bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-72 bg-zinc-950 border-r border-[#151419] shrink-0 h-screen sticky top-0 overflow-y-auto">
        <div className="w-full h-full">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Main Core View Area */}
      <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden pb-36">
        
        {/* Top Header Grid HUD */}
        <header className="bg-zinc-950/80 border-b border-[#121117] backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Hamburger menu for mobile */}
            <button 
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="lg:hidden p-1.5 hover:bg-zinc-900 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Title HUD */}
            <div className="flex flex-col">
              <span className="font-title font-black text-xl italic tracking-tight text-white leading-none">
                {activeTab === 'home' ? 'Dashboard' : activeTab.toUpperCase().replace(/-/g, ' ')}
              </span>
              <span className="text-[10px] text-zinc-500 font-sans tracking-wide mt-1">
                {activeTab === 'home' ? 'Welcome back, White Pigeons Family' : `Sync pipeline details for ${activeTab.replace(/-/g, ' ')}`}
              </span>
            </div>

            {/* Profile widget and Bell badge */}
            <div className="flex items-center gap-4">
              {/* Notification bell */}
              <button 
                onClick={() => setShowNotifDrawer(true)}
                className="p-2 bg-[#121118] hover:bg-purple-950/20 border border-[#1e1b29] hover:border-purple-600/30 text-zinc-400 hover:text-white rounded-lg cursor-pointer relative transition-smooth"
              >
                <Bell className="w-4.5 h-4.5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[8px] font-sans font-bold px-1.5 py-0.5 rounded-full animate-bounce leading-none">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* User block */}
              {loading ? (
                <div className="w-7 h-7 rounded-full border border-t-transparent border-purple-500 animate-spin" />
              ) : user ? (
                <div className="flex items-center gap-3 bg-[#121118] border border-[#1e1b29] p-1.5 pr-4 rounded-xl">
                  <img 
                    src={user.avatar} 
                    alt={user.username} 
                    className="w-7.5 h-7.5 rounded-lg border border-purple-500/30"
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
                  className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-2 px-5 rounded-lg border border-purple-500 glow-magenta cursor-pointer transition-smooth"
                >
                  ENTER HUB
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 lg:hidden flex">
            <div className="w-72 h-full relative">
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

        {/* System notifications drawer */}
        {showNotifDrawer && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end">
            <div className="w-96 bg-[#09080d] border-l border-[#1c1a24] h-full flex flex-col shadow-2xl relative animate-slide-in font-sans">
              <div className="bg-[#121118] p-4 border-b border-[#1c1a24] flex items-center justify-between">
                <span className="font-title font-black italic tracking-wide text-purple-400 flex items-center gap-2">
                  <Bell className="w-5 h-5" /> SYSTEM LEDGER
                </span>
                <button 
                  onClick={() => setShowNotifDrawer(false)}
                  className="p-1.5 hover:bg-zinc-900 rounded text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 font-sans text-xs">
                    NO PENDING NOTIFICATIONS RECORDED.
                  </div>
                ) : (
                  notifications.map((notif) => {
                    let statusColor = 'border-[#1a1924] text-zinc-300';
                    if (notif.type === 'success') statusColor = 'border-green-500/25 text-green-400 bg-green-500/5';
                    if (notif.type === 'warning') statusColor = 'border-amber-500/25 text-amber-400 bg-amber-500/5';
                    if (notif.type === 'error') statusColor = 'border-red-500/25 text-red-400 bg-red-500/5';
                    if (notif.type === 'info') statusColor = 'border-purple-500/25 text-purple-400 bg-purple-500/5';

                    return (
                      <div 
                        key={notif.id} 
                        className={`border p-3.5 rounded-xl font-sans text-xs space-y-1 transition-smooth ${statusColor}`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{notif.title.toUpperCase()}</span>
                          <span className="text-[9px] text-zinc-500">
                            {new Date(notif.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-zinc-400 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live logs console */}
        <footer className="fixed bottom-0 left-0 right-0 z-30 lg:left-72 bg-[#070709] border-t border-[#131218]">
          <div className="bg-[#0b0a10] px-6 py-1.5 flex items-center justify-between border-b border-[#131218]">
            <button 
              onClick={() => setShowConsole(!showConsole)}
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 font-sans text-[10px] font-bold cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-purple-400" /> 
              DISCORD WEBHOOKS & BOT INTERACTION SIMULATOR LOGS
              <span className="text-[8px] bg-purple-950/40 text-purple-400 px-2 py-0.5 rounded font-bold uppercase leading-none border border-purple-800/10">
                {showConsole ? 'CLOSE' : 'OPEN'}
              </span>
            </button>
            
            <div className="text-[9px] font-sans text-zinc-650">
              Bidirectional WebSocket Stream Link
            </div>
          </div>

          {showConsole && (
            <div className="h-20 overflow-y-auto p-3.5 font-mono text-[9px] text-zinc-400 bg-black/90 space-y-1 select-text">
              {logs.length === 0 ? (
                <div className="text-zinc-700 italic">
                  &gt; Simulator Idle. Send a role request, trigger an activity, or collect BizWar profits to view real-time Discord channel log sync.
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2 hover:bg-zinc-900/50 py-0.5 px-1 leading-none">
                    <span className="text-purple-400 font-bold">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className="text-zinc-500">&gt;</span>
                    <span className="text-zinc-300 font-sans">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </footer>
      </div>

      <PasscodeModal 
        isOpen={isPasscodeModalOpen} 
        onClose={() => setIsPasscodeModalOpen(false)} 
      />
    </div>
  );
}
