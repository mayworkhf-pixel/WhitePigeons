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
  Unlock,
  Info
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
    if (['home', 'about-us'].includes(tabId)) return 'text-purple-400/80';
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
      
      {/* Tabs list navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-2.5">
        {sidebarTabs.map((cat, idx) => (
          <div key={idx} className="space-y-0.5">
            <div className="px-2 text-[8px] font-sans font-black tracking-[0.18em] text-zinc-500 uppercase pb-0.5">
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
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded-md border text-[11px] font-sans font-bold transition-smooth cursor-pointer ${
                      isActive 
                        ? 'bg-purple-950/20 border-purple-800/40 text-white font-black shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                        : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[#131218]/45'
                    }`}
                  >
                    <item.icon className={`w-3 h-3 shrink-0 ${getIconColor(item.id, isActive)}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Admin Panel Gateway */}
      <div className="p-3 border-t border-[#131218]/80 bg-[#070709] shrink-0">
        {user?.admin_authenticated ? (
          <button 
            onClick={logout}
            className="w-full py-1.5 px-3 bg-red-950/15 hover:bg-red-950/30 border border-red-900/30 hover:border-red-800/50 text-red-400 hover:text-red-300 rounded-md text-[10px] font-sans font-bold transition-smooth flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3 h-3" />
            Lock Admin Console
          </button>
        ) : (
          <button 
            onClick={() => setIsPasscodeModalOpen(true)}
            className="w-full py-1.5 px-3 bg-purple-950/15 hover:bg-purple-950/30 border border-purple-800/30 hover:border-purple-700/50 text-purple-400 hover:text-purple-300 rounded-md text-[10px] font-sans font-bold transition-smooth flex items-center justify-center gap-1.5 cursor-pointer"
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
      <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden pb-12">
        
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

            {/* Logo and Title HUD */}
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="White Pigeons Logo" 
                className="h-10 w-auto object-contain hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_12px_rgba(168,85,247,0.25)] select-none"
              />
              <div className="flex flex-col">
                <span className="font-title font-black text-xl italic tracking-tight text-white leading-none">
                  {activeTab === 'home' ? 'Dashboard' : activeTab.toUpperCase().replace(/-/g, ' ')}
                </span>
                <span className="text-[10px] text-zinc-500 font-sans tracking-wide mt-1">
                  {activeTab === 'home' ? 'Welcome back, White Pigeons Family' : `Sync pipeline details for ${activeTab.replace(/-/g, ' ')}`}
                </span>
              </div>
            </div>

            {/* Profile widget */}
            <div className="flex items-center gap-4">
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
                  className="bg-purple-600/10 hover:bg-purple-600/25 text-purple-400 hover:text-white font-title text-[10px] font-black italic tracking-wide py-1.5 px-3 rounded border border-purple-500/40 hover:scale-[1.02] cursor-pointer transition-smooth flex items-center gap-1"
                >
                  <Unlock className="w-3.5 h-3.5" />
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
      </div>

      <PasscodeModal 
        isOpen={isPasscodeModalOpen} 
        onClose={() => setIsPasscodeModalOpen(false)} 
      />
    </div>
  );
}
