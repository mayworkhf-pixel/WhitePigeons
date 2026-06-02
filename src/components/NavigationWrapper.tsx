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
    setActiveTab
  } = useApp();
  
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [showConsole, setShowConsole] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

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
            onClick={logout}
            className="w-full flex items-center gap-2.5 bg-[#0e0e16] border border-[#1c1a2a] rounded-lg p-2.5 text-red-400 hover:text-red-300 hover:border-red-900/40 transition-smooth cursor-pointer"
          >
            <Lock className="w-4 h-4 shrink-0" />
            <div className="flex-1 text-left">
              <div className="text-[12px] font-semibold">Lock Admin Console</div>
              <div className="text-[8px] text-zinc-500 mt-0.5">Administrator Access</div>
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
      />
    </div>
  );
}
