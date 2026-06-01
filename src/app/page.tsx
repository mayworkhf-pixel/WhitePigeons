'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/components/AppContext';
import { 
  Flame, Shield, Trophy, Users, Zap, ShieldAlert,
  Coins, Radio, Bell, Terminal, Clock, Settings,
  AlertTriangle, Ticket, TrendingUp, Send, CheckCircle,
  Award, Package, Sliders, CheckSquare, Factory, Play,
  Plus, CheckCircle2, XCircle, UserCheck, Eye, Trash, Star,
  Megaphone, ShoppingBag, ArrowRight, ClipboardList
} from 'lucide-react';

interface Strike {
  id: string;
  reason: string;
  date: string;
  issuedBy: string;
}

interface Member {
  discordId: string;
  username: string;
  nickname: string;
  roles: string[];
  kills: number;
  weeklyKills: number;
  balance: number;
  strikes: Strike[];
  points: number;
  isTop10: boolean;
  activityScore: number;
}

interface TicketModel {
  id: string;
  memberId: string;
  username: string;
  type: string;
  subject: string;
  description: string;
  status: string;
  response: string;
  createdAt: string;
}

interface ActivityModel {
  id: string;
  memberId: string;
  username: string;
  description: string;
  mediaUrl: string;
  pointsAwarded: number;
  status: string;
  reason: string;
  reviewedBy?: string;
  createdAt: string;
}

interface OrderModel {
  id: string;
  memberId: string;
  username: string;
  itemId: string;
  itemName: string;
  pointsPrice: number;
  status: string;
  createdAt: string;
}

interface WinModel {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
  participants: string;
  mediaUrl: string;
  createdAt: string;
}

interface SignupModel {
  eventId: string;
  memberId: string;
  username: string;
  signedUpAt: string;
  isTop10: boolean;
  status: 'confirmed' | 'reserve' | 'displaced';
}

// Helper to format countdown from milliseconds to HH:MM:SS
const formatCountdownStr = (ms: number) => {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function RootDashboard() {
  const { user, activeTab, setActiveTab, addNotification, timers, refreshUser, API_BASE_URL } = useApp();

  // Core Data states
  const [members, setMembers] = useState<Member[]>([]);
  const [tickets, setTickets] = useState<TicketModel[]>([]);
  const [activities, setActivities] = useState<ActivityModel[]>([]);
  const [orders, setOrders] = useState<OrderModel[]>([]);
  const [wins, setWins] = useState<WinModel[]>([]);
  
  // Signups
  const [rpSignups, setRpSignups] = useState<SignupModel[]>([]);
  const [informalSignups, setInformalSignups] = useState<SignupModel[]>([]);
  
  // Economy logs
  const [bizwarLogs, setBizwarLogs] = useState<any[]>([]);
  const [rpLogs, setRpLogs] = useState<any[]>([]);
  const [rpTotalStock, setRpTotalStock] = useState(1235);
  
  // Form states
  const [roleRequestForm, setRoleRequestForm] = useState({ gameId: '', reason: '', currentRoles: '' });
  const [ticketForm, setTicketForm] = useState({ type: 'complaint', subject: '', description: '' });
  const [activityForm, setActivityForm] = useState({ description: '', mediaUrl: '' });
  const [bizwarForm, setBizwarForm] = useState({ businessName: 'Hotel Factory', amount: '' });
  const [rpCollectForm, setRpCollectForm] = useState({ ticketsCollected: '5' });
  const [winForm, setWinForm] = useState({ type: 'event', title: '', description: '', participants: '', mediaUrl: '' });
  
  // Admin action inputs
  const [strikeForm, setStrikeForm] = useState({ memberId: '', reason: '', strikeRole: 'Striked Player' });
  const [roleReviewForm, setRoleReviewForm] = useState<Record<string, { nickname: string; roleToGrant: string; reason: string }>>({});
  const [activityReviewForm, setActivityReviewForm] = useState<Record<string, { points: string; reason: string }>>({});
  const [ticketResolveForm, setTicketResolveForm] = useState<Record<string, string>>({});
  const [bonusApprovalForm, setBonusApprovalForm] = useState<Record<string, { finalAmount: string; comment: string }>>({});
  
  // Event controls (Admin)
  const [eventTriggerForm, setEventTriggerForm] = useState({ title: '', description: '' });

  // Shop state
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [shopBalance, setShopBalance] = useState(0);

  // General timers
  const [rpCountdown, setRpCountdown] = useState('00:32:10');
  const [loading, setLoading] = useState(true);

  const isLeaderOrAdmin = user?.roles && (user.roles.includes('Leadership') || user.roles.includes('Admin'));

  // Load backend data helper
  const loadDashboardData = async () => {
    try {
      const membersRes = await fetch(`${API_BASE_URL}/api/members`);
      if (membersRes.ok) setMembers(await membersRes.json());

      const winsRes = await fetch(`${API_BASE_URL}/api/wins`);
      if (winsRes.ok) setWins(await winsRes.json());

      if (user) {
        const ticketRes = await fetch(`${API_BASE_URL}/api/tickets`);
        if (ticketRes.ok) setTickets(await ticketRes.json());

        const actRes = await fetch(`${API_BASE_URL}/api/activities`);
        if (actRes.ok) setActivities(await actRes.json());

        const bizRes = await fetch(`${API_BASE_URL}/api/economy/bizwar-collect`);
        if (bizRes.ok) setBizwarLogs(await bizRes.json());

        const rpRes = await fetch(`${API_BASE_URL}/api/economy/rp-collect`);
        if (rpRes.ok) {
          const rpData = await rpRes.json();
          setRpLogs(rpData.logs);
          setRpTotalStock(rpData.totalCollected);
        }

        const shopRes = await fetch(`${API_BASE_URL}/api/shop/items`);
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          setShopItems(shopData.items);
          setShopBalance(shopData.pointsBalance);
        }
      }

      if (isLeaderOrAdmin) {
        const orderRes = await fetch(`${API_BASE_URL}/api/shop/orders`);
        if (orderRes.ok) setOrders(await orderRes.json());
      }
    } catch (e) {
      console.warn('Failed to load full API datasets.');
    } finally {
      setLoading(false);
    }
  };

  // Poll event signups
  const loadSignups = async () => {
    try {
      const rpRes = await fetch(`${API_BASE_URL}/api/events/signup/rp-signup`);
      if (rpRes.ok) setRpSignups(await rpRes.json());

      const infRes = await fetch(`${API_BASE_URL}/api/events/signup/informal-signup`);
      if (infRes.ok) setInformalSignups(await infRes.json());
    } catch (e) {}
  };

  // Run data timers & queries on mount
  useEffect(() => {
    loadDashboardData();
    loadSignups();
    const interval = setInterval(loadSignups, 5000);
    return () => clearInterval(interval);
  }, [user, activeTab]);

  // RP collection countdown top-of-hour
  useEffect(() => {
    const updateRpCountdown = () => {
      const now = new Date();
      const nextHour = new Date();
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);
      const diff = nextHour.getTime() - now.getTime();
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRpCountdown(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };
    updateRpCountdown();
    const interval = setInterval(updateRpCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Form submission: Role Request
  const handleRoleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleRequestForm.gameId || !roleRequestForm.reason) {
      addNotification('Form Error', 'Please complete all fields.', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/members/role-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleRequestForm)
      });
      if (res.ok) {
        addNotification('Application Sent', 'Role Request posted to Discord for Leadership audit.', 'success');
        setRoleRequestForm({ gameId: '', reason: '', currentRoles: '' });
      }
    } catch (e) {
      addNotification('Request Failed', 'Network failure.', 'error');
    }
  };

  // Form submission: Support ticket
  const handleRaiseTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.subject || !ticketForm.description) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketForm)
      });
      if (res.ok) {
        addNotification('Ticket Logged', 'Support/Bonus ticket registered in pipeline.', 'success');
        setTicketForm({ type: 'complaint', subject: '', description: '' });
        loadDashboardData();
      }
    } catch (e) {}
  };

  // Form submission: Submit Activity
  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.description || !activityForm.mediaUrl) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityForm)
      });
      if (res.ok) {
        addNotification('Activity Logged', 'Submission sent to bot. Awaiting review.', 'success');
        setActivityForm({ description: '', mediaUrl: '' });
        loadDashboardData();
      }
    } catch (e) {}
  };

  // Form submission: BizWar Collect
  const handleBizwarCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizwarForm.amount) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/economy/bizwar-collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bizwarForm)
      });
      if (res.ok) {
        addNotification('Profits Logged', 'BizWar revenue logged and balance adjusted.', 'success');
        setBizwarForm({ businessName: 'Hotel Factory', amount: '' });
        loadDashboardData();
        refreshUser();
      }
    } catch (e) {}
  };

  // Form submission: RP Collect
  const handleRpCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/economy/rp-collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpCollectForm)
      });
      if (res.ok) {
        addNotification('Collection Logged', 'RP Tickets harvested to family ledger.', 'success');
        loadDashboardData();
      }
    } catch (e) {}
  };

  // Purchase item
  const handlePurchaseItem = async (itemId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/shop/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      });
      if (res.ok) {
        addNotification('Item Purchased', 'Order dispatched. Points deducted.', 'success');
        loadDashboardData();
        refreshUser();
      } else {
        const err = await res.json();
        addNotification('Purchase Denied', err.error || 'Failed to complete order.', 'warning');
      }
    } catch (e) {}
  };

  // Admin audit: Role requests
  const handleRoleReview = async (memberId: string, status: 'approved' | 'rejected') => {
    const fields = roleReviewForm[memberId] || { nickname: '', roleToGrant: 'Member', reason: '' };
    try {
      const res = await fetch(`${API_BASE_URL}/api/members/role-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, status, ...fields })
      });
      if (res.ok) {
        addNotification('Decision Logged', `Role request review logged as: ${status.toUpperCase()}`, 'success');
        loadDashboardData();
      }
    } catch (e) {}
  };

  // Admin audit: Strike issue
  const handleIssueStrike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strikeForm.memberId || !strikeForm.reason) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/discipline/strike`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(strikeForm)
      });
      if (res.ok) {
        addNotification('Strike Logged', 'Strike issued and role assigned on Discord.', 'success');
        setStrikeForm({ memberId: '', reason: '', strikeRole: 'Striked Player' });
        loadDashboardData();
      }
    } catch (e) {}
  };

  // Admin audit: Resolve tickets
  const handleResolveTicket = async (ticketId: string) => {
    const response = ticketResolveForm[ticketId] || '';
    if (!response) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
      });
      if (res.ok) {
        addNotification('Ticket Resolved', 'Ticket closed. Dispatched response to member.', 'success');
        loadDashboardData();
      }
    } catch (e) {}
  };

  // Admin audit: Bonus Approval
  const handleBonusApproval = async (ticketId: string, status: 'approved' | 'rejected') => {
    const fields = bonusApprovalForm[ticketId] || { finalAmount: '0', comment: '' };
    try {
      const res = await fetch(`${API_BASE_URL}/api/economy/bonus-approval/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...fields })
      });
      if (res.ok) {
        addNotification('Bonus Decided', `Disbursement processed: ${status.toUpperCase()}`, 'success');
        loadDashboardData();
        refreshUser();
      }
    } catch (e) {}
  };

  // Admin audit: Complete Order
  const handleCompleteOrder = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/shop/orders/${orderId}/complete`, { method: 'POST' });
      if (res.ok) {
        addNotification('Order Completed', 'Inventory items dispatched to client.', 'success');
        loadDashboardData();
      }
    } catch (e) {}
  };

  // Admin audit: Review Activity
  const handleReviewActivity = async (activityId: string, status: 'approved' | 'rejected') => {
    const fields = activityReviewForm[activityId] || { points: '150', reason: '' };
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities/${activityId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...fields })
      });
      if (res.ok) {
        addNotification('Activity Reviewed', `Logged review: ${status.toUpperCase()}`, 'success');
        loadDashboardData();
        refreshUser();
      }
    } catch (e) {}
  };

  // Event signup execution
  const handleEventSignup = async (eventId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/signup/${eventId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (data.action === 'confirmed') addNotification('Roster Joined', 'Spot confirmed in tactical team!', 'success');
        else if (data.action === 'displaced') addNotification('Vanguard Priority', 'Top 10 priority displacement applied!', 'success');
        else addNotification('Queue Full', 'Placed in the reserve queue.', 'info');
        loadSignups();
      } else {
        addNotification('Signup Denied', data.error || 'Check parameters.', 'warning');
      }
    } catch (e) {}
  };

  // Open active signup channel
  const handleTriggerSignupWindow = async (eventId: string, title: string, desc: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, title, description: desc })
      });
      if (res.ok) {
        addNotification('Signup Window Triggered', `Roster registration opened for ${title}.`, 'success');
        loadSignups();
      }
    } catch (e) {}
  };

  // Wipe rosters
  const handleClearSignupRoster = async (eventId: string) => {
    if (!confirm('Are you sure you want to flush the signed up player roster?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/clear/${eventId}`, { method: 'POST' });
      if (res.ok) {
        addNotification('Roster Cleared', 'Roster lists reset successfully.', 'info');
        loadSignups();
      }
    } catch (e) {}
  };

  // Log public win
  const handleLogWin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!winForm.title || !winForm.description) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/wins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(winForm)
      });
      if (res.ok) {
        addNotification('Win Logged', 'Victory report published in public channels.', 'success');
        setWinForm({ type: 'event', title: '', description: '', participants: '', mediaUrl: '' });
        loadDashboardData();
      }
    } catch (e) {}
  };

  // Shared Denied handler
  const checkAccess = (tier: 'member' | 'admin') => {
    if (!user) return false;
    if (tier === 'admin') return isLeaderOrAdmin;
    return true; // Member tier
  };

  const renderAccessDenied = (requiredRole: string) => (
    <div className="bg-zinc-950 border border-red-500/20 rounded p-8 flex flex-col items-center justify-center text-center shadow-lg max-w-md mx-auto my-12 relative overflow-hidden font-tech">
      <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
      <AlertTriangle className="w-12 h-12 text-red-500 animate-pulse mb-4" />
      <h2 className="font-title font-black text-xl italic text-red-500 tracking-wider">
        AUTHENTICATION REFUSED
      </h2>
      <p className="text-xs text-zinc-400 mt-2 leading-relaxed font-sans">
        This channel contains classified intelligence. Your current security tier does not authorize access.
      </p>
      <div className="mt-6 bg-zinc-900 border border-zinc-800 p-3 rounded text-[10px] text-zinc-500 w-full">
        REQUIRED TIER: <span className="text-red-400 font-bold uppercase">{requiredRole}</span>
        <span className="block mt-1 font-mono text-[9px] text-zinc-650">Select a different Mode at the bottom of the sidebar to switch tiers.</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="text-center py-36 font-tech text-xs text-zinc-500 animate-pulse">
        CONNECTING TO WHITE PIGEON INTEGRATION API NODE...
      </div>
    );
  }

  // -----------------------------------------------------------------
  // TABS RENDERING CONTEXTS
  // -----------------------------------------------------------------

  const renderHome = () => {
    return (
      <div className="flex flex-col gap-6 font-sans">
        
        {/* Top metrics row matching the screenshot */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-5">
          <div className="bg-[#121118] border border-[#1e1b29] p-5 rounded-2xl flex items-center gap-4 hover:border-purple-600/25 transition-smooth relative overflow-hidden shadow-lg select-none">
            <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-800/25 flex items-center justify-center text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase tracking-widest block leading-none">MEMBERS</span>
              <span className="text-2xl font-title font-black italic text-white block mt-1.5 leading-none">128</span>
              <span className="text-[9px] text-zinc-500 mt-1 block">Active Members</span>
            </div>
          </div>

          <div className="bg-[#121118] border border-[#1e1b29] p-5 rounded-2xl flex items-center gap-4 hover:border-purple-600/25 transition-smooth relative overflow-hidden shadow-lg select-none">
            <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-800/25 flex items-center justify-center text-purple-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase tracking-widest block leading-none">WINS</span>
              <span className="text-2xl font-title font-black italic text-white block mt-1.5 leading-none">247</span>
              <span className="text-[9px] text-zinc-500 mt-1 block">Total Wins</span>
            </div>
          </div>

          <div className="bg-[#121118] border border-[#1e1b29] p-5 rounded-2xl flex items-center gap-4 hover:border-purple-600/25 transition-smooth relative overflow-hidden shadow-lg select-none">
            <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-800/25 flex items-center justify-center text-purple-400">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase tracking-widest block leading-none">RP TICKETS</span>
              <span className="text-2xl font-title font-black italic text-white block mt-1.5 leading-none">1,235</span>
              <span className="text-[9px] text-zinc-500 mt-1 block">Total Collected</span>
            </div>
          </div>

          <div className="bg-[#121118] border border-[#1e1b29] p-5 rounded-2xl flex items-center gap-4 hover:border-purple-600/25 transition-smooth relative overflow-hidden shadow-lg select-none">
            <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-800/25 flex items-center justify-center text-purple-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase tracking-widest block leading-none">BUSINESSES</span>
              <span className="text-2xl font-title font-black italic text-white block mt-1.5 leading-none">18</span>
              <span className="text-[9px] text-zinc-500 mt-1 block">Owned</span>
            </div>
          </div>

          <div className="bg-[#121118] border border-[#1e1b29] p-5 rounded-2xl flex items-center gap-4 hover:border-purple-600/25 transition-smooth relative overflow-hidden shadow-lg select-none col-span-2 md:col-span-1">
            <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-800/25 flex items-center justify-center text-purple-400">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase tracking-widest block leading-none">ACTIVITY POINTS</span>
              <span className="text-2xl font-title font-black italic text-white block mt-1.5 leading-none">98,760</span>
              <span className="text-[9px] text-zinc-500 mt-1 block">Total Points</span>
            </div>
          </div>
        </section>

        {/* Announcements section with pigeon artwork on the right */}
        <section className="bg-[#121118] border border-[#1e1b29] rounded-2xl p-6 relative overflow-hidden shadow-lg">
          {/* Subtle graphic background placeholder representation for style alignment */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-5 bg-gradient-to-l from-white to-transparent pointer-events-none select-none" />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-800/25 flex items-center justify-center text-purple-400 shrink-0 mt-1">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <h3 className="font-title font-black text-sm italic tracking-widest text-white uppercase leading-none">ANNOUNCEMENTS</h3>
                <ul className="space-y-1.5 text-xs text-zinc-300 font-sans mt-2 list-disc list-inside">
                  <li>
                    RP SIGNUP starts in <span className="text-purple-400 font-mono font-bold">{timers.nextInformalCountdown ? formatCountdownStr(timers.nextInformalCountdown + 3600000) : '02:15:34'}</span>
                  </li>
                  <li>
                    Informal Fight in <span className="text-purple-400 font-mono font-bold">{formatCountdownStr(timers.nextInformalCountdown)}</span>
                  </li>
                  <li>
                    Weekly Kill List resets in <span className="text-purple-400 font-sans font-bold">4d 12h 32m</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="text-right shrink-0 border-l border-zinc-800/60 pl-6 h-full flex flex-col justify-center">
              <span className="font-title font-black text-xl italic tracking-tight text-purple-500 leading-none">LOYALTY.</span>
              <span className="block text-[10px] tracking-widest text-zinc-500 uppercase font-bold mt-1.5 leading-none">RESPECT. POWER.</span>
            </div>
          </div>
        </section>

        {/* Quick actions buttons matching the screenshot */}
        <section className="space-y-2">
          <span className="text-[9px] font-sans font-black tracking-widest text-zinc-500 uppercase px-1">QUICK ACTIONS</span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { id: 'role-request', label: 'Role Request', icon: ClipboardList },
              { id: 'submit-activity', label: 'Submit Activity', icon: Send },
              { id: 'check-balance', label: 'Check Balance', icon: Coins },
              { id: 'point-shop', label: 'Point Shop', icon: ShoppingBag },
              { id: 'rp-signup', label: 'RP Signup', icon: Users }
            ].map((act) => (
              <button
                key={act.id}
                onClick={() => setActiveTab(act.id)}
                className="bg-[#121118] border border-[#1e1b29] hover:border-purple-600/35 p-4 rounded-xl flex items-center justify-center gap-3 transition-smooth cursor-pointer text-xs font-sans font-bold text-zinc-300 hover:text-white select-none text-center shadow-md"
              >
                <act.icon className="w-4 h-4 text-purple-400" />
                <span>{act.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Recent activity & Top Players side-by-side matching the screenshot */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* RECENT ACTIVITY */}
          <div className="bg-[#121118] border border-[#1e1b29] p-5 rounded-2xl space-y-4 shadow-lg">
            <span className="text-[9px] font-sans font-black tracking-widest text-zinc-500 uppercase border-b border-[#1c1a24] pb-2 block">
              RECENT ACTIVITY
            </span>
            
            <div className="space-y-4 font-sans text-xs">
              {[
                { text: 'Raven submitted an activity', time: '2 min ago', dot: 'bg-green-500', icon: ClipboardList },
                { text: 'Phantom collected RP Ticket', time: '12 min ago', dot: 'bg-green-500', icon: Ticket },
                { text: 'Nova requested a role', time: '18 min ago', dot: 'bg-red-500', icon: UserCheck },
                { text: 'Strike issued to Joker', time: '25 min ago', dot: 'bg-red-500', icon: AlertTriangle },
                { text: 'Order #1023 completed', time: '35 min ago', dot: 'bg-green-500', icon: ShoppingBag }
              ].map((act, idx) => (
                <div key={idx} className="flex justify-between items-center bg-[#181622]/20 p-2.5 rounded-xl border border-[#1a1924]/60">
                  <div className="flex items-center gap-3">
                    <act.icon className="w-4 h-4 text-purple-400/80" />
                    <span className="text-zinc-200 font-bold">{act.text}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500 text-[10px]">
                    <span>{act.time}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${act.dot} animate-pulse`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TOP PLAYERS (THIS WEEK) */}
          <div className="bg-[#121118] border border-[#1e1b29] p-5 rounded-2xl space-y-4 shadow-lg">
            <div className="flex justify-between items-center border-b border-[#1c1a24] pb-2">
              <span className="text-[9px] font-sans font-black tracking-widest text-zinc-500 uppercase">
                TOP PLAYERS (THIS WEEK)
              </span>
              <button onClick={() => setActiveTab('leaderboard')} className="text-[10px] text-purple-400 hover:text-white font-bold flex items-center gap-1 cursor-pointer">
                View Leaderboard <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="text-zinc-500 uppercase text-[9px] tracking-wider border-b border-[#1d1c25] pb-1">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Player</th>
                    <th className="py-2 px-2 text-center">Events</th>
                    <th className="py-2 px-2 text-center">Wins</th>
                    <th className="py-2 px-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181622]/40 font-medium">
                  {[
                    { rank: 1, name: 'Phantom', events: 15, wins: 12, points: '5,420', dot: 'bg-yellow-500' },
                    { rank: 2, name: 'Raven', events: 13, wins: 10, points: '4,890', dot: 'bg-zinc-400' },
                    { rank: 3, name: 'Nova', events: 11, wins: 8, points: '4,120', dot: 'bg-amber-700' },
                    { rank: 4, name: 'Shadow', events: 10, wins: 7, points: '3,760' },
                    { rank: 5, name: 'Blaze', events: 9, wins: 6, points: '3,240' }
                  ].map((player, idx) => (
                    <tr key={idx} className="hover:bg-[#1a1924]/20 transition-smooth">
                      <td className="py-2.5 px-2">
                        {player.rank <= 3 ? (
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black ${player.dot}`}>
                            {player.rank}
                          </div>
                        ) : (
                          <span className="text-zinc-500 pl-1.5">{player.rank}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 font-bold text-zinc-100">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#181622] border border-purple-500/20 flex items-center justify-center text-[9px] text-purple-400">
                            WP
                          </div>
                          {player.name}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-zinc-300">{player.events}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-zinc-300">{player.wins}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-purple-400">{player.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* RP Ticket Factory & Informal Reminder side-by-side */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RP Ticket Factory */}
          <div className="lg:col-span-2 bg-[#121118] border border-[#1e1b29] p-5 rounded-2xl space-y-4 shadow-lg flex flex-col justify-between">
            <div className="flex items-center gap-2 border-b border-[#1c1a24] pb-2">
              <Ticket className="w-5 h-5 text-purple-400" />
              <span className="text-[10px] font-sans font-black tracking-widest text-zinc-200 uppercase">
                RP TICKET FACTORY
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
              <div>
                <span className="text-[9px] text-zinc-500 font-bold block uppercase leading-none">TODAY COLLECTED</span>
                <span className="text-2xl font-title font-black text-zinc-200 mt-2 block leading-none">60 / 120</span>
                <span className="text-[8px] text-zinc-650 mt-1 block">Total Possible (6 Weeks)</span>
              </div>
              
              <div>
                <span className="text-[9px] text-zinc-500 font-bold block uppercase leading-none">NEXT COLLECTION IN</span>
                <span className="text-2xl font-title font-black text-purple-400 mt-2 block leading-none font-mono">{rpCountdown}</span>
              </div>

              <div>
                <span className="text-[9px] text-zinc-500 font-bold block uppercase leading-none">PROGRESS</span>
                <div className="w-full bg-[#181622] h-1.5 rounded-full overflow-hidden mt-2">
                  <div className="bg-purple-600 h-full" style={{ width: '40%' }} />
                </div>
                <div className="flex justify-between text-[8px] text-zinc-500 mt-1.5 leading-none">
                  <span>Week 2 of 6</span>
                  <span>Missed: 15</span>
                </div>
              </div>
            </div>

            {user ? (
              <button 
                onClick={handleRpCollect}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-2.5 rounded-lg border border-purple-500 glow-magenta transition-smooth cursor-pointer"
              >
                Collect Now (5 RP)
              </button>
            ) : (
              <div className="text-[10px] text-center text-zinc-650 italic py-2 bg-zinc-900/40 border border-zinc-900 rounded select-none">
                Identity authentication required to harvest tickets.
              </div>
            )}
          </div>

          {/* Informal Fight Reminder */}
          <div className="lg:col-span-1 bg-[#121118] border border-[#1e1b29] p-5 rounded-2xl space-y-4 shadow-lg flex flex-col justify-between">
            <div className="flex items-center gap-2 border-b border-[#1c1a24] pb-2">
              <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="text-[10px] font-sans font-black tracking-widest text-zinc-200 uppercase">
                INFORMAL FIGHT REMINDER
              </span>
            </div>

            <div className="py-2">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase leading-none">NEXT FIGHT IN</span>
              <span className="text-3xl font-title font-black text-purple-400 mt-2 block leading-none font-mono">
                {timers.nextInformalCountdown ? formatCountdownStr(timers.nextInformalCountdown) : '00:32:10'}
              </span>
              <span className="text-[9px] text-zinc-500 mt-1.5 block">Every 1h 44m battle cycle</span>
            </div>

            <button 
              onClick={() => setActiveTab('informal-signup')}
              className="w-full border border-purple-500/30 hover:border-purple-500/70 hover:bg-purple-950/20 text-purple-400 hover:text-white font-title text-xs font-black italic tracking-wide py-2.5 rounded-lg transition-smooth cursor-pointer"
            >
              View Signup
            </button>
          </div>
        </section>

        {/* Details about the family block matching the requested tab: About Us */}
        <section className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 shadow-md font-sans">
          <h3 className="font-title font-black text-lg italic text-white flex items-center gap-2 border-b border-[#1c1a24] pb-2">
            📖 ABOUT US
          </h3>
          <p className="text-zinc-400 text-xs leading-relaxed font-sans">
            White Pigeon is a military-styled open world family operating under Server 3 rules of Grand RP. Founded as a combat-centric organization, we dominate major turf battlefields and hold multiple illegal income streams including the RP Ticket factories. 
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 font-sans">
            <div className="bg-[#181622]/40 p-4 border border-[#1a1924] rounded-xl text-xs space-y-1.5">
              <span className="font-bold text-purple-400 uppercase tracking-wider block text-[10px]">Active Turf Wars</span>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                We organize gunfight runs for hotel factories, Ammunation sites, and oil well turfs hourly. Top marksmen maintain prioritized queue registration.
              </p>
            </div>
            <div className="bg-[#181622]/40 p-4 border border-[#1a1924] rounded-xl text-xs space-y-1.5">
              <span className="font-bold text-purple-400 uppercase tracking-wider block text-[10px]">Family Points Economy</span>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Collecting profits is logged. For every delivery, members earn Family Points (FP) that can be traded for weapons, customized VIP license plates, and Tier-3 armor plates in the points store.
              </p>
            </div>
          </div>
        </section>

      </div>
    );
  };

  const renderRoleRequest = () => {
    if (!checkAccess('member')) return renderAccessDenied('Member access token required');
    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-2xl mx-auto shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2">
          📋┃𝐑𝐨𝐥𝐞-𝐑𝐞𝐪𝐮𝐞𝐬𝐭 APPLICATION
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed font-sans">
          Submit your official server role application. Your request will post to the Discord channel `#Role-Request` via bot, and leadership will update your handle name formats and active guild roles.
        </p>

        <form onSubmit={handleRoleRequest} className="font-sans text-xs flex flex-col gap-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 font-bold block mb-1">IN-GAME IDENTIFICATION ID</label>
              <input 
                type="text"
                value={roleRequestForm.gameId}
                onChange={(e) => setRoleRequestForm(prev => ({ ...prev, gameId: e.target.value }))}
                placeholder="e.g. 28402"
                className="w-full bg-[#09080d] border border-[#1e1b29] rounded-xl p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 font-bold block mb-1">CURRENT RANK/ROLES</label>
              <input 
                type="text"
                value={roleRequestForm.currentRoles}
                onChange={(e) => setRoleRequestForm(prev => ({ ...prev, currentRoles: e.target.value }))}
                placeholder="e.g. Recruit / Member"
                className="w-full bg-[#09080d] border border-[#1e1b29] rounded-xl p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 font-bold block mb-1">REASON FOR APPLICATION</label>
            <textarea 
              rows={4}
              value={roleRequestForm.reason}
              onChange={(e) => setRoleRequestForm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Detail your request..."
              className="w-full bg-[#09080d] border border-[#1e1b29] rounded-xl p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans"
            />
          </div>

          <button 
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta transition-smooth cursor-pointer"
          >
            DISPATCH TO DISCORD WEBHOOK
          </button>
        </form>
      </div>
    );
  };

  const renderRoleReqReview = () => {
    if (!checkAccess('admin')) return renderAccessDenied('Leadership authority authorization required');
    
    // Roster queue list
    const pendingApplicants = [
      { id: 'mock-member1', username: 'VitoScaletta', gameId: '28402', reason: 'I am active in turf wars daily. Requesting Fighter rank.', currentRoles: 'Recruit' },
      { id: 'mock-member2', username: 'TonyMontana', gameId: '39482', reason: 'Need access to the points system and point store.', currentRoles: 'None' }
    ];

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2">
          📜╰𝐑𝐨𝐥𝐞𝐑𝐞𝐪-𝐑𝐞𝐯𝐢𝐞𝐰 PANEL
        </h2>
        
        <div className="space-y-4 font-sans text-xs">
          {pendingApplicants.map((req) => {
            const fields = roleReviewForm[req.id] || { nickname: `WP | ${req.username}`, roleToGrant: 'Member', reason: '' };
            
            return (
              <div key={req.id} className="bg-[#181622]/40 border border-[#1e1b29] p-4 rounded-xl flex flex-col md:flex-row gap-6 justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200">@{req.username}</span>
                    <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">ID: {req.gameId}</span>
                    <span className="text-[9px] bg-zinc-950 text-zinc-400 px-1.5 py-0.5 rounded border border-[#1c1a24]">Role: {req.currentRoles}</span>
                  </div>
                  <p className="text-zinc-400 italic bg-[#09080d] p-2.5 rounded-lg border border-[#1e1b29] leading-relaxed">
                    &quot;{req.reason}&quot;
                  </p>
                </div>

                <div className="w-full md:w-64 flex flex-col gap-3 border-t md:border-t-0 md:border-l border-[#1e1b29]/65 pt-4 md:pt-0 md:pl-4">
                  <div>
                    <label className="text-[9px] text-zinc-500 font-bold block mb-1">CORRECT NICKNAME HANDLE</label>
                    <input 
                      type="text"
                      value={fields.nickname}
                      onChange={(e) => setRoleReviewForm(prev => ({
                        ...prev,
                        [req.id]: { ...(prev[req.id] || { nickname: '', roleToGrant: 'Member', reason: '' }), nickname: e.target.value }
                      }))}
                      placeholder="WP | VitoFighter" 
                      className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-1.5 text-xs text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[9px] text-zinc-500 font-bold block mb-1">GRANT ROLE</label>
                    <select 
                      value={fields.roleToGrant}
                      onChange={(e) => setRoleReviewForm(prev => ({
                        ...prev,
                        [req.id]: { ...(prev[req.id] || { nickname: '', roleToGrant: 'Member', reason: '' }), roleToGrant: e.target.value }
                      }))}
                      className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-1.5 text-xs text-zinc-300 outline-none font-sans"
                    >
                      <option value="Member">Member</option>
                      <option value="Fighter">Fighter</option>
                      <option value="Elite Shooter">Elite Shooter</option>
                      <option value="Top-10">Top-10 Priority</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button onClick={() => handleRoleReview(req.id, 'approved')} className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg py-1.5 font-bold cursor-pointer text-[10px]">
                      APPROVE
                    </button>
                    <button onClick={() => handleRoleReview(req.id, 'rejected')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg py-1.5 font-bold cursor-pointer text-[10px]">
                      REJECT
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStrikes = () => {
    const isAuditor = checkAccess('admin');

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto font-sans">
        {/* Issue Strike (Admin) */}
        {isAuditor && (
          <div className="lg:col-span-1 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 h-fit shadow-xl">
            <h3 className="font-title font-bold text-xs text-primary tracking-wide uppercase border-b border-[#1c1a24] pb-2">
              🚨┃𝐒𝐭𝐫𝐢𝐤𝐞𝐬 DISCIPLINE DESK
            </h3>

            <form onSubmit={handleIssueStrike} className="font-sans text-xs flex flex-col gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">SELECT MEMBER TO DISCIPLINE</label>
                <select 
                  value={strikeForm.memberId}
                  onChange={(e) => setStrikeForm(prev => ({ ...prev, memberId: e.target.value }))}
                  className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 outline-none font-sans"
                >
                  <option value="">-- Choose Member --</option>
                  {members.map(m => (
                    <option key={m.discordId} value={m.discordId}>@{m.username} ({m.nickname})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">INFRACTION DETAIL</label>
                <textarea 
                  rows={4}
                  value={strikeForm.reason}
                  onChange={(e) => setStrikeForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Infraction reasons..."
                  className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans"
                />
              </div>

              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">
                ISSUE STRIKE LOG
              </button>
            </form>
          </div>
        )}

        {/* Strikes Ledger */}
        <div className={`${isAuditor ? 'lg:col-span-2' : 'lg:col-span-3'} bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 shadow-xl`}>
          <h2 className="font-title font-black text-lg italic text-zinc-200 border-b border-[#1c1a24] pb-2">
            🚨 SYSTEM STRIKE ARCHIVES
          </h2>

          <div className="space-y-4 font-sans text-xs">
            {members.filter(m => m.strikes && m.strikes.length > 0).length === 0 ? (
              <div className="text-center py-12 text-zinc-500 italic">
                NO INFRACTIONS DETECTED ON SYSTEM REGISTRY.
              </div>
            ) : (
              members.filter(m => m.strikes && m.strikes.length > 0).map((m) => (
                <div key={m.discordId} className="bg-[#181622]/40 border border-[#1e1b29] p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center border-b border-[#1e1b29] pb-1.5">
                    <span className="font-bold text-red-400 uppercase tracking-wider text-[10px]">@{m.username} ({m.nickname})</span>
                    <span className="bg-red-500/10 text-red-500 border border-red-500/25 px-2 py-0.5 rounded font-black text-[9px]">{m.strikes.length} ACTIVE STRIKES</span>
                  </div>
                  <div className="space-y-3 mt-2 pl-2 border-l border-zinc-800">
                    {m.strikes.map((st, sIdx) => (
                      <div key={sIdx} className="text-xs">
                        <p className="text-zinc-300">&quot;{st.reason}&quot;</p>
                        <div className="text-[9px] text-zinc-500 mt-1 flex justify-between">
                          <span>Issued by: {st.issuedBy}</span>
                          <span>{new Date(st.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTickets = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster account verification required');
    const isAuditor = checkAccess('admin');

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto font-sans">
        {/* Raise Ticket */}
        <div className="lg:col-span-1 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 h-fit shadow-xl">
          <h3 className="font-title font-bold text-xs text-primary tracking-wide uppercase border-b border-[#1c1a24] pb-2">
            🎫 Raise Support Complaint
          </h3>

          <form onSubmit={handleRaiseTicket} className="font-sans text-xs flex flex-col gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 font-bold block mb-1">TICKET TIER CATEGORY</label>
              <select 
                value={ticketForm.type}
                onChange={(e) => setTicketForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 outline-none font-sans"
              >
                <option value="complaint">Syndicate / Player Complaint</option>
                <option value="request">Bonus / Payout Claim</option>
                <option value="suggestion">Structural Suggestion</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 font-bold block mb-1">HEADER SUBJECT</label>
              <input 
                type="text"
                value={ticketForm.subject}
                onChange={(e) => setTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Car stolen during RP event..."
                className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 font-bold block mb-1">TICKET DETAIL</label>
              <textarea 
                rows={4}
                value={ticketForm.description}
                onChange={(e) => setTicketForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Provide description..."
                className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans"
              />
            </div>

            <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">
              DISPATCH TICKET
            </button>
          </form>
        </div>

        {/* Tickets Pipeline */}
        <div className="lg:col-span-2 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 shadow-xl">
          <h2 className="font-title font-black text-lg italic text-zinc-200 border-b border-[#1c1a24] pb-2">
            🎫 TICKET PIPELINE
          </h2>

          <div className="space-y-4 font-sans text-xs">
            {tickets.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 italic">
                NO TICKET LOGS FOUND ON PIPELINE.
              </div>
            ) : (
              tickets.map((t) => {
                let badge = 'bg-zinc-900 border-zinc-800 text-zinc-500';
                if (t.status === 'open') badge = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
                if (t.status === 'reviewed') badge = 'bg-green-500/10 border-green-500/20 text-green-400';

                return (
                  <div key={t.id} className="bg-[#181622]/40 border border-[#1e1b29] p-4 rounded-xl flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-300">[{t.id.toUpperCase()}] {t.subject}</span>
                          <span className="text-[9px] bg-[#09080d] px-1.5 py-0.5 rounded font-mono">{t.type.toUpperCase()}</span>
                        </div>
                        <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase ${badge}`}>{t.status}</span>
                      </div>
                      <p className="text-zinc-400 italic bg-[#09080d] p-2.5 rounded-lg border border-[#1e1b29] leading-relaxed">&quot;{t.description}&quot;</p>
                      
                      {t.response && (
                        <p className="text-[10px] text-purple-400 font-sans mt-2 leading-relaxed border-t border-[#1e1b29] pt-2">
                          💡 RESPONSE: <span className="text-zinc-300 italic">&quot;{t.response}&quot;</span>
                        </p>
                      )}
                    </div>

                    {isAuditor && t.status === 'open' && (
                      <div className="flex gap-2 items-center border-t border-[#1e1b29] pt-3 mt-1">
                        <input 
                          type="text"
                          value={ticketResolveForm[t.id] || ''}
                          onChange={(e) => setTicketResolveForm(prev => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="Type response description..." 
                          className="flex-1 bg-[#09080d] border border-[#1e1b29] rounded-lg p-1.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none"
                        />
                        <button onClick={() => handleResolveTicket(t.id)} className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg py-1.5 px-4 font-bold text-[10px]">
                          RESOLVE
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCheckBalance = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster verification code required');

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-2xl mx-auto text-center relative overflow-hidden font-sans shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/5 to-transparent filter blur-2xl rounded-full" />
        
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2">
          💸 CHECK LEDGER BALANCE
        </h2>
        
        <div className="py-6 select-text">
          <Coins className="w-16 h-16 text-glow-magenta text-purple-400 mx-auto mb-2 animate-bounce" />
          <span className="text-4xl font-title font-black italic text-zinc-100 font-tech">
            ${(user?.balance || 0).toLocaleString()}
          </span>
          <span className="block text-[10px] text-zinc-500 mt-2">Drawn from automated BizWar collections and bonus records.</span>
        </div>

        <div className="bg-[#09080d] p-4 border border-[#1e1b29] rounded-xl text-xs leading-relaxed text-zinc-400 max-w-md mx-auto text-left space-y-3">
          <span className="font-bold text-zinc-200">CLAIM PAYOUT CASHOUT VOUCHER</span>
          <p>
            When your personal ledger accumulates BizWar revenues, you can submit a cashout request. Leadership will deduct your ledger balances and deliver cash directly inside the Grand RP game.
          </p>
          <button onClick={() => setActiveTab('tickets')} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-title text-[10px] font-black italic tracking-wide py-2.5 rounded-lg border border-purple-500 glow-magenta transition-smooth cursor-pointer">
            TRIGGER WEEKLY CASH CLAIM TICKET
          </button>
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    const activeMembers = [...members].sort((a, b) => b.activityScore - a.activityScore);

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2 flex items-center gap-2">
          💪 SYNDICATE ACTIVITY LEADERBOARD
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-[#1e1b29] text-zinc-500 uppercase tracking-widest text-[9px]">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Player Name</th>
                <th className="py-2.5 px-3">Sync Handle</th>
                <th className="py-2.5 px-3">Assigned Roles</th>
                <th className="py-2.5 px-3 text-right">Activity Score</th>
              </tr>
            </thead>
            <tbody>
              {activeMembers.map((m, idx) => (
                <tr key={m.discordId} className="border-b border-[#181622]/40 hover:bg-[#181622]/20">
                  <td className="py-3 px-3 font-bold text-zinc-500 italic">#{idx + 1}</td>
                  <td className="py-3 px-3 text-zinc-200 font-bold">@{m.username}</td>
                  <td className="py-3 px-3 text-zinc-400 font-mono">{m.nickname}</td>
                  <td className="py-3 px-3 text-zinc-500">{m.roles.join(', ')}</td>
                  <td className="py-3 px-3 text-right font-bold text-purple-400 font-mono">{m.activityScore || 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderLongTimeKillList = () => {
    const list = [...members].sort((a, b) => b.kills - a.kills);

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2 flex items-center gap-2">
          🔻┃𝐋𝐨𝐧𝐠-𝐓𝐢𝐦𝐞-𝐊𝐢𝐥𝐥-𝐋𝐢𝐬𝐭 SYNDICATE ARCHIVES
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-[#1e1b29] text-zinc-500 uppercase tracking-widest text-[9px]">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Marksman</th>
                <th className="py-2.5 px-3">Combat Tag</th>
                <th className="py-2.5 px-3">Top 10 Priority</th>
                <th className="py-2.5 px-3 text-right">Lifetime Kills</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m, idx) => (
                <tr key={m.discordId} className="border-b border-[#181622]/40 hover:bg-[#181622]/20">
                  <td className="py-3 px-3 font-bold text-zinc-500 italic">#{idx + 1}</td>
                  <td className="py-3 px-3 text-zinc-200 font-bold">@{m.username}</td>
                  <td className="py-3 px-3 text-zinc-400 font-mono">{m.nickname}</td>
                  <td className="py-3 px-3 text-zinc-500">{m.isTop10 ? 'Elite Shooter' : 'Operative'}</td>
                  <td className="py-3 px-3 text-right font-bold text-purple-400 font-mono">{m.kills || 0} kills</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderWeeklyKillList = () => {
    const list = [...members].sort((a, b) => b.weeklyKills - a.weeklyKills);

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#1c1a24] pb-2">
          <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta flex items-center gap-2">
            🔻┃weekly-𝐊𝐢𝐥𝐥-𝐋𝐢𝐬𝐭
          </h2>
          <div className="bg-[#09080d] border border-[#1e1b29] px-3.5 py-1 rounded-xl text-[10px] text-zinc-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-400" /> RESETS IN: <span className="font-bold text-purple-400 font-sans text-xs">4d 12h 32m</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-[#1e1b29] text-zinc-500 uppercase tracking-widest text-[9px]">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Shooter</th>
                <th className="py-2.5 px-3">Radio Tag</th>
                <th className="py-2.5 px-3">Elite Status</th>
                <th className="py-2.5 px-3 text-right">Weekly Kills</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m, idx) => (
                <tr key={m.discordId} className="border-b border-[#181622]/40 hover:bg-[#181622]/20">
                  <td className="py-3 px-3 font-bold text-zinc-500 italic">#{idx + 1}</td>
                  <td className="py-3 px-3 text-zinc-200 font-bold">@{m.username}</td>
                  <td className="py-3 px-3 text-zinc-400 font-mono">{m.nickname}</td>
                  <td className="py-3 px-3 text-zinc-500">{m.isTop10 ? 'TOP 10 Shooters' : 'Operatives'}</td>
                  <td className="py-3 px-3 text-right font-bold text-purple-400 font-mono">{m.weeklyKills || 0} kills</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSubmitActivity = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster clearance validation required');

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-2xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2">
          💯╭submit-activity FORM
        </h2>
        
        <form onSubmit={handleSubmitActivity} className="font-sans text-xs flex flex-col gap-4 mt-2">
          <div>
            <label className="text-[10px] text-zinc-500 font-bold block mb-1">OPERATION DIRECTIVES DETAIL</label>
            <textarea 
              rows={4}
              value={activityForm.description}
              onChange={(e) => setActivityForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what family events you participated in..."
              className="w-full bg-[#09080d] border border-[#1e1b29] rounded-xl p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans"
            />
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 font-bold block mb-1">VERIFICATION PROOF MEDIA URL</label>
            <input 
              type="text"
              value={activityForm.mediaUrl}
              onChange={(e) => setActivityForm(prev => ({ ...prev, mediaUrl: e.target.value }))}
              placeholder="Provide screenshot link or video URL..."
              className="w-full bg-[#09080d] border border-[#1e1b29] rounded-xl p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-mono"
            />
          </div>

          <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta transition-smooth cursor-pointer">
            POST TO #SUBMIT-ACTIVITY CHANNEL
          </button>
        </form>
      </div>
    );
  };

  const renderActivityResults = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster authentication required');

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2 flex items-center gap-2">
          💯︱𝝖ctivity-𝗥esults RECORD
        </h2>

        <div className="space-y-4">
          {activities.filter(a => a.status !== 'pending').length === 0 ? (
            <div className="text-center py-12 text-zinc-500 italic">
              NO ACTIVITY RESULTS REVIEWED YET.
            </div>
          ) : (
            activities.filter(a => a.status !== 'pending').map((a) => {
              const isApproved = a.status === 'approved';
              
              return (
                <div key={a.id} className="bg-[#181622]/40 border border-[#1e1b29] p-4 rounded-xl flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-200">@{a.username}</span>
                      <span className="text-[9px] bg-[#09080d] px-1.5 py-0.5 rounded font-mono">ID: {a.id}</span>
                      <span className="text-[9px] text-zinc-500">{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-zinc-400 italic bg-[#09080d] p-2.5 rounded-lg border border-[#1e1b29] mt-2">&quot;{a.description}&quot;</p>
                    
                    {a.reason && (
                      <p className="text-[10px] text-zinc-500 mt-2 border-t border-[#1e1b29] pt-2 font-mono">
                        Remarks: &quot;{a.reason}&quot; - Reviewed by: @{a.reviewedBy || 'Admin'}
                      </p>
                    )}
                  </div>

                  <div className="flex sm:flex-col justify-center items-end gap-2 shrink-0">
                    <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase ${isApproved ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                      {a.status.toUpperCase()}
                    </span>
                    {isApproved && (
                      <span className="text-purple-400 font-bold font-mono text-[11px]">+{a.pointsAwarded} FP</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderActivityPointsLeaderboard = () => {
    const list = [...members].sort((a, b) => b.points - a.points);

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2 flex items-center gap-2">
          💯╰𝝖ctivity-📍oints-𝗟eader𝗕oard
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-[#1e1b29] text-zinc-500 uppercase tracking-widest text-[9px]">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Syndicate Member</th>
                <th className="py-2.5 px-3">Combat Nickname</th>
                <th className="py-2.5 px-3 text-right">Points Earned</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m, idx) => (
                <tr key={m.discordId} className="border-b border-[#181622]/40 hover:bg-[#181622]/20">
                  <td className="py-3 px-3 font-bold text-zinc-500 italic">#{idx + 1}</td>
                  <td className="py-3 px-3 text-zinc-200 font-bold">@{m.username}</td>
                  <td className="py-3 px-3 text-zinc-400 font-mono">{m.nickname}</td>
                  <td className="py-3 px-3 text-right font-bold text-purple-400 font-mono">{m.points || 0} FP</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPointShop = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster point store token required');

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-6 max-w-5xl mx-auto font-sans shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#1c1a24] pb-3">
          <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta flex items-center gap-2">
            💰╭point-shop CATALOG
          </h2>
          <div className="bg-[#09080d] border border-[#1e1b29] px-4 py-1.5 rounded-xl font-title font-black text-xs italic text-purple-400 text-glow-magenta">
            STORE VALUE: {shopBalance} FP
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {shopItems.map((item) => (
            <div key={item.id} className="bg-[#181622]/20 border border-[#1e1b29] rounded-2xl p-4 flex flex-col justify-between hover:border-purple-600/35 transition-smooth shadow-md">
              <div className="space-y-2">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="w-full h-32 object-cover rounded-xl border border-[#1e1b29]/60"
                />
                <div>
                  <span className="text-[8px] bg-[#09080d] text-zinc-400 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">{item.category}</span>
                  <h3 className="font-title font-bold text-xs text-zinc-200 mt-1 truncate">{item.name}</h3>
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-[#1e1b29]/40 flex items-center justify-between">
                <span className="font-sans text-xs font-bold text-purple-400">{item.price} FP</span>
                <button 
                  onClick={() => handlePurchaseItem(item.id)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-title font-black italic tracking-wide py-1.5 px-3 rounded-lg cursor-pointer transition-smooth border border-purple-500"
                >
                  BUY
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderActivityReview = () => {
    if (!checkAccess('admin')) return renderAccessDenied('Higher authority authorization required');

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2">
          💪︱𝐀𝐜𝐭𝐢𝐯𝐢𝐭𝐲-𝐑𝐞𝐯𝐢𝐞𝐰 BOARD
        </h2>

        <div className="space-y-4">
          {activities.filter(a => a.status === 'pending').length === 0 ? (
            <div className="text-center py-12 text-zinc-500 italic">
              NO PENDING COMPLETED OPERATIONS IN PIPELINE.
            </div>
          ) : (
            activities.filter(a => a.status === 'pending').map((act) => {
              const fields = activityReviewForm[act.id] || { points: '150', reason: '' };
              
              return (
                <div key={act.id} className="bg-[#181622]/40 border border-[#1e1b29] p-4 rounded-xl flex flex-col md:flex-row gap-6 justify-between animate-fade-in">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-200">@{act.username}</span>
                      <span className="text-[9px] bg-[#09080d] text-zinc-450 px-1.5 py-0.5 rounded font-mono">ACT: {act.id}</span>
                      <span className="text-[9px] text-zinc-500">{new Date(act.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-zinc-400 italic bg-[#09080d] p-2.5 rounded-lg border border-[#1e1b29] leading-relaxed">&quot;{act.description}&quot;</p>
                    <a href={act.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex text-[10px] text-purple-400 hover:text-white font-bold underline">
                      📸 VIEW VERIFICATION MEDIA FILE
                    </a>
                  </div>

                  <div className="w-full md:w-56 flex flex-col gap-3 border-t md:border-t-0 md:border-l border-[#1e1b29] pt-4 md:pt-0 md:pl-4">
                    <div>
                      <label className="text-[9px] text-zinc-500 font-bold block mb-1">AWARD REWARDS POINTS</label>
                      <input 
                        type="number"
                        value={fields.points}
                        onChange={(e) => setActivityReviewForm(prev => ({
                          ...prev,
                          [act.id]: { ...(prev[act.id] || { points: '150', reason: '' }), points: e.target.value }
                        }))}
                        placeholder="e.g. 150"
                        className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-1.5 text-xs text-zinc-300 font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 font-bold block mb-1">FEEDBACK COMMENT</label>
                      <input 
                        type="text"
                        value={fields.reason}
                        onChange={(e) => setActivityReviewForm(prev => ({
                          ...prev,
                          [act.id]: { ...(prev[act.id] || { points: '150', reason: '' }), reason: e.target.value }
                        }))}
                        placeholder="Valid run..."
                        className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-1.5 text-xs text-zinc-300 outline-none font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button onClick={() => handleReviewActivity(act.id, 'approved')} className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg py-1.5 font-bold cursor-pointer text-[10px]">
                        ACCEPT
                      </button>
                      <button onClick={() => handleReviewActivity(act.id, 'rejected')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg py-1.5 font-bold cursor-pointer text-[10px]">
                        REJECT
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderOrderDetails = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster security key verification required');

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2">
          💰╰order-details LOGS
        </h2>

        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 italic">
              NO POINT SHOP INVENTORY DISPATCH ORDERS FOUND.
            </div>
          ) : (
            orders.map((o) => {
              const isCompleted = o.status === 'completed';
              
              return (
                <div key={o.id} className="bg-[#181622]/40 border border-[#1e1b29] p-4 rounded-xl flex flex-col sm:flex-row justify-between gap-4 items-center">
                  <div className="space-y-1 self-start">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-300">[{o.id.toUpperCase()}] {o.itemName}</span>
                      <span className="text-[9px] text-zinc-500">Order by: @{o.username}</span>
                    </div>
                    <span className="block text-[9px] text-zinc-500 font-mono">Drawn at: {new Date(o.createdAt).toLocaleString()}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase ${isCompleted ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                      {o.status}
                    </span>
                    {!isCompleted && isLeaderOrAdmin && (
                      <button onClick={() => handleCompleteOrder(o.id)} className="bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 text-[10px] font-title font-black italic tracking-wide py-1.5 px-3 rounded-lg transition-smooth cursor-pointer" style={{ pointerEvents: 'auto' }}>
                        DISPATCH DELIVERY
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderBonusAdminPanel = () => {
    if (!checkAccess('admin')) return renderAccessDenied('Higher authority authorization required');

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2">
          💰┃𝐁𝐨𝐧𝐮𝐬-𝐀𝐝𝐦𝐢𝐧-𝐏𝐚𝐧𝐞𝐥 AUDIT REGISTER
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-[#1e1b29] text-zinc-500 uppercase tracking-widest text-[9px]">
                <th className="py-2.5 px-3">Ticket ID</th>
                <th className="py-2.5 px-3">Applicant</th>
                <th className="py-2.5 px-3">Calculation Details</th>
                <th className="py-2.5 px-3">Audit Response</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.filter(t => t.type === 'bonus' || t.type === 'request').map((t) => (
                <tr key={t.id} className="border-b border-[#181622]/40 hover:bg-[#181622]/20">
                  <td className="py-3 px-3 font-mono font-bold text-zinc-400">[{t.id.toUpperCase()}]</td>
                  <td className="py-3 px-3 font-bold text-zinc-200">@{t.username}</td>
                  <td className="py-3 px-3 text-zinc-400 font-sans">{t.description}</td>
                  <td className="py-3 px-3 text-zinc-500 italic">{t.response || 'Pending Audit Review'}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase ${
                      t.status === 'open' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-green-500/10 border-green-500/20 text-green-400'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBonusApproval = () => {
    if (!checkAccess('admin')) return renderAccessDenied('Higher authority authorization required');

    const bonusTickets = tickets.filter(t => (t.type === 'bonus' || t.type === 'request') && t.status === 'open');

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2">
          ✅┃𝐁𝐨𝐧𝐮𝐬-𝐀𝐩𝐩𝐫𝐨𝐯𝐚𝐥 DESK
        </h2>

        <div className="space-y-4 font-sans text-xs">
          {bonusTickets.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 italic">
              NO PENDING BONUS REQUEST TICKETS IN QUEUE.
            </div>
          ) : (
            bonusTickets.map((t) => {
              const fields = bonusApprovalForm[t.id] || { finalAmount: '500000', comment: '' };
              
              return (
                <div key={t.id} className="bg-[#181622]/40 border border-[#1e1b29] p-4 rounded-xl flex flex-col md:flex-row gap-6 justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-200">@{t.username}</span>
                      <span className="text-[9px] bg-[#09080d] text-zinc-450 px-1.5 py-0.5 rounded">TKT: {t.id.toUpperCase()}</span>
                      <span className="text-[9px] text-zinc-500">{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-zinc-400 italic bg-[#09080d] p-2.5 rounded-lg border border-[#1e1b29] mt-2">&quot;{t.description}&quot;</p>
                  </div>

                  <div className="w-full md:w-56 flex flex-col gap-3 border-t md:border-t-0 md:border-l border-[#1e1b29] pt-4 md:pt-0 md:pl-4">
                    <div>
                      <label className="text-[9px] text-zinc-500 font-bold block mb-1">CALCULATED PAYOUT SUM ($)</label>
                      <input 
                        type="number"
                        value={fields.finalAmount}
                        onChange={(e) => setBonusApprovalForm(prev => ({
                          ...prev,
                          [t.id]: { ...(prev[t.id] || { finalAmount: '0', comment: '' }), finalAmount: e.target.value }
                        }))}
                        placeholder="e.g. 500000"
                        className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-1.5 text-xs text-zinc-300 font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 font-bold block mb-1">PAYOUT REMARKS</label>
                      <input 
                        type="text"
                        value={fields.comment}
                        onChange={(e) => setBonusApprovalForm(prev => ({
                          ...prev,
                          [t.id]: { ...(prev[t.id] || { finalAmount: '0', comment: '' }), comment: e.target.value }
                        }))}
                        placeholder="Approved payout formula..."
                        className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-1.5 text-xs text-zinc-300 outline-none font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button onClick={() => handleBonusApproval(t.id, 'approved')} className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg py-1.5 font-bold cursor-pointer text-[10px]">
                        APPROVE
                      </button>
                      <button onClick={() => handleBonusApproval(t.id, 'rejected')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg py-1.5 font-bold cursor-pointer text-[10px]">
                        REJECT
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderBizWarCollect = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster credentials required');

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto font-sans shadow-xl">
        {/* Log profits Form */}
        <div className="lg:col-span-1 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 h-fit">
          <h3 className="font-title font-bold text-xs text-primary tracking-wide uppercase border-b border-[#1c1a24] pb-2">
            💲┃𝐁𝐢𝐳𝐰𝐚𝐫-𝐂𝐨𝐥𝐥𝐞𝐜𝐭 FORM
          </h3>

          <form onSubmit={handleBizwarCollect} className="font-sans text-xs flex flex-col gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 font-bold block mb-1">BUSINESS LANDMARK SITE</label>
              <select 
                value={bizwarForm.businessName}
                onChange={(e) => setBizwarForm(prev => ({ ...prev, businessName: e.target.value }))}
                className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-350 outline-none font-sans"
              >
                <option value="Hotel Factory">Hotel Factory</option>
                <option value="Oil Well 12">Oil Well 12</option>
                <option value="Gun Shop 4">Gun Shop 4</option>
                <option value="Docks Warehouse">Docks Warehouse</option>
                <option value="Cash Factory 3">Cash Factory 3</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 font-bold block mb-1">HARVEST PROFIT VALUE ($)</label>
              <input 
                type="number"
                value={bizwarForm.amount}
                onChange={(e) => setBizwarForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="e.g. 450000"
                className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
              />
            </div>

            <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">
              LOG BUSINESS REVENUE
            </button>
          </form>
        </div>

        {/* Business collection lists */}
        <div className="lg:col-span-2 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4">
          <h2 className="font-title font-black text-lg italic text-zinc-200 border-b border-[#1c1a24] pb-2">
            📊 BUSINESS PROFITS LEDGER
          </h2>

          <div className="space-y-3">
            {bizwarLogs.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 italic">
                NO REVENUES RECORDED TODAY.
              </div>
            ) : (
              bizwarLogs.map((log, idx) => (
                <div key={idx} className="flex justify-between items-center bg-[#181622]/40 p-3 border border-[#1e1b29] rounded-xl font-sans text-xs">
                  <div>
                    <span className="font-bold text-zinc-200">{log.businessName}</span>
                    <span className="block text-[8px] text-zinc-500">Collected by: @{log.username} | {new Date(log.timeCollected).toLocaleTimeString()}</span>
                  </div>
                  <span className="font-bold text-green-400 font-mono">+${log.amount.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRpCollect = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster verification required');

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto font-sans shadow-xl">
        {/* Ticket Harvest controls */}
        <div className="lg:col-span-1 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 h-fit">
          <div className="flex justify-between items-center border-b border-[#1c1a24] pb-2">
            <h3 className="font-title font-bold text-xs text-secondary tracking-wide uppercase">
              🎫┃𝐑package-𝐂𝐨𝐥𝐥𝐞𝐜𝐭 LOOP
            </h3>
            <span className="bg-zinc-900 px-2 py-0.5 border border-zinc-800 text-[9px] text-secondary font-bold font-mono rounded animate-pulse">{rpCountdown}</span>
          </div>

          <form onSubmit={handleRpCollect} className="font-sans text-xs flex flex-col gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 font-bold block mb-1">HARVEST BUNDLE SIZE</label>
              <select 
                value={rpCollectForm.ticketsCollected}
                onChange={(e) => setRpCollectForm({ ticketsCollected: e.target.value })}
                className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 outline-none font-sans"
              >
                <option value="5">5 RP Tickets (1 Hour standard)</option>
                <option value="10">10 RP Tickets (2 Hour batch)</option>
                <option value="15">15 RP Tickets (3 Hour batch)</option>
              </select>
            </div>

            <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">
              LOG HARVEST TRANSACTION
            </button>
          </form>
        </div>

        {/* Harvest logs */}
        <div className="lg:col-span-2 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-[#1c1a24] pb-2">
            <h2 className="font-title font-black text-lg italic text-zinc-200">
              💎 VAULT STOCK LOGS
            </h2>
            <span className="font-mono text-xs text-purple-400 font-bold">VAULT VALUE: {rpTotalStock} TICKETS</span>
          </div>

          <div className="space-y-3">
            {rpLogs.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 italic">
                NO TRANSACTIONS LOGGED IN TICKET ARCHIVE.
              </div>
            ) : (
              rpLogs.map((log, idx) => (
                <div key={idx} className="flex justify-between items-center bg-[#181622]/40 p-3 border border-[#1e1b29] rounded-xl font-sans text-xs">
                  <div>
                    <span className="font-bold text-zinc-200">Harvest Process</span>
                    <span className="block text-[8px] text-zinc-500">Collector: @{log.username} | {new Date(log.timeCollected).toLocaleTimeString()}</span>
                  </div>
                  <span className="font-bold text-purple-400 font-mono">+{log.ticketsCollected} RP Tickets</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPublicWinlog = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto font-sans shadow-xl">
        {/* Win logging Form (Admin) */}
        {isLeaderOrAdmin && (
          <div className="lg:col-span-1 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 h-fit">
            <h3 className="font-title font-bold text-xs text-primary tracking-wide uppercase border-b border-[#1c1a24] pb-2">
              🏆 LOG NEW SYNDICATE WIN
            </h3>

            <form onSubmit={handleLogWin} className="font-sans text-xs flex flex-col gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">EVENT TYPE</label>
                <select 
                  value={winForm.type}
                  onChange={(e) => setWinForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-350 outline-none font-sans"
                >
                  <option value="event">Major Syndicate Event / Raid</option>
                  <option value="bizwar">BizWar Profit Battle</option>
                  <option value="informal">Informal Gunfight Battle</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">EVENT TITLE</label>
                <input 
                  type="text"
                  value={winForm.title}
                  onChange={(e) => setWinForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Captured central hotel factory..."
                  className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">direct DETAILS</label>
                <textarea 
                  rows={3}
                  value={winForm.description}
                  onChange={(e) => setWinForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detail operations details..."
                  className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-350 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">COMBATANTS PARTICIPATED</label>
                <input 
                  type="text"
                  value={winForm.participants}
                  onChange={(e) => setWinForm(prev => ({ ...prev, participants: e.target.value }))}
                  placeholder="Vito, Tony, Phantom..."
                  className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">VICTORY SCREENSHOT URL</label>
                <input 
                  type="text"
                  value={winForm.mediaUrl}
                  onChange={(e) => setWinForm(prev => ({ ...prev, mediaUrl: e.target.value }))}
                  placeholder="Provide image link..."
                  className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-mono"
                />
              </div>

              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">
                PUBLISH RECORD
              </button>
            </form>
          </div>
        )}

        {/* Win records list */}
        <div className={`${isLeaderOrAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4`}>
          <h2 className="font-title font-black text-lg italic text-zinc-200 border-b border-[#1c1a24] pb-2">
            🏆 PUBLIC SYNDICATE WINNING LOGS
          </h2>

          <div className="space-y-6">
            {wins.filter(w => w.type !== 'informal').length === 0 ? (
              <div className="text-center py-12 text-zinc-500 italic">
                NO WINS RECORDED IN HISTORY LOG.
              </div>
            ) : (
              wins.filter(w => w.type !== 'informal').map((w) => (
                <div key={w.id} className="bg-[#181622]/40 border border-[#1e1b29] rounded-2xl p-4 flex flex-col md:flex-row gap-6 hover:border-purple-600/25 transition-smooth">
                  {w.mediaUrl && (
                    <img 
                      src={w.mediaUrl} 
                      alt={w.title} 
                      className="w-full md:w-48 h-32 object-cover rounded-xl border border-[#1e1b29] shrink-0"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-title font-black text-base italic text-zinc-200">{w.title}</h3>
                      <span className="text-[9px] bg-[#09080d] text-zinc-400 px-1.5 py-0.5 rounded uppercase font-mono">{w.type}</span>
                    </div>
                    <p className="text-zinc-400 text-xs leading-relaxed font-sans">{w.description}</p>
                    <div className="text-[10px] text-zinc-500">
                      <span className="font-bold text-zinc-400 font-sans">Squad combatants:</span> {w.participants}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRpSignup = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster account verification required');
    const isAuditor = checkAccess('admin');

    const confirmedQueue = rpSignups.filter(s => s.status === 'confirmed');
    const reserveQueue = rpSignups.filter(s => s.status === 'reserve' || s.status === 'displaced');

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto font-sans shadow-xl">
        {/* Directive details */}
        <div className="lg:col-span-1 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-5 h-fit">
          <div className="space-y-1.5">
            <span className="bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider animate-pulse">SIGNUP ROSTER OPEN</span>
            <h2 className="font-title font-black text-xl italic text-zinc-200">Docks Turf Battle</h2>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed bg-[#09080d] p-3 border border-[#1e1b29] rounded-xl italic font-sans">
              &quot;Raid the central supply depot. Roster limit is 25. Gear requirements: Heavy Sniper, Tier-3 Armor Plates, Radio Freq: 104.4. Top 10 Priority shooters can displace.&quot;
            </p>
          </div>

          <button 
            onClick={() => handleEventSignup('rp-signup')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta transition-smooth cursor-pointer"
          >
            CLAIM CONFIRMED SLOT
          </button>

          {isAuditor && (
            <div className="bg-[#09080d] p-4 border border-[#1e1b29] rounded-xl space-y-3">
              <span className="text-[9px] font-bold text-zinc-400 tracking-wider block">ADMIN CONTROLS</span>
              
              <input 
                type="text"
                value={eventTriggerForm.title}
                onChange={(e) => setEventTriggerForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Roster Event Title..." 
                className="w-full bg-[#121118] border border-[#1e1b29] rounded-lg p-2 text-xs text-zinc-300 outline-none"
              />
              <textarea 
                rows={2}
                value={eventTriggerForm.description}
                onChange={(e) => setEventTriggerForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Roster Event Directives..." 
                className="w-full bg-[#121118] border border-[#1e1b29] rounded-lg p-2 text-xs text-zinc-350 outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleTriggerSignupWindow('rp-signup', eventTriggerForm.title, eventTriggerForm.description)} className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[10px] font-black italic py-2 rounded-lg cursor-pointer transition-smooth">
                  BROADCAST
                </button>
                <button onClick={() => handleClearSignupRoster('rp-signup')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-bold py-2 rounded-lg cursor-pointer transition-smooth">
                  WIPE ROSTER
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Signup lists */}
        <div className="lg:col-span-2 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-[#1c1a24] pb-3">
            <h2 className="font-title font-black text-lg italic text-purple-400 text-glow-magenta">
              ⏰ RP SIGNUP TEAM LIST
            </h2>
            <span className="text-xs text-zinc-400">CONFIRMED: <span className="font-bold text-purple-400 font-mono">{confirmedQueue.length} / 25</span></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
            {/* Confirmed */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider block border-b border-[#1e1b29] pb-1">✅ CONFIRMED ROSTER</span>
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {confirmedQueue.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600 italic">ROSTER IS VACANT.</div>
                ) : (
                  confirmedQueue.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-[#181622]/40 p-2.5 border border-[#1e1b29] rounded-xl font-sans text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 font-bold">#{idx + 1}</span>
                        <span className="font-bold text-zinc-200">@{s.username}</span>
                        {s.isTop10 && <span className="text-[7px] bg-accent/20 text-accent border border-accent/30 font-black px-1 rounded">TOP 10</span>}
                      </div>
                      <span className="text-[8px] text-zinc-500">{new Date(s.signedUpAt).toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Reserve */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider block border-b border-[#1e1b29] pb-1">⏳ RESERVE QUEUE</span>
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {reserveQueue.length === 0 ? (
                  <div className="text-center py-12 text-zinc-655 italic">RESERVE QUEUE VACANT.</div>
                ) : (
                  reserveQueue.map((s, idx) => (
                    <div key={idx} className={`flex justify-between items-center p-2.5 border rounded-xl font-sans text-xs ${
                      s.status === 'displaced' ? 'bg-red-500/5 border-red-500/10 text-red-400 animate-pulse' : 'bg-[#181622]/40 border-[#1e1b29] text-zinc-400'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 font-bold">R#{idx + 1}</span>
                        <span className="font-bold">@{s.username}</span>
                        {s.isTop10 && <span className="text-[7px] bg-accent/20 text-accent border border-accent/30 font-black px-1 rounded">TOP 10</span>}
                      </div>
                      <span className="text-[9px] font-bold uppercase">{s.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInformalSignup = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster combat verification required');
    const isAuditor = checkAccess('admin');

    const confirmedQueue = informalSignups.filter(s => s.status === 'confirmed');
    const reserveQueue = informalSignups.filter(s => s.status === 'reserve' || s.status === 'displaced');

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto font-sans shadow-xl">
        {/* directives */}
        <div className="lg:col-span-1 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-5 h-fit">
          <div className="space-y-1.5">
            <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider animate-pulse">INFORMAL BATTLE QUEUE OPEN</span>
            <h2 className="font-title font-black text-xl italic text-zinc-200">Informal Roster</h2>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed bg-[#09080d] p-3 border border-[#1e1b29] rounded-xl italic font-sans">
              &quot;Automated informal wars trigger every 1h 44m. The vanguard shooters will displace recruits dynamically on the confirmation grid.&quot;
            </p>
          </div>

          <button 
            onClick={() => handleEventSignup('informal-signup')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta transition-smooth cursor-pointer"
          >
            CLAIM CONFIRMED SLOT
          </button>

          {isAuditor && (
            <div className="bg-[#09080d] p-4 border border-[#1e1b29] rounded-xl space-y-3">
              <span className="text-[9px] font-bold text-zinc-400 tracking-wider block">ADMIN ROSTER FLUSH</span>
              <button onClick={() => handleClearSignupRoster('informal-signup')} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-bold py-2.5 rounded-lg transition-smooth cursor-pointer">
                WIPE INFORMAL ROSTER LIST
              </button>
            </div>
          )}
        </div>

        {/* Signups */}
        <div className="lg:col-span-2 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-[#1c1a24] pb-3">
            <h2 className="font-title font-black text-lg italic text-purple-400 text-glow-magenta">
              ⏰╭𝐈𝐧𝐟𝐨𝐫𝐦𝐚𝐥-𝐒𝐢𝐠𝐧𝐮𝐩 LIST
            </h2>
            <span className="text-xs text-zinc-400">CONFIRMED: <span className="font-bold text-purple-400 font-mono">{confirmedQueue.length} / 25</span></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
            {/* Confirmed */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider block border-b border-[#1e1b29] pb-1">✅ CONFIRMED GRID</span>
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {confirmedQueue.length === 0 ? (
                  <div className="text-center py-12 text-zinc-650 italic">ROSTER IS VACANT.</div>
                ) : (
                  confirmedQueue.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-[#181622]/40 p-2.5 border border-[#1e1b29] rounded-xl font-sans text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 font-bold">#{idx + 1}</span>
                        <span className="font-bold text-zinc-200">@{s.username}</span>
                        {s.isTop10 && <span className="text-[7px] bg-accent/20 text-accent border border-accent/30 font-black px-1 rounded">TOP 10</span>}
                      </div>
                      <span className="text-[8px] text-zinc-500">{new Date(s.signedUpAt).toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Reserve */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider block border-b border-[#1e1b29] pb-1">⏳ RESERVE QUEUE</span>
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {reserveQueue.length === 0 ? (
                  <div className="text-center py-12 text-zinc-650 italic">RESERVE QUEUE VACANT.</div>
                ) : (
                  reserveQueue.map((s, idx) => (
                    <div key={idx} className={`flex justify-between items-center p-2.5 border rounded-xl font-sans text-xs ${
                      s.status === 'displaced' ? 'bg-red-500/5 border-red-500/10 text-red-400 animate-pulse' : 'bg-[#181622]/40 border-[#1e1b29] text-zinc-400'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 font-bold">R#{idx + 1}</span>
                        <span className="font-bold">@{s.username}</span>
                        {s.isTop10 && <span className="text-[7px] bg-accent/20 text-accent border border-accent/30 font-black px-1 rounded">TOP 10</span>}
                      </div>
                      <span className="text-[9px] font-bold uppercase">{s.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPublicInformallog = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto font-sans shadow-xl">
        {/* Log win (Admin) */}
        {isLeaderOrAdmin && (
          <div className="lg:col-span-1 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 h-fit">
            <h3 className="font-title font-bold text-xs text-primary tracking-wide uppercase border-b border-[#1c1a24] pb-2">
              🏆 LOG PUBLIC INFORMAL WIN
            </h3>

            <form onSubmit={handleLogWin} className="font-sans text-xs flex flex-col gap-4">
              <input type="hidden" value={winForm.type = 'informal'} />
              
              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">BATTLE TITLE</label>
                <input 
                  type="text"
                  value={winForm.title}
                  onChange={(e) => setWinForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Informal Win vs Vagos..."
                  className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">direct DETAILS</label>
                <textarea 
                  rows={4}
                  value={winForm.description}
                  onChange={(e) => setWinForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Operation execution summary..."
                  className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-350 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">PARTICIPATING COMBATANTS</label>
                <input 
                  type="text"
                  value={winForm.participants}
                  onChange={(e) => setWinForm(prev => ({ ...prev, participants: e.target.value }))}
                  placeholder="Shooters..."
                  className="w-full bg-[#09080d] border border-[#1e1b29] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans"
                />
              </div>

              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">
                PUBLISH INFORMAL RECORD
              </button>
            </form>
          </div>
        )}

        {/* Win records list */}
        <div className={`${isLeaderOrAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4`}>
          <h2 className="font-title font-black text-lg italic text-zinc-200 border-b border-[#1c1a24] pb-2">
            📜╰public-informallog RECORDS
          </h2>

          <div className="space-y-6">
            {wins.filter(w => w.type === 'informal').length === 0 ? (
              <div className="text-center py-12 text-zinc-500 italic">
                NO INFORMAL WINS RECORDED TODAY.
              </div>
            ) : (
              wins.filter(w => w.type === 'informal').map((w) => (
                <div key={w.id} className="bg-[#181622]/40 border border-[#1e1b29] rounded-2xl p-4 flex flex-col md:flex-row gap-6 hover:border-purple-600/25 transition-smooth">
                  {w.mediaUrl && (
                    <img 
                      src={w.mediaUrl} 
                      alt={w.title} 
                      className="w-full md:w-48 h-32 object-cover rounded-xl border border-[#1e1b29] shrink-0"
                    />
                  )}
                  <div className="flex-1 space-y-2 font-sans">
                    <h3 className="font-title font-black text-base italic text-zinc-200">{w.title}</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed font-sans">{w.description}</p>
                    <div className="text-[10px] text-zinc-500">
                      <span className="font-bold text-zinc-400">Combatants:</span> {w.participants}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTop10List = () => {
    const topShooters = members.filter(m => m.isTop10);

    return (
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a24] pb-2 flex items-center gap-2">
          🎖️╭𝐓𝐨𝐩-𝟏0-𝐋𝐢𝐬𝐭 ELITE SHOOTERS WALL
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          These are the priority sharpshooters of the White Pigeon family. Selected based on lifetime combat results, they possess priority signup slot displacement privileges in RP and Informal rosters.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topShooters.map((m, idx) => (
            <div key={m.discordId} className="bg-[#181622]/40 border border-[#1e1b29] p-4 rounded-xl flex items-center gap-4 hover:border-purple-600/35 transition-smooth shadow-sm">
              <div className="w-10 h-10 bg-purple-950/40 text-purple-400 border border-purple-800/25 rounded-full flex items-center justify-center font-title font-black italic text-lg shadow-[inset_0_0_8px_rgba(168,85,247,0.15)] shrink-0">
                #{idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-title font-black text-sm italic text-zinc-200 truncate">@{m.username}</h4>
                  <span className="bg-purple-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shrink-0">Priority</span>
                </div>
                <p className="text-[10px] text-zinc-550 font-mono mt-0.5 truncate">{m.nickname}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-bold text-zinc-300 font-sans">{m.kills || 0} Kills</span>
                <span className="block text-[8px] text-zinc-500">Activity: {m.activityScore || 0}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Switch render blocks dynamically based on state
  switch (activeTab) {
    case 'home':
      return renderHome();
    case 'role-request':
      return renderRoleRequest();
    case 'rolereq-review':
      return renderRoleReqReview();
    case 'strikes':
      return renderStrikes();
    case 'tickets':
      return renderTickets();
    case 'check-balance':
      return renderCheckBalance();
    case 'leaderboard':
      return renderLeaderboard();
    case 'long-time-kill-list':
      return renderLongTimeKillList();
    case 'weekly-kill-list':
      return renderWeeklyKillList();
    case 'submit-activity':
      return renderSubmitActivity();
    case 'activity-results':
      return renderActivityResults();
    case 'activity-points-leaderboard':
      return renderActivityPointsLeaderboard();
    case 'point-shop':
      return renderPointShop();
    case 'activity-review':
      return renderActivityReview();
    case 'order-details':
      return renderOrderDetails();
    case 'bonus-admin-panel':
      return renderBonusAdminPanel();
    case 'bonus-approval':
      return renderBonusApproval();
    case 'bizwar-collect':
      return renderBizWarCollect();
    case 'rp-collect':
      return renderRpCollect();
    case 'public-winlog':
      return renderPublicWinlog();
    case 'rp-signup':
      return renderRpSignup();
    case 'informal-signup':
      return renderInformalSignup();
    case 'public-informallog':
      return renderPublicInformallog();
    case 'top-10-list':
      return renderTop10List();
    default:
      return renderHome();
  }
}
