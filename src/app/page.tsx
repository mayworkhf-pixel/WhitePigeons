'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/components/AppContext';
import { 
  Flame, Trophy, Users,
  Coins,
  AlertTriangle, TrendingUp,
  Plus, CheckCircle2, XCircle, Trash, Star,
  Search, ExternalLink, Gift, RefreshCw, Shield,
  Wrench, Target, UserX, Crown, Building, CreditCard
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
  weeklyPoints?: number;
}

interface WeeklyLeaderboardEntry {
  discordId: string;
  username: string;
  nickname: string;
  roles: string[];
  weeklyPoints: number;
  source: 'live' | 'mock';
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
  inVoice?: boolean;
}

export default function RootDashboard() {
  const { user, activeTab, setActiveTab, addNotification, refreshUser, API_BASE_URL, socket } = useApp();
  
  // Roster registration states
  const [rpState, setRpState] = useState<'open' | 'closed'>('closed');
  const [informalState, setInformalState] = useState<'open' | 'closed'>('closed');
  const [signupEventState, setSignupEventState] = useState<'open' | 'closed'>('closed');
  const [rpDescription, setRpDescription] = useState<string>('Raid the central supply depot. Roster limit is 25. Gear requirements: Heavy Sniper, Tier-3 Armor Plates, Radio Freq: 104.4. Top 10 Priority shooters can displace.');
  const [informalDescription, setInformalDescription] = useState<string>('Automated informal wars trigger every 1h 44m. The vanguard shooters will displace recruits dynamically on the confirmation grid.');
  const [signupEventDescription, setSignupEventDescription] = useState<string>('Signup Event roster limit is 25. Top 10 Priority shooters can displace.');
  
  // Core Data states
  const [members, setMembers] = useState<Member[]>([]);
  const [tickets, setTickets] = useState<TicketModel[]>([]);
  const [activities, setActivities] = useState<ActivityModel[]>([]);
  const [orders, setOrders] = useState<OrderModel[]>([]);
  const [wins, setWins] = useState<WinModel[]>([]);
  const [roleRequests, setRoleRequests] = useState<any[]>([]);
  
  // Priority Lists
  const [priorityList, setPriorityList] = useState<{ top5: Member[]; top10: Member[] }>({ top5: [], top10: [] });
  const [showAddMemberDropdown, setShowAddMemberDropdown] = useState<'top5' | 'top10' | null>(null);
  const [prioritySearch, setPrioritySearch] = useState('');
  const [isDeployingPriority, setIsDeployingPriority] = useState(false);
  
  // Signups
  const [rpSignups, setRpSignups] = useState<SignupModel[]>([]);
  const [informalSignups, setInformalSignups] = useState<SignupModel[]>([]);
  const [signupEventSignups, setSignupEventSignups] = useState<SignupModel[]>([]);

  // Custom Timer states
  const [rpTriggerCountdown, setRpTriggerCountdown] = useState<number | null>(null);
  const [infTriggerCountdown, setInfTriggerCountdown] = useState<number | null>(null);
  const [signupEventTriggerCountdown, setSignupEventTriggerCountdown] = useState<number | null>(null);
  
  // Schedule states for both events
  const [rpSchedule, setRpSchedule] = useState<{ times: string[]; mode: 'once' | 'day' | 'ever'; enabled: boolean; title: string; description: string }>({
    times: ['', '', '', ''],
    mode: 'once',
    enabled: false,
    title: '',
    description: ''
  });
  const [infSchedule, setInfSchedule] = useState<{ times: string[]; mode: 'once' | 'day' | 'ever'; enabled: boolean; title: string; description: string }>({
    times: ['', '', '', ''],
    mode: 'once',
    enabled: false,
    title: '',
    description: ''
  });
  const [signupEventSchedule, setSignupEventSchedule] = useState<{ times: string[]; mode: 'once' | 'day' | 'ever'; enabled: boolean; title: string; description: string }>({
    times: ['', '', '', ''],
    mode: 'once',
    enabled: false,
    title: '',
    description: ''
  });
  
  // Kick & Swap admin states
  const [rpSwapFirstId, setRpSwapFirstId] = useState<string | null>(null);
  const [infSwapFirstId, setInfSwapFirstId] = useState<string | null>(null);
  const [signupEventSwapFirstId, setSignupEventSwapFirstId] = useState<string | null>(null);
  const [rpBotAdminShow, setRpBotAdminShow] = useState(false);
  const [rpBotSwapFirstId, setRpBotSwapFirstId] = useState<string | null>(null);
  const [infBotAdminShow, setInfBotAdminShow] = useState(false);
  const [infBotSwapFirstId, setInfBotSwapFirstId] = useState<string | null>(null);
  const [signupEventBotAdminShow, setSignupEventBotAdminShow] = useState(false);
  const [signupEventBotSwapFirstId, setSignupEventBotSwapFirstId] = useState<string | null>(null);
  
  // Economy logs
  const [bizwarLogs, setBizwarLogs] = useState<any[]>([]);
  const [rpLogs, setRpLogs] = useState<any[]>([]);
  const [rpTotalStock, setRpTotalStock] = useState(1235);
  
  // Form states
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
  
  const [rpTriggerDesc, setRpTriggerDesc] = useState('');
  const [infTriggerDesc, setInfTriggerDesc] = useState('');
  const [signupEventTriggerDesc, setSignupEventTriggerDesc] = useState('');

  // Shop state
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [shopBalance, setShopBalance] = useState(0);

  // General timers
  const [rpCountdown, setRpCountdown] = useState('00:32:10');
  const [loading, setLoading] = useState(true);
  const [weeklyPointsForm, setWeeklyPointsForm] = useState<Record<string, string>>({});
  const [killsForm, setKillsForm] = useState<Record<string, string>>({});
  const [weeklyKillsForm, setWeeklyKillsForm] = useState<Record<string, string>>({});
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [familyStats, setFamilyStats] = useState<any>({
    totalMembers: 403,
    totalGiveaways: 7,
    totalBonuses: 118920000,
    hcWorkDone: 97,
    totalStrikes: 57,
    totalBlacklisted: 20,
    rpWon: 133,
    eventsWon: 928,
    familyRankingPoints: 2168,
    familyRank: '#1',
    updatedAt: ''
  });
  const [statsForm, setStatsForm] = useState<any>({
    totalMembers: '403',
    totalGiveaways: '7',
    totalBonuses: '118920000',
    hcWorkDone: '97',
    totalStrikes: '57',
    totalBlacklisted: '20',
    rpWon: '133',
    eventsWon: '928',
    familyRankingPoints: '2168',
    familyRank: '#1'
  });

  const isLeaderOrAdmin = !!(user?.admin_authenticated || (user?.roles && (
    user.roles.includes('Leadership') || 
    user.roles.includes('Admin') || 
    user.roles.includes('High Command') || 
    user.roles.includes('HIGH COMMAND') || 
    user.roles.includes('👑 | Leader') || 
    user.roles.includes('🥇 | UnderBoss') || 
    user.roles.includes('High-Command') || 
    user.roles.includes('HC')
  )));
  const isLocalPreview = user?.discordId === 'local-preview';

  // Load backend data helper
  const loadDashboardData = React.useCallback(async () => {
    if (isLocalPreview) {
      setLoading(false);
      return;
    }

    try {
      // Run public fetches in parallel
      const publicFetches = [
        fetch(`${API_BASE_URL}/api/members`).then(r => r.ok ? r.json() : null).then(data => data && setMembers(data)),
        fetch(`${API_BASE_URL}/api/wins`).then(r => r.ok ? r.json() : null).then(data => data && setWins(data)),
        fetch(`${API_BASE_URL}/api/priority-list`).then(r => r.ok ? r.json() : null).then(data => data && setPriorityList(data))
      ];

      await Promise.all(publicFetches);

      if (user) {
        const userFetches = [
          fetch(`${API_BASE_URL}/api/tickets`).then(r => r.ok ? r.json() : null).then(data => data && setTickets(data)),
          fetch(`${API_BASE_URL}/api/activities`).then(r => r.ok ? r.json() : null).then(data => data && setActivities(data)),
          fetch(`${API_BASE_URL}/api/economy/bizwar-collect`).then(r => r.ok ? r.json() : null).then(data => data && setBizwarLogs(data)),
          fetch(`${API_BASE_URL}/api/economy/rp-collect`).then(r => r.ok ? r.json() : null).then(data => {
            if (data) {
              setRpLogs(data.logs);
              setRpTotalStock(data.totalCollected);
            }
          }),
          fetch(`${API_BASE_URL}/api/shop/items`).then(r => r.ok ? r.json() : null).then(data => {
            if (data) {
              setShopItems(data.items);
              setShopBalance(data.pointsBalance);
            }
          }),
          fetch(`${API_BASE_URL}/api/members/role-requests`).then(r => r.ok ? r.json() : null).then(data => data && setRoleRequests(data)),
          fetch(`${API_BASE_URL}/api/about/stats`).then(r => r.ok ? r.json() : null).then(statsData => {
            if (statsData) {
              setFamilyStats(statsData);
              setStatsForm({
                totalMembers: String(statsData.totalMembers),
                totalGiveaways: String(statsData.totalGiveaways),
                totalBonuses: String(statsData.totalBonuses),
                hcWorkDone: String(statsData.hcWorkDone),
                totalStrikes: String(statsData.totalStrikes),
                totalBlacklisted: String(statsData.totalBlacklisted),
                rpWon: String(statsData.rpWon),
                eventsWon: String(statsData.eventsWon),
                familyRankingPoints: String(statsData.familyRankingPoints),
                familyRank: statsData.familyRank || '#1'
              });
            }
          })
        ];

        if (isLeaderOrAdmin) {
          userFetches.push(
            fetch(`${API_BASE_URL}/api/shop/orders`).then(r => r.ok ? r.json() : null).then(data => data && setOrders(data))
          );
        }

        await Promise.all(userFetches);
      }
    } catch {
      console.warn('Failed to load full API datasets.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, isLeaderOrAdmin, isLocalPreview, user]);

  const handleAddMember = async (type: 'top5' | 'top10', discordId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/priority-list/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, discordId })
      });
      if (res.ok) {
        const data = await res.json();
        setPriorityList(data.priorityList);
        setShowAddMemberDropdown(null);
        setPrioritySearch('');
        addNotification('Roster Updated', `Member successfully added to TOP ${type === 'top5' ? '5' : '10'} priority roster.`, 'success');
      } else {
        const err = await res.json();
        addNotification('Update Failed', err.error || 'Failed to update roster.', 'error');
      }
    } catch (err: any) {
      addNotification('Connection Error', err.message, 'error');
    }
  };

  const handleRemoveMember = async (type: 'top5' | 'top10', discordId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/priority-list/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, discordId })
      });
      if (res.ok) {
        const data = await res.json();
        setPriorityList(data.priorityList);
        addNotification('Roster Updated', `Member successfully removed from TOP ${type === 'top5' ? '5' : '10'} priority roster.`, 'success');
      } else {
        const err = await res.json();
        addNotification('Update Failed', err.error || 'Failed to update roster.', 'error');
      }
    } catch (err: any) {
      addNotification('Connection Error', err.message, 'error');
    }
  };

  const handleDeployPriorityPrompt = async () => {
    setIsDeployingPriority(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/deploy-priority-prompt`, {
        method: 'POST'
      });
      if (res.ok) {
        addNotification('Deployment Complete', 'Roster list embed was successfully re-deployed to Discord.', 'success');
      } else {
        const err = await res.json();
        addNotification('Deployment Failed', err.error || 'Failed to deploy to Discord.', 'error');
      }
    } catch (err: any) {
      addNotification('Connection Error', err.message, 'error');
    } finally {
      setIsDeployingPriority(false);
    }
  };

  // Poll event signups
  const loadSignups = React.useCallback(async () => {
    if (isLocalPreview) return;

    try {
      await Promise.all([
        fetch(`${API_BASE_URL}/api/events/signup/rp-signup`).then(r => r.ok ? r.json() : null).then(data => data && setRpSignups(data)),
        fetch(`${API_BASE_URL}/api/events/signup/informal-signup`).then(r => r.ok ? r.json() : null).then(data => data && setInformalSignups(data)),
        fetch(`${API_BASE_URL}/api/events/signup/signup-event`).then(r => r.ok ? r.json() : null).then(data => data && setSignupEventSignups(data)),
        fetch(`${API_BASE_URL}/api/events/state/rp-signup`).then(r => r.ok ? r.json() : null).then(data => {
          if (data) {
            setRpState(data.state || 'closed');
            if (data.description) {
              setRpDescription(data.description);
              setRpTriggerDesc(data.description);
            }
          }
        }),
        fetch(`${API_BASE_URL}/api/events/state/signup-event`).then(r => r.ok ? r.json() : null).then(data => {
          if (data) {
            setSignupEventState(data.state || 'closed');
            if (data.description) {
              setSignupEventDescription(data.description);
              setSignupEventTriggerDesc(data.description);
            }
          }
        }),
        fetch(`${API_BASE_URL}/api/events/state/informal-signup`).then(r => r.ok ? r.json() : null).then(data => {
          if (data) {
            setInformalState(data.state || 'closed');
            if (data.description) {
              setInformalDescription(data.description);
              setInfTriggerDesc(data.description);
            }
          }
        })
      ]);
    } catch {}
  }, [API_BASE_URL, isLocalPreview]);

  const loadSchedules = React.useCallback(async () => {
    if (isLocalPreview) return;

    try {
      const rpRes = await fetch(`${API_BASE_URL}/api/events/schedule/rp-signup`);
      if (rpRes.ok) {
        const rpData = await rpRes.json();
        setRpSchedule({
          times: rpData.times || ['', '', '', ''],
          mode: rpData.mode || 'once',
          enabled: rpData.enabled || false,
          title: rpData.title || '',
          description: rpData.description || ''
        });
      }
      const seRes = await fetch(`${API_BASE_URL}/api/events/schedule/signup-event`);
      if (seRes.ok) {
        const seData = await seRes.json();
        setSignupEventSchedule({
          times: seData.times || ['', '', '', ''],
          mode: seData.mode || 'once',
          enabled: seData.enabled || false,
          title: seData.title || '',
          description: seData.description || ''
        });
      }
      const infRes = await fetch(`${API_BASE_URL}/api/events/schedule/informal-signup`);
      if (infRes.ok) {
        const infData = await infRes.json();
        setInfSchedule({
          times: infData.times || ['', '', '', ''],
          mode: infData.mode || 'once',
          enabled: infData.enabled || false,
          title: infData.title || '',
          description: infData.description || ''
        });
      }
    } catch {}
  }, [API_BASE_URL, isLocalPreview]);

  const handleSaveSchedule = async (eventId: 'rp-signup' | 'informal-signup' | 'signup-event', scheduleData: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/schedule-times/${eventId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData)
      });
      if (res.ok) {
        addNotification('Schedule Saved', `Roster schedule saved successfully.`, 'success');
        loadSchedules();
      } else {
        const err = await res.json();
        addNotification('Save Failed', err.error || 'Failed to update schedule.', 'error');
      }
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    }
  };

  // Countdown timers tickers
  useEffect(() => {
    if (rpTriggerCountdown === null) return;
    if (rpTriggerCountdown < 0) {
      setRpTriggerCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setRpTriggerCountdown(rpTriggerCountdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [rpTriggerCountdown]);

  useEffect(() => {
    if (signupEventTriggerCountdown === null) return;
    if (signupEventTriggerCountdown < 0) {
      setSignupEventTriggerCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setSignupEventTriggerCountdown(signupEventTriggerCountdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [signupEventTriggerCountdown]);

  useEffect(() => {
    if (infTriggerCountdown === null) return;
    if (infTriggerCountdown < 0) {
      setInfTriggerCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setInfTriggerCountdown(infTriggerCountdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [infTriggerCountdown]);

  // Run data timers & queries on mount
  useEffect(() => {
    loadDashboardData();
    loadSignups();
    loadSchedules();
  }, [user, activeTab, loadDashboardData, loadSignups, loadSchedules]);

  // Synchronize event states and signups via websocket in real-time
  useEffect(() => {
    if (!socket) return;
    
    const handleStateChange = (data: { eventId: string; state: 'open' | 'closed'; title?: string; description?: string }) => {
      if (data.eventId === 'rp-signup') {
        setRpState(data.state);
        if (data.description) {
          setRpDescription(data.description);
          setRpTriggerDesc(data.description);
        }
        loadSignups();
      } else if (data.eventId === 'signup-event') {
        setSignupEventState(data.state);
        if (data.description) {
          setSignupEventDescription(data.description);
          setSignupEventTriggerDesc(data.description);
        }
        loadSignups();
      } else if (data.eventId === 'informal-signup') {
        setInformalState(data.state);
        if (data.description) {
          setInformalDescription(data.description);
          setInfTriggerDesc(data.description);
        }
        loadSignups();
      }
    };

    const handleSignupChange = (data: { eventId: string; signups: any[] }) => {
      if (data.eventId === 'rp-signup') {
        setRpSignups(data.signups);
      } else if (data.eventId === 'signup-event') {
        setSignupEventSignups(data.signups);
      } else if (data.eventId === 'informal-signup') {
        setInformalSignups(data.signups);
      }
    };

    const handleTicketsUpdate = (updatedTickets: any[]) => {
      setTickets(updatedTickets);
      loadDashboardData();
    };

    const handleRoleRequestsUpdate = (updatedRequests: any[]) => {
      setRoleRequests(updatedRequests);
      loadDashboardData();
    };

    const handleLeaderboardUpdate = (updatedMembers: any[]) => {
      setMembers(updatedMembers);
      loadDashboardData();
    };

    const handlePriorityListUpdate = (updatedList: any) => {
      setPriorityList(updatedList);
    };

    const handleScheduleChange = (data: { eventId: string; schedule: any }) => {
      if (data.eventId === 'rp-signup') {
        setRpSchedule(data.schedule);
      } else if (data.eventId === 'signup-event') {
        setSignupEventSchedule(data.schedule);
      } else if (data.eventId === 'informal-signup') {
        setInfSchedule(data.schedule);
      }
    };

    socket.on('event_state_change', handleStateChange);
    socket.on('signup_change', handleSignupChange);
    socket.on('tickets_update', handleTicketsUpdate);
    socket.on('role_requests_update', handleRoleRequestsUpdate);
    socket.on('leaderboard_update', handleLeaderboardUpdate);
    socket.on('kills_update', handleLeaderboardUpdate);
    socket.on('weekly_kills_update', handleLeaderboardUpdate);
    socket.on('priority_list_update', handlePriorityListUpdate);
    socket.on('event_schedule_change', handleScheduleChange);
    return () => {
      socket.off('event_state_change', handleStateChange);
      socket.off('signup_change', handleSignupChange);
      socket.off('tickets_update', handleTicketsUpdate);
      socket.off('role_requests_update', handleRoleRequestsUpdate);
      socket.off('leaderboard_update', handleLeaderboardUpdate);
      socket.off('kills_update', handleLeaderboardUpdate);
      socket.off('weekly_kills_update', handleLeaderboardUpdate);
      socket.off('priority_list_update', handlePriorityListUpdate);
      socket.off('event_schedule_change', handleScheduleChange);
    };
  }, [socket, loadDashboardData, loadSignups]);

  // Admin closes registration roster
  const handleCloseEventSignup = async (eventId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/close/${eventId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: eventId === 'rp-signup' ? 'RP Ticket' : 'Informal Fight'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addNotification('Registration Closed', `${eventId === 'rp-signup' ? 'RP' : 'Informal'} registration closed and final roster posted.`, 'success');
        loadSignups();
      } else {
        throw new Error(data.error || 'Failed to close registration.');
      }
    } catch (err: any) {
      addNotification('Closure Failed', err.message || 'Could not close registration.', 'error');
    }
  };

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

  const handleStatsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/about/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statsForm)
      });
      if (res.ok) {
        addNotification('Stats Updated', 'Family stats updated successfully on website.', 'success');
        loadDashboardData();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update stats.');
      }
    } catch (err: any) {
      addNotification('Update Failed', err.message || 'Network error.', 'error');
    }
  };

  const handleStatsBroadcast = async (channelKey: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/about/stats/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelKey })
      });
      if (res.ok) {
        addNotification('Embed Dispatched', `Family stats broadcasted to Discord channel "${channelKey}".`, 'success');
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Broadcast failed.');
      }
    } catch (err: any) {
      addNotification('Broadcast Failed', err.message || 'Network error.', 'error');
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
    } catch {}
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
    } catch {}
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
    } catch {}
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
    } catch {}
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
    } catch {}
  };

  // Admin audit: Role requests
  const handleRoleReview = async (requestId: string, status: 'approved' | 'rejected') => {
    const reqObj = roleRequests.find(r => r.id === requestId);
    if (!reqObj) return;
    
    const memberId = reqObj.discordId;
    const fields = roleReviewForm[requestId] || { nickname: `WP | ${reqObj.inGameName || reqObj.username}`, roleToGrant: 'Family Member', reason: '' };
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/members/role-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, memberId, status, ...fields })
      });
      if (res.ok) {
        addNotification('Decision Logged', `Role request review logged as: ${status.toUpperCase()}`, 'success');
        loadDashboardData();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to log review decision.');
      }
    } catch (err: any) {
      addNotification('Review Failed', err.message || 'Network failure.', 'error');
    }
  };

  const handleUpdateWeeklyPoints = async (memberId: string, pointsStr: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/members/${memberId}/weekly-points`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ weeklyPoints: pointsStr })
      });
      if (res.ok) {
        addNotification('Points Updated', 'Weekly event points updated & synced with Discord bot.', 'success');
        loadDashboardData();
      } else {
        const errorData = await res.json();
        addNotification('Update Failed', errorData.error || 'Server error', 'warning');
      }
    } catch {
      addNotification('Update Failed', 'Network failure.', 'error');
    }
  };

  const handleUpdateKills = async (memberId: string, killsStr: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/members/${memberId}/kills`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kills: killsStr })
      });
      if (res.ok) {
        addNotification('Kills Updated', 'All-time kills successfully updated & synced with Discord.', 'success');
        loadDashboardData();
      } else {
        const errorData = await res.json();
        addNotification('Update Failed', errorData.error || 'Server error', 'warning');
      }
    } catch {
      addNotification('Update Failed', 'Network failure.', 'error');
    }
  };

  const handleUpdateWeeklyKills = async (memberId: string, weeklyKillsStr: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/members/${memberId}/weekly-kills`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ weeklyKills: weeklyKillsStr })
      });
      if (res.ok) {
        addNotification('Weekly Kills Updated', 'Weekly kills successfully updated & synced with Discord.', 'success');
        loadDashboardData();
      } else {
        const errorData = await res.json();
        addNotification('Update Failed', errorData.error || 'Server error', 'warning');
      }
    } catch {
      addNotification('Update Failed', 'Network failure.', 'error');
    }
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
    } catch {}
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
    } catch {}
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
    } catch {}
  };

  // Admin audit: Complete Order
  const handleCompleteOrder = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/shop/orders/${orderId}/complete`, { method: 'POST' });
      if (res.ok) {
        addNotification('Order Completed', 'Inventory items dispatched to client.', 'success');
        loadDashboardData();
      }
    } catch {}
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
    } catch {}
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
    } catch {}
  };

  const handleLeaveSignup = async (eventId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/leave/${eventId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        addNotification('Queue Withdrawn', 'Successfully left the signup roster.', 'info');
        loadSignups();
      } else {
        addNotification('Action Denied', data.error || 'Failed to leave roster.', 'warning');
      }
    } catch {}
  };

  const handleScheduleTrigger = async (eventId: string, title: string, description: string, delay: string, unit: 'seconds' | 'minutes' = 'minutes') => {
    if (!title) {
      addNotification('Title Required', 'Please set an event title first.', 'warning');
      return;
    }
    const val = parseInt(delay, 10);
    if (isNaN(val) || val <= 0) {
      addNotification('Invalid Delay', `Please set a valid positive delay in ${unit}.`, 'warning');
      return;
    }

    try {
      const payload: any = { eventId, title, description };
      if (unit === 'seconds') {
        payload.delaySeconds = val;
      } else {
        payload.delayMinutes = val;
      }

      const res = await fetch(`${API_BASE_URL}/api/events/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        addNotification('Trigger Scheduled', `Bot will trigger in ${val} ${unit} at ${data.targetTime}.`, 'success');
        const totalSecs = unit === 'seconds' ? val : val * 60;
        if (eventId === 'rp-signup') {
          setRpTriggerCountdown(totalSecs);
        } else if (eventId === 'signup-event') {
          setSignupEventTriggerCountdown(totalSecs);
        } else {
          setInfTriggerCountdown(totalSecs);
        }
      } else {
        addNotification('Scheduling Failed', data.error || 'Failed to schedule trigger.', 'warning');
      }
    } catch {
      addNotification('Error', 'Failed to connect to scheduling service.', 'warning');
    }
  };

  // Open active signup channel
  const handleTriggerSignupWindow = async (eventId: string, title: string, desc: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/trigger`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId, title, description: desc })
      });
      if (res.ok) {
        addNotification('Signup Window Triggered', `Roster registration opened for ${title}.`, 'success');
        loadSignups();
      }
    } catch {}
  };

  // Toggle simulated voice presence
  const handleToggleVoiceSimulation = async (memberId: string, currentInVoice: boolean) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/simulate-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId, inVoice: !currentInVoice })
      });
      if (res.ok) {
        addNotification('Voice Presence Toggled', 'Simulated voice status updated and Discord synced.', 'success');
        loadSignups();
      } else {
        const errData = await res.json();
        addNotification('Action Denied', errData.error || 'Failed to toggle voice status.', 'warning');
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'Error toggling voice status.', 'warning');
    }
  };

  // Kick a roster member
  const handleKickRosterMember = async (eventId: 'rp-signup' | 'informal-signup' | 'signup-event', memberId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/kick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId, memberId })
      });
      if (res.ok) {
        addNotification('Member Kicked', 'Successfully kicked member from the roster and Discord embed.', 'success');
        loadSignups();
      } else {
        const errData = await res.json();
        addNotification('Action Denied', errData.error || 'Failed to kick member.', 'warning');
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'Error kicking member.', 'warning');
    }
  };

  // Swap two roster members
  const handleSwapRosterMembers = async (eventId: 'rp-signup' | 'informal-signup' | 'signup-event', memberId1: string, memberId2: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId, memberId1, memberId2 })
      });
      if (res.ok) {
        addNotification('Members Swapped', 'Successfully swapped roster positions and updated Discord.', 'success');
        loadSignups();
      } else {
        const errData = await res.json();
        addNotification('Action Denied', errData.error || 'Failed to swap members.', 'warning');
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'Error swapping members.', 'warning');
    }
  };

  // Log public win
  const handleLogWin = async (e: React.FormEvent, forcedType?: string) => {
    e.preventDefault();
    if (!winForm.title || !winForm.description) return;
    const payload = { ...winForm, type: forcedType || winForm.type };
    try {
      const res = await fetch(`${API_BASE_URL}/api/wins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addNotification('Win Logged', 'Victory report published in public channels.', 'success');
        setWinForm({ type: 'event', title: '', description: '', participants: '', mediaUrl: '' });
        loadDashboardData();
      }
    } catch {}
  };

  // Shared Denied handler
  const checkAccess = (tier: 'member' | 'admin') => {
    if (tier === 'admin') {
      if (!user) return false;
      return isLeaderOrAdmin;
    }
    return true; // Member tier is open to all public visitors
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

  const renderAboutUs = () => {
    const RPIcon = () => (
      <span className="text-[9px] font-mono font-black tracking-tight leading-none block select-none">RP</span>
    );

    const statsGrid = [
      { label: 'TOTAL FAMILY MEMBERS', value: familyStats.totalMembers, icon: Users, color: 'text-purple-300', bg: 'badge-purple', desc: 'Active Members' },
      { label: 'TOTAL GIVEAWAYS', value: familyStats.totalGiveaways, icon: Gift, color: 'text-rose-400', bg: 'badge-rose', desc: 'Completed' },
      { label: 'TOTAL BONUSES', value: `$${Number(familyStats.totalBonuses || 0).toLocaleString()}`, icon: Coins, color: 'text-emerald-400', bg: 'badge-green', desc: 'From Operations' },
      { label: 'HC WORK DONE', value: familyStats.hcWorkDone, icon: Wrench, color: 'text-blue-400', bg: 'badge-blue', desc: 'Tasks Completed' },
      { label: 'TOTAL STRIKES', value: familyStats.totalStrikes, icon: Target, color: 'text-purple-300', bg: 'badge-purple', desc: 'Total Issued' },
      { label: 'TOTAL BLACKLISTED', value: familyStats.totalBlacklisted, icon: UserX, color: 'text-rose-400', bg: 'badge-rose', desc: 'Players' },
      { label: 'RP WON', value: familyStats.rpWon, icon: RPIcon, color: 'text-purple-300', bg: 'badge-purple', desc: 'Roleplay Points' },
      { label: 'EVENTS WON', value: familyStats.eventsWon, icon: Trophy, color: 'text-amber-400', bg: 'badge-amber', desc: 'Total Victories' },
      { label: 'FAMILY RANKING POINTS', value: familyStats.familyRankingPoints, icon: Star, color: 'text-purple-300', bg: 'badge-purple', desc: 'Ranking Points' },
      { label: 'FAMILY RANK', value: familyStats.familyRank, icon: Crown, color: 'text-cyan-400', bg: 'badge-cyan', desc: 'On The Server' }
    ];

    const DoveIcon = () => (
      <svg className="w-9 h-9 text-[#7c3aed] fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 4c-1.5 0-3 1-3.5 2C12 7 10.5 6 9 6c-3 0-5 2.5-5 5.5s2.5 5.5 5.5 5.5c1.5 0 2.5-.5 3.5-1.5.5-.5 1-1.5 1-2.5 0-1.5-.5-2.5-1.5-3.5.5 0 1 .5 1.5 1 1 1 2.5 1 3.5.5s1-2.5 1-3.5c0-1.5-1.5-3-3-3zM5.5 11.5c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5c0 1-.5 2-1.5 2.5s-2 .5-3 .5c-1.5 0-2.5-1-2.5-3z" />
      </svg>
    );

    const RespectIcon = () => (
      <svg className="w-4.5 h-4 text-[#cca43b] fill-none stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 8.5c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1M2 12c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1M2 15.5c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1" />
      </svg>
    );

    const PowerIcon = () => (
      <svg className="w-4 h-4 text-[#cca43b] fill-none stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2l4.5 5.5L22 12l-5.5 4.5L12 22l-4.5-5.5L2 12l5.5-4.5Z" />
      </svg>
    );

    return (
      <div className="space-y-6 max-w-5xl mx-auto font-sans">
        {/* Story Intro Card */}
        <div 
          className="border rounded-2xl relative overflow-hidden shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 py-3 px-8 border-slate-200/90 bg-[url('/about_banner_bg.png')] bg-no-repeat bg-center bg-cover md:bg-[position:98%_65%] md:bg-[size:114%_100%]"
          style={{
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.95)'
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full filter blur-3xl pointer-events-none" />
          <div className="flex-1 space-y-3.5 relative z-10 text-left">
            <div className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-purple-500/10 to-amber-500/5 border border-purple-500/20 text-purple-700 text-[9px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider font-sans">
                WHO WE ARE
              </span>
            </div>
            
            <div className="flex items-center gap-3.5">
              <div className="shrink-0 text-[#7c3aed] flex items-center justify-center">
                <DoveIcon />
              </div>
              <div className="w-[1.5px] h-12 bg-gradient-to-b from-[#7c3aed] to-[#cca43b] self-center" />
              <div className="space-y-0.5 animate-flip-in-left origin-left">
                <h1 className="font-title font-black text-3xl md:text-[45px] uppercase tracking-wider text-slate-900 leading-none italic">
                  WHITE PIGEONS
                </h1>
                <h1 className="font-title font-black text-3xl md:text-[45px] uppercase tracking-wider text-purple-700 leading-none italic">
                  FAMILY
                </h1>
              </div>
            </div>

            <p className="text-slate-700 text-[13.5px] leading-relaxed max-w-xl font-medium font-sans">
              Forged in city conflicts, the <strong className="text-slate-900 font-bold">White Pigeons</strong> family rises as the supreme power on the streets. 
              We operate with loyalty, respect, and clinical efficiency. Through turf dominance, strategic commerce collections, 
              and synchronized operations, we remain #TOP1. We stand undivided—a true brotherhood on top.
            </p>

            <div className="flex flex-wrap items-center gap-6 text-slate-800 text-[11px] font-title font-black uppercase tracking-widest pt-1">
              <span className="flex items-center gap-2 hover:text-[#7c3aed] transition-smooth cursor-default">
                <Shield className="w-4 h-4 text-[#cca43b] shrink-0" />
                LOYALTY
              </span>
              <span className="flex items-center gap-2 hover:text-[#7c3aed] transition-smooth cursor-default">
                <RespectIcon />
                RESPECT
              </span>
              <span className="flex items-center gap-2 hover:text-[#7c3aed] transition-smooth cursor-default">
                <PowerIcon />
                POWER
              </span>
            </div>
          </div>
          
          {/* Logo Illustration */}
          <div className="relative shrink-0 select-none flex items-center justify-center py-0 md:pr-0 md:-mr-4 z-10">
            {/* Premium Golden-Purple Halos behind logo */}
            <div className="absolute w-64 h-64 rounded-full bg-radial from-purple-300/20 via-transparent to-transparent blur-2xl pointer-events-none z-0" />
            <div className="absolute w-56 h-56 rounded-full bg-radial from-amber-200/10 via-transparent to-transparent blur-3xl pointer-events-none z-0 translate-x-4 translate-y-4" />
            
            <img 
              src="/about_logo_isolated.png"
              alt="White Pigeons Isolated Logo" 
              className="w-96 h-96 md:w-[440px] md:h-[440px] object-contain relative z-10 hover:scale-[1.015] transition-smooth drop-shadow-[0_0_40px_rgba(168,85,247,0.35)] animate-float"
            />
          </div>
        </div>

        {/* Live Metrics Embed Replica Dashboard */}
        <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-[#1c1a2a]/50 pb-3 select-none">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-purple-400" />
              <div>
                <h2 className="font-title font-black text-sm text-purple-400 uppercase tracking-wider">
                  WHITE PIGEONS #TOP1 FAMILY STATS!
                </h2>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">WHITE PIGEONS #TOP1 ON TOP!</p>
              </div>
            </div>
            <div className="text-[9px] text-zinc-550 font-mono flex items-center gap-1.5">
              <span>Last Synced: {familyStats.updatedAt ? new Date(familyStats.updatedAt).toLocaleTimeString() : '9:25 PM'}</span>
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {statsGrid.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div 
                  key={idx} 
                  className="bg-[#08111f]/65 border border-purple-500/10 hover:border-purple-500/25 hover:shadow-[0_0_20px_rgba(168,85,247,0.06)] p-4 rounded-xl flex flex-col justify-between h-28 hover:-translate-y-0.5 transition-smooth relative group overflow-hidden shadow-inner select-none"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[7.5px] font-title font-black text-zinc-500 uppercase tracking-widest leading-tight pr-2">
                      {stat.label}
                    </span>
                    <div className={`p-1.5 rounded-lg ${stat.bg} ${stat.color} border border-transparent`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1 text-left">
                    <div className="text-xl font-title font-black italic text-zinc-100 group-hover:text-purple-400 transition-smooth leading-none">
                      {stat.value || 0}
                    </div>
                    <div className="text-[8px] font-sans font-medium text-zinc-500 mt-1 uppercase tracking-wide">
                      {stat.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-start items-center gap-2 pt-2 border-t border-[#1c1a2a]/30 select-none">
            <button
              onClick={loadDashboardData}
              className="bg-transparent hover:bg-purple-500/5 text-zinc-400 hover:text-white font-sans text-[9px] font-extrabold uppercase tracking-wider py-2 px-4 rounded-lg border border-purple-500/20 hover:border-purple-500/40 flex items-center gap-2 transition-smooth cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Stats</span>
            </button>
            {isLeaderOrAdmin && (
              <span className="text-[9px] text-zinc-600 italic">Admin settings enabled below. Edit stats in the panel controller to broadcast values.</span>
            )}
          </div>
        </div>

        {/* Admin Stats Control Panel */}
        {isLeaderOrAdmin && (
          <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 shadow-xl">
            <h3 className="font-title font-black text-sm italic text-purple-500 border-b border-[#1c1a2a]/50 pb-2 uppercase tracking-wide">
              ⚙️┃𝐅𝐚𝐦𝐢𝐥𝐲 𝐒𝐭𝐚𝐭𝐬 𝐂𝐨𝐧𝐭𝐫𝐨𝐥𝐥𝐞𝐫
            </h3>
            
            <form onSubmit={handleStatsUpdate} className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div>
                  <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">Total Members</label>
                  <input
                    type="text"
                    value={statsForm.totalMembers}
                    onChange={(e) => setStatsForm((p: any) => ({ ...p, totalMembers: e.target.value }))}
                    className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2 text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">Total Giveaways</label>
                  <input
                    type="text"
                    value={statsForm.totalGiveaways}
                    onChange={(e) => setStatsForm((p: any) => ({ ...p, totalGiveaways: e.target.value }))}
                    className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2 text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">Total Bonuses ($)</label>
                  <input
                    type="text"
                    value={statsForm.totalBonuses}
                    onChange={(e) => setStatsForm((p: any) => ({ ...p, totalBonuses: e.target.value }))}
                    className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2 text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">HC Work Done</label>
                  <input
                    type="text"
                    value={statsForm.hcWorkDone}
                    onChange={(e) => setStatsForm((p: any) => ({ ...p, hcWorkDone: e.target.value }))}
                    className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2 text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">Total Strikes</label>
                  <input
                    type="text"
                    value={statsForm.totalStrikes}
                    onChange={(e) => setStatsForm((p: any) => ({ ...p, totalStrikes: e.target.value }))}
                    className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2 text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div>
                  <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">Total Blacklisted</label>
                  <input
                    type="text"
                    value={statsForm.totalBlacklisted}
                    onChange={(e) => setStatsForm((p: any) => ({ ...p, totalBlacklisted: e.target.value }))}
                    className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2 text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">RP Won</label>
                  <input
                    type="text"
                    value={statsForm.rpWon}
                    onChange={(e) => setStatsForm((p: any) => ({ ...p, rpWon: e.target.value }))}
                    className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2 text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">Events Won</label>
                  <input
                    type="text"
                    value={statsForm.eventsWon}
                    onChange={(e) => setStatsForm((p: any) => ({ ...p, eventsWon: e.target.value }))}
                    className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2 text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">Rank Points</label>
                  <input
                    type="text"
                    value={statsForm.familyRankingPoints}
                    onChange={(e) => setStatsForm((p: any) => ({ ...p, familyRankingPoints: e.target.value }))}
                    className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2 text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">Family Rank</label>
                  <input
                    type="text"
                    value={statsForm.familyRank}
                    onChange={(e) => setStatsForm((p: any) => ({ ...p, familyRank: e.target.value }))}
                    className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2 text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[10px] font-black italic tracking-wide py-2.5 px-6 rounded-lg border border-purple-500 glow-magenta transition-smooth cursor-pointer"
                >
                  SAVE & UPDATE WEBSITE
                </button>
                <button
                  type="button"
                  onClick={() => handleStatsBroadcast('announcements')}
                  className="bg-indigo-600 hover:bg-indigo-750 text-white font-title text-[10px] font-black italic tracking-wide py-2.5 px-6 rounded-lg border border-indigo-500 glow-indigo transition-smooth cursor-pointer"
                >
                  📢 SEND EMBED TO #ANNOUNCEMENTS
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  };

  const renderRoleRequest = () => {
    if (!checkAccess('member')) return renderAccessDenied('Member access token required');
    
    // Filter to only approved roles
    const approvedReqs = roleRequests.filter(r => {
      if (r.status !== 'approved') return false;
      if (!roleSearchQuery) return true;
      const query = roleSearchQuery.toLowerCase();
      return (
        (r.inGameName && r.inGameName.toLowerCase().includes(query)) ||
        (r.username && r.username.toLowerCase().includes(query)) ||
        (r.characterId && r.characterId.toLowerCase().includes(query)) ||
        (r.roleToGrant && r.roleToGrant.toLowerCase().includes(query))
      );
    });

    return (
      <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-6 max-w-5xl mx-auto shadow-xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#1c1a2a]/50 pb-4 gap-4">
          <div className="space-y-1">
            <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta flex items-center gap-2">
              📋┃𝐑𝐎𝐋𝐄 𝐑𝐄𝐐𝐔𝐄𝐒𝐓 𝐀𝐑𝐂𝐇𝐈𝐕𝐄
            </h2>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed font-sans">
              This registry displays the synchronized active logs of members who requested and received roles. 
              Submissions are strictly processed via our Discord server interaction system.
            </p>
          </div>
          
          {/* Discord CTA Button */}
          <a
            href="https://discord.gg/JrCJvrWv"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-title text-xs font-black italic px-5 py-2.5 rounded-xl border border-purple-500/50 glow-magenta transition-smooth select-none cursor-pointer shrink-0"
          >
            <span>JOIN & APPLY ON DISCORD</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Search & Stats Row */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#0a0a14] p-4 rounded-xl border border-[#1c1a2a]">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name, ID, or role..."
              value={roleSearchQuery}
              onChange={(e) => setRoleSearchQuery(e.target.value)}
              className="w-full bg-[#111118] border border-[#1c1a2a] rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-300 placeholder-zinc-650 focus:border-purple-600/50 outline-none font-sans"
            />
          </div>
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex gap-4 shrink-0 font-sans">
            <span>Total Approved: <strong className="text-purple-400 font-mono">{approvedReqs.length}</strong></span>
          </div>
        </div>

        {/* Logs List */}
        <div className="overflow-x-auto rounded-xl border border-[#1c1a2a]">
          {approvedReqs.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 italic font-sans text-xs bg-[#0c0b11]">
              {roleSearchQuery ? 'NO MATCHING ROLE REQUEST LOGS FOUND.' : 'NO APPROVED ROLE REQUESTS REGISTERED IN DATABASE.'}
            </div>
          ) : (
            <table className="w-full text-left font-sans text-xs border-collapse bg-[#0c0b11]/20">
              <thead>
                <tr className="bg-[#0a0a14]/60 border-b border-[#1c1a2a] text-zinc-500 uppercase tracking-widest text-[9px] font-black select-none">
                  <th className="p-4">DISCORD MEMBER</th>
                  <th className="p-4">IN-GAME DETAILS</th>
                  <th className="p-4">FORUM LINK</th>
                  <th className="p-4">GRANTED ROLES</th>
                  <th className="p-4">APPROVED BY</th>
                  <th className="p-4">TIMESTAMP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#181622]/40">
                {approvedReqs.map((req) => (
                  <tr key={req.id} className="hover:bg-[#13121d]/20 transition-smooth">
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-950/20 border border-purple-900/30 flex items-center justify-center text-purple-400 font-mono text-[10px] font-bold">
                          {req.username ? req.username.slice(0,2).toUpperCase() : 'WP'}
                        </div>
                        <div>
                          <div className="font-bold text-zinc-200">@{req.username || 'unknown'}</div>
                          <div className="text-[9px] text-zinc-500 font-mono">{req.discordId || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="font-black text-zinc-300">WP | {req.inGameName || 'N/A'}</div>
                        <div className="flex flex-wrap gap-1 text-[8px] font-mono">
                          <span className="bg-[#111118] border border-[#1c1a2a] text-zinc-400 px-1 rounded">ID: {req.characterId || 'N/A'}</span>
                          <span className="bg-purple-950/30 border border-purple-900/20 text-purple-400 px-1 rounded">LVL: {req.level || 'N/A'}</span>
                          <span className="bg-amber-950/30 border border-amber-900/20 text-amber-500 px-1 rounded">{req.rank || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {req.forumLink && req.forumLink.startsWith('http') ? (
                        <a
                          href={req.forumLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 font-mono font-bold hover:underline inline-flex items-center gap-1"
                        >
                          <span>Forum Link</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-zinc-650 font-mono italic">Not Provided</span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {(req.roleToGrant || req.selectedRoles?.join(', ') || 'Family Member').split(',').map((role: string, idx: number) => (
                          <span 
                            key={idx} 
                            className="bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 font-bold px-2 py-0.5 rounded text-[9px] uppercase font-sans tracking-wide"
                          >
                            {role.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-zinc-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shrink-0" />
                        <span className="font-bold">@{req.reviewer || 'system'}</span>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap text-zinc-550 font-mono text-[10px]">
                      {req.requestedAt ? new Date(req.requestedAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const renderRoleReqReview = () => {
    if (!checkAccess('admin')) return renderAccessDenied('Leadership authority authorization required');
    
    const pendingReqs = roleRequests.filter(r => r.status === 'pending');

    return (
      <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a2a]/50 pb-2">
          📜╰𝐑𝐨𝐥𝐞𝐑𝐞𝐪-𝐑𝐞𝐯𝐢𝐞𝐰 PANEL
        </h2>
        
        <div className="space-y-4 font-sans text-xs">
          {pendingReqs.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 italic">
              NO PENDING ROLE REQUESTS REGISTERED.
            </div>
          ) : (
            pendingReqs.map((req) => {
              const fields = roleReviewForm[req.id] || { nickname: `WP | ${req.inGameName || req.username}`, roleToGrant: 'Family Member', reason: '' };
              
              return (
                <div key={req.id} className="bg-[#13121d]/40 border border-[#1c1a2a] p-4 rounded-xl flex flex-col md:flex-row gap-6 justify-between hover:border-purple-500/20 transition-smooth">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 border-b border-[#1c1a2a]/50 pb-2">
                      <span className="font-bold text-zinc-200">@{req.username}</span>
                      <span className="text-[9px] bg-purple-950/40 text-purple-400 px-2 py-0.5 rounded-full border border-purple-900/30 font-mono">ID: {req.characterId}</span>
                      <span className="text-[9px] bg-amber-950/40 text-amber-500 px-2 py-0.5 rounded-full border border-amber-900/30">City Lvl: {req.level}</span>
                      <span className="text-[9px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-800">Family Rank: {req.rank}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-zinc-500 block uppercase">In-Game Name</span>
                      <span className="text-zinc-300 font-sans font-bold block">{req.inGameName}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-zinc-500 block uppercase">Forum Account Link</span>
                      <a href={req.forumLink} target="_blank" rel="noreferrer" className="text-purple-400 hover:underline font-mono truncate block max-w-md">
                        {req.forumLink}
                      </a>
                    </div>
                  </div>

                  <div className="w-full md:w-64 flex flex-col gap-3 border-t md:border-t-0 md:border-l border-[#1c1a2a]/65 pt-4 md:pt-0 md:pl-4">
                    <div>
                      <label className="text-[9px] text-zinc-500 font-bold block mb-1">CORRECT NICKNAME HANDLE</label>
                      <input 
                        type="text"
                        value={fields.nickname}
                        onChange={(e) => setRoleReviewForm(prev => ({
                          ...prev,
                          [req.id]: { ...(prev[req.id] || { nickname: '', roleToGrant: 'Family Member', reason: '' }), nickname: e.target.value }
                        }))}
                        placeholder="WP | Nickname" 
                        className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-1.5 text-xs text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="text-[9px] text-zinc-500 font-bold block mb-1">GRANT ROLE</label>
                      <select 
                        value={fields.roleToGrant}
                        onChange={(e) => setRoleReviewForm(prev => ({
                          ...prev,
                          [req.id]: { ...(prev[req.id] || { nickname: '', roleToGrant: 'Family Member', reason: '' }), roleToGrant: e.target.value }
                        }))}
                        className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-1.5 text-xs text-zinc-300 outline-none font-sans"
                      >
                        <option value="Family Member">Family Member</option>
                        <option value="Informal Role">Informal Role</option>
                        <option value="Events Role">Events Role</option>
                        <option value="RP Ticket Roaster">RP Ticket Roaster</option>
                        <option value="Turfer">Turfer</option>
                        <option value="Top 10">Top-10 Priority</option>
                        <option value="Broski">Broski</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] text-zinc-500 font-bold block mb-1">REASON / NOTES (IF REJECTING)</label>
                      <input 
                        type="text"
                        value={fields.reason}
                        onChange={(e) => setRoleReviewForm(prev => ({
                          ...prev,
                          [req.id]: { ...(prev[req.id] || { nickname: '', roleToGrant: 'Family Member', reason: '' }), reason: e.target.value }
                        }))}
                        placeholder="Notes or reject reason..." 
                        className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-1.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button onClick={() => handleRoleReview(req.id, 'approved')} className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg py-1.5 font-bold cursor-pointer text-[10px] transition-smooth uppercase">
                        APPROVE
                      </button>
                      <button onClick={() => handleRoleReview(req.id, 'rejected')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg py-1.5 font-bold cursor-pointer text-[10px] transition-smooth uppercase">
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

  const renderStrikes = () => {
    const isAuditor = checkAccess('admin');

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto font-sans">
        {/* Issue Strike (Admin) */}
        {isAuditor && (
          <div className="lg:col-span-1 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 h-fit shadow-xl">
            <h3 className="font-title font-bold text-xs text-primary tracking-wide uppercase border-b border-[#1c1a2a]/50 pb-2">
              🚨┃𝐒𝐭𝐫𝐢𝐤𝐞𝐬 DISCIPLINE DESK
            </h3>

            <form onSubmit={handleIssueStrike} className="font-sans text-xs flex flex-col gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">SELECT MEMBER TO DISCIPLINE</label>
                <select 
                  value={strikeForm.memberId}
                  onChange={(e) => setStrikeForm(prev => ({ ...prev, memberId: e.target.value }))}
                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 outline-none font-sans"
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
                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans"
                />
              </div>

              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">
                ISSUE STRIKE LOG
              </button>
            </form>
          </div>
        )}

        {/* Strikes Ledger */}
        <div className={`${isAuditor ? 'lg:col-span-2' : 'lg:col-span-3'} bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 shadow-xl`}>
          <h2 className="font-title font-black text-lg italic text-zinc-200 border-b border-[#1c1a2a]/50 pb-2">
            🚨 SYSTEM STRIKE ARCHIVES
          </h2>

          <div className="space-y-4 font-sans text-xs">
            {members.filter(m => m.strikes && m.strikes.length > 0).length === 0 ? (
              <div className="text-center py-12 text-zinc-500 italic">
                NO INFRACTIONS DETECTED ON SYSTEM REGISTRY.
              </div>
            ) : (
              members.filter(m => m.strikes && m.strikes.length > 0).map((m) => (
                <div key={m.discordId} className="bg-[#13121d]/40 border border-[#1c1a2a] p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center border-b border-[#1c1a2a] pb-1.5">
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
        <div className="lg:col-span-1 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 h-fit shadow-xl">
          <h3 className="font-title font-bold text-xs text-primary tracking-wide uppercase border-b border-[#1c1a2a]/50 pb-2">
            🎫 Raise Support Complaint
          </h3>

          <form onSubmit={handleRaiseTicket} className="font-sans text-xs flex flex-col gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 font-bold block mb-1">TICKET TIER CATEGORY</label>
              <select 
                value={ticketForm.type}
                onChange={(e) => setTicketForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 outline-none font-sans"
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
                className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 font-bold block mb-1">TICKET DETAIL</label>
              <textarea 
                rows={4}
                value={ticketForm.description}
                onChange={(e) => setTicketForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Provide description..."
                className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans"
              />
            </div>

            <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">
              DISPATCH TICKET
            </button>
          </form>
        </div>

        {/* Tickets Pipeline */}
        <div className="lg:col-span-2 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 shadow-xl">
          <h2 className="font-title font-black text-lg italic text-zinc-200 border-b border-[#1c1a2a]/50 pb-2">
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
                  <div key={t.id} className="bg-[#13121d]/40 border border-[#1c1a2a] p-4 rounded-xl flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-300">[{t.id.toUpperCase()}] {t.subject}</span>
                          <span className="text-[9px] bg-[#0a0a14] px-1.5 py-0.5 rounded font-mono">{t.type.toUpperCase()}</span>
                        </div>
                        <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase ${badge}`}>{t.status}</span>
                      </div>
                      <p className="text-zinc-400 italic bg-[#0a0a14] p-2.5 rounded-lg border border-[#1c1a2a] leading-relaxed">&quot;{t.description}&quot;</p>
                      
                      {t.response && (
                        <p className="text-[10px] text-purple-400 font-sans mt-2 leading-relaxed border-t border-[#1c1a2a] pt-2">
                          💡 RESPONSE: <span className="text-zinc-300 italic">&quot;{t.response}&quot;</span>
                        </p>
                      )}
                    </div>

                    {isAuditor && t.status === 'open' && (
                      <div className="flex gap-2 items-center border-t border-[#1c1a2a] pt-3 mt-1">
                        <input 
                          type="text"
                          value={ticketResolveForm[t.id] || ''}
                          onChange={(e) => setTicketResolveForm(prev => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="Type response description..." 
                          className="flex-1 bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-1.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none"
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
      <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 max-w-2xl mx-auto text-center relative overflow-hidden font-sans shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/5 to-transparent filter blur-2xl rounded-full" />
        
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a2a]/50 pb-2">
          💸 CHECK LEDGER BALANCE
        </h2>
        
        <div className="py-6 select-text">
          <Coins className="w-16 h-16 text-glow-magenta text-purple-400 mx-auto mb-2 animate-bounce" />
          <span className="text-4xl font-title font-black italic text-zinc-100 font-tech">
            ${(user?.balance || 0).toLocaleString()}
          </span>
          <span className="block text-[10px] text-zinc-500 mt-2">Drawn from automated BizWar collections and bonus records.</span>
        </div>

        <div className="bg-[#0a0a14] p-4 border border-[#1c1a2a] rounded-xl text-xs leading-relaxed text-zinc-400 max-w-md mx-auto text-left space-y-3">
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
    const mockLeaderboardMembers: WeeklyLeaderboardEntry[] = [
      { discordId: '110116', username: 'Prem Cullen', nickname: 'Prem Cullen | 110116', roles: ['Event Squad'], weeklyPoints: 62.5, source: 'mock' },
      { discordId: '70941', username: 'Chloe Veneta', nickname: 'Chloe Veneta | 70941', roles: ['Event Squad'], weeklyPoints: 62, source: 'mock' },
      { discordId: '101254', username: 'Melissa MakarovVicious', nickname: 'Melissa MakarovVicious | 101254', roles: ['Event Squad'], weeklyPoints: 61, source: 'mock' },
      { discordId: '133338', username: 'Aayush MakarovVicious', nickname: 'Aayush MakarovVicious | 133338', roles: ['Event Squad'], weeklyPoints: 60.5, source: 'mock' },
      { discordId: '144778', username: 'Evan Verlice', nickname: 'Evan Verlice | 144778', roles: ['Event Squad'], weeklyPoints: 60, source: 'mock' },
      { discordId: '61783', username: 'Quaresma | Dona --', nickname: 'Quaresma | Dona -- 61783', roles: ['Event Squad'], weeklyPoints: 57, source: 'mock' },
      { discordId: '151867', username: 'Rex Nocap', nickname: 'Rex Nocap | 151867', roles: ['Event Squad'], weeklyPoints: 55.5, source: 'mock' },
      { discordId: 'mock-anvy', username: 'Anvy', nickname: 'Anvy', roles: ['Event Squad'], weeklyPoints: 54, source: 'mock' },
      { discordId: '60696', username: 'Eve Riviera', nickname: 'Eve Riviera | 60696', roles: ['Event Squad'], weeklyPoints: 52.5, source: 'mock' },
      { discordId: '118681', username: 'tom scofiel', nickname: 'tom scofiel | 118681', roles: ['Event Squad'], weeklyPoints: 52.5, source: 'mock' },
      { discordId: '82934', username: 'Sukuna MakarovVicious', nickname: 'Sukuna MakarovVicious | 82934', roles: ['Event Squad'], weeklyPoints: 50.5, source: 'mock' },
      { discordId: '48079', username: 'Yasseen Riviera', nickname: 'Yasseen Riviera | 48079', roles: ['Event Squad'], weeklyPoints: 45.5, source: 'mock' },
      { discordId: 'mock-alikagan', username: 'Alikagan', nickname: 'Alikagan', roles: ['Event Squad'], weeklyPoints: 45, source: 'mock' },
      { discordId: '52589', username: 'Fred Riviera', nickname: 'Fred Riviera 52589', roles: ['Event Squad'], weeklyPoints: 44.5, source: 'mock' },
      { discordId: '24644', username: 'Yash Riviera', nickname: 'Yash Riviera 24644', roles: ['Event Squad'], weeklyPoints: 44, source: 'mock' },
      { discordId: '68192', username: 'Ace Verlice', nickname: 'Ace Verlice | 68192', roles: ['Event Squad'], weeklyPoints: 40, source: 'mock' },
      { discordId: '155077', username: 'Akash', nickname: 'Akash | 155077', roles: ['Event Squad'], weeklyPoints: 38.5, source: 'mock' },
      { discordId: 'mock-cobra', username: 'Cobra Entity', nickname: 'Cobra Entity', roles: ['Event Squad'], weeklyPoints: 38, source: 'mock' },
      { discordId: '105776', username: 'Rjay Entity', nickname: 'Rjay Entity | 105776', roles: ['Event Squad'], weeklyPoints: 38, source: 'mock' },
      { discordId: '171896', username: 'Louis Silva', nickname: 'Louis Silva | 171896', roles: ['Event Squad'], weeklyPoints: 38, source: 'mock' }
    ];

    const liveLeaderboardMembers: WeeklyLeaderboardEntry[] = [...members]
      .sort((a, b) => {
        const aPoints = a.weeklyPoints ?? 0;
        const bPoints = b.weeklyPoints ?? 0;
        if (bPoints !== aPoints) return bPoints - aPoints;
        return b.activityScore - a.activityScore;
      })
      .slice(0, 20)
      .map(member => ({
        discordId: member.discordId,
        username: member.username,
        nickname: member.nickname || `${member.username} | ${member.discordId}`,
        roles: member.roles || [],
        weeklyPoints: member.weeklyPoints ?? 0,
        source: 'live'
      }));

    const hasLiveLeaderboardData = liveLeaderboardMembers.length > 0;
    const leaderboardMembers = hasLiveLeaderboardData ? liveLeaderboardMembers : mockLeaderboardMembers;
    const totalPoints = leaderboardMembers.reduce((sum, member) => sum + member.weeklyPoints, 0);
    const totalPlayers = hasLiveLeaderboardData
      ? leaderboardMembers.filter(member => member.weeklyPoints > 0).length
      : 99;
    const isMock = !hasLiveLeaderboardData;

    const isAuditor = checkAccess('admin');
    const formatPoints = (points: number) => points.toFixed(1).replace(/\.0$/, '');
    const getDisplayId = (member: WeeklyLeaderboardEntry) => member.discordId.startsWith('mock-') ? 'pending' : member.discordId;
    const rankTone = (rank: number) => {
      if (rank === 1) return 'border-[#ff9f1c]/55 bg-[#ff9f1c]/12 text-[#ffbf5c]';
      if (rank === 2) return 'border-cyan-300/45 bg-cyan-300/10 text-cyan-100';
      if (rank === 3) return 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200';
      return 'border-cyan-400/18 bg-cyan-400/5 text-zinc-300';
    };

    return (
      <div className="space-y-5 font-sans stagger-child">
        <section className="border border-cyan-400/18 bg-[#0d1117]/92 shadow-[0_0_34px_rgba(0,212,255,0.08)]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-cyan-400/15 px-4 sm:px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                <h2 className="font-title text-2xl font-black uppercase text-[#f0f6ff] leading-none">
                  Weekly Event Leaderboard
                </h2>
                <span className={`font-tech text-[9px] uppercase px-2 py-1 border ${isMock ? 'border-[#ff9f1c]/40 text-[#ffb84d] bg-[#ff9f1c]/10' : 'border-emerald-400/35 text-emerald-300 bg-emerald-400/10'}`}>
                  {isMock ? 'Mock Roster' : 'Live Roster'}
                </span>
              </div>
              <p className="mt-1 font-tech text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Event point standings // channel relay
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="border border-cyan-400/20 bg-cyan-400/5 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Total Points</div>
                <div className="font-tech text-sm font-bold text-cyan-200">{formatPoints(totalPoints)}</div>
              </div>
              <div className="border border-cyan-400/20 bg-cyan-400/5 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Players</div>
                <div className="font-tech text-sm font-bold text-cyan-200">{totalPlayers}</div>
              </div>
              <div className="border border-[#ff9f1c]/25 bg-[#ff9f1c]/8 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Next Reset</div>
                <div className="font-tech text-sm font-bold text-[#ffb84d]">in 4 days</div>
              </div>
            </div>
          </div>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] gap-5 p-4 sm:p-5">
            <div className="border border-cyan-400/15 bg-[#090f16]/88 overflow-hidden">
              <div className="hidden md:grid grid-cols-[72px_minmax(0,1.3fr)_130px_130px_130px] gap-3 border-b border-cyan-400/15 bg-cyan-400/5 px-4 py-2 font-tech text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                <span>Rank</span>
                <span>Member Name</span>
                <span>Citizen ID</span>
                <span>Role</span>
                <span className="text-right">Points</span>
              </div>

              <div className="divide-y divide-cyan-400/10">
                {leaderboardMembers.map((member, index) => {
                  const rank = index + 1;
                  const pointsVal = weeklyPointsForm[member.discordId] !== undefined
                    ? weeklyPointsForm[member.discordId]
                    : String(member.weeklyPoints || 0);
                  const canEditLivePoints = isAuditor && member.source === 'live';

                  return (
                    <div
                      key={member.discordId}
                      className="grid md:grid-cols-[72px_minmax(0,1.3fr)_130px_130px_130px] gap-3 items-center px-4 py-3 hover:bg-cyan-400/5 transition-smooth"
                    >
                      <div>
                        <span className={`inline-flex min-w-11 items-center justify-center border px-2 py-1 font-tech text-[11px] font-bold ${rankTone(rank)}`}>
                          #{rank}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-title text-[16px] font-bold uppercase text-[#f0f6ff]">
                          {member.username}
                        </div>
                        <div className="mt-0.5 truncate font-tech text-[10px] uppercase text-zinc-500">
                          {member.nickname}
                        </div>
                      </div>
                      <div className="font-tech text-[11px] uppercase text-cyan-200">
                        {getDisplayId(member)}
                      </div>
                      <div className="truncate font-tech text-[10px] uppercase text-zinc-500">
                        {member.roles[0] || 'Event Squad'}
                      </div>
                      <div className="flex items-center justify-end gap-2 font-tech text-[12px] text-[#f0f6ff]">
                        {canEditLivePoints ? (
                          <>
                            <input
                              type="text"
                              value={pointsVal}
                              onChange={(e) => setWeeklyPointsForm(prev => ({ ...prev, [member.discordId]: e.target.value }))}
                              className="w-16 bg-[#0a0f18] border border-cyan-400/20 p-1 text-center text-cyan-100 outline-none focus:border-cyan-300"
                              aria-label={`Weekly points for ${member.username}`}
                            />
                            <button
                              onClick={() => handleUpdateWeeklyPoints(member.discordId, pointsVal)}
                              className="border border-cyan-400/35 bg-cyan-400/10 px-2 py-1 text-[9px] font-bold uppercase text-cyan-200 hover:bg-cyan-400/18 active:scale-95 transition-smooth cursor-pointer"
                            >
                              Set
                            </button>
                          </>
                        ) : (
                          <span className="text-cyan-100"><strong>{formatPoints(member.weeklyPoints)}</strong> pts</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="border border-cyan-400/15 bg-[#090f16]/88 p-4">
                <div className="font-tech text-[9px] uppercase tracking-[0.16em] text-zinc-500">Data Source</div>
                <div className="mt-3 flex items-center justify-between border border-cyan-400/15 bg-cyan-400/5 px-3 py-2">
                  <span className="font-tech text-[11px] uppercase text-cyan-100">{isMock ? 'Mock sample loaded' : 'Live channel sync'}</span>
                  <span className={`h-2 w-2 ${isMock ? 'bg-[#ff9f1c]' : 'bg-emerald-400'} shadow-[0_0_10px_rgba(0,212,255,0.7)]`} />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
                  {isMock
                    ? 'Local preview dataset active.'
                    : 'Live member dataset active.'}
                </p>
              </div>

              <div className="border border-cyan-400/15 bg-[#090f16]/88 p-4">
                <div className="font-tech text-[9px] uppercase tracking-[0.16em] text-zinc-500">Point System</div>
                <div className="mt-3 space-y-2 font-tech text-[11px] uppercase text-zinc-300">
                  <div className="flex justify-between border-b border-cyan-400/10 pb-2"><span>Harbor</span><strong className="text-cyan-200">1</strong></div>
                  <div className="flex justify-between border-b border-cyan-400/10 pb-2"><span>Weapons Factory</span><strong className="text-cyan-200">2</strong></div>
                  <div className="flex justify-between border-b border-cyan-400/10 pb-2"><span>RP Ticket</span><strong className="text-cyan-200">2</strong></div>
                  <div className="flex justify-between"><span>Foundry</span><strong className="text-cyan-200">3</strong></div>
                </div>
              </div>

              {isAuditor && (
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to deploy/sync the Weekly Event Leaderboard Embed in Discord?')) {
                      try {
                        const res = await fetch(`${API_BASE_URL}/api/admin/deploy-leaderboard-prompt`, { method: 'POST' });
                        if (res.ok) {
                          addNotification('Embed Deployed', 'Leaderboard feed successfully pushed to Discord!', 'success');
                        } else {
                          addNotification('Deployment Failed', 'Verify bot connection.', 'warning');
                        }
                      } catch {
                        addNotification('Deployment Failed', 'Network failure while syncing Discord embed.', 'error');
                      }
                    }
                  }}
                  className="w-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-2.5 font-title text-[11px] font-black uppercase text-cyan-100 hover:bg-cyan-400/18 active:scale-[0.98] transition-smooth cursor-pointer"
                >
                  Sync Live Leaderboard
                </button>
              )}
            </aside>
          </div>
        </section>
      </div>
    );
  };

  const renderLongTimeKillList = () => {
    type KillLeaderboardEntry = {
      discordId: string;
      username: string;
      nickname: string;
      kills: number;
      isTop10: boolean;
      source: 'live' | 'mock';
    };

    const mockKillMembers: KillLeaderboardEntry[] = [
      { discordId: '171896', username: 'Louis Silva', nickname: 'Louis Silva | 171896', kills: 137, isTop10: true, source: 'mock' },
      { discordId: '155077', username: 'Akash', nickname: 'Akash | 155077', kills: 134, isTop10: true, source: 'mock' },
      { discordId: '130686', username: 'Mikey Bonz', nickname: 'Mikey Bonz | 130686', kills: 132, isTop10: true, source: 'mock' },
      { discordId: 'mock-cobra', username: 'Cobra Entity', nickname: 'Cobra Entity', kills: 116, isTop10: true, source: 'mock' },
      { discordId: '48888', username: 'Michael Makarovvicious', nickname: 'Michael Makarovvicious 48888', kills: 110, isTop10: true, source: 'mock' },
      { discordId: '170715', username: 'Clark Turechad', nickname: 'Clark Turechad 170715', kills: 107, isTop10: true, source: 'mock' },
      { discordId: '48079', username: 'Yasseen Riviera', nickname: 'Yasseen Riviera | 48079', kills: 103, isTop10: true, source: 'mock' },
      { discordId: '12623', username: 'winston wir', nickname: 'winston wir | 12623', kills: 101, isTop10: true, source: 'mock' },
      { discordId: '70941', username: 'Chloe Veneta', nickname: 'Chloe Veneta | 70941', kills: 100, isTop10: true, source: 'mock' },
      { discordId: 'mock-alikagan', username: 'Alikagan', nickname: 'Alikagan', kills: 93, isTop10: true, source: 'mock' },
      { discordId: '61783', username: 'Quaresma | Dona ~', nickname: 'Quaresma | Dona ~ 61783', kills: 89, isTop10: false, source: 'mock' },
      { discordId: 'mock-dick-supplier', username: 'Dick Supplier', nickname: 'Dick Supplier', kills: 86, isTop10: false, source: 'mock' },
      { discordId: '82934', username: 'Sukuna MakarovVicious', nickname: 'Sukuna MakarovVicious | 82934', kills: 86, isTop10: false, source: 'mock' },
      { discordId: '172247', username: 'Dryhes Mattis', nickname: 'Dryhes Mattis 172247', kills: 81, isTop10: false, source: 'mock' },
      { discordId: '101254', username: 'Melissa MakarovVicious', nickname: 'Melissa MakarovVicious | 101254', kills: 81, isTop10: false, source: 'mock' },
      { discordId: '3572', username: 'Lokmane Bonz', nickname: 'Lokmane Bonz | 3572', kills: 77, isTop10: false, source: 'mock' },
      { discordId: '116365', username: 'Caln Vicious', nickname: 'Caln Vicious 116365', kills: 74, isTop10: false, source: 'mock' },
      { discordId: '127353', username: 'Franz Barnicht', nickname: 'Franz Barnicht | 127353', kills: 72, isTop10: false, source: 'mock' },
      { discordId: 'mock-gardy', username: 'Gardy', nickname: 'Gardy', kills: 71, isTop10: false, source: 'mock' },
      { discordId: '7386', username: 'Bruno Dior', nickname: 'Bruno Dior | 7386', kills: 70, isTop10: false, source: 'mock' },
      { discordId: '110116', username: 'Prem Cullen', nickname: 'Prem Cullen | 110116', kills: 70, isTop10: false, source: 'mock' },
      { discordId: '152194', username: 'Calvin Revy', nickname: 'Calvin Revy | 152194', kills: 68, isTop10: false, source: 'mock' },
      { discordId: '43022', username: 'Aditya/Fake Vicious', nickname: 'Aditya/Fake Vicious 43022', kills: 67, isTop10: false, source: 'mock' },
      { discordId: 'mock-can', username: 'can', nickname: 'can', kills: 64, isTop10: false, source: 'mock' }
    ];

    const liveKillMembers: KillLeaderboardEntry[] = [...members]
      .filter(m => !['PigeonBoss', 'VitoScaletta', 'TonyMontana'].includes(m.username))
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 50)
      .map(member => ({
        discordId: member.discordId,
        username: member.username,
        nickname: member.nickname || `${member.username} | ${member.discordId}`,
        kills: member.kills || 0,
        isTop10: member.isTop10,
        source: 'live'
      }));

    const hasLiveKillData = liveKillMembers.length > 0;
    const list = hasLiveKillData ? liveKillMembers : mockKillMembers;
    const totalKills = list.reduce((sum, member) => sum + member.kills, 0);
    const topKillCount = list[0]?.kills || 0;
    const isMock = !hasLiveKillData;
    const isAuditor = checkAccess('admin');
    const getDisplayId = (member: KillLeaderboardEntry) => member.discordId.startsWith('mock-') ? 'pending' : member.discordId;
    const rankTone = (rank: number) => {
      if (rank === 1) return 'border-[#ff9f1c]/55 bg-[#ff9f1c]/12 text-[#ffbf5c]';
      if (rank === 2) return 'border-cyan-300/45 bg-cyan-300/10 text-cyan-100';
      if (rank === 3) return 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200';
      return 'border-cyan-400/18 bg-cyan-400/5 text-zinc-300';
    };

    return (
      <div className="space-y-5 font-sans stagger-child">
        <section className="border border-cyan-400/18 bg-[#0d1117]/92 shadow-[0_0_34px_rgba(0,212,255,0.08)]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-cyan-400/15 px-4 sm:px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                <h2 className="font-title text-2xl font-black uppercase text-[#f0f6ff] leading-none">
                  All Time Kills
                </h2>
                <span className={`font-tech text-[9px] uppercase px-2 py-1 border ${isMock ? 'border-[#ff9f1c]/40 text-[#ffb84d] bg-[#ff9f1c]/10' : 'border-emerald-400/35 text-emerald-300 bg-emerald-400/10'}`}>
                  {isMock ? 'Mock Roster' : 'Live Roster'}
                </span>
              </div>
              <p className="mt-1 font-tech text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Lifetime kill standings // channel relay
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="border border-cyan-400/20 bg-cyan-400/5 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Total Kills</div>
                <div className="font-tech text-sm font-bold text-cyan-200">{totalKills.toLocaleString()}</div>
              </div>
              <div className="border border-cyan-400/20 bg-cyan-400/5 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Marksmen</div>
                <div className="font-tech text-sm font-bold text-cyan-200">{list.length}</div>
              </div>
              <div className="border border-[#ff9f1c]/25 bg-[#ff9f1c]/8 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Top Count</div>
                <div className="font-tech text-sm font-bold text-[#ffb84d]">{topKillCount}</div>
              </div>
            </div>
          </div>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] gap-5 p-4 sm:p-5">
            <div className="border border-cyan-400/15 bg-[#090f16]/88 overflow-hidden">
              <div className="hidden md:grid grid-cols-[72px_minmax(0,1.3fr)_130px_130px_130px] gap-3 border-b border-cyan-400/15 bg-cyan-400/5 px-4 py-2 font-tech text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                <span>Rank</span>
                <span>Marksman</span>
                <span>Citizen ID</span>
                <span>Status</span>
                <span className="text-right">Kills</span>
              </div>

              <div className="divide-y divide-cyan-400/10">
                {list.map((member, index) => {
                  const rank = index + 1;
                  const killsVal = killsForm[member.discordId] !== undefined
                    ? killsForm[member.discordId]
                    : String(member.kills || 0);
                  const canEditLiveKills = isAuditor && member.source === 'live';
                  const shooterStatus = member.isTop10 || rank <= 10 ? 'Elite Shooter' : 'Operative';

                  return (
                    <div
                      key={member.discordId}
                      className="grid md:grid-cols-[72px_minmax(0,1.3fr)_130px_130px_130px] gap-3 items-center px-4 py-3 hover:bg-cyan-400/5 transition-smooth"
                    >
                      <div>
                        <span className={`inline-flex min-w-11 items-center justify-center border px-2 py-1 font-tech text-[11px] font-bold ${rankTone(rank)}`}>
                          #{rank}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-title text-[16px] font-bold uppercase text-[#f0f6ff]">
                          {member.username}
                        </div>
                        <div className="mt-0.5 truncate font-tech text-[10px] uppercase text-zinc-500">
                          {member.nickname}
                        </div>
                      </div>
                      <div className="font-tech text-[11px] uppercase text-cyan-200">
                        {getDisplayId(member)}
                      </div>
                      <div className="truncate font-tech text-[10px] uppercase text-zinc-500">
                        {shooterStatus}
                      </div>
                      <div className="flex items-center justify-end gap-2 font-tech text-[12px] text-[#f0f6ff]">
                        {canEditLiveKills ? (
                          <>
                            <input
                              type="text"
                              value={killsVal}
                              onChange={(e) => setKillsForm(prev => ({ ...prev, [member.discordId]: e.target.value }))}
                              className="w-16 bg-[#0a0f18] border border-cyan-400/20 p-1 text-center text-cyan-100 outline-none focus:border-cyan-300"
                              aria-label={`All time kills for ${member.username}`}
                            />
                            <button
                              onClick={() => handleUpdateKills(member.discordId, killsVal)}
                              className="border border-cyan-400/35 bg-cyan-400/10 px-2 py-1 text-[9px] font-bold uppercase text-cyan-200 hover:bg-cyan-400/18 active:scale-95 transition-smooth cursor-pointer"
                            >
                              Set
                            </button>
                          </>
                        ) : (
                          <span className="text-cyan-100"><strong>{member.kills}</strong> kills</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="border border-cyan-400/15 bg-[#090f16]/88 p-4">
                <div className="font-tech text-[9px] uppercase tracking-[0.16em] text-zinc-500">Data Source</div>
                <div className="mt-3 flex items-center justify-between border border-cyan-400/15 bg-cyan-400/5 px-3 py-2">
                  <span className="font-tech text-[11px] uppercase text-cyan-100">{isMock ? 'Mock sample loaded' : 'Live kill sync'}</span>
                  <span className={`h-2 w-2 ${isMock ? 'bg-[#ff9f1c]' : 'bg-emerald-400'} shadow-[0_0_10px_rgba(0,212,255,0.7)]`} />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
                  {isMock ? 'Local preview dataset active.' : 'Live member dataset active.'}
                </p>
              </div>

              <div className="border border-cyan-400/15 bg-[#090f16]/88 p-4">
                <div className="font-tech text-[9px] uppercase tracking-[0.16em] text-zinc-500">Kill Metrics</div>
                <div className="mt-3 space-y-2 font-tech text-[11px] uppercase text-zinc-300">
                  <div className="flex justify-between border-b border-cyan-400/10 pb-2"><span>Total Kills</span><strong className="text-cyan-200">{totalKills.toLocaleString()}</strong></div>
                  <div className="flex justify-between border-b border-cyan-400/10 pb-2"><span>Top Count</span><strong className="text-cyan-200">{topKillCount}</strong></div>
                  <div className="flex justify-between"><span>Tracked Marksmen</span><strong className="text-cyan-200">{list.length}</strong></div>
                </div>
              </div>

              {isAuditor && (
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to deploy/sync the All Time Kills leaderboard in Discord?')) {
                      try {
                        const res = await fetch(`${API_BASE_URL}/api/admin/deploy-alltime-kills-prompt`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          }
                        });
                        if (res.ok) {
                          addNotification('Leaderboard Synced', 'All-time kills feed pushed to Discord.', 'success');
                        } else {
                          addNotification('Deployment Failed', 'Verify bot connection.', 'warning');
                        }
                      } catch {
                        addNotification('Deployment Failed', 'Network failure while syncing All Time Kills.', 'error');
                      }
                    }
                  }}
                  className="w-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-2.5 font-title text-[11px] font-black uppercase text-cyan-100 hover:bg-cyan-400/18 active:scale-[0.98] transition-smooth cursor-pointer"
                >
                  Sync All Time Kills
                </button>
              )}
            </aside>
          </div>
        </section>
      </div>
    );
  };

  const renderWeeklyKillList = () => {
    type WeeklyKillEntry = {
      discordId: string;
      username: string;
      nickname: string;
      weeklyKills: number;
      isTop10: boolean;
      source: 'live' | 'mock';
    };

    const mockWeeklyKillMembers: WeeklyKillEntry[] = [
      { discordId: '70941', username: 'Chloe Veneta', nickname: 'Chloe Veneta | 70941', weeklyKills: 60, isTop10: true, source: 'mock' },
      { discordId: '170715', username: 'Clark Turechad', nickname: 'Clark Turechad 170715', weeklyKills: 56, isTop10: true, source: 'mock' },
      { discordId: '155077', username: 'Akash', nickname: 'Akash | 155077', weeklyKills: 50, isTop10: true, source: 'mock' },
      { discordId: '101254', username: 'Melissa MakarovVicious', nickname: 'Melissa MakarovVicious | 101254', weeklyKills: 49, isTop10: true, source: 'mock' },
      { discordId: 'mock-cobra', username: 'Cobra Entity', nickname: 'Cobra Entity', weeklyKills: 46, isTop10: true, source: 'mock' },
      { discordId: '82934', username: 'Sukuna MakarovVicious', nickname: 'Sukuna MakarovVicious | 82934', weeklyKills: 37, isTop10: true, source: 'mock' },
      { discordId: '48888', username: 'Michael Makarovvicious', nickname: 'Michael Makarovvicious 48888', weeklyKills: 36, isTop10: true, source: 'mock' },
      { discordId: 'mock-alikagan', username: 'Alikagan', nickname: 'Alikagan', weeklyKills: 33, isTop10: true, source: 'mock' },
      { discordId: 'mock-harry', username: 'Harry', nickname: 'Harry', weeklyKills: 33, isTop10: true, source: 'mock' },
      { discordId: '24644', username: 'Yash Riviera', nickname: 'Yash Riviera 24644', weeklyKills: 30, isTop10: true, source: 'mock' },
      { discordId: '61783', username: 'Quaresma | Dona ~', nickname: 'Quaresma | Dona ~ 61783', weeklyKills: 29, isTop10: false, source: 'mock' },
      { discordId: '152194', username: 'Calvin Reyy', nickname: 'Calvin Reyy | 152194', weeklyKills: 26, isTop10: false, source: 'mock' },
      { discordId: '133338', username: 'Aayush MakarovVicious', nickname: 'Aayush MakarovVicious | 133338', weeklyKills: 25, isTop10: false, source: 'mock' },
      { discordId: '110116', username: 'Prem Cullen', nickname: 'Prem Cullen | 110116', weeklyKills: 24, isTop10: false, source: 'mock' },
      { discordId: 'mock-dick-supplier', username: 'Dick Supplier', nickname: 'Dick Supplier', weeklyKills: 23, isTop10: false, source: 'mock' },
      { discordId: '171896', username: 'Louis Silva', nickname: 'Louis Silva | 171896', weeklyKills: 20, isTop10: false, source: 'mock' },
      { discordId: '116365', username: 'Calm Vicious', nickname: 'Calm Vicious 116365', weeklyKills: 19, isTop10: false, source: 'mock' },
      { discordId: '48079', username: 'Yasseen Riviera', nickname: 'Yasseen Riviera | 48079', weeklyKills: 19, isTop10: false, source: 'mock' }
    ];

    const liveWeeklyKillMembers: WeeklyKillEntry[] = [...members]
      .filter(m => !['PigeonBoss', 'VitoScaletta', 'TonyMontana'].includes(m.username))
      .sort((a, b) => b.weeklyKills - a.weeklyKills)
      .slice(0, 50)
      .map(member => ({
        discordId: member.discordId,
        username: member.username,
        nickname: member.nickname || `${member.username} | ${member.discordId}`,
        weeklyKills: member.weeklyKills || 0,
        isTop10: member.isTop10,
        source: 'live'
      }));

    const hasLiveWeeklyKillData = liveWeeklyKillMembers.length > 0;
    const list = hasLiveWeeklyKillData ? liveWeeklyKillMembers : mockWeeklyKillMembers;
    const totalWeeklyKills = list.reduce((sum, member) => sum + member.weeklyKills, 0);
    const topWeeklyKillCount = list[0]?.weeklyKills || 0;
    const isMock = !hasLiveWeeklyKillData;
    const isAuditor = checkAccess('admin');
    const getDisplayId = (member: WeeklyKillEntry) => member.discordId.startsWith('mock-') ? 'pending' : member.discordId;
    const rankTone = (rank: number) => {
      if (rank === 1) return 'border-[#ff9f1c]/55 bg-[#ff9f1c]/12 text-[#ffbf5c]';
      if (rank === 2) return 'border-cyan-300/45 bg-cyan-300/10 text-cyan-100';
      if (rank === 3) return 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200';
      return 'border-cyan-400/18 bg-cyan-400/5 text-zinc-300';
    };

    return (
      <div className="space-y-5 font-sans stagger-child">
        <section className="border border-cyan-400/18 bg-[#0d1117]/92 shadow-[0_0_34px_rgba(0,212,255,0.08)]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-cyan-400/15 px-4 sm:px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                <h2 className="font-title text-2xl font-black uppercase text-[#f0f6ff] leading-none">
                  Weekly Kills
                </h2>
                <span className={`font-tech text-[9px] uppercase px-2 py-1 border ${isMock ? 'border-[#ff9f1c]/40 text-[#ffb84d] bg-[#ff9f1c]/10' : 'border-emerald-400/35 text-emerald-300 bg-emerald-400/10'}`}>
                  {isMock ? 'Mock Roster' : 'Live Roster'}
                </span>
              </div>
              <p className="mt-1 font-tech text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Weekly kill standings // channel relay
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="border border-cyan-400/20 bg-cyan-400/5 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Weekly Kills</div>
                <div className="font-tech text-sm font-bold text-cyan-200">{totalWeeklyKills.toLocaleString()}</div>
              </div>
              <div className="border border-cyan-400/20 bg-cyan-400/5 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Shooters</div>
                <div className="font-tech text-sm font-bold text-cyan-200">{list.length}</div>
              </div>
              <div className="border border-[#ff9f1c]/25 bg-[#ff9f1c]/8 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Top Count</div>
                <div className="font-tech text-sm font-bold text-[#ffb84d]">{topWeeklyKillCount}</div>
              </div>
              <div className="border border-cyan-400/20 bg-cyan-400/5 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Reset</div>
                <div className="font-tech text-sm font-bold text-cyan-200">4d 12h 32m</div>
              </div>
            </div>
          </div>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] gap-5 p-4 sm:p-5">
            <div className="border border-cyan-400/15 bg-[#090f16]/88 overflow-hidden">
              <div className="hidden md:grid grid-cols-[72px_minmax(0,1.3fr)_130px_130px_130px] gap-3 border-b border-cyan-400/15 bg-cyan-400/5 px-4 py-2 font-tech text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                <span>Rank</span>
                <span>Shooter</span>
                <span>Citizen ID</span>
                <span>Status</span>
                <span className="text-right">Kills</span>
              </div>

              <div className="divide-y divide-cyan-400/10">
                {list.map((member, index) => {
                  const rank = index + 1;
                  const weeklyKillsVal = weeklyKillsForm[member.discordId] !== undefined
                    ? weeklyKillsForm[member.discordId]
                    : String(member.weeklyKills || 0);
                  const canEditLiveWeeklyKills = isAuditor && member.source === 'live';
                  const shooterStatus = member.isTop10 || rank <= 10 ? 'Top Shooter' : 'Operative';

                  return (
                    <div
                      key={member.discordId}
                      className="grid md:grid-cols-[72px_minmax(0,1.3fr)_130px_130px_130px] gap-3 items-center px-4 py-3 hover:bg-cyan-400/5 transition-smooth"
                    >
                      <div>
                        <span className={`inline-flex min-w-11 items-center justify-center border px-2 py-1 font-tech text-[11px] font-bold ${rankTone(rank)}`}>
                          #{rank}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-title text-[16px] font-bold uppercase text-[#f0f6ff]">
                          {member.username}
                        </div>
                        <div className="mt-0.5 truncate font-tech text-[10px] uppercase text-zinc-500">
                          {member.nickname}
                        </div>
                      </div>
                      <div className="font-tech text-[11px] uppercase text-cyan-200">
                        {getDisplayId(member)}
                      </div>
                      <div className="truncate font-tech text-[10px] uppercase text-zinc-500">
                        {shooterStatus}
                      </div>
                      <div className="flex items-center justify-end gap-2 font-tech text-[12px] text-[#f0f6ff]">
                        {canEditLiveWeeklyKills ? (
                          <>
                            <input
                              type="text"
                              value={weeklyKillsVal}
                              onChange={(e) => setWeeklyKillsForm(prev => ({ ...prev, [member.discordId]: e.target.value }))}
                              className="w-16 bg-[#0a0f18] border border-cyan-400/20 p-1 text-center text-cyan-100 outline-none focus:border-cyan-300"
                              aria-label={`Weekly kills for ${member.username}`}
                            />
                            <button
                              onClick={() => handleUpdateWeeklyKills(member.discordId, weeklyKillsVal)}
                              className="border border-cyan-400/35 bg-cyan-400/10 px-2 py-1 text-[9px] font-bold uppercase text-cyan-200 hover:bg-cyan-400/18 active:scale-95 transition-smooth cursor-pointer"
                            >
                              Set
                            </button>
                          </>
                        ) : (
                          <span className="text-cyan-100"><strong>{member.weeklyKills}</strong> kills</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="border border-cyan-400/15 bg-[#090f16]/88 p-4">
                <div className="font-tech text-[9px] uppercase tracking-[0.16em] text-zinc-500">Data Source</div>
                <div className="mt-3 flex items-center justify-between border border-cyan-400/15 bg-cyan-400/5 px-3 py-2">
                  <span className="font-tech text-[11px] uppercase text-cyan-100">{isMock ? 'Mock sample loaded' : 'Live weekly sync'}</span>
                  <span className={`h-2 w-2 ${isMock ? 'bg-[#ff9f1c]' : 'bg-emerald-400'} shadow-[0_0_10px_rgba(0,212,255,0.7)]`} />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
                  {isMock ? 'Local preview dataset active.' : 'Live member dataset active.'}
                </p>
              </div>

              <div className="border border-cyan-400/15 bg-[#090f16]/88 p-4">
                <div className="font-tech text-[9px] uppercase tracking-[0.16em] text-zinc-500">Weekly Metrics</div>
                <div className="mt-3 space-y-2 font-tech text-[11px] uppercase text-zinc-300">
                  <div className="flex justify-between border-b border-cyan-400/10 pb-2"><span>Weekly Kills</span><strong className="text-cyan-200">{totalWeeklyKills.toLocaleString()}</strong></div>
                  <div className="flex justify-between border-b border-cyan-400/10 pb-2"><span>Top Count</span><strong className="text-cyan-200">{topWeeklyKillCount}</strong></div>
                  <div className="flex justify-between border-b border-cyan-400/10 pb-2"><span>Tracked Shooters</span><strong className="text-cyan-200">{list.length}</strong></div>
                  <div className="flex justify-between"><span>Reset Window</span><strong className="text-cyan-200">4d 12h</strong></div>
                </div>
              </div>

              {isAuditor && (
                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      if (confirm('Are you sure you want to deploy/sync the Weekly Kills leaderboard in Discord?')) {
                        try {
                          const res = await fetch(`${API_BASE_URL}/api/admin/deploy-weekly-kills-prompt`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            }
                          });
                          if (res.ok) {
                            addNotification('Leaderboard Synced', 'Weekly kills feed pushed to Discord.', 'success');
                          } else {
                            addNotification('Deployment Failed', 'Verify bot connection.', 'warning');
                          }
                        } catch {
                          addNotification('Deployment Failed', 'Network failure while syncing Weekly Kills.', 'error');
                        }
                      }
                    }}
                    className="w-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-2.5 font-title text-[11px] font-black uppercase text-cyan-100 hover:bg-cyan-400/18 active:scale-[0.98] transition-smooth cursor-pointer"
                  >
                    Sync Weekly Kills
                  </button>

                  <button
                    onClick={async () => {
                      if (confirm("Are you sure you want to reset all members' Weekly Kills to 0? This will sync to Discord instantly.")) {
                        try {
                          const res = await fetch(`${API_BASE_URL}/api/admin/reset-weekly-kills`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            }
                          });
                          if (res.ok) {
                            addNotification('Leaderboard Reset', 'All weekly kills successfully reset to 0.', 'success');
                            loadDashboardData();
                          } else {
                            addNotification('Reset Failed', 'Error resetting weekly leaderboard.', 'warning');
                          }
                        } catch {
                          addNotification('Reset Failed', 'Network failure while resetting Weekly Kills.', 'error');
                        }
                      }
                    }}
                    className="w-full border border-red-400/35 bg-red-400/10 px-3 py-2.5 font-title text-[11px] font-black uppercase text-red-200 hover:bg-red-400/15 active:scale-[0.98] transition-smooth cursor-pointer"
                  >
                    Reset Weekly Kills
                  </button>
                </div>
              )}
            </aside>
          </div>
        </section>
      </div>
    );
  };

  const renderSubmitActivity = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster clearance validation required');

    return (
      <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 max-w-2xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a2a]/50 pb-2">
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
              className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-xl p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans"
            />
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 font-bold block mb-1">VERIFICATION PROOF MEDIA URL</label>
            <input 
              type="text"
              value={activityForm.mediaUrl}
              onChange={(e) => setActivityForm(prev => ({ ...prev, mediaUrl: e.target.value }))}
              placeholder="Provide screenshot link or video URL..."
              className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-xl p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-mono"
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
      <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a2a]/50 pb-2 flex items-center gap-2">
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
                <div key={a.id} className="bg-[#13121d]/40 border border-[#1c1a2a] p-4 rounded-xl flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-200">@{a.username}</span>
                      <span className="text-[9px] bg-[#0a0a14] px-1.5 py-0.5 rounded font-mono">ID: {a.id}</span>
                      <span className="text-[9px] text-zinc-500">{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-zinc-400 italic bg-[#0a0a14] p-2.5 rounded-lg border border-[#1c1a2a] mt-2">&quot;{a.description}&quot;</p>
                    
                    {a.reason && (
                      <p className="text-[10px] text-zinc-500 mt-2 border-t border-[#1c1a2a] pt-2 font-mono">
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
      <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a2a]/50 pb-2 flex items-center gap-2">
          💯╰𝝖ctivity-📍oints-𝗟eader𝗕oard
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-[#1c1a2a] text-zinc-500 uppercase tracking-widest text-[9px]">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Syndicate Member</th>
                <th className="py-2.5 px-3">Combat Nickname</th>
                <th className="py-2.5 px-3 text-right">Points Earned</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m, idx) => (
                <tr key={m.discordId} className="border-b border-[#181622]/40 hover:bg-[#13121d]/20">
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
      <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-6 max-w-5xl mx-auto font-sans shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#1c1a2a]/50 pb-3">
          <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta flex items-center gap-2">
            💰╭point-shop CATALOG
          </h2>
          <div className="bg-[#0a0a14] border border-[#1c1a2a] px-4 py-1.5 rounded-xl font-title font-black text-xs italic text-purple-400 text-glow-magenta">
            STORE VALUE: {shopBalance} FP
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {shopItems.map((item) => (
            <div key={item.id} className="bg-[#13121d]/20 border border-[#1c1a2a] rounded-2xl p-4 flex flex-col justify-between hover:border-purple-600/35 transition-smooth shadow-md">
              <div className="space-y-2">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="w-full h-32 object-cover rounded-xl border border-[#1c1a2a]/60"
                />
                <div>
                  <span className="text-[8px] bg-[#0a0a14] text-zinc-400 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">{item.category}</span>
                  <h3 className="font-title font-bold text-xs text-zinc-200 mt-1 truncate">{item.name}</h3>
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-[#1c1a2a]/40 flex items-center justify-between">
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
      <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a2a]/50 pb-2">
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
                <div key={act.id} className="bg-[#13121d]/40 border border-[#1c1a2a] p-4 rounded-xl flex flex-col md:flex-row gap-6 justify-between animate-fade-in">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-200">@{act.username}</span>
                      <span className="text-[9px] bg-[#0a0a14] text-zinc-450 px-1.5 py-0.5 rounded font-mono">ACT: {act.id}</span>
                      <span className="text-[9px] text-zinc-500">{new Date(act.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-zinc-400 italic bg-[#0a0a14] p-2.5 rounded-lg border border-[#1c1a2a] leading-relaxed">&quot;{act.description}&quot;</p>
                    <a href={act.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex text-[10px] text-purple-400 hover:text-white font-bold underline">
                      📸 VIEW VERIFICATION MEDIA FILE
                    </a>
                  </div>

                  <div className="w-full md:w-56 flex flex-col gap-3 border-t md:border-t-0 md:border-l border-[#1c1a2a] pt-4 md:pt-0 md:pl-4">
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
                        className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-1.5 text-xs text-zinc-300 font-mono outline-none"
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
                        className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-1.5 text-xs text-zinc-300 outline-none font-sans"
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
      <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a2a]/50 pb-2">
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
                <div key={o.id} className="bg-[#13121d]/40 border border-[#1c1a2a] p-4 rounded-xl flex flex-col sm:flex-row justify-between gap-4 items-center">
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
      <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a2a]/50 pb-2">
          💰┃𝐁𝐨𝐧𝐮𝐬-𝐀𝐝𝐦𝐢𝐧-𝐏𝐚𝐧𝐞𝐥 AUDIT REGISTER
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-[#1c1a2a] text-zinc-500 uppercase tracking-widest text-[9px]">
                <th className="py-2.5 px-3">Ticket ID</th>
                <th className="py-2.5 px-3">Applicant</th>
                <th className="py-2.5 px-3">Calculation Details</th>
                <th className="py-2.5 px-3">Audit Response</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.filter(t => t.type === 'bonus' || t.type === 'request').map((t) => (
                <tr key={t.id} className="border-b border-[#181622]/40 hover:bg-[#13121d]/20">
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
      <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 max-w-4xl mx-auto font-sans shadow-xl">
        <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta border-b border-[#1c1a2a]/50 pb-2">
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
                <div key={t.id} className="bg-[#13121d]/40 border border-[#1c1a2a] p-4 rounded-xl flex flex-col md:flex-row gap-6 justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-200">@{t.username}</span>
                      <span className="text-[9px] bg-[#0a0a14] text-zinc-450 px-1.5 py-0.5 rounded">TKT: {t.id.toUpperCase()}</span>
                      <span className="text-[9px] text-zinc-500">{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-zinc-400 italic bg-[#0a0a14] p-2.5 rounded-lg border border-[#1c1a2a] mt-2">&quot;{t.description}&quot;</p>
                  </div>

                  <div className="w-full md:w-56 flex flex-col gap-3 border-t md:border-t-0 md:border-l border-[#1c1a2a] pt-4 md:pt-0 md:pl-4">
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
                        className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-1.5 text-xs text-zinc-300 font-mono outline-none"
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
                        className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-1.5 text-xs text-zinc-300 outline-none font-sans"
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
        <div className="lg:col-span-1 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 h-fit">
          <h3 className="font-title font-bold text-xs text-primary tracking-wide uppercase border-b border-[#1c1a2a]/50 pb-2">
            💲┃𝐁𝐢𝐳𝐰𝐚𝐫-𝐂𝐨𝐥𝐥𝐞𝐜𝐭 FORM
          </h3>

          <form onSubmit={handleBizwarCollect} className="font-sans text-xs flex flex-col gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 font-bold block mb-1">BUSINESS LANDMARK SITE</label>
              <select 
                value={bizwarForm.businessName}
                onChange={(e) => setBizwarForm(prev => ({ ...prev, businessName: e.target.value }))}
                className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-350 outline-none font-sans"
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
                className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 font-mono focus:border-purple-600/50 outline-none"
              />
            </div>

            <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">
              LOG BUSINESS REVENUE
            </button>
          </form>
        </div>

        {/* Business collection lists */}
        <div className="lg:col-span-2 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4">
          <h2 className="font-title font-black text-lg italic text-zinc-200 border-b border-[#1c1a2a]/50 pb-2">
            📊 BUSINESS PROFITS LEDGER
          </h2>

          <div className="space-y-3">
            {bizwarLogs.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 italic">
                NO REVENUES RECORDED TODAY.
              </div>
            ) : (
              bizwarLogs.map((log, idx) => (
                <div key={idx} className="flex justify-between items-center bg-[#13121d]/40 p-3 border border-[#1c1a2a] rounded-xl font-sans text-xs">
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
        <div className="lg:col-span-1 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 h-fit">
          <div className="flex justify-between items-center border-b border-[#1c1a2a]/50 pb-2">
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
                className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 outline-none font-sans"
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
        <div className="lg:col-span-2 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-[#1c1a2a]/50 pb-2">
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
                <div key={idx} className="flex justify-between items-center bg-[#13121d]/40 p-3 border border-[#1c1a2a] rounded-xl font-sans text-xs">
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
          <div className="lg:col-span-1 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 h-fit">
            <h3 className="font-title font-bold text-xs text-primary tracking-wide uppercase border-b border-[#1c1a2a]/50 pb-2">
              🏆 LOG NEW SYNDICATE WIN
            </h3>

            <form onSubmit={handleLogWin} className="font-sans text-xs flex flex-col gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">EVENT TYPE</label>
                <select 
                  value={winForm.type}
                  onChange={(e) => setWinForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-350 outline-none font-sans"
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
                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">direct DETAILS</label>
                <textarea 
                  rows={3}
                  value={winForm.description}
                  onChange={(e) => setWinForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detail operations details..."
                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-350 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">COMBATANTS PARTICIPATED</label>
                <input 
                  type="text"
                  value={winForm.participants}
                  onChange={(e) => setWinForm(prev => ({ ...prev, participants: e.target.value }))}
                  placeholder="Vito, Tony, Phantom..."
                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">VICTORY SCREENSHOT URL</label>
                <input 
                  type="text"
                  value={winForm.mediaUrl}
                  onChange={(e) => setWinForm(prev => ({ ...prev, mediaUrl: e.target.value }))}
                  placeholder="Provide image link..."
                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-mono"
                />
              </div>

              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">
                PUBLISH RECORD
              </button>
            </form>
          </div>
        )}

        {/* Win records list */}
        <div className={`${isLeaderOrAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4`}>
          <h2 className="font-title font-black text-lg italic text-zinc-200 border-b border-[#1c1a2a]/50 pb-2">
            🏆 PUBLIC SYNDICATE WINNING LOGS
          </h2>

          <div className="space-y-6">
            {wins.filter(w => w.type !== 'informal').length === 0 ? (
              <div className="text-center py-12 text-zinc-500 italic">
                NO WINS RECORDED IN HISTORY LOG.
              </div>
            ) : (
              wins.filter(w => w.type !== 'informal').map((w) => (
                <div key={w.id} className="bg-[#13121d]/40 border border-[#1c1a2a] rounded-2xl p-4 flex flex-col md:flex-row gap-6 hover:border-purple-500/30 transition-smooth">
                  {w.mediaUrl && (
                    <img 
                      src={w.mediaUrl} 
                      alt={w.title} 
                      className="w-full md:w-48 h-32 object-cover rounded-xl border border-[#1c1a2a] shrink-0"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-title font-black text-base italic text-zinc-200">{w.title}</h3>
                      <span className="text-[9px] bg-[#0a0a14] text-zinc-400 px-1.5 py-0.5 rounded uppercase font-mono">{w.type}</span>
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

  const renderDiscordEmbedMockup = (eventId: 'rp-signup' | 'informal-signup' | 'signup-event') => {
    const isClosed = eventId === 'rp-signup'
      ? rpState === 'closed'
      : eventId === 'signup-event'
      ? signupEventState === 'closed'
      : informalState === 'closed';

    const signups = eventId === 'rp-signup'
      ? rpSignups
      : eventId === 'signup-event'
      ? signupEventSignups
      : informalSignups;

    const confirmed = signups.filter(s => s.status === 'confirmed');
    const reserve = signups.filter(s => s.status === 'reserve' || s.status === 'displaced');

    const directives = eventId === 'rp-signup' 
      ? (rpDescription || 'Raid the central supply depot. Roster limit is 25. Gear requirements: Heavy Sniper, Tier-3 Armor Plates, Radio Freq: 104.4. Top 10 Priority shooters can displace.')
      : eventId === 'signup-event'
      ? (signupEventDescription || 'Signup Event roster limit is 25. Top 10 Priority shooters can displace.')
      : (informalDescription || 'Automated informal wars trigger every 1h 44m. The vanguard shooters will displace recruits dynamically on the confirmation grid.');

    const bannerImage = eventId === 'rp-signup'
      ? '/rp_ticket_banner.webp'
      : eventId === 'signup-event'
      ? '/signup_event_banner.webp'
      : '/informal_fight_banner.webp';

    const statusBadge = isClosed ? '🔴 Registration is closed!' : '🟢 Registration is active!';
    const embedColor = isClosed ? 'border-[#ff003c]' : 'border-[#00f0ff]';

    const getRosterLine = (s: any, idx: number) => {
      const icon = s.isTop10 ? '👑' : '⚔️';
      const inVoice = s.inVoice || s.isMock || s.username === 'PigeonBoss' || s.username === 'TonyMontana';
      return (
        <div key={s.memberId} className="text-[11px] text-[#dbdee1] flex items-center gap-1.5 font-mono py-0.5">
          <span className="text-[#23a55a] font-bold shrink-0">{inVoice ? '✅' : '❌'}</span>
          <span className="text-zinc-500 font-bold shrink-0">{idx + 1}.</span>
          <span className="shrink-0">{icon}</span>
          <span className="text-[#c9cdfb] font-sans hover:underline cursor-pointer truncate">@{s.username}</span>
        </div>
      );
    };

    return (
      <div className="bg-[#2b2d31] border border-[#1c1a2a] rounded-2xl overflow-hidden font-sans text-left shadow-2xl">
        {/* Discord Server HUD Header */}
        <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-black text-sm select-none">#</span>
            <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
              {eventId === 'rp-signup' ? 'rp-signup-feed' : eventId === 'signup-event' ? 'signup-event-feed' : 'informal-signup-feed'}
            </span>
          </div>
          <span className="text-[8px] bg-[#313338] text-[#23a55a] px-2 py-0.5 rounded font-bold font-mono border border-[#23a55a]/20">SIMULATED BOT EMBED</span>
        </div>

        {/* Discord Chat Area */}
        <div className="p-4 space-y-4 bg-[#313338]">
          <div className="flex gap-3">
            {/* Bot Avatar */}
            <div className="w-9 h-9 rounded-full bg-[#111118] border border-purple-500/20 shrink-0 overflow-hidden select-none">
              <img src="/logo.webp" alt="Bot PFP" className="w-full h-full object-cover" />
            </div>

            {/* Message Body */}
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-xs font-bold text-[#f2f3f5] hover:underline cursor-pointer">White Pigeons MOD</span>
                <span className="bg-[#5865f2] text-white text-[7px] font-bold px-1.5 py-0.5 rounded font-sans uppercase">APP</span>
                <span className="text-[9px] text-[#949ba4] font-sans">Today at 9:02 AM</span>
              </div>

              {/* Bot Embed Box */}
              <div className={`border-l-4 ${embedColor} bg-[#2b2d31] p-4 rounded-r-lg max-w-xl space-y-4 shadow-md`}>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white hover:underline cursor-pointer">
                    {eventId === 'rp-signup' ? `🚀 RP Ticket - OPEN ⚔️` : eventId === 'signup-event' ? `🚀 Signup-Event - OPEN ⚔️` : `🚀 Informal Fight - OPEN ⚔️`}
                  </h4>
                  <div className="border-l-4 border-[#4e5058] pl-3 py-0.5 text-[11px] text-[#949ba4] italic leading-relaxed">
                    <strong>Event Directives:</strong><br />
                    {directives}
                  </div>
                </div>

                <div className="text-[11px] text-[#dbdee1] font-sans font-bold flex items-center gap-1">
                  {statusBadge}
                </div>

                <div className="text-[11px] font-bold text-[#dbdee1] font-mono">
                  📊 Participants: {confirmed.length}/25
                </div>

                {/* Grid Roster in Columns */}
                <div className="space-y-3 pt-2 border-t border-[#35363c]">
                  <div>
                    <span className="text-[9px] font-black tracking-wider text-zinc-500 uppercase block mb-1">⚔️ Main Roster</span>
                    {confirmed.length === 0 ? (
                      <span className="text-[11px] text-zinc-500 italic">*Roster is vacant. Claim a slot!*</span>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                        {confirmed.map((s, idx) => getRosterLine(s, idx))}
                      </div>
                    )}
                  </div>

                  {reserve.length > 0 && (
                    <div className="pt-2 border-t border-[#35363c]/50">
                      <span className="text-[9px] font-black tracking-wider text-zinc-500 uppercase block mb-1">⏳ Substitutes List ({reserve.length})</span>
                      <div className="space-y-0.5">
                        {reserve.map((s, idx) => getRosterLine(s, idx))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Banner Image */}
                <div className="rounded-lg overflow-hidden border border-[#3f4248]/30 max-h-48 select-none">
                  <img src={bannerImage} alt="Event Banner" className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Bot Interaction Buttons */}
              <div className="flex flex-wrap gap-2 pt-1 select-none">
                <button
                  onClick={() => handleEventSignup(eventId)}
                  disabled={isClosed}
                  className="bg-[#248046] hover:bg-[#1a6535] disabled:bg-[#248046]/40 disabled:text-zinc-400 text-white font-sans text-xs font-bold py-1.5 px-4 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]"
                >
                  SIGN UP
                </button>
                <button
                  onClick={() => handleLeaveSignup(eventId)}
                  disabled={isClosed}
                  className="bg-[#da373c] hover:bg-[#a92b2f] disabled:bg-[#da373c]/40 disabled:text-zinc-400 text-white font-sans text-xs font-bold py-1.5 px-4 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]"
                >
                  LEAVE
                </button>
                {eventId === 'rp-signup' && (
                  <button
                    onClick={() => setRpBotAdminShow(!rpBotAdminShow)}
                    className="bg-[#4e5058] hover:bg-[#6d6f78] text-white font-sans text-xs font-bold py-1.5 px-4 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    🛠️ ADMIN ACTIONS
                  </button>
                )}
                {eventId === 'signup-event' && (
                  <button
                    onClick={() => setSignupEventBotAdminShow(!signupEventBotAdminShow)}
                    className="bg-[#4e5058] hover:bg-[#6d6f78] text-white font-sans text-xs font-bold py-1.5 px-4 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    🛠️ ADMIN ACTIONS
                  </button>
                )}
                {eventId === 'informal-signup' && (
                  <button
                    onClick={() => setInfBotAdminShow(!infBotAdminShow)}
                    className="bg-[#4e5058] hover:bg-[#6d6f78] text-white font-sans text-xs font-bold py-1.5 px-4 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    🛠️ ADMIN ACTIONS
                  </button>
                )}
              </div>

              {/* Bot Ephemeral Administrative Actions Panel Simulation */}
              {eventId === 'rp-signup' && rpBotAdminShow && (
                <div className="mt-3 p-3 bg-[#2b2d31] border border-zinc-700/50 rounded-lg text-xs space-y-3 relative font-sans">
                  <div className="absolute top-2 right-2 text-[9px] text-[#949ba4] font-bold tracking-wider select-none flex items-center gap-1">
                    👤 Only you can see this • <span onClick={() => { setRpBotAdminShow(false); setRpBotSwapFirstId(null); }} className="text-blue-400 hover:underline cursor-pointer">Dismiss message</span>
                  </div>
                  <div className="font-bold text-[#f2f3f5] pr-20">🛠️ Roster Administrative Actions</div>
                  
                  {signups.length === 0 ? (
                    <p className="text-[11px] text-[#949ba4] italic">The roster is currently empty.</p>
                  ) : (
                    <div className="space-y-3 pt-1">
                      {/* Kick Select */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#949ba4] font-bold block uppercase">Kick Player</label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleKickRosterMember('rp-signup', e.target.value);
                              setRpBotAdminShow(false);
                            }
                          }}
                          className="w-full bg-[#1e1f22] border border-[#151618] rounded-md p-1.5 text-xs text-[#dbdee1] outline-none cursor-pointer"
                          defaultValue=""
                        >
                          <option value="">Select a member to KICK...</option>
                          {signups.map(s => (
                            <option key={s.memberId} value={s.memberId}>@{s.username} ({s.status.toUpperCase()})</option>
                          ))}
                        </select>
                      </div>

                      {/* Swap Select */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#949ba4] font-bold block uppercase">Swap Player</label>
                        {rpBotSwapFirstId === null ? (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                setRpBotSwapFirstId(e.target.value);
                              }
                            }}
                            className="w-full bg-[#1e1f22] border border-[#151618] rounded-md p-1.5 text-xs text-[#dbdee1] outline-none cursor-pointer"
                            defaultValue=""
                          >
                            <option value="">Select first member to SWAP...</option>
                            {signups.map(s => (
                              <option key={s.memberId} value={s.memberId}>@{s.username} ({s.status.toUpperCase()})</option>
                            ))}
                          </select>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-[11px] text-blue-400">
                              Swapping <strong>@{signups.find(s => s.memberId === rpBotSwapFirstId)?.username}</strong>
                            </p>
                            <div className="flex gap-2">
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleSwapRosterMembers('rp-signup', rpBotSwapFirstId, e.target.value);
                                    setRpBotSwapFirstId(null);
                                    setRpBotAdminShow(false);
                                  }
                                }}
                                className="flex-1 bg-[#1e1f22] border border-[#151618] rounded-md p-1.5 text-xs text-[#dbdee1] outline-none cursor-pointer"
                                defaultValue=""
                              >
                                <option value="">Select who to swap with...</option>
                                {signups.filter(s => s.memberId !== rpBotSwapFirstId).map(s => (
                                  <option key={s.memberId} value={s.memberId}>@{s.username} ({s.status.toUpperCase()})</option>
                                ))}
                              </select>
                              <button
                                onClick={() => setRpBotSwapFirstId(null)}
                                className="bg-[#da373c] hover:bg-[#a92b2f] text-white px-2.5 rounded-md text-xs font-bold transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bot Ephemeral Administrative Actions Panel Simulation for signup-event */}
              {eventId === 'signup-event' && signupEventBotAdminShow && (
                <div className="mt-3 p-3 bg-[#2b2d31] border border-zinc-700/50 rounded-lg text-xs space-y-3 relative font-sans">
                  <div className="absolute top-2 right-2 text-[9px] text-[#949ba4] font-bold tracking-wider select-none flex items-center gap-1">
                    👤 Only you can see this • <span onClick={() => { setSignupEventBotAdminShow(false); setSignupEventBotSwapFirstId(null); }} className="text-blue-400 hover:underline cursor-pointer">Dismiss message</span>
                  </div>
                  <div className="font-bold text-[#f2f3f5] pr-20">🛠️ Roster Administrative Actions</div>
                  
                  {signups.length === 0 ? (
                    <p className="text-[11px] text-[#949ba4] italic">The roster is currently empty.</p>
                  ) : (
                    <div className="space-y-3 pt-1">
                      {/* Kick Select */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#949ba4] font-bold block uppercase">Kick Player</label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleKickRosterMember('signup-event', e.target.value);
                              setSignupEventBotAdminShow(false);
                            }
                          }}
                          className="w-full bg-[#1e1f22] border border-[#151618] rounded-md p-1.5 text-xs text-[#dbdee1] outline-none cursor-pointer"
                          defaultValue=""
                        >
                          <option value="">Select a member to KICK...</option>
                          {signups.map(s => (
                            <option key={s.memberId} value={s.memberId}>@{s.username} ({s.status.toUpperCase()})</option>
                          ))}
                        </select>
                      </div>

                      {/* Swap Select */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#949ba4] font-bold block uppercase">Swap Player</label>
                        {signupEventBotSwapFirstId === null ? (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                setSignupEventBotSwapFirstId(e.target.value);
                              }
                            }}
                            className="w-full bg-[#1e1f22] border border-[#151618] rounded-md p-1.5 text-xs text-[#dbdee1] outline-none cursor-pointer"
                            defaultValue=""
                          >
                            <option value="">Select first member to SWAP...</option>
                            {signups.map(s => (
                              <option key={s.memberId} value={s.memberId}>@{s.username} ({s.status.toUpperCase()})</option>
                            ))}
                          </select>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-[11px] text-blue-400">
                              Swapping <strong>@{signups.find(s => s.memberId === signupEventBotSwapFirstId)?.username}</strong>
                            </p>
                            <div className="flex gap-2">
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleSwapRosterMembers('signup-event', signupEventBotSwapFirstId, e.target.value);
                                    setSignupEventBotSwapFirstId(null);
                                    setSignupEventBotAdminShow(false);
                                  }
                                }}
                                className="flex-1 bg-[#1e1f22] border border-[#151618] rounded-md p-1.5 text-xs text-[#dbdee1] outline-none cursor-pointer"
                                defaultValue=""
                              >
                                <option value="">Select who to swap with...</option>
                                {signups.filter(s => s.memberId !== signupEventBotSwapFirstId).map(s => (
                                  <option key={s.memberId} value={s.memberId}>@{s.username} ({s.status.toUpperCase()})</option>
                                ))}
                              </select>
                              <button
                                onClick={() => setSignupEventBotSwapFirstId(null)}
                                className="bg-[#da373c] hover:bg-[#a92b2f] text-white px-2.5 rounded-md text-xs font-bold transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {eventId === 'informal-signup' && infBotAdminShow && (
                <div className="mt-3 p-3 bg-[#2b2d31] border border-zinc-700/50 rounded-lg text-xs space-y-3 relative font-sans">
                  <div className="absolute top-2 right-2 text-[9px] text-[#949ba4] font-bold tracking-wider select-none flex items-center gap-1">
                    👤 Only you can see this • <span onClick={() => { setInfBotAdminShow(false); setInfBotSwapFirstId(null); }} className="text-blue-400 hover:underline cursor-pointer">Dismiss message</span>
                  </div>
                  <div className="font-bold text-[#f2f3f5] pr-20">🛠️ Roster Administrative Actions</div>
                  
                  {signups.length === 0 ? (
                    <p className="text-[11px] text-[#949ba4] italic">The roster is currently empty.</p>
                  ) : (
                    <div className="space-y-3 pt-1">
                      {/* Kick Select */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#949ba4] font-bold block uppercase">Kick Player</label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleKickRosterMember('informal-signup', e.target.value);
                              setInfBotAdminShow(false);
                            }
                          }}
                          className="w-full bg-[#1e1f22] border border-[#151618] rounded-md p-1.5 text-xs text-[#dbdee1] outline-none cursor-pointer"
                          defaultValue=""
                        >
                          <option value="">Select a member to KICK...</option>
                          {signups.map(s => (
                            <option key={s.memberId} value={s.memberId}>@{s.username} ({s.status.toUpperCase()})</option>
                          ))}
                        </select>
                      </div>

                      {/* Swap Select */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#949ba4] font-bold block uppercase">Swap Player</label>
                        {infBotSwapFirstId === null ? (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                setInfBotSwapFirstId(e.target.value);
                              }
                            }}
                            className="w-full bg-[#1e1f22] border border-[#151618] rounded-md p-1.5 text-xs text-[#dbdee1] outline-none cursor-pointer"
                            defaultValue=""
                          >
                            <option value="">Select first member to SWAP...</option>
                            {signups.map(s => (
                              <option key={s.memberId} value={s.memberId}>@{s.username} ({s.status.toUpperCase()})</option>
                            ))}
                          </select>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-[11px] text-blue-400">
                              Swapping <strong>@{signups.find(s => s.memberId === infBotSwapFirstId)?.username}</strong>
                            </p>
                            <div className="flex gap-2">
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleSwapRosterMembers('informal-signup', infBotSwapFirstId, e.target.value);
                                    setInfBotSwapFirstId(null);
                                    setInfBotAdminShow(false);
                                  }
                                }}
                                className="flex-1 bg-[#1e1f22] border border-[#151618] rounded-md p-1.5 text-xs text-[#dbdee1] outline-none cursor-pointer"
                                defaultValue=""
                              >
                                <option value="">Select who to swap with...</option>
                                {signups.filter(s => s.memberId !== infBotSwapFirstId).map(s => (
                                  <option key={s.memberId} value={s.memberId}>@{s.username} ({s.status.toUpperCase()})</option>
                                ))}
                              </select>
                              <button
                                onClick={() => setInfBotSwapFirstId(null)}
                                className="bg-[#da373c] hover:bg-[#a92b2f] text-white px-2.5 rounded-md text-xs font-bold transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRpSignup = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster account verification required');
    const isAuditor = true;

    const confirmedQueue = rpSignups.filter(s => s.status === 'confirmed');
    const reserveQueue = rpSignups.filter(s => s.status === 'reserve' || s.status === 'displaced');

    let normalCount = 0;
    const confirmedIcons = confirmedQueue.map((s) => {
      if (s.isTop10) return '👑';
      normalCount++;
      if (normalCount === 1) return '🥇';
      if (normalCount === 2) return '🥈';
      if (normalCount === 3) return '🥉';
      if (normalCount === 4) return '🏅';
      if (normalCount === 5) return '🎖️';
      return '⚔️';
    });

    let normalSubCount = 0;
    const reserveIcons = reserveQueue.map((s) => {
      if (s.isTop10) return '👑';
      normalSubCount++;
      if (normalSubCount === 1) return '🥇';
      if (normalSubCount === 2) return '🥈';
      if (normalSubCount === 3) return '🥉';
      if (normalSubCount === 4) return '🏅';
      if (normalSubCount === 5) return '🎖️';
      return '⚔️';
    });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto font-sans shadow-xl">
        {/* Directive details */}
        <div className="lg:col-span-4 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-5 h-fit">
          <div className="flex justify-between items-center pb-2 border-b border-[#1c1a2a]/60">
            <span className="text-xs font-bold text-zinc-300">ADMIN CONTROL HUB</span>
            {rpState === 'closed' ? (
              <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider">CLOSED</span>
            ) : (
              <span className="bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider animate-pulse">ACTIVE</span>
            )}
          </div>

          {isAuditor && (
            <div className="bg-[#0a0a14] p-4 border border-[#1c1a2a] rounded-xl space-y-3">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-zinc-400 tracking-wider block">EVENT DIRECTIVES</span>
                <textarea 
                  rows={4}
                  value={rpTriggerDesc}
                  onChange={(e) => setRpTriggerDesc(e.target.value)}
                  placeholder="Type event directives to broadcast in Discord..." 
                  className="w-full bg-[#111118] border border-[#1c1a2a] rounded-lg p-2 text-xs text-zinc-300 outline-none resize-none font-sans"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => handleTriggerSignupWindow('rp-signup', 'RP Ticket', rpTriggerDesc || rpDescription)} 
                  className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[9px] font-black italic py-2 rounded-lg cursor-pointer transition-smooth flex items-center justify-center font-bold"
                >
                  OPEN
                </button>
                <button 
                  onClick={() => handleCloseEventSignup('rp-signup')} 
                  className="bg-amber-600 hover:bg-amber-700 text-white font-title text-[9px] font-black italic py-2 rounded-lg cursor-pointer transition-smooth flex items-center justify-center font-bold"
                >
                  CLOSE
                </button>
                <button 
                  onClick={() => handleScheduleTrigger('rp-signup', 'RP Ticket', rpTriggerDesc || rpDescription, '10', 'seconds')} 
                  className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[9px] font-bold py-2 rounded-lg cursor-pointer transition-smooth flex items-center justify-center font-bold"
                >
                  10s
                </button>
              </div>

              {rpTriggerCountdown !== null && rpTriggerCountdown >= 0 && (
                <span className="text-[10px] text-green-400 font-bold block animate-pulse mt-1">
                  ⏱️ Triggering in {rpTriggerCountdown}s
                </span>
              )}

              {/* IST Scheduler section */}
              <div className="border-t border-[#1c1a2a]/60 pt-3 mt-2 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-zinc-400 tracking-wider block">IST DAILY TRIGGER TIMES</span>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={rpSchedule.enabled}
                      onChange={(e) => setRpSchedule(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="rounded border-[#1c1a2a] text-purple-600 focus:ring-0 bg-[#111118] w-3 h-3"
                    />
                    <span className="text-[9px] font-bold text-zinc-500 uppercase">ENABLED</span>
                  </label>
                </div>
                
                {/* 3 Time inputs */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[0, 1, 2].map((idx) => (
                    <input 
                      key={idx}
                      type="text"
                      placeholder="HH:MM"
                      value={rpSchedule.times[idx] || ''}
                      onChange={(e) => {
                        const newTimes = [...rpSchedule.times];
                        newTimes[idx] = e.target.value;
                        setRpSchedule(prev => ({ ...prev, times: newTimes }));
                      }}
                      className="bg-[#111118] border border-[#1c1a2a] rounded-lg p-1.5 text-center text-[10px] text-zinc-300 outline-none"
                    />
                  ))}
                </div>

                {/* Mode and Apply Button */}
                <div className="flex items-center justify-between mt-2 gap-2">
                  <select 
                    value={rpSchedule.mode}
                    onChange={(e) => setRpSchedule(prev => ({ ...prev, mode: e.target.value as any }))}
                    className="bg-[#111118] border border-[#1c1a2a] rounded-lg p-1.5 text-[10px] text-zinc-400 outline-none select-style"
                  >
                    <option value="once">set once</option>
                    <option value="day">set for a day</option>
                    <option value="ever">set to Ever</option>
                  </select>
                  
                  <button 
                    onClick={() => handleSaveSchedule('rp-signup', { ...rpSchedule, title: 'RP Ticket', description: rpTriggerDesc || rpDescription })}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[9px] font-black italic py-1.5 px-3 rounded-lg cursor-pointer transition-smooth font-bold"
                  >
                    APPLY
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Signup lists */}
        <div className="lg:col-span-4 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-[#1c1a2a]/50 pb-3">
            <h2 className="font-title font-black text-lg italic text-purple-400 text-glow-magenta">
              ⏰ RP SIGNUP TEAM LIST
            </h2>
            <span className="text-xs text-zinc-400 font-bold">CONFIRMED: <span className="text-purple-400 font-mono">{confirmedQueue.length} / 25</span></span>
          </div>

          {/* Roster Statistics Breakdown */}
          <div className="grid grid-cols-2 gap-3 bg-[#0a090f] p-4 border border-[#1c1a2a] rounded-2xl font-sans text-xs">
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Total Signups</span>
              <span className="text-base font-title font-black text-purple-400 font-mono">{confirmedQueue.length + reserveQueue.length}</span>
            </div>
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Top Shooters</span>
              <span className="text-base font-title font-black text-amber-500 font-mono">{confirmedQueue.filter(s => s.isTop10).length}</span>
            </div>
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Normal Conf</span>
              <span className="text-base font-title font-black text-zinc-300 font-mono">{confirmedQueue.filter(s => !s.isTop10).length}</span>
            </div>
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Reserve List</span>
              <span className="text-base font-title font-black text-red-400 font-mono">{reserveQueue.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 text-xs">
            {/* Confirmed */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider block border-b border-[#1c1a2a] pb-1">✅ CONFIRMED ROSTER</span>
              {rpSwapFirstId && (
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-xl text-[9px] flex justify-between items-center animate-pulse">
                  <span>🔄 Swapping <strong>@{rpSignups.find(s => s.memberId === rpSwapFirstId)?.username || 'selected player'}</strong>. Click SWAP next to another member to exchange positions.</span>
                  <button onClick={() => setRpSwapFirstId(null)} className="text-zinc-400 hover:text-white underline cursor-pointer text-[8px] font-bold">Cancel</button>
                </div>
              )}
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {confirmedQueue.length === 0 ? (
                  <div className="text-center py-12 text-zinc-655 italic">ROSTER IS VACANT.</div>
                ) : (
                  confirmedQueue.map((s, idx) => {
                    const badgeIcon = confirmedIcons[idx];
                    return (
                      <div key={idx} className="flex justify-between items-center bg-[#13121d]/40 p-2.5 border border-[#1c1a2a] rounded-xl font-sans text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 font-bold w-4 text-right">#{idx + 1}</span>
                          <span className="text-base leading-none select-none">{badgeIcon}</span>
                          <span className="font-bold text-zinc-200">@{s.username}</span>
                          {s.isTop10 && <span className="text-[7px] bg-accent/20 text-accent border border-accent/30 font-black px-1 rounded">TOP 10</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[8px] text-zinc-500">{new Date(s.signedUpAt).toLocaleTimeString()}</span>
                          <button
                            onClick={() => isAuditor && handleToggleVoiceSimulation(s.memberId, !!s.inVoice)}
                            disabled={!isAuditor}
                            className={`text-base select-none ${isAuditor ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
                            title={isAuditor ? "Toggle simulated voice presence" : ""}
                          >
                            {s.inVoice ? '✅' : '❌'}
                          </button>
                          {isAuditor && (
                            <div className="flex items-center gap-1 border-l border-zinc-800 pl-1.5 ml-1">
                              <button
                                onClick={() => handleKickRosterMember('rp-signup', s.memberId)}
                                className="text-red-500 hover:text-red-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                title="Kick from roster"
                              >
                                🗑️
                              </button>
                              {rpSwapFirstId === null ? (
                                <button
                                  onClick={() => setRpSwapFirstId(s.memberId)}
                                  className="text-blue-500 hover:text-blue-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                  title="Swap member"
                                >
                                  🔄
                                </button>
                              ) : rpSwapFirstId === s.memberId ? (
                                <button
                                  onClick={() => setRpSwapFirstId(null)}
                                  className="text-amber-500 hover:text-amber-400 font-black p-0.5 cursor-pointer text-[10px] animate-pulse"
                                  title="Cancel swap"
                                >
                                  ⏳
                                </button>
                              ) : (
                                <button
                                  onClick={() => { handleSwapRosterMembers('rp-signup', rpSwapFirstId, s.memberId); setRpSwapFirstId(null); }}
                                  className="bg-green-600/30 hover:bg-green-600/50 text-green-400 border border-green-500/30 px-1 py-0.5 rounded text-[8px] font-bold cursor-pointer"
                                  title="Swap with selected"
                                >
                                  SWAP
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Reserve */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider block border-b border-[#1c1a2a] pb-1">⏳ RESERVE QUEUE</span>
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {reserveQueue.length === 0 ? (
                  <div className="text-center py-12 text-zinc-655 italic">RESERVE QUEUE VACANT.</div>
                ) : (
                  reserveQueue.map((s, idx) => {
                    const badgeIcon = reserveIcons[idx];
                    return (
                      <div key={idx} className={`flex justify-between items-center p-2.5 border rounded-xl font-sans text-xs ${
                        s.status === 'displaced' ? 'bg-red-500/5 border-red-500/10 text-red-400 animate-pulse' : 'bg-[#13121d]/40 border-[#1c1a2a] text-zinc-400'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 font-bold w-4 text-right">R#{idx + 1}</span>
                          <span className="text-base leading-none select-none">{badgeIcon}</span>
                          <span className="font-bold">@{s.username}</span>
                          {s.isTop10 && <span className="text-[7px] bg-accent/20 text-accent border border-accent/30 font-black px-1 rounded">TOP 10</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-bold uppercase">{s.status}</span>
                          <button
                            onClick={() => isAuditor && handleToggleVoiceSimulation(s.memberId, !!s.inVoice)}
                            disabled={!isAuditor}
                            className={`text-base select-none ${isAuditor ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
                            title={isAuditor ? "Toggle simulated voice presence" : ""}
                          >
                            {s.inVoice ? '✅' : '❌'}
                          </button>
                          {isAuditor && (
                            <div className="flex items-center gap-1 border-l border-zinc-800 pl-1.5 ml-1">
                              <button
                                onClick={() => handleKickRosterMember('rp-signup', s.memberId)}
                                className="text-red-500 hover:text-red-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                title="Kick from roster"
                              >
                                🗑️
                              </button>
                              {rpSwapFirstId === null ? (
                                <button
                                  onClick={() => setRpSwapFirstId(s.memberId)}
                                  className="text-blue-500 hover:text-blue-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                  title="Swap member"
                                >
                                  🔄
                                </button>
                              ) : rpSwapFirstId === s.memberId ? (
                                <button
                                  onClick={() => setRpSwapFirstId(null)}
                                  className="text-amber-500 hover:text-amber-400 font-black p-0.5 cursor-pointer text-[10px] animate-pulse"
                                  title="Cancel swap"
                                >
                                  ⏳
                                </button>
                              ) : (
                                <button
                                  onClick={() => { handleSwapRosterMembers('rp-signup', rpSwapFirstId, s.memberId); setRpSwapFirstId(null); }}
                                  className="bg-green-600/30 hover:bg-green-600/50 text-green-400 border border-green-500/30 px-1 py-0.5 rounded text-[8px] font-bold cursor-pointer"
                                  title="Swap with selected"
                                >
                                  SWAP
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Discord Preview Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
            🤖 DISCORD WEBHOOK INTEGRATION PREVIEW
          </div>
          {renderDiscordEmbedMockup('rp-signup')}
        </div>
      </div>
    );
  };

  const renderInformalSignup = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster combat verification required');
    const isAuditor = true;

    const confirmedQueue = informalSignups.filter(s => s.status === 'confirmed');
    const reserveQueue = informalSignups.filter(s => s.status === 'reserve' || s.status === 'displaced');

    let normalCount = 0;
    const confirmedIcons = confirmedQueue.map((s) => {
      if (s.isTop10) return '👑';
      normalCount++;
      if (normalCount === 1) return '🥇';
      if (normalCount === 2) return '🥈';
      if (normalCount === 3) return '🥉';
      if (normalCount === 4) return '🏅';
      if (normalCount === 5) return '🎖️';
      return '⚔️';
    });

    let normalSubCount = 0;
    const reserveIcons = reserveQueue.map((s) => {
      if (s.isTop10) return '👑';
      normalSubCount++;
      if (normalSubCount === 1) return '🥇';
      if (normalSubCount === 2) return '🥈';
      if (normalSubCount === 3) return '🥉';
      if (normalSubCount === 4) return '🏅';
      if (normalSubCount === 5) return '🎖️';
      return '⚔️';
    });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto font-sans shadow-xl">
        {/* directives */}
        <div className="lg:col-span-4 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-5 h-fit">
          <div className="flex justify-between items-center pb-2 border-b border-[#1c1a2a]/60">
            <span className="text-xs font-bold text-zinc-300">ADMIN CONTROL HUB</span>
            {informalState === 'closed' ? (
              <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider">CLOSED</span>
            ) : (
              <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider animate-pulse">ACTIVE</span>
            )}
          </div>

          {isAuditor && (
            <div className="bg-[#0a0a14] p-4 border border-[#1c1a2a] rounded-xl space-y-3">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-zinc-400 tracking-wider block">EVENT DIRECTIVES</span>
                <textarea 
                  rows={4}
                  value={infTriggerDesc}
                  onChange={(e) => setInfTriggerDesc(e.target.value)}
                  placeholder="Type event directives to broadcast in Discord..." 
                  className="w-full bg-[#111118] border border-[#1c1a2a] rounded-lg p-2 text-xs text-zinc-300 outline-none resize-none font-sans"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => handleTriggerSignupWindow('informal-signup', 'Rooster control', infTriggerDesc || informalDescription)} 
                  className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[9px] font-black italic py-2 rounded-lg cursor-pointer transition-smooth flex items-center justify-center font-bold"
                >
                  OPEN
                </button>
                <button 
                  onClick={() => handleCloseEventSignup('informal-signup')} 
                  className="bg-amber-600 hover:bg-amber-700 text-white font-title text-[9px] font-black italic py-2 rounded-lg cursor-pointer transition-smooth flex items-center justify-center font-bold"
                >
                  CLOSE
                </button>
                <button 
                  onClick={() => handleScheduleTrigger('informal-signup', 'Rooster control', infTriggerDesc || informalDescription, '10', 'seconds')} 
                  className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[9px] font-bold py-2 rounded-lg cursor-pointer transition-smooth flex items-center justify-center font-bold"
                >
                  10s
                </button>
              </div>

              {infTriggerCountdown !== null && infTriggerCountdown >= 0 && (
                <span className="text-[10px] text-green-400 font-bold block animate-pulse mt-1">
                  ⏱️ Triggering in {infTriggerCountdown}s
                </span>
              )}

              {/* IST Scheduler section */}
              <div className="border-t border-[#1c1a2a]/60 pt-3 mt-2 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-zinc-400 tracking-wider block">IST DAILY TRIGGER TIMES</span>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={infSchedule.enabled}
                      onChange={(e) => setInfSchedule(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="rounded border-[#1c1a2a] text-purple-600 focus:ring-0 bg-[#111118] w-3 h-3"
                    />
                    <span className="text-[9px] font-bold text-zinc-500 uppercase">ENABLED</span>
                  </label>
                </div>
                
                {/* 1 Time input */}
                <div className="grid grid-cols-1 gap-1.5">
                  {[0].map((idx) => (
                    <input 
                      key={idx}
                      type="text"
                      placeholder="HH:MM"
                      value={infSchedule.times[idx] || ''}
                      onChange={(e) => {
                        const newTimes = [...infSchedule.times];
                        newTimes[idx] = e.target.value;
                        setInfSchedule(prev => ({ ...prev, times: newTimes }));
                      }}
                      className="bg-[#111118] border border-[#1c1a2a] rounded-lg p-1.5 text-center text-[10px] text-zinc-300 outline-none"
                    />
                  ))}
                </div>

                {/* Mode and Apply Button */}
                <div className="flex items-center justify-between mt-2 gap-2">
                  <select 
                    value={infSchedule.mode}
                    onChange={(e) => setInfSchedule(prev => ({ ...prev, mode: e.target.value as any }))}
                    className="bg-[#111118] border border-[#1c1a2a] rounded-lg p-1.5 text-[10px] text-zinc-400 outline-none select-style"
                  >
                    <option value="once">set once</option>
                    <option value="day">set for a day</option>
                    <option value="ever">set to Ever</option>
                  </select>
                  
                  <button 
                    onClick={() => handleSaveSchedule('informal-signup', { ...infSchedule, title: 'Rooster control', description: infTriggerDesc || informalDescription })}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[9px] font-black italic py-1.5 px-3 rounded-lg cursor-pointer transition-smooth font-bold"
                  >
                    APPLY
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Signups */}
        <div className="lg:col-span-4 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-[#1c1a2a]/50 pb-3">
            <h2 className="font-title font-black text-lg italic text-purple-400 text-glow-magenta">
              ⏰╭𝐈𝐧𝐟𝐨𝐫𝐦𝐚𝐥-𝐒𝐢𝐠𝐧𝐮𝐩 LIST
            </h2>
            <span className="text-xs text-zinc-400 font-bold">CONFIRMED: <span className="text-purple-400 font-mono">{confirmedQueue.length} / 25</span></span>
          </div>

          {/* Roster Statistics Breakdown */}
          <div className="grid grid-cols-2 gap-3 bg-[#0a090f] p-4 border border-[#1c1a2a] rounded-2xl font-sans text-xs">
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Total Signups</span>
              <span className="text-base font-title font-black text-purple-400 font-mono">{confirmedQueue.length + reserveQueue.length}</span>
            </div>
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Top Shooters</span>
              <span className="text-base font-title font-black text-amber-500 font-mono">{confirmedQueue.filter(s => s.isTop10).length}</span>
            </div>
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Normal Conf</span>
              <span className="text-base font-title font-black text-zinc-300 font-mono">{confirmedQueue.filter(s => !s.isTop10).length}</span>
            </div>
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Reserve List</span>
              <span className="text-base font-title font-black text-red-400 font-mono">{reserveQueue.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 text-xs">
            {/* Confirmed */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider block border-b border-[#1c1a2a] pb-1">✅ CONFIRMED GRID</span>
              {infSwapFirstId && (
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-xl text-[9px] flex justify-between items-center animate-pulse">
                  <span>🔄 Swapping <strong>@{informalSignups.find(s => s.memberId === infSwapFirstId)?.username || 'selected player'}</strong>. Click SWAP next to another member to exchange positions.</span>
                  <button onClick={() => setInfSwapFirstId(null)} className="text-zinc-400 hover:text-white underline cursor-pointer text-[8px] font-bold">Cancel</button>
                </div>
              )}
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {confirmedQueue.length === 0 ? (
                  <div className="text-center py-12 text-zinc-650 italic">ROSTER IS VACANT.</div>
                ) : (
                  confirmedQueue.map((s, idx) => {
                    const badgeIcon = confirmedIcons[idx];
                    return (
                      <div key={idx} className="flex justify-between items-center bg-[#13121d]/40 p-2.5 border border-[#1c1a2a] rounded-xl font-sans text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 font-bold w-4 text-right">#{idx + 1}</span>
                          <span className="text-base leading-none select-none">{badgeIcon}</span>
                          <span className="font-bold text-zinc-200">@{s.username}</span>
                          {s.isTop10 && <span className="text-[7px] bg-accent/20 text-accent border border-accent/30 font-black px-1 rounded">TOP 10</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[8px] text-zinc-500">{new Date(s.signedUpAt).toLocaleTimeString()}</span>
                          <button
                            onClick={() => isAuditor && handleToggleVoiceSimulation(s.memberId, !!s.inVoice)}
                            disabled={!isAuditor}
                            className={`text-base select-none ${isAuditor ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
                            title={isAuditor ? "Toggle simulated voice presence" : ""}
                          >
                            {s.inVoice ? '✅' : '❌'}
                          </button>
                          {isAuditor && (
                            <div className="flex items-center gap-1 border-l border-zinc-800 pl-1.5 ml-1">
                              <button
                                onClick={() => handleKickRosterMember('informal-signup', s.memberId)}
                                className="text-red-500 hover:text-red-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                title="Kick from roster"
                              >
                                🗑️
                              </button>
                              {infSwapFirstId === null ? (
                                <button
                                  onClick={() => setInfSwapFirstId(s.memberId)}
                                  className="text-blue-500 hover:text-blue-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                  title="Swap member"
                                >
                                  🔄
                                </button>
                              ) : infSwapFirstId === s.memberId ? (
                                <button
                                  onClick={() => setInfSwapFirstId(null)}
                                  className="text-amber-500 hover:text-amber-400 font-black p-0.5 cursor-pointer text-[10px] animate-pulse"
                                  title="Cancel swap"
                                >
                                  ⏳
                                </button>
                              ) : (
                                <button
                                  onClick={() => { handleSwapRosterMembers('informal-signup', infSwapFirstId, s.memberId); setInfSwapFirstId(null); }}
                                  className="bg-green-600/30 hover:bg-green-600/50 text-green-400 border border-green-500/30 px-1 py-0.5 rounded text-[8px] font-bold cursor-pointer"
                                  title="Swap with selected"
                                >
                                  SWAP
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Reserve */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider block border-b border-[#1c1a2a] pb-1">⏳ RESERVE QUEUE</span>
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {reserveQueue.length === 0 ? (
                  <div className="text-center py-12 text-zinc-655 italic">RESERVE QUEUE VACANT.</div>
                ) : (
                  reserveQueue.map((s, idx) => {
                    const badgeIcon = reserveIcons[idx];
                    return (
                      <div key={idx} className={`flex justify-between items-center p-2.5 border rounded-xl font-sans text-xs ${
                        s.status === 'displaced' ? 'bg-red-500/5 border-red-500/10 text-red-400 animate-pulse' : 'bg-[#13121d]/40 border-[#1c1a2a] text-zinc-400'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 font-bold w-4 text-right">R#{idx + 1}</span>
                          <span className="text-base leading-none select-none">{badgeIcon}</span>
                          <span className="font-bold">@{s.username}</span>
                          {s.isTop10 && <span className="text-[7px] bg-accent/20 text-accent border border-accent/30 font-black px-1 rounded">TOP 10</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-bold uppercase">{s.status}</span>
                          <button
                            onClick={() => isAuditor && handleToggleVoiceSimulation(s.memberId, !!s.inVoice)}
                            disabled={!isAuditor}
                            className={`text-base select-none ${isAuditor ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
                            title={isAuditor ? "Toggle simulated voice presence" : ""}
                          >
                            {s.inVoice ? '✅' : '❌'}
                          </button>
                          {isAuditor && (
                            <div className="flex items-center gap-1 border-l border-zinc-800 pl-1.5 ml-1">
                              <button
                                onClick={() => handleKickRosterMember('informal-signup', s.memberId)}
                                className="text-red-500 hover:text-red-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                title="Kick from roster"
                              >
                                🗑️
                              </button>
                              {infSwapFirstId === null ? (
                                <button
                                  onClick={() => setInfSwapFirstId(s.memberId)}
                                  className="text-blue-500 hover:text-blue-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                  title="Swap member"
                                >
                                  🔄
                                </button>
                              ) : infSwapFirstId === s.memberId ? (
                                <button
                                  onClick={() => setInfSwapFirstId(null)}
                                  className="text-amber-500 hover:text-amber-400 font-black p-0.5 cursor-pointer text-[10px] animate-pulse"
                                  title="Cancel swap"
                                >
                                  ⏳
                                </button>
                              ) : (
                                <button
                                  onClick={() => { handleSwapRosterMembers('informal-signup', infSwapFirstId, s.memberId); setInfSwapFirstId(null); }}
                                  className="bg-green-600/30 hover:bg-green-600/50 text-green-400 border border-green-500/30 px-1 py-0.5 rounded text-[8px] font-bold cursor-pointer"
                                  title="Swap with selected"
                                >
                                  SWAP
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Discord Preview Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
            🤖 DISCORD WEBHOOK INTEGRATION PREVIEW
          </div>
          {renderDiscordEmbedMockup('informal-signup')}
        </div>
      </div>
    );
  };

  const renderSignupEvent = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster verification required');
    const isAuditor = true;

    const confirmedQueue = signupEventSignups.filter(s => s.status === 'confirmed');
    const reserveQueue = signupEventSignups.filter(s => s.status === 'reserve' || s.status === 'displaced');

    let normalCount = 0;
    const confirmedIcons = confirmedQueue.map((s) => {
      if (s.isTop10) return '👑';
      normalCount++;
      if (normalCount === 1) return '🥇';
      if (normalCount === 2) return '🥈';
      if (normalCount === 3) return '🥉';
      if (normalCount === 4) return '🏅';
      if (normalCount === 5) return '🎖️';
      return '⚔️';
    });

    let normalSubCount = 0;
    const reserveIcons = reserveQueue.map((s) => {
      if (s.isTop10) return '👑';
      normalSubCount++;
      if (normalSubCount === 1) return '🥇';
      if (normalSubCount === 2) return '🥈';
      if (normalSubCount === 3) return '🥉';
      if (normalSubCount === 4) return '🏅';
      if (normalSubCount === 5) return '🎖️';
      return '⚔️';
    });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto font-sans shadow-xl">
        {/* Directive details */}
        <div className="lg:col-span-4 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-5 h-fit">
          <div className="flex justify-between items-center pb-2 border-b border-[#1c1a2a]/60">
            <span className="text-xs font-bold text-zinc-300">ADMIN CONTROL HUB</span>
            {signupEventState === 'closed' ? (
              <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider">CLOSED</span>
            ) : (
              <span className="bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider animate-pulse">ACTIVE</span>
            )}
          </div>

          {isAuditor && (
            <div className="bg-[#0a0a14] p-4 border border-[#1c1a2a] rounded-xl space-y-3">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-zinc-400 tracking-wider block">EVENT DIRECTIVES</span>
                <textarea 
                  rows={4}
                  value={signupEventTriggerDesc}
                  onChange={(e) => setSignupEventTriggerDesc(e.target.value)}
                  placeholder="Type event directives to broadcast in Discord..." 
                  className="w-full bg-[#111118] border border-[#1c1a2a] rounded-lg p-2 text-xs text-zinc-300 outline-none resize-none font-sans"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => handleTriggerSignupWindow('signup-event', 'Signup-Event', signupEventTriggerDesc || signupEventDescription)} 
                  className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[9px] font-black italic py-2 rounded-lg cursor-pointer transition-smooth flex items-center justify-center font-bold"
                >
                  OPEN
                </button>
                <button 
                  onClick={() => handleCloseEventSignup('signup-event')} 
                  className="bg-amber-600 hover:bg-amber-700 text-white font-title text-[9px] font-black italic py-2 rounded-lg cursor-pointer transition-smooth flex items-center justify-center font-bold"
                >
                  CLOSE
                </button>
                <button 
                  onClick={() => handleScheduleTrigger('signup-event', 'Signup-Event', signupEventTriggerDesc || signupEventDescription, '10', 'seconds')} 
                  className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[9px] font-bold py-2 rounded-lg cursor-pointer transition-smooth flex items-center justify-center font-bold"
                >
                  10s
                </button>
              </div>

              {signupEventTriggerCountdown !== null && signupEventTriggerCountdown >= 0 && (
                <span className="text-[10px] text-green-400 font-bold block animate-pulse mt-1">
                  ⏱️ Triggering in {signupEventTriggerCountdown}s
                </span>
              )}

              {/* IST Scheduler section */}
              <div className="border-t border-[#1c1a2a]/60 pt-3 mt-2 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-zinc-400 tracking-wider block">IST DAILY TRIGGER TIMES</span>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={signupEventSchedule.enabled}
                      onChange={(e) => setSignupEventSchedule(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="rounded border-[#1c1a2a] text-purple-600 focus:ring-0 bg-[#111118] w-3 h-3"
                    />
                    <span className="text-[9px] font-bold text-zinc-500 uppercase">ENABLED</span>
                  </label>
                </div>
                
                {/* 3 Time inputs */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[0, 1, 2].map((idx) => (
                    <input 
                      key={idx}
                      type="text"
                      placeholder="HH:MM"
                      value={signupEventSchedule.times[idx] || ''}
                      onChange={(e) => {
                        const newTimes = [...signupEventSchedule.times];
                        newTimes[idx] = e.target.value;
                        setSignupEventSchedule(prev => ({ ...prev, times: newTimes }));
                      }}
                      className="bg-[#111118] border border-[#1c1a2a] rounded-lg p-1.5 text-center text-[10px] text-zinc-300 outline-none"
                    />
                  ))}
                </div>

                {/* Mode and Apply Button */}
                <div className="flex items-center justify-between mt-2 gap-2">
                  <select 
                    value={signupEventSchedule.mode}
                    onChange={(e) => setSignupEventSchedule(prev => ({ ...prev, mode: e.target.value as any }))}
                    className="bg-[#111118] border border-[#1c1a2a] rounded-lg p-1.5 text-[10px] text-zinc-400 outline-none select-style"
                  >
                    <option value="once">set once</option>
                    <option value="day">set for a day</option>
                    <option value="ever">set to Ever</option>
                  </select>
                  
                  <button 
                    onClick={() => handleSaveSchedule('signup-event', { ...signupEventSchedule, title: 'Signup-Event', description: signupEventTriggerDesc || signupEventDescription })}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[9px] font-black italic py-1.5 px-3 rounded-lg cursor-pointer transition-smooth font-bold"
                  >
                    APPLY
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Signup lists */}
        <div className="lg:col-span-4 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-[#1c1a2a]/50 pb-3">
            <h2 className="font-title font-black text-lg italic text-purple-400 text-glow-magenta">
              ⏰ EVENT SIGNUP TEAM LIST
            </h2>
            <span className="text-xs text-zinc-400 font-bold">CONFIRMED: <span className="text-purple-400 font-mono">{confirmedQueue.length} / 25</span></span>
          </div>

          {/* Roster Statistics Breakdown */}
          <div className="grid grid-cols-2 gap-3 bg-[#0a090f] p-4 border border-[#1c1a2a] rounded-2xl font-sans text-xs">
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Total Signups</span>
              <span className="text-base font-title font-black text-purple-400 font-mono">{confirmedQueue.length + reserveQueue.length}</span>
            </div>
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Top Shooters</span>
              <span className="text-base font-title font-black text-amber-500 font-mono">{confirmedQueue.filter(s => s.isTop10).length}</span>
            </div>
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Normal Conf</span>
              <span className="text-base font-title font-black text-zinc-300 font-mono">{confirmedQueue.filter(s => !s.isTop10).length}</span>
            </div>
            <div className="text-center p-2 bg-[#111118]/50 border border-[#1c1a2a]/40 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Reserve List</span>
              <span className="text-base font-title font-black text-red-400 font-mono">{reserveQueue.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 text-xs">
            {/* Confirmed */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider block border-b border-[#1c1a2a] pb-1">✅ CONFIRMED ROSTER</span>
              {signupEventSwapFirstId && (
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-xl text-[9px] flex justify-between items-center animate-pulse">
                  <span>🔄 Swapping <strong>@{signupEventSignups.find(s => s.memberId === signupEventSwapFirstId)?.username || 'selected player'}</strong>. Click SWAP next to another member to exchange positions.</span>
                  <button onClick={() => setSignupEventSwapFirstId(null)} className="text-zinc-400 hover:text-white underline cursor-pointer text-[8px] font-bold">Cancel</button>
                </div>
              )}
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {confirmedQueue.length === 0 ? (
                  <div className="text-center py-12 text-zinc-655 italic">ROSTER IS VACANT.</div>
                ) : (
                  confirmedQueue.map((s, idx) => {
                    const badgeIcon = confirmedIcons[idx];
                    return (
                      <div key={idx} className="flex justify-between items-center bg-[#13121d]/40 p-2.5 border border-[#1c1a2a] rounded-xl font-sans text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 font-bold w-4 text-right">#{idx + 1}</span>
                          <span className="text-base leading-none select-none">{badgeIcon}</span>
                          <span className="font-bold text-zinc-200">@{s.username}</span>
                          {s.isTop10 && <span className="text-[7px] bg-accent/20 text-accent border border-accent/30 font-black px-1 rounded">TOP 10</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[8px] text-zinc-500">{new Date(s.signedUpAt).toLocaleTimeString()}</span>
                          <button
                            onClick={() => isAuditor && handleToggleVoiceSimulation(s.memberId, !!s.inVoice)}
                            disabled={!isAuditor}
                            className={`text-base select-none ${isAuditor ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
                            title={isAuditor ? "Toggle simulated voice presence" : ""}
                          >
                            {s.inVoice ? '✅' : '❌'}
                          </button>
                          {isAuditor && (
                            <div className="flex items-center gap-1 border-l border-zinc-800 pl-1.5 ml-1">
                              <button
                                onClick={() => handleKickRosterMember('signup-event', s.memberId)}
                                className="text-red-500 hover:text-red-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                title="Kick from roster"
                              >
                                🗑️
                              </button>
                              {signupEventSwapFirstId === null ? (
                                <button
                                  onClick={() => setSignupEventSwapFirstId(s.memberId)}
                                  className="text-blue-500 hover:text-blue-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                  title="Swap member"
                                >
                                  🔄
                                </button>
                              ) : signupEventSwapFirstId === s.memberId ? (
                                <button
                                  onClick={() => setSignupEventSwapFirstId(null)}
                                  className="text-amber-500 hover:text-amber-400 font-black p-0.5 cursor-pointer text-[10px] animate-pulse"
                                  title="Cancel swap"
                                >
                                  ⏳
                                </button>
                              ) : (
                                <button
                                  onClick={() => { handleSwapRosterMembers('signup-event', signupEventSwapFirstId, s.memberId); setSignupEventSwapFirstId(null); }}
                                  className="bg-green-600/30 hover:bg-green-600/50 text-green-400 border border-green-500/30 px-1 py-0.5 rounded text-[8px] font-bold cursor-pointer"
                                  title="Swap with selected"
                                >
                                  SWAP
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Reserve */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider block border-b border-[#1c1a2a] pb-1">⏳ RESERVE QUEUE</span>
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {reserveQueue.length === 0 ? (
                  <div className="text-center py-12 text-zinc-655 italic">RESERVE QUEUE VACANT.</div>
                ) : (
                  reserveQueue.map((s, idx) => {
                    const badgeIcon = reserveIcons[idx];
                    return (
                      <div key={idx} className={`flex justify-between items-center p-2.5 border rounded-xl font-sans text-xs ${
                        s.status === 'displaced' ? 'bg-red-500/5 border-red-500/10 text-red-400 animate-pulse' : 'bg-[#13121d]/40 border-[#1c1a2a] text-zinc-400'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 font-bold w-4 text-right">R#{idx + 1}</span>
                          <span className="text-base leading-none select-none">{badgeIcon}</span>
                          <span className="font-bold">@{s.username}</span>
                          {s.isTop10 && <span className="text-[7px] bg-accent/20 text-accent border border-accent/30 font-black px-1 rounded">TOP 10</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-bold uppercase">{s.status}</span>
                          <button
                            onClick={() => isAuditor && handleToggleVoiceSimulation(s.memberId, !!s.inVoice)}
                            disabled={!isAuditor}
                            className={`text-base select-none ${isAuditor ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
                            title={isAuditor ? "Toggle simulated voice presence" : ""}
                          >
                            {s.inVoice ? '✅' : '❌'}
                          </button>
                          {isAuditor && (
                            <div className="flex items-center gap-1 border-l border-zinc-800 pl-1.5 ml-1">
                              <button
                                onClick={() => handleKickRosterMember('signup-event', s.memberId)}
                                className="text-red-500 hover:text-red-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                title="Kick from roster"
                              >
                                🗑️
                              </button>
                              {signupEventSwapFirstId === null ? (
                                <button
                                  onClick={() => setSignupEventSwapFirstId(s.memberId)}
                                  className="text-blue-500 hover:text-blue-400 font-bold p-0.5 cursor-pointer text-[10px]"
                                  title="Swap member"
                                >
                                  🔄
                                </button>
                              ) : signupEventSwapFirstId === s.memberId ? (
                                <button
                                  onClick={() => setSignupEventSwapFirstId(null)}
                                  className="text-amber-500 hover:text-amber-400 font-black p-0.5 cursor-pointer text-[10px] animate-pulse"
                                  title="Cancel swap"
                                >
                                  ⏳
                                </button>
                              ) : (
                                <button
                                  onClick={() => { handleSwapRosterMembers('signup-event', signupEventSwapFirstId, s.memberId); setSignupEventSwapFirstId(null); }}
                                  className="bg-green-600/30 hover:bg-green-600/50 text-green-400 border border-green-500/30 px-1 py-0.5 rounded text-[8px] font-bold cursor-pointer"
                                  title="Swap with selected"
                                >
                                  SWAP
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Discord Preview Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
            🤖 DISCORD WEBHOOK INTEGRATION PREVIEW
          </div>
          {renderDiscordEmbedMockup('signup-event')}
        </div>
      </div>
    );
  };

  const renderPublicInformallog = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto font-sans shadow-xl">
        {/* Log win (Admin) */}
        {isLeaderOrAdmin && (
          <div className="lg:col-span-1 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4 h-fit">
            <h3 className="font-title font-bold text-xs text-primary tracking-wide uppercase border-b border-[#1c1a2a]/50 pb-2">
              🏆 LOG PUBLIC INFORMAL WIN
            </h3>

            <form onSubmit={(event) => handleLogWin(event, 'informal')} className="font-sans text-xs flex flex-col gap-4">
              <input type="hidden" value="informal" readOnly />
              
              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">BATTLE TITLE</label>
                <input 
                  type="text"
                  value={winForm.title}
                  onChange={(e) => setWinForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Informal Win vs Vagos..."
                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">direct DETAILS</label>
                <textarea 
                  rows={4}
                  value={winForm.description}
                  onChange={(e) => setWinForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Operation execution summary..."
                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-350 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">PARTICIPATING COMBATANTS</label>
                <input 
                  type="text"
                  value={winForm.participants}
                  onChange={(e) => setWinForm(prev => ({ ...prev, participants: e.target.value }))}
                  placeholder="Shooters..."
                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans"
                />
              </div>

              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">
                PUBLISH INFORMAL RECORD
              </button>
            </form>
          </div>
        )}

        {/* Win records list */}
        <div className={`${isLeaderOrAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4`}>
          <h2 className="font-title font-black text-lg italic text-zinc-200 border-b border-[#1c1a2a]/50 pb-2">
            📜╰public-informallog RECORDS
          </h2>

          <div className="space-y-6">
            {wins.filter(w => w.type === 'informal').length === 0 ? (
              <div className="text-center py-12 text-zinc-500 italic">
                NO INFORMAL WINS RECORDED TODAY.
              </div>
            ) : (
              wins.filter(w => w.type === 'informal').map((w) => (
                <div key={w.id} className="bg-[#13121d]/40 border border-[#1c1a2a] rounded-2xl p-4 flex flex-col md:flex-row gap-6 hover:border-purple-500/30 transition-smooth">
                  {w.mediaUrl && (
                    <img 
                      src={w.mediaUrl} 
                      alt={w.title} 
                      className="w-full md:w-48 h-32 object-cover rounded-xl border border-[#1c1a2a] shrink-0"
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
    const isAdmin = user && (user.admin_authenticated || user.roles.includes('Admin'));

    const renderAddDropdown = (type: 'top5' | 'top10') => {
      const currentIds = type === 'top5'
        ? (priorityList.top5 || []).map(m => m.discordId)
        : (priorityList.top10 || []).map(m => m.discordId);

      const availableMembers = members.filter(m => !currentIds.includes(m.discordId));
      const filtered = availableMembers.filter(m => 
        m.username.toLowerCase().includes(prioritySearch.toLowerCase()) ||
        m.nickname.toLowerCase().includes(prioritySearch.toLowerCase()) ||
        m.discordId.includes(prioritySearch)
      ).slice(0, 6);

      return (
        <div className="absolute left-0 mt-2 w-full bg-[#111118] border border-[#1c1a2a] rounded-xl shadow-2xl z-50 p-3 space-y-2">
          <input
            type="text"
            placeholder="Search member by name..."
            value={prioritySearch}
            onChange={(e) => setPrioritySearch(e.target.value)}
            className="w-full bg-[#0a0a14] border border-[#1c1a2a]/50 text-xs rounded-lg p-2 text-white focus:outline-none focus:border-purple-600 font-sans"
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <div className="text-zinc-500 text-[10px] p-2 text-center font-sans">No members found</div>
            ) : (
              filtered.map(m => (
                <button
                  key={m.discordId}
                  onClick={() => handleAddMember(type, m.discordId)}
                  className="w-full text-left text-xs hover:bg-purple-600/20 hover:text-purple-400 text-zinc-300 p-2 rounded-lg transition-smooth truncate flex items-center justify-between font-sans cursor-pointer"
                >
                  <span className="font-bold">@{m.nickname || m.username}</span>
                  <span className="text-[9px] text-zinc-500 font-mono">ID: {m.discordId}</span>
                </button>
              ))
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page header and deploy */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl shadow-xl">
          <div>
            <h2 className="font-title font-black text-xl italic text-purple-400 text-glow-magenta flex items-center gap-2">
              🎖️╭𝐓𝐨𝐩-𝟏0-𝐋𝐢𝐬𝐭 PRIORITY MEMBERS
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed mt-1 font-sans">
              Manage and view the Priority Members list synced directly to the Discord server roster embed.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={handleDeployPriorityPrompt}
              disabled={isDeployingPriority}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 text-white text-[10px] font-title font-black italic tracking-wide py-2 px-4 rounded-lg border border-purple-500 hover:scale-[1.02] active:scale-[0.98] transition-smooth cursor-pointer shrink-0"
            >
              {isDeployingPriority ? 'DEPLOYING...' : 'DEPLOY TO DISCORD'}
            </button>
          )}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* TOP 5 CARD */}
          <div className="bg-[#111118] border border-[#1c1a2a] rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex justify-between items-center border-b border-[#1c1a2a]/50 pb-3">
              <h3 className="font-title font-black text-sm italic text-amber-400 flex items-center gap-2">
                🥇 TOP 5 MEMBERS
              </h3>
              <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black uppercase px-2 py-0.5 rounded">
                ELITE ROSTER
              </span>
            </div>

            <div className="space-y-2">
              {(!priorityList.top5 || priorityList.top5.length === 0) ? (
                <div className="text-zinc-500 text-xs italic py-6 text-center">No members listed</div>
              ) : (
                priorityList.top5.map((m, idx) => (
                  <div key={m.discordId} className="flex items-center justify-between bg-[#0c0a10] border border-[#1c1a2a]/50 p-3 rounded-xl hover:border-purple-600/30 transition-smooth group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 h-6 bg-amber-950/40 text-amber-400 border border-amber-800/35 rounded-lg flex items-center justify-center font-title font-black italic text-xs shrink-0 select-none">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-title font-black text-xs italic text-zinc-200 truncate">
                          @{m.username}
                        </h4>
                        <p className="text-[9px] text-zinc-500 font-mono truncate">{m.nickname}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-bold text-zinc-400 font-sans">{m.kills || 0} Kills</span>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveMember('top5', m.discordId)}
                          className="text-rose-400 hover:text-white p-1 hover:bg-rose-950/30 border border-rose-900/30 hover:border-rose-600/50 rounded-lg transition-smooth cursor-pointer"
                          title="Remove Member"
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {isAdmin && (
              <div className="relative pt-2">
                <button
                  onClick={() => setShowAddMemberDropdown(showAddMemberDropdown === 'top5' ? null : 'top5')}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] text-emerald-400 hover:text-white font-title font-black italic tracking-wide bg-emerald-950/20 hover:bg-emerald-600 border border-emerald-800/35 hover:border-emerald-500 py-2.5 rounded-lg transition-smooth cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> ADD TOP 5 MEMBER
                </button>
                {showAddMemberDropdown === 'top5' && renderAddDropdown('top5')}
              </div>
            )}
          </div>

          {/* TOP 10 CARD */}
          <div className="bg-[#111118] border border-[#1c1a2a] rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex justify-between items-center border-b border-[#1c1a2a]/50 pb-3">
              <h3 className="font-title font-black text-sm italic text-purple-400 flex items-center gap-2">
                🎖️ TOP 10 MEMBERS
              </h3>
              <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[8px] font-black uppercase px-2 py-0.5 rounded">
                SHARPSHOOTERS
              </span>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {(!priorityList.top10 || priorityList.top10.length === 0) ? (
                <div className="text-zinc-500 text-xs italic py-6 text-center">No members listed</div>
              ) : (
                priorityList.top10.map((m, idx) => (
                  <div key={m.discordId} className="flex items-center justify-between bg-[#0c0a10] border border-[#1c1a2a]/50 p-3 rounded-xl hover:border-purple-600/30 transition-smooth group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 h-6 bg-purple-950/40 text-purple-400 border border-purple-800/35 rounded-lg flex items-center justify-center font-title font-black italic text-xs shrink-0 select-none">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-title font-black text-xs italic text-zinc-200 truncate">
                          @{m.username}
                        </h4>
                        <p className="text-[9px] text-zinc-500 font-mono truncate">{m.nickname}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-bold text-zinc-400 font-sans">{m.kills || 0} Kills</span>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveMember('top10', m.discordId)}
                          className="text-rose-400 hover:text-white p-1 hover:bg-rose-950/30 border border-rose-900/30 hover:border-rose-600/50 rounded-lg transition-smooth cursor-pointer"
                          title="Remove Member"
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {isAdmin && (
              <div className="relative pt-2">
                <button
                  onClick={() => setShowAddMemberDropdown(showAddMemberDropdown === 'top10' ? null : 'top10')}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] text-emerald-400 hover:text-white font-title font-black italic tracking-wide bg-emerald-950/20 hover:bg-emerald-600 border border-emerald-800/35 hover:border-emerald-500 py-2.5 rounded-lg transition-smooth cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> ADD TOP 10 MEMBER
                </button>
                {showAddMemberDropdown === 'top10' && renderAddDropdown('top10')}
              </div>
            )}
          </div>
        </div>

        {/* Discord Bot Panel Simulator Console Footer */}
        <div className="bg-[#111118] border border-[#1c1a2a] rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 text-left shadow-xl">
          <div className="text-left shrink-0">
            <span className="text-[8px] bg-purple-950/40 text-purple-400 px-2 py-0.5 rounded border border-purple-900/30 font-mono tracking-wider">DISCORD BOT LIVE INTEGRATION</span>
            <h4 className="font-title font-black text-xs italic text-zinc-300 mt-2">Interactive Bot Panel Simulator</h4>
            <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Simulate button interactions and modals linked to the Discord priority embed message.</p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center md:justify-end">
            <button 
              onClick={() => {
                if (isAdmin) {
                  setShowAddMemberDropdown('top5');
                } else {
                  addNotification('Access Denied', 'Admin console passcode is required to edit the priority list.', 'warning');
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-title font-black italic tracking-wide py-2 px-3.5 rounded-lg border border-emerald-500 hover:scale-[1.02] active:scale-[0.98] transition-smooth cursor-pointer"
            >
              + ADD TOP 5 MEMBER
            </button>
            <button 
              onClick={() => {
                if (isAdmin) {
                  setShowAddMemberDropdown('top10');
                } else {
                  addNotification('Access Denied', 'Admin console passcode is required to edit the priority list.', 'warning');
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-title font-black italic tracking-wide py-2 px-3.5 rounded-lg border border-emerald-500 hover:scale-[1.02] active:scale-[0.98] transition-smooth cursor-pointer"
            >
              + ADD TOP 10 MEMBER
            </button>
            <button 
              onClick={() => {
                if (isAdmin) {
                  addNotification('Roster Management', 'To remove members, use the inline red trash (X) icons next to their names in the list columns above.', 'info');
                } else {
                  addNotification('Access Denied', 'Admin console passcode is required to edit the priority list.', 'warning');
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-title font-black italic tracking-wide py-2 px-3.5 rounded-lg border border-[#f43f5e] hover:scale-[1.02] active:scale-[0.98] transition-smooth cursor-pointer"
            >
              X REMOVE TOP 5 MEMBER
            </button>
            <button 
              onClick={() => {
                if (isAdmin) {
                  addNotification('Roster Management', 'To remove members, use the inline red trash (X) icons next to their names in the list columns above.', 'info');
                } else {
                  addNotification('Access Denied', 'Admin console passcode is required to edit the priority list.', 'warning');
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-title font-black italic tracking-wide py-2 px-3.5 rounded-lg border border-[#f43f5e] hover:scale-[1.02] active:scale-[0.98] transition-smooth cursor-pointer"
            >
              X REMOVE TOP 10 MEMBER
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Switch render blocks dynamically based on state
  switch (activeTab) {
    case 'about-us':
      return renderAboutUs();
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
    case 'signup-event':
      return renderSignupEvent();
    case 'public-informallog':
      return renderPublicInformallog();
    case 'top-10-list':
      return renderTop10List();
    default:
      return renderAboutUs();
  }
}
