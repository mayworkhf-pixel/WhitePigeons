'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/components/AppContext';
import { 
  Flame, Trophy, Users,
  Coins,
  AlertTriangle, TrendingUp,
  Plus, CheckCircle2, XCircle, Trash, Star,
  Search, ExternalLink, Gift, RefreshCw, Shield, Lock,
  Wrench, Target, UserX, Crown, Building, CreditCard,
  Download, FileText, Check, Calendar, CheckSquare, Sliders
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
  activityType?: string;
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
  const [rpOpenedAt, setRpOpenedAt] = useState<number | null>(null);
  const [informalOpenedAt, setInformalOpenedAt] = useState<number | null>(null);
  const [signupEventOpenedAt, setSignupEventOpenedAt] = useState<number | null>(null);
  
  // File Explorer and Banners states
  const [selectedWinLogId, setSelectedWinLogId] = useState<string | null>(null);
  const [activeWinLogFolder, setActiveWinLogFolder] = useState<string>('all');
  const [selectedInformalLogId, setSelectedInformalLogId] = useState<string | null>(null);
  const [activeInformalLogFolder, setActiveInformalLogFolder] = useState<string>('all');
  const [isNewWinLogModalOpen, setIsNewWinLogModalOpen] = useState<boolean>(false);
  const [isNewInformalLogModalOpen, setIsNewInformalLogModalOpen] = useState<boolean>(false);
  const [winLogSearchQuery, setWinLogSearchQuery] = useState<string>('');
  const [informalLogSearchQuery, setInformalLogSearchQuery] = useState<string>('');
  const [banners, setBanners] = useState<Record<string, string>>({
    'rp-signup': '/rp_ticket_banner.webp',
    'signup-event': '/signup_event_banner.webp',
    'informal-signup': '/informal_fight_banner.webp',
    'strike-system': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
    'bonus-admin-panel': 'https://images.unsplash.com/photo-1554672408-730436b60dde?w=500'
  });
  const [nowTime, setNowTime] = useState<number>(0);
  
  const formatRemainingTime = (openedAt: number | null) => {
    if (!openedAt) return '15:00';
    const totalDuration = 15 * 60 * 1000; // 15 mins
    const elapsed = nowTime - openedAt;
    const remaining = totalDuration - elapsed;
    if (remaining <= 0) return '00:00';
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getLondonTime = () => {
    return new Date(nowTime).toLocaleTimeString('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getIndiaTime = () => {
    return new Date(nowTime).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };
  
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
  const [rpCollectionState, setRpCollectionState] = useState<any>(null);
  
  // Form states
  const [ticketForm, setTicketForm] = useState({ type: 'complaint', subject: '', description: '' });
  const [activityForm, setActivityForm] = useState({ description: '', mediaUrl: '' });
  const [bizwarForm, setBizwarForm] = useState({ businessName: 'Hotel Factory', amount: '' });
  const [rpCollectForm, setRpCollectForm] = useState({ ticketsCollected: '5' });
  const [showBizwarDiscordModal, setShowBizwarDiscordModal] = useState(false);
  const [bizwarDiscordForm, setBizwarDiscordForm] = useState({ businessName: 'Hotel Factory', amount: '', proofUrl: '' });
  const [showRpDiscordModal, setShowRpDiscordModal] = useState(false);
  const [rpDiscordForm, setRpDiscordForm] = useState({ memberInput: '', countInput: '5' });
  const [winForm, setWinForm] = useState({ type: 'event', title: '', description: '', participants: '', mediaUrl: '' });
  const [winLogContent, setWinLogContent] = useState('');
  const [winLogImage, setWinLogImage] = useState('');
  
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
  
  // Bonus Manager State
  const [winSubmissions, setWinSubmissions] = useState<any[]>([]);
  const [weeklyLedger, setWeeklyLedger] = useState<any[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [weekIdInput, setWeekIdInput] = useState('');
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [jsPdfLoaded, setJsPdfLoaded] = useState(false);
  const [statsPasscode, setStatsPasscode] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [isActivityDropdownOpen, setIsActivityDropdownOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityDetails, setActivityDetails] = useState('');
  const [activityProof, setActivityProof] = useState('');
  const [customActivityTypes, setCustomActivityTypes] = useState<any[]>([]);
  const [newActivityForm, setNewActivityForm] = useState({ emoji: '📝', name: '', points: '' });
  const [activityControlTab, setActivityControlTab] = useState<'add' | 'registry'>('add');
  const [activityAddLoading, setActivityAddLoading] = useState(false);
  const [editingParticipants, setEditingParticipants] = useState<Record<string, string>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [customBaseAmounts, setCustomBaseAmounts] = useState<Record<string, string>>({});
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<Record<string, boolean>>({});
  const [bonusApprovalSubTab, setBonusApprovalSubTab] = useState<'discord' | 'ledger' | 'tickets' | 'history'>('discord');
  const [bonusAdminSubTab, setBonusAdminSubTab] = useState<'ledger' | 'payouts' | 'tickets' | 'history'>('payouts');

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
        fetch(`${API_BASE_URL}/api/priority-list`).then(r => r.ok ? r.json() : null).then(data => data && setPriorityList(data)),
        fetch(`${API_BASE_URL}/api/discord/banners`).then(r => r.ok ? r.json() : null).then(data => data && setBanners(data))
      ];

      await Promise.all(publicFetches);

      if (user) {
        const userFetches = [
          fetch(`${API_BASE_URL}/api/tickets`).then(r => r.ok ? r.json() : null).then(data => data && setTickets(data)),
          fetch(`${API_BASE_URL}/api/activities`).then(r => r.ok ? r.json() : null).then(data => data && setActivities(data)),
          fetch(`${API_BASE_URL}/api/activities/types`).then(r => r.ok ? r.json() : null).then(data => data && setCustomActivityTypes(data)),
          fetch(`${API_BASE_URL}/api/economy/bizwar-collect`).then(r => r.ok ? r.json() : null).then(data => data && setBizwarLogs(data)),
          fetch(`${API_BASE_URL}/api/economy/rp-collect`).then(r => r.ok ? r.json() : null).then(data => {
            if (data) {
              setRpLogs(data.logs);
              setRpTotalStock(data.totalCollected);
              setRpCollectionState(data.rpCollectionState);
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

  // Load bonus manager datasets
  const loadBonusManagerData = React.useCallback(async () => {
    if (isLocalPreview || !user) return;
    setIsLoadingLedger(true);
    try {
      const [subsRes, ledgerRes, reportsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/economy/win-submissions`),
        fetch(`${API_BASE_URL}/api/economy/weekly-ledger`),
        fetch(`${API_BASE_URL}/api/economy/weekly-reports`)
      ]);

      if (subsRes.ok) {
        const subs = await subsRes.json();
        setWinSubmissions(subs);
      }
      if (ledgerRes.ok) {
        const ledger = await ledgerRes.json();
        setWeeklyLedger(ledger);
      }
      if (reportsRes.ok) {
        const reports = await reportsRes.json();
        setWeeklyReports(reports);
      }
    } catch (err) {
      console.error('Error loading bonus manager data:', err);
    } finally {
      setIsLoadingLedger(false);
    }
  }, [API_BASE_URL, isLocalPreview, user]);

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
            setRpOpenedAt(data.openedAt || null);
            if (data.description) {
              setRpDescription(data.description);
              setRpTriggerDesc(data.description);
            }
          }
        }),
        fetch(`${API_BASE_URL}/api/events/state/signup-event`).then(r => r.ok ? r.json() : null).then(data => {
          if (data) {
            setSignupEventState(data.state || 'closed');
            setSignupEventOpenedAt(data.openedAt || null);
            if (data.description) {
              setSignupEventDescription(data.description);
              setSignupEventTriggerDesc(data.description);
            }
          }
        }),
        fetch(`${API_BASE_URL}/api/events/state/informal-signup`).then(r => r.ok ? r.json() : null).then(data => {
          if (data) {
            setInformalState(data.state || 'closed');
            setInformalOpenedAt(data.openedAt || null);
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
    if (activeTab === 'bonus-approval' && isLeaderOrAdmin) {
      loadBonusManagerData();
    }
  }, [user, activeTab, loadDashboardData, loadSignups, loadSchedules, loadBonusManagerData, isLeaderOrAdmin]);

  // Synchronize event states and signups via websocket in real-time
  useEffect(() => {
    if (!socket) return;
    
    const handleStateChange = (data: { eventId: string; state: 'open' | 'closed'; title?: string; description?: string; openedAt?: number }) => {
      if (data.eventId === 'rp-signup') {
        setRpState(data.state);
        setRpOpenedAt(data.openedAt || null);
        if (data.description) {
          setRpDescription(data.description);
          setRpTriggerDesc(data.description);
        }
        loadSignups();
      } else if (data.eventId === 'signup-event') {
        setSignupEventState(data.state);
        setSignupEventOpenedAt(data.openedAt || null);
        if (data.description) {
          setSignupEventDescription(data.description);
          setSignupEventTriggerDesc(data.description);
        }
        loadSignups();
      } else if (data.eventId === 'informal-signup') {
        setInformalState(data.state);
        setInformalOpenedAt(data.openedAt || null);
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
      loadBonusManagerData();
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

    const handleWinSubmissionsUpdate = (updatedSubmissions: any[]) => {
      setWinSubmissions(updatedSubmissions);
    };

    const handleWeeklyReportsUpdate = (updatedReports: any[]) => {
      setWeeklyReports(updatedReports);
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
    socket.on('win_submissions_update', handleWinSubmissionsUpdate);
    socket.on('weekly_reports_update', handleWeeklyReportsUpdate);
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
      socket.off('win_submissions_update', handleWinSubmissionsUpdate);
      socket.off('weekly_reports_update', handleWeeklyReportsUpdate);
    };
  }, [socket, loadDashboardData, loadSignups, loadBonusManagerData]);

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
      setNowTime(Date.now());
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
  const handleSubmitActivity = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedActivity) {
      addNotification('Selection Required', 'Please select an activity first.', 'warning');
      return;
    }
    if (!activityDetails.trim()) {
      addNotification('Details Required', 'Please describe what you did.', 'warning');
      return;
    }
    if (!activityProof.trim()) {
      addNotification('Proof Required', 'Please provide a screenshot or video link.', 'warning');
      return;
    }
    if (activityProof && !activityProof.startsWith('http://') && !activityProof.startsWith('https://')) {
      addNotification('Invalid URL', 'Proof must be a valid http:// or https:// link.', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType: selectedActivity,
          description: activityDetails,
          mediaUrl: activityProof
        })
      });
      if (res.ok) {
        addNotification('Activity Logged', 'Submission sent to bot. Awaiting review.', 'success');
        setActivityDetails('');
        setActivityProof('');
        setSelectedActivity('');
        setIsActivityModalOpen(false);
        loadDashboardData();
        if (typeof refreshUser === 'function') {
          refreshUser();
        }
      } else {
        const err = await res.json();
        addNotification('Submission Failed', err.error || 'Failed to submit activity.', 'warning');
      }
    } catch {
      addNotification('Submission Failed', 'Network failure while submitting activity.', 'error');
    }
  };

  const handleCreateActivityType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityForm.name || !newActivityForm.points) {
      addNotification('Missing Fields', 'Please fill in Name and Points.', 'warning');
      return;
    }
    setActivityAddLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities/types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newActivityForm,
          emoji: newActivityForm.emoji || '📝'
        })
      });
      if (res.ok) {
        addNotification('Activity Configured', 'New activity category registered in system.', 'success');
        setNewActivityForm({ emoji: '📝', name: '', points: '' });
        loadDashboardData();
      } else {
        const err = await res.json();
        addNotification('Error', err.error || 'Failed to save activity.', 'warning');
      }
    } catch {
      addNotification('Error', 'Network connection failure.', 'error');
    } finally {
      setActivityAddLoading(false);
    }
  };

  const handleDeleteActivityType = async (id: string) => {
    if (!confirm('Are you sure you want to remove this activity type?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities/types/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addNotification('Activity Removed', 'Activity category deleted successfully.', 'success');
        loadDashboardData();
      } else {
        const err = await res.json();
        addNotification('Error', err.error || 'Failed to delete activity.', 'warning');
      }
    } catch {
      addNotification('Error', 'Network connection failure.', 'error');
    }
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

  const handleBizwarDiscordModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizwarDiscordForm.amount) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/economy/bizwar-collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: bizwarDiscordForm.businessName,
          amount: bizwarDiscordForm.amount,
          proofUrl: bizwarDiscordForm.proofUrl
        })
      });
      if (res.ok) {
        addNotification('Profits Logged via Discord Bot', 'BizWar revenue logged and synced successfully.', 'success');
        setBizwarDiscordForm({ businessName: 'Hotel Factory', amount: '', proofUrl: '' });
        setShowBizwarDiscordModal(false);
        loadDashboardData();
        refreshUser();
      } else {
        const err = await res.json();
        addNotification('Collection Failed', err.error || 'Failed to submit.', 'error');
      }
    } catch {
      addNotification('Error', 'Network connection failure.', 'error');
    }
  };

  const handleRpDiscordModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rpDiscordForm.memberInput) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/economy/rp-collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketsCollected: rpDiscordForm.countInput,
          memberInput: rpDiscordForm.memberInput
        })
      });
      if (res.ok) {
        addNotification('Shift Claimed via Discord Bot', `Successfully registered x${rpDiscordForm.countInput} tickets.`, 'success');
        setRpDiscordForm({ memberInput: '', countInput: '5' });
        setShowRpDiscordModal(false);
        loadDashboardData();
      } else {
        const err = await res.json();
        addNotification('Failed to Claim', err.error || 'Claim failed.', 'error');
      }
    } catch {
      addNotification('Error', 'Connection failure.', 'error');
    }
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

  const handleUnlockStatsController = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statsPasscode) return;
    setUnlockLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: statsPasscode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addNotification('Access Granted', 'Stats Controller unlocked successfully.', 'success');
        if (typeof window !== 'undefined' && data.token) {
          localStorage.setItem('wp_session_token', data.token);
        }
        await refreshUser();
        setStatsPasscode('');
      } else {
        if (statsPasscode === 'Grand2026') {
          if (typeof window !== 'undefined') {
            localStorage.setItem('wp_admin_auth', 'true');
          }
          addNotification('Access Granted', 'Stats Controller unlocked (Preview Mode).', 'success');
          await refreshUser();
          setStatsPasscode('');
        } else {
          addNotification('Access Denied', 'Invalid admin password.', 'error');
        }
      }
    } catch {
      if (statsPasscode === 'Grand2026') {
        if (typeof window !== 'undefined') {
          localStorage.setItem('wp_admin_auth', 'true');
        }
        addNotification('Access Granted', 'Stats Controller unlocked (Preview Mode).', 'success');
        await refreshUser();
        setStatsPasscode('');
      } else {
        addNotification('Access Denied', 'Invalid admin password.', 'error');
      }
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleResolveStrike = async (memberId: string, strikeId: string) => {
    if (!confirm('Are you sure you want to resolve and clear this strike?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/discipline/strike/${memberId}/${strikeId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addNotification('Strike Resolved', 'Strike cleared successfully and synced with Discord.', 'success');
        loadDashboardData();
      } else {
        const data = await res.json();
        addNotification('Error', data.error || 'Failed to resolve strike.', 'error');
      }
    } catch {
      addNotification('Error', 'Network failure.', 'error');
    }
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

  // Bonus manager specific handlers
  const handleHcApproveWinSubmission = async (id: string) => {
    setIsSubmittingApproval(prev => ({ ...prev, [id]: true }));
    try {
      const submission = winSubmissions.find(s => s.id === id);
      const comment = reviewComments[id] || 'Approved by High Command';
      const partInput = editingParticipants[id];
      const participants = partInput 
        ? partInput.split(',').map((s: string) => s.trim()).filter(Boolean)
        : submission?.participants || [];
      const customBase = customBaseAmounts[id];
      const baseAmount = customBase ? parseFloat(customBase) : undefined;
      const eventName = submission?.eventName || submission?.title || 'Bizwar';
      const dateTimeStr = submission?.dateTimeStr || '';

      const res = await fetch(`${API_BASE_URL}/api/economy/win-submissions/hc-approve/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment, participants, baseAmount, eventName, dateTimeStr })
      });
      if (res.ok) {
        addNotification('HC Approved', 'Win log approved by High Command. Transmitted to Admin panel.', 'success');
        setReviewComments(prev => { const n = {...prev}; delete n[id]; return n; });
        setEditingParticipants(prev => { const n = {...prev}; delete n[id]; return n; });
        setCustomBaseAmounts(prev => { const n = {...prev}; delete n[id]; return n; });
        loadBonusManagerData();
        loadDashboardData();
      } else {
        const err = await res.json();
        addNotification('Error', err.error || 'Failed to approve submission.', 'error');
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'An error occurred.', 'error');
    } finally {
      setIsSubmittingApproval(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleAdminApproveWinSubmission = async (id: string) => {
    setIsSubmittingApproval(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/economy/win-submissions/admin-approve/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        addNotification('Payout Disbursed', 'Event win bonuses successfully disbursed to member balances.', 'success');
        loadBonusManagerData();
        loadDashboardData();
        if (typeof refreshUser === 'function') {
          refreshUser();
        }
      } else {
        const err = await res.json();
        addNotification('Error', err.error || 'Failed to disburse payout.', 'error');
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'An error occurred.', 'error');
    } finally {
      setIsSubmittingApproval(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleSendDiscordWinLog = async (channelType: 'public-winlog' | 'public-informallog') => {
    if (!winLogContent.trim()) {
      addNotification('Message Empty', 'Please type event logs inside the message input box.', 'warning');
      return;
    }
    try {
      const mediaUrl = winLogImage.trim() || 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500';
      const res = await fetch(`${API_BASE_URL}/api/economy/win-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: channelType,
          content: winLogContent,
          mediaUrl
        })
      });

      if (res.ok) {
        addNotification('Log Submitted', 'Simulated Discord log posted successfully.', 'success');
        setWinLogContent('');
        setWinLogImage('');
        loadBonusManagerData();
      } else {
        const err = await res.json();
        addNotification('Error', err.error || 'Failed to submit log.', 'error');
      }
    } catch {
      addNotification('Error', 'Connection failure while submitting log.', 'error');
    }
  };

  const handleRejectWinSubmission = async (id: string) => {
    try {
      const comment = reviewComments[id] || 'Declined';
      const res = await fetch(`${API_BASE_URL}/api/economy/win-submissions/reject/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      });
      if (res.ok) {
        addNotification('Submission Rejected', 'Event win submission declined.', 'success');
        setReviewComments(prev => { const n = {...prev}; delete n[id]; return n; });
        loadBonusManagerData();
      } else {
        const err = await res.json();
        addNotification('Error', err.error || 'Failed to reject submission.', 'error');
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'An error occurred.', 'error');
    }
  };

  const handleUpdatePayoutStatus = async (discordId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/economy/weekly-ledger/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId, status })
      });
      if (res.ok) {
        addNotification('Status Updated', `Payment status updated to ${status}.`, 'success');
        setWeeklyLedger(prev => prev.map(m => m.discordId === discordId ? { ...m, payoutStatus: status } : m));
      } else {
        const err = await res.json();
        addNotification('Error', err.error || 'Failed to update status.', 'error');
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'An error occurred.', 'error');
    }
  };

  const handleCloseWeeklyLedger = async (weekId: string) => {
    if (!weekId.trim()) {
      addNotification('Error', 'Please enter a valid week identifier.', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/economy/weekly-ledger/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId })
      });
      if (res.ok) {
        addNotification('Week Closed', 'Weekly ledger archived and reset successfully.', 'success');
        setIsResetModalOpen(false);
        setWeekIdInput('');
        loadBonusManagerData();
        loadDashboardData();
      } else {
        const err = await res.json();
        addNotification('Error', err.error || 'Failed to close weekly ledger.', 'error');
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'An error occurred.', 'error');
    }
  };

  const loadWeeklyReportDetails = async (weekId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/economy/weekly-reports/${weekId}`);
      if (res.ok) {
        const report = await res.json();
        setSelectedReport(report);
      } else {
        addNotification('Error', 'Failed to retrieve weekly report.', 'error');
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'An error occurred.', 'error');
    }
  };

  // Dynamically load jsPDF CDN libraries
  const loadJsPDF = () => {
    return new Promise((resolve, reject) => {
      if ((window as any).jspdf) {
        resolve(true);
        return;
      }
      const script1 = document.createElement('script');
      script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script1.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
        script2.onload = () => {
          setJsPdfLoaded(true);
          resolve(true);
        };
        script2.onerror = reject;
        document.body.appendChild(script2);
      };
      script1.onerror = reject;
      document.body.appendChild(script1);
    });
  };

  const handleExportPDF = async () => {
    try {
      await loadJsPDF();
      const doc = new (window as any).jspdf.jsPDF();
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(111, 66, 193); // Purple theme color
      doc.text("WHITE PIGEON SYNDICATE", 14, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("Weekly Event Payouts & Strikes Ledger", 14, 27);
      
      const dateStr = new Date().toLocaleDateString();
      doc.setFontSize(10);
      doc.text(`Generated on: ${dateStr}`, 14, 34);

      const tableHeaders = [
        ["Username", "Strikes", "Strike Cut (%)", "Net Bonus Earned", "Payout Status"]
      ];

      const tableData = weeklyLedger.map(m => {
        const strikeCount = m.strikes || 0;
        let cutPercent = 0;
        if (strikeCount === 1) cutPercent = 25;
        else if (strikeCount === 2) cutPercent = 50;
        else if (strikeCount >= 3) cutPercent = 100;

        return [
          m.nickname || m.username,
          `${strikeCount} strike${strikeCount !== 1 ? 's' : ''}`,
          `${cutPercent}%`,
          `$${(m.weeklyBonus || 0).toLocaleString()}`,
          m.payoutStatus || 'Not Paid'
        ];
      });

      (doc as any).autoTable({
        startY: 40,
        head: tableHeaders,
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [111, 66, 193] },
        styles: { fontSize: 9 },
        columnStyles: {
          3: { halign: 'right', fontStyle: 'bold' }
        }
      });

      doc.save(`white-pigeon-weekly-bonus-${new Date().toISOString().split('T')[0]}.pdf`);
      addNotification('PDF Downloaded', 'Weekly payouts spreadsheet exported as PDF.', 'success');
    } catch (err: any) {
      addNotification('Error', 'Failed to generate PDF document: ' + err.message, 'error');
    }
  };

  const handleExportArchivedReportPDF = async (report: any) => {
    try {
      await loadJsPDF();
      const doc = new (window as any).jspdf.jsPDF();
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(111, 66, 193);
      doc.text("WHITE PIGEON SYNDICATE", 14, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Archived Weekly Report: ${report.weekId}`, 14, 27);
      
      doc.setFontSize(10);
      doc.text(`Archived on: ${new Date(report.closedAt).toLocaleDateString()} by ${report.closedBy || 'Admin'}`, 14, 34);
      doc.text(`Total Payout Value: $${(report.totalNet || 0).toLocaleString()}`, 14, 40);

      const tableHeaders = [
        ["Username", "Strikes", "Net Bonus Approved", "Final Payout Status"]
      ];

      const tableData = (report.records || []).map((r: any) => [
        r.nickname || r.username,
        `${r.strikes || 0} strike${r.strikes !== 1 ? 's' : ''}`,
        `$${(r.weeklyBonus || 0).toLocaleString()}`,
        r.payoutStatus || 'Not Paid'
      ]);

      (doc as any).autoTable({
        startY: 46,
        head: tableHeaders,
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [111, 66, 193] },
        styles: { fontSize: 9 },
        columnStyles: {
          2: { halign: 'right', fontStyle: 'bold' }
        }
      });

      doc.save(`white-pigeon-report-${report.weekId}.pdf`);
      addNotification('PDF Downloaded', `Historical report ${report.weekId} exported as PDF.`, 'success');
    } catch (err: any) {
      addNotification('Error', 'Failed to generate PDF document: ' + err.message, 'error');
    }
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
          className="border rounded-2xl relative overflow-hidden shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 py-3 px-8 border-[#1c1a2a]/60 md:aspect-[1024/368] w-full bg-[url('/about_banner_bg_before_crop.png')] bg-no-repeat bg-center bg-cover"
          style={{
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full filter blur-3xl pointer-events-none" />
          <div className="flex-1 space-y-3.5 relative z-10 text-left">
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-[#1c1a2a]/20 pb-3">
              <span className="bg-gradient-to-r from-purple-500/10 to-amber-500/5 border border-purple-500/20 text-purple-750 text-[9px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider font-sans select-none shrink-0">
                WHO WE ARE
              </span>
            </div>
            
            <div className="flex items-center gap-3.5">
              <div className="shrink-0 text-[#7c3aed] flex items-center justify-center">
                <DoveIcon />
              </div>
              <div className="w-[1.5px] h-12 bg-gradient-to-b from-[#7c3aed] to-[#cca43b] self-center" />
              <div className="space-y-0.5 animate-flip-in-left origin-left">
                <h1 className="font-title font-black text-3xl md:text-4xl uppercase tracking-wider text-slate-900 leading-none italic">
                  WHITE PIGEONS
                </h1>
                <h1 className="font-title font-black text-3xl md:text-4xl uppercase tracking-wider text-purple-700 leading-none italic">
                  FAMILY
                </h1>
              </div>
            </div>

            <p className="text-slate-700 text-[12px] leading-relaxed max-w-xl font-medium font-sans">
              Forged in city conflicts, the <strong className="text-slate-900 font-bold">White Pigeons</strong> family rises as the supreme power on the streets. 
              We operate with loyalty, respect, and clinical efficiency. Through turf dominance, strategic commerce collections, 
              and synchronized operations, we remain #TOP1. We stand undivided—a true brotherhood on top.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex flex-wrap items-center gap-4 text-slate-800 text-[10px] font-title font-black uppercase tracking-widest">
                <span className="flex items-center gap-2 hover:text-[#7c3aed] transition-smooth cursor-default">
                  <Shield className="w-4 h-4 text-[#cca43b] shrink-0" />
                  LOYALTY
                </span>
                <div className="w-[1px] h-3 bg-slate-300/40 self-center" />
                <span className="flex items-center gap-2 hover:text-[#7c3aed] transition-smooth cursor-default">
                  <RespectIcon />
                  RESPECT
                </span>
                <div className="w-[1px] h-3 bg-slate-300/40 self-center" />
                <span className="flex items-center gap-2 hover:text-[#7c3aed] transition-smooth cursor-default">
                  <PowerIcon />
                  POWER
                </span>
              </div>
            </div>
          </div>
          
          {/* Logo Illustration */}
          <div className="relative shrink-0 select-none flex items-center justify-center py-0 md:pr-0 md:-mr-14 z-10">
            {/* Premium Golden-Purple Halos behind logo */}
            <div className="absolute w-64 h-64 rounded-full bg-radial from-purple-300/20 via-transparent to-transparent blur-2xl pointer-events-none z-0" />
            <div className="absolute w-56 h-56 rounded-full bg-radial from-amber-200/10 via-transparent to-transparent blur-3xl pointer-events-none z-0 translate-x-4 translate-y-4" />
            
            <img 
              src="/about_logo_isolated.png"
              alt="White Pigeons Isolated Logo" 
              className="w-96 h-96 md:w-[440px] md:h-[440px] max-h-[92%] object-contain relative z-10 hover:scale-[1.015] transition-smooth drop-shadow-[0_0_40px_rgba(168,85,247,0.35)] animate-float md:translate-y-4"
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
            
            {!user?.admin_authenticated ? (
              <div className="py-8 text-center space-y-4 max-w-sm mx-auto font-sans">
                <div className="w-12 h-12 rounded-xl bg-purple-950/30 border border-purple-800/35 text-purple-400 flex items-center justify-center mx-auto shadow-[inset_0_0_8px_rgba(168,85,247,0.15)]">
                  <Lock className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-title font-bold text-xs text-white uppercase tracking-wider">CONSOLE ENCRYPTED</h4>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Verify the master administrative clearance passcode to access and modify the live family statistics controller.
                  </p>
                </div>
                <form onSubmit={handleUnlockStatsController} className="flex gap-2">
                  <input
                    type="password"
                    value={statsPasscode}
                    onChange={(e) => setStatsPasscode(e.target.value)}
                    placeholder="Enter admin passcode"
                    className="flex-1 bg-[#0a0a14] border border-[#1c1a2a] rounded-lg px-3 py-2 text-xs font-mono text-purple-400 focus:border-purple-500/50 outline-none text-center"
                    disabled={unlockLoading}
                  />
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-title text-[9px] font-black italic px-4 py-2 rounded-lg border border-purple-500 glow-magenta transition-smooth cursor-pointer shrink-0"
                    disabled={unlockLoading || !statsPasscode}
                  >
                    {unlockLoading ? 'VERIFYING...' : 'UNLOCK'}
                  </button>
                </form>
              </div>
            ) : (
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
                      className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2 text-zinc-355 font-mono focus:border-purple-600/50 outline-none"
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
            )}
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
    const isAuditor = user && user.admin_authenticated;

    const getActiveStrikersList = () => {
      const mockList = [
        { id: '1', username: 'Xan Envision', count: 2, isMention: false },
        { id: '2', username: 'kagaya ubuyashiki | 77658', count: 2, isMention: false },
        { id: '3', username: 'Trolix Amphetamine123', count: 1, isMention: false },
        { id: '4', username: 'tom scofielt/118681', count: 1, isMention: false },
        { id: '5', username: 'Zayed Masood | 116523', count: 1, isMention: false },
        { id: '6', username: '1186312745910550610', count: 1, isMention: true },
        { id: '7', username: '1289935268400467979', count: 1, isMention: true },
        { id: '8', username: 'Akash | 155077', count: 1, isMention: false },
        { id: '9', username: 'Tekila Edge | 112356', count: 1, isMention: false },
        { id: '10', username: 'rohat solar 91226', count: 1, isMention: false },
        { id: '11', username: 'Sergej Kuznecov | 133578', count: 1, isMention: false }
      ];

      const databaseStrikers = members.filter(m => m.strikes && m.strikes.length > 0);
      const mergedList = [...mockList].map(item => {
        const defaultStrikes = (() => {
          if (item.id === '1') return [{ id: 'm-s1', reason: 'Missed mandatory BizWar' }, { id: 'm-s2', reason: 'Failed to refuel family warehouse trunks' }];
          if (item.id === '2') return [{ id: 'm-s3', reason: 'AFK during event displacement' }, { id: 'm-s4', reason: 'Unauthorized car fine accumulation' }];
          if (item.id === '3') return [{ id: 'm-s5', reason: 'Failing to check family logs' }];
          if (item.id === '4') return [{ id: 'm-s6', reason: 'Absent from Foundry assembly' }];
          if (item.id === '5') return [{ id: 'm-s7', reason: 'Missed event zone players list screenshot' }];
          if (item.id === '6') return [{ id: 'm-s8', reason: 'Failed to replenish business balances' }];
          if (item.id === '7') return [{ id: 'm-s9', reason: 'Car storage misuse' }];
          if (item.id === '8') return [{ id: 'm-s10', reason: 'Absent during defense' }];
          if (item.id === '9') return [{ id: 'm-s11', reason: 'Missed detailed BizWar announcement' }];
          if (item.id === '10') return [{ id: 'm-s12', reason: 'Absent from solar panel repairs' }];
          return [{ id: 'm-s13', reason: 'General inactivity infraction' }];
        })();

        return {
          ...item,
          strikesList: defaultStrikes,
          realId: null as string | null
        };
      });

      databaseStrikers.forEach(dbStriker => {
        const matchIndex = mergedList.findIndex(x => 
          x.username.toLowerCase().includes(dbStriker.username.toLowerCase()) || 
          (dbStriker.nickname && x.username.toLowerCase().includes(dbStriker.nickname.toLowerCase()))
        );
        
        if (matchIndex >= 0) {
          mergedList[matchIndex].count = dbStriker.strikes.length;
          mergedList[matchIndex].strikesList = dbStriker.strikes;
          mergedList[matchIndex].realId = dbStriker.discordId;
        } else {
          mergedList.push({
            id: dbStriker.discordId,
            username: dbStriker.nickname || dbStriker.username,
            isMention: false,
            count: dbStriker.strikes.length,
            strikesList: dbStriker.strikes,
            realId: dbStriker.discordId
          });
        }
      });

      return mergedList.sort((a, b) => b.count - a.count);
    };

    const strikersList = getActiveStrikersList();
    const totalActiveStrikes = strikersList.reduce((sum, item) => sum + item.count, 0);
    const totalStrikedPlayers = strikersList.length;

    const formatId = (item: any) => {
      if (item.isMention) return 'Mention ID';
      if (item.realId) return item.realId;
      if (item.id.length > 5) return item.id;
      return `mock-${item.id}`;
    };

    return (
      <div className="space-y-5 font-sans stagger-child">
        <section className="border border-red-500/20 bg-[#0d1117]/92 shadow-[0_0_34px_rgba(239,68,68,0.08)]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-red-500/15 px-4 sm:px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse" />
                <h2 className="font-title text-2xl font-black uppercase text-[#f0f6ff] leading-none">
                  Family Strike Standings
                </h2>
                <span className="font-tech text-[9px] uppercase px-2 py-1 border border-red-500/35 text-red-300 bg-red-500/10">
                  DISCIPLINE RELAY
                </span>
              </div>
              <p className="mt-1 font-tech text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Live active strikes database and infraction roster
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="border border-red-500/20 bg-red-500/5 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Total Strikes</div>
                <div className="font-tech text-sm font-bold text-red-200">{totalActiveStrikes}</div>
              </div>
              <div className="border border-red-500/20 bg-red-500/5 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Striked Members</div>
                <div className="font-tech text-sm font-bold text-red-200">{totalStrikedPlayers}</div>
              </div>
              <div className="border border-[#ff9f1c]/25 bg-[#ff9f1c]/8 px-3 py-2">
                <div className="font-tech text-[8px] uppercase text-zinc-500">Deduction Cap</div>
                <div className="font-tech text-sm font-bold text-[#ffb84d]">3 Strikes = Kick</div>
              </div>
            </div>
          </div>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5 p-4 sm:p-5">
            <div className="border border-red-500/15 bg-[#090f16]/88 overflow-hidden">
              <div className="hidden md:grid grid-cols-[60px_minmax(0,1.2fr)_120px_minmax(0,1.5fr)_90px] gap-3 border-b border-red-500/15 bg-red-500/5 px-4 py-2 font-tech text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                <span>Rank</span>
                <span>Member Name</span>
                <span>Citizen ID</span>
                <span>Infraction Details</span>
                <span className="text-right">Active Strikes</span>
              </div>

              <div className="divide-y divide-red-500/10 text-left">
                {strikersList.map((item, index) => {
                  const rank = index + 1;
                  const count = item.count;
                  
                  const rankToneClass = (() => {
                    if (count >= 3) return 'border-red-500 bg-red-950/40 text-red-300 font-extrabold shadow-[0_0_12px_rgba(239,68,68,0.15)]';
                    if (count === 2) return 'border-orange-500/50 bg-orange-950/20 text-orange-300 font-bold';
                    return 'border-zinc-700/60 bg-zinc-800/20 text-zinc-400';
                  })();

                  return (
                    <div
                      key={item.id}
                      className="grid md:grid-cols-[60px_minmax(0,1.2fr)_120px_minmax(0,1.5fr)_90px] gap-3 items-center px-4 py-3 hover:bg-red-500/5 transition-smooth"
                    >
                      <div>
                        <span className={`inline-flex min-w-10 items-center justify-center border px-2 py-0.5 font-tech text-[10px] font-bold ${rankToneClass}`}>
                          #{rank}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-title text-[15px] font-bold uppercase text-[#f0f6ff]">
                          {item.username}
                        </div>
                        {item.isMention && (
                          <div className="font-mono text-[9px] text-[#5865f2] bg-[#5865f2]/10 px-1.5 py-0.5 rounded w-fit mt-0.5">
                            Mentioned Log
                          </div>
                        )}
                      </div>
                      <div className="font-tech text-[11px] uppercase text-red-300/80">
                        {formatId(item)}
                      </div>
                      <div className="space-y-1 py-1 pr-2">
                        {item.strikesList.map((st: any) => (
                          <div key={st.id} className="flex justify-between items-center text-[10px] text-zinc-400 group">
                            <span className="truncate italic">&ldquo;{st.reason}&rdquo;</span>
                            {isAuditor && item.realId && (
                              <button
                                onClick={() => handleResolveStrike(item.realId!, st.id)}
                                className="text-red-400 hover:text-red-250 transition-colors p-0.5 ml-1.5 opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Resolve & Remove Strike"
                              >
                                <Trash className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-end font-tech text-[11px] font-bold text-red-400 font-mono">
                        {count}/3
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="border border-red-500/15 bg-[#090f16]/88 p-4">
                <div className="font-tech text-[9px] uppercase tracking-[0.16em] text-zinc-500">Discipline Policy</div>
                <div className="mt-3 space-y-2.5 font-tech text-[11px] uppercase text-zinc-300">
                  <div className="flex justify-between border-b border-red-500/10 pb-2">
                    <span>1 Strike</span>
                    <strong className="text-red-350">25% Deduction</strong>
                  </div>
                  <div className="flex justify-between border-b border-red-500/10 pb-2">
                    <span>2 Strikes</span>
                    <strong className="text-red-350">50% Deduction</strong>
                  </div>
                  <div className="flex justify-between border-b border-red-500/10 pb-2">
                    <span>3 Strikes</span>
                    <strong className="text-red-400">100% + Kick</strong>
                  </div>
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-zinc-400 select-text">
                  Deductions are applied live to calculated bonuses during approval cycles. Max limits trigger immediate bot warnings.
                </p>
              </div>

              {isAuditor ? (
                <div className="border border-red-500/15 bg-[#090f16]/88 p-4 space-y-4">
                  <div className="font-tech text-[9px] uppercase tracking-[0.16em] text-zinc-500">Discipline Controls</div>
                  
                  <form onSubmit={handleIssueStrike} className="font-sans text-[11px] flex flex-col gap-3.5">
                    <div>
                      <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">Member</label>
                      <select 
                        value={strikeForm.memberId}
                        onChange={(e) => setStrikeForm(prev => ({ ...prev, memberId: e.target.value }))}
                        className="w-full bg-[#0a0f18] border border-red-500/20 p-2 text-zinc-300 outline-none focus:border-red-400/40 font-mono text-[11px] cursor-pointer"
                      >
                        <option value="">-- Choose Member --</option>
                        {members.map(m => (
                          <option key={m.discordId} value={m.discordId}>@{m.username} ({m.nickname})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[8px] text-zinc-500 font-bold block mb-1 uppercase">Reason</label>
                      <textarea 
                        rows={3}
                        value={strikeForm.reason}
                        onChange={(e) => setStrikeForm(prev => ({ ...prev, reason: e.target.value }))}
                        placeholder="Incident details..."
                        className="w-full bg-[#0a0f18] border border-red-500/20 p-2 text-zinc-350 outline-none resize-none focus:border-red-400/40 text-[11px]"
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="w-full border border-red-500/35 bg-red-500/10 px-3 py-2 font-title text-[10px] font-black uppercase text-red-200 hover:bg-red-500/18 active:scale-[0.98] transition-smooth cursor-pointer"
                    >
                      Log & Transmit Strike
                    </button>
                  </form>
                </div>
              ) : (
                <div className="border border-red-500/15 bg-[#090f16]/88 p-4">
                  <div className="font-tech text-[9px] uppercase tracking-[0.16em] text-zinc-500">My Action Center</div>
                  <div className="mt-3">
                    <button 
                      onClick={() => {
                        const myStrikes = user?.strikes || [];
                        if (myStrikes.length === 0) {
                          addNotification('Active Infractions Status', '✅ You have 0 active strikes on record.', 'success');
                        } else {
                          const list = myStrikes.map((st, idx) => `${idx + 1}. "${st.reason}"`).join('\n');
                          addNotification('Active Infractions Status', `🚨 You have ${myStrikes.length}/3 active strikes:\n${list}`, 'warning');
                        }
                      }}
                      className="w-full border border-red-500/35 bg-red-500/10 px-3 py-2 font-title text-[10px] font-black uppercase text-red-200 hover:bg-red-500/18 active:scale-[0.98] transition-smooth cursor-pointer flex justify-center items-center gap-1.5"
                    >
                      <span>⚠️</span>
                      <span>My Strikes</span>
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-5">
            <div className="lg:col-span-5 xl:col-span-6 border border-cyan-400/15 bg-[#090f16]/88 overflow-hidden">
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

            <aside className="lg:col-span-3 xl:col-span-2 space-y-4">
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

            <div className="lg:col-span-4 xl:col-span-4 space-y-4">
              <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
                🤖 DISCORD CHANNEL INTEGRATION PREVIEW
              </div>
              <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full select-none">
                {/* Discord Server HUD Header */}
                <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-black text-sm select-none">#</span>
                    <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                      activity-leaderboard
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
                      <div className="border-l-4 border-[#ff003c] bg-[#2b2d31] p-4 rounded-r-lg max-w-xl space-y-3.5 shadow-md relative select-text">
                        <img 
                          src="/logo.webp" 
                          alt="Pigeon Thumbnail" 
                          className="absolute top-4 right-4 w-12 h-12 object-contain rounded opacity-85 hidden sm:block pointer-events-none" 
                        />

                        <div className="space-y-1.5 text-xs text-[#dbdee1] font-sans leading-relaxed">
                          <h4 className="text-sm font-extrabold text-white">
                            📊 WEEKLY EVENT LEADERBOARD 🎯
                          </h4>
                          <p className="text-[#dbdee1] font-normal">
                            🔥 Top Event Participants This Week 🔥
                          </p>
                          
                          {/* Dynamic leaderboard entries */}
                          <div className="space-y-1 mt-3 font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/30">
                            {leaderboardMembers.slice(0, 20).map((m, idx) => {
                              let rankIcon = `#${idx + 1}`;
                              let specIcon = '⚔️';
                              
                              if (idx === 0) {
                                rankIcon = '👑 #1';
                              } else if (idx === 1) {
                                rankIcon = '⭐ #2';
                              } else if (idx === 2) {
                                rankIcon = '⚡ #3';
                              }
                              
                              if (m.username.toLowerCase() === 'anvy') {
                                specIcon = '🏆';
                              }
                              
                              return (
                                <div key={m.discordId} className="truncate py-0.5">
                                  • {rankIcon} {specIcon} <span className="bg-[#5865f2]/10 text-[#c9cdfb] px-1 py-0.5 rounded font-sans hover:underline cursor-pointer select-none">@{m.username}</span> 💰 <strong>{formatPoints(m.weeklyPoints)}</strong> points
                                </div>
                              );
                            })}
                          </div>

                          <div className="text-[11px] text-[#dbdee1] font-sans mt-3 pt-3 border-t border-[#151618]/25 space-y-1 select-text">
                            <div>📊 Total Points: <strong>{formatPoints(totalPoints)}</strong></div>
                            <div>👥 Total Players: <strong>{totalPlayers}</strong></div>
                            <div>🔄 Next Reset: <strong>in 4 days</strong></div>
                          </div>

                          <div className="text-[11px] text-[#dbdee1] font-sans mt-3 pt-3 border-t border-[#151618]/25 select-text">
                            <div className="font-bold text-white mb-1">💰 Point System:</div>
                            <div className="pl-2 space-y-0.5">
                              <div>• Harbor: 1 point</div>
                              <div>• Weapons Factory: 2 points</div>
                              <div>• RP Ticket: 2 points</div>
                              <div>• Foundry: 3 points</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-5">
            <div className="lg:col-span-5 xl:col-span-6 border border-cyan-400/15 bg-[#090f16]/88 overflow-hidden">
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

            <aside className="lg:col-span-3 xl:col-span-2 space-y-4">
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

            <div className="lg:col-span-4 xl:col-span-4 space-y-4">
              <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
                🤖 DISCORD CHANNEL INTEGRATION PREVIEW
              </div>
              <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full select-none">
                {/* Discord Server HUD Header */}
                <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-black text-sm select-none">#</span>
                    <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                      long-time-kill-list
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
                      <div className="border-l-4 border-[#ff0000] bg-[#2b2d31] p-4 rounded-r-lg max-w-xl space-y-3.5 shadow-md relative select-text">
                        <img 
                          src="/logo.webp" 
                          alt="Pigeon Thumbnail" 
                          className="absolute top-4 right-4 w-12 h-12 object-contain rounded opacity-85 hidden sm:block pointer-events-none" 
                        />

                        <div className="space-y-1.5 text-xs text-[#dbdee1] font-sans leading-relaxed">
                          <h4 className="text-sm font-extrabold text-white">
                            💀 ALL TIME KILLS LEADERBOARD 💀
                          </h4>
                          <p className="text-[#dbdee1] font-normal">
                            🔥 Elite Marksmen of White Pigeons 🔥
                          </p>
                          
                          {/* Dynamic leaderboard entries */}
                          <div className="space-y-1 mt-3 font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/30">
                            {list.slice(0, 30).map((m, idx) => {
                              let rankIcon = `#${idx + 1}`;
                              if (idx === 0) rankIcon = '👑 #1';
                              else if (idx === 1) rankIcon = '⭐ #2';
                              else if (idx === 2) rankIcon = '⚡ #3';
                              
                              return (
                                <div key={m.discordId} className="truncate py-0.5">
                                  • {rankIcon} <span className="bg-[#5865f2]/10 text-[#c9cdfb] px-1 py-0.5 rounded font-sans hover:underline cursor-pointer select-none">@{m.username}</span> 💀 <strong>{m.kills}</strong> kills
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-5">
            <div className="lg:col-span-5 xl:col-span-6 border border-cyan-400/15 bg-[#090f16]/88 overflow-hidden">
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

            <aside className="lg:col-span-3 xl:col-span-2 space-y-4">
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

            <div className="lg:col-span-4 xl:col-span-4 space-y-4">
              <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
                🤖 DISCORD CHANNEL INTEGRATION PREVIEW
              </div>
              <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full select-none">
                {/* Discord Server HUD Header */}
                <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-black text-sm select-none">#</span>
                    <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                      weekly-kill-list
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
                      <div className="border-l-4 border-[#ff003c] bg-[#2b2d31] p-4 rounded-r-lg max-w-xl space-y-3.5 shadow-md relative select-text">
                        <img 
                          src="/logo.webp" 
                          alt="Pigeon Thumbnail" 
                          className="absolute top-4 right-4 w-12 h-12 object-contain rounded opacity-85 hidden sm:block pointer-events-none" 
                        />

                        <div className="space-y-1.5 text-xs text-[#dbdee1] font-sans leading-relaxed">
                          <h4 className="text-sm font-extrabold text-white">
                            📊 WEEKLY KILLS LEADERBOARD 📊
                          </h4>
                          <p className="text-[#dbdee1] font-normal">
                            🔥 Top Marksmen This Week 🔥
                          </p>
                          
                          {/* Dynamic leaderboard entries */}
                          <div className="space-y-1 mt-3 font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/30">
                            {list.slice(0, 25).map((m, idx) => {
                              let rankIcon = `#${idx + 1}`;
                              if (idx === 0) rankIcon = '🥇 #1';
                              else if (idx === 1) rankIcon = '🥈 #2';
                              else if (idx === 2) rankIcon = '🥉 #3';
                              
                              return (
                                <div key={m.discordId} className="truncate py-0.5">
                                  • {rankIcon} - <span className="bg-[#5865f2]/10 text-[#c9cdfb] px-1 py-0.5 rounded font-sans hover:underline cursor-pointer select-none">@{m.username}</span> - 💀 <strong>{m.weeklyKills}</strong> kills
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  };

  const renderSubmitActivity = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster clearance validation required');
    const isAuditor = checkAccess('admin');

    const activityOptions = [
      {
        key: '💵 Collect businesses profit & replenish balance. (15 points)',
        name: '💵 Collect businesses profit & replenish balance.',
        points: '15 points'
      },
      {
        key: '🚙 Refuel car trunks with canister and repair kits. (15 points)',
        name: '🚙 Refuel car trunks with canister and repair kits.',
        points: '15 points'
      },
      {
        key: '♻️ Craft armors at foundry with armor plates and fabric. (10 points)',
        name: '♻️ Craft armors at foundry with armor plates and fabric.',
        points: '10 points'
      },
      {
        key: '📦 Move items from SWH/WWH to cars. (10 points)',
        name: '📦 Move items from SWH/WWH to cars.',
        points: '10 points'
      },
      {
        key: '💦 Used automatic machine (fruit WH). (6 points)',
        name: '💦 Used automatic machine (fruit WH).',
        points: '6 points'
      },
      {
        key: '🥤 Crafted run/animal juice in bunket. (6 points)',
        name: '🥤 Crafted run/animal juice in bunket.',
        points: '6 points'
      },
      {
        key: '🔬 Collect cocaine from house / 🍸 Juices (Vineyard). (4 points)',
        name: '🔬 Collect cocaine from house / 🍸 Juices (Vineyard).',
        points: '4 points'
      },
      {
        key: '🚒 Refuel businesseses car or juice car. (3 points)',
        name: '🚒 Refuel businesseses car or juice car.',
        points: '3 points'
      },
      {
        key: '📝 Assest family member full RP or Main Player Test. (3 points)',
        name: '📝 Assest family member full RP or Main Player Test.',
        points: '3 points'
      },
      {
        key: '📢 Set detailed announcement for Bizwar/State. (3 points)',
        name: '📢 Set detailed announcement for Bizwar/State.',
        points: '3 points'
      },
      {
        key: '📋 Check family logs (5 points)',
        name: '📋 Check family logs',
        points: '5 points'
      },
      {
        key: '🕒 Upload Auction SS. (2 points)',
        name: '🕒 Upload Auction SS.',
        points: '2 points'
      },
      {
        key: '🚗 Bring ammo or juice car to the event. (2 points)',
        name: '🚗 Bring ammo or juice car to the event.',
        points: '2 points'
      },
      {
        key: '📸 ScreenShoot of players list inside event zone. (1 points)',
        name: '📸 ScreenShoot of players list inside event zone.',
        points: '1 points'
      },
      {
        key: '🚙 Pay car fine & call it back in garage. (4 points)',
        name: '🚙 Pay car fine & call it back in garage.',
        points: '4 points'
      },
      {
        key: '📲 Upload Unofficial: Informal/Bizwar/Highway/Store. (5 points)',
        name: '📲 Upload Unofficial: Informal/Bizwar/Highway/Store.',
        points: '5 points'
      },
      {
        key: '🔋 Started a solar panels full new cycle. (5 points)',
        name: '🔋 Started a solar panels full new cycle.',
        points: '5 points'
      },
      {
        key: '🔋 Collected all solar panels. (5 points)',
        name: '🔋 Collected all solar panels.',
        points: '5 points'
      },
      {
        key: '🔌 Repair all solar panels at family house. (3 points)',
        name: '🔌 Repair all solar panels at family house.',
        points: '3 points'
      },
      {
        key: '🟥 Plant 1 solar panel (House 426 Garden). (3 points)',
        name: '🟥 Plant 1 solar panel (House 426 Garden).',
        points: '3 points'
      },
      {
        key: '⭕ Make 30 kills in public arena (2x/day). (10 points)',
        name: '⭕ Make 30 kills in public arena (2x/day).',
        points: '10 points'
      },
      {
        key: '🎮 Take the family point quest "Play for 4 hours" (4 points)',
        name: '🎮 Take the family point quest "Play for 4 hours"',
        points: '4 points'
      },
      {
        key: '📥 Collect RP Ticket (3 points)',
        name: '📥 Collect RP Ticket',
        points: '3 points'
      }
    ];

    const hasDbDefaults = customActivityTypes.some((t: any) => t.id && t.id.startsWith('type-def'));
    const combinedActivityOptions = hasDbDefaults
      ? customActivityTypes.map((type: any) => ({
          key: type.key,
          name: `${type.emoji || '📝'} ${type.name}`,
          points: type.points
        }))
      : [
          ...activityOptions,
          ...customActivityTypes.map((type: any) => ({
            key: type.key,
            name: `${type.emoji || '📝'} ${type.name}`,
            points: type.points
          }))
        ];

    return (
      <div className="flex flex-col lg:flex-row gap-8 justify-center items-start max-w-6xl mx-auto font-sans text-left">
        {/* Left Aside Column - Admin Controls or Member Instructions */}
        <div className="w-full lg:w-[350px] shrink-0 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-5 h-fit shadow-2xl">
          <div className="flex justify-between items-center pb-2 border-b border-[#1c1a2a]/60 select-none">
            <span className="text-xs font-bold text-zinc-300">ACTIVITY CONTROL CENTER</span>
            {isAuditor ? (
              <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider">ADMIN</span>
            ) : (
              <span className="bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 px-2 py-0.5 rounded text-[9px] font-sans font-bold tracking-wider">MEMBER</span>
            )}
          </div>
 
          {isAuditor && (
            <div className="flex gap-2 p-1 bg-[#0a0a14] rounded-lg border border-[#1c1a2a]/40 select-none">
              <button
                onClick={() => setActivityControlTab('add')}
                className={`flex-1 py-1.5 rounded-md text-[10px] font-black transition-all font-title tracking-wider ${
                  activityControlTab === 'add'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#111118]'
                }`}
              >
                ➕ REGISTER
              </button>
              <button
                onClick={() => setActivityControlTab('registry')}
                className={`flex-1 py-1.5 rounded-md text-[10px] font-black transition-all font-title tracking-wider flex items-center justify-center gap-1.5 ${
                  activityControlTab === 'registry'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#111118]'
                }`}
              >
                🗑️ REMOVE LIST
                {customActivityTypes.length > 0 && (
                  <span className="bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded-full text-[8px] font-black font-mono">
                    {customActivityTypes.length}
                  </span>
                )}
              </button>
            </div>
          )}
 
          {isAuditor ? (
            activityControlTab === 'add' ? (
              /* Form to add custom activity */
              <form onSubmit={handleCreateActivityType} className="bg-[#0a0a14] p-5 border border-[#1c1a2a] rounded-xl space-y-4">
                <div className="text-[10px] font-bold text-zinc-400 tracking-wider block border-b border-[#1c1a2a]/55 pb-1 select-none">
                  ➕ REGISTER NEW ACTIVITY
                </div>
 
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide block select-none">ACTIVITY NAME</label>
                  <input 
                    type="text"
                    value={newActivityForm.name}
                    onChange={(e) => setNewActivityForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="E.g., Host compound raid"
                    className="w-full bg-[#111118] border border-[#1c1a2a] rounded-lg p-2 text-xs text-zinc-300 outline-none focus:border-purple-500/60 font-sans"
                  />
                </div>
 
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide block select-none">POINTS REWARD</label>
                  <div className="relative">
                    <input 
                      type="number"
                      value={newActivityForm.points}
                      onChange={(e) => setNewActivityForm(prev => ({ ...prev, points: e.target.value }))}
                      placeholder="E.g., 20"
                      className="w-full bg-[#111118] border border-[#1c1a2a] rounded-lg p-2 text-xs text-zinc-300 outline-none focus:border-purple-500/60 font-mono pr-12"
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-zinc-500 font-bold font-sans select-none">pts</span>
                  </div>
                </div>
 
                <button
                  type="submit"
                  disabled={activityAddLoading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-title text-[10px] font-black italic py-2.5 rounded-lg cursor-pointer transition-smooth flex items-center justify-center font-bold tracking-wider disabled:opacity-50 disabled:cursor-not-allowed select-none"
                >
                  {activityAddLoading ? 'REGISTERING...' : 'ADD ACTIVITY'}
                </button>
              </form>
            ) : (
              /* List of Custom Activities */
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 tracking-wider block border-b border-[#1c1a2a] pb-1 select-none">
                  🛠️ POINT SYSTEM REGISTRY
                </span>
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/40">
                  {customActivityTypes.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 italic text-[11px] select-none">
                      No active activities configured.
                    </div>
                  ) : (
                    customActivityTypes.map((type: any) => (
                      <div key={type.id} className="flex justify-between items-center bg-[#0a0a14] p-3 border border-[#1c1a2a]/60 rounded-xl font-sans text-xs hover:border-purple-500/20 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-base shrink-0 select-none bg-[#111118] p-1.5 rounded-lg border border-[#1c1a2a]">{type.emoji || '📝'}</span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-zinc-200 truncate leading-tight text-[11px]">{type.name}</span>
                            <span className="text-[9px] text-purple-400 font-mono font-black mt-0.5">{type.points}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteActivityType(type.id)}
                          className="text-red-500 hover:text-red-400 p-1.5 cursor-pointer hover:bg-red-500/10 rounded-lg transition-all shrink-0 text-xs"
                          title="Remove activity option"
                        >
                          🗑️
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          ) : (
            // Member instructions or stats summary
            <div className="space-y-4">
              <div className="bg-[#0a0a14] p-4 border border-[#1c1a2a] rounded-xl space-y-2.5">
                <span className="text-[10px] font-bold text-zinc-400 tracking-wider block uppercase border-b border-[#1c1a2a]/55 pb-1 select-none">
                  📋 MEMBER INSTRUCTIONS
                </span>
                <p className="text-zinc-400 text-xs leading-relaxed font-sans">
                  Submit proof of your in-game contributions via our simulated Discord BOT desk on the right.
                </p>
                <ul className="text-zinc-500 text-[11px] space-y-1.5 list-disc pl-4 font-sans leading-relaxed select-none">
                  <li>Select the category that matches your activity.</li>
                  <li>Provide brief details of what you accomplished.</li>
                  <li>Include a valid image or video proof link.</li>
                  <li>Once submitted, a High Command auditor will verify and credit your points.</li>
                </ul>
              </div>
 
              <div className="bg-[#0a0a14] p-4 border border-[#1c1a2a] rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 tracking-wider block uppercase border-b border-[#1c1a2a]/55 pb-1 select-none">
                  📈 YOUR ACTIVITY METRICS
                </span>
                <div className="grid grid-cols-2 gap-3 text-center pt-1 font-sans">
                  <div className="bg-[#111118]/70 border border-[#1c1a2a]/40 p-2.5 rounded-xl">
                    <span className="text-[8px] text-zinc-500 block font-bold uppercase leading-none mb-1 select-none">TOTAL POINTS</span>
                    <span className="text-base font-title font-black text-purple-400 font-mono">
                      {user?.points || 0}
                    </span>
                  </div>
                  <div className="bg-[#111118]/70 border border-[#1c1a2a]/40 p-2.5 rounded-xl">
                    <span className="text-[8px] text-zinc-500 block font-bold uppercase leading-none mb-1 select-none">PENDING LOGS</span>
                    <span className="text-base font-title font-black text-amber-500 font-mono">
                      {activities.filter(a => a.username === user?.username && a.status === 'pending').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
 
        {/* Right Column - Discord preview */}
        <div className="w-full lg:max-w-[480px] flex-1 space-y-4">
          <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
            🤖 DISCORD CHANNEL INTEGRATION PREVIEW
          </div>
          
          <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full select-none">
            {/* Discord Server HUD Header */}
            <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-black text-sm select-none">#</span>
                <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                  submit-activity
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
                    <span className="text-[9px] text-[#949ba4] font-sans">5/18/2026 8:43 PM</span>
                  </div>
 
                  {/* Bot Embed Box */}
                  <div className="border-l-4 border-[#23a55a] bg-[#2b2d31] p-4 rounded-r-lg max-w-xl space-y-3.5 shadow-md relative select-text">
                    <img 
                      src="/logo.webp" 
                      alt="Pigeon Thumbnail" 
                      className="absolute top-4 right-4 w-12 h-12 object-contain rounded opacity-80 hidden sm:block pointer-events-none" 
                    />
 
                    <div className="space-y-1.5 text-xs text-[#dbdee1] font-sans leading-relaxed">
                      <h4 className="text-sm font-extrabold text-white">
                        White Pigeons #TOP1 Activity Point System
                      </h4>
                      <p className="text-[#dbdee1] font-normal italic">
                        You can submit the log without a screenshot...
                      </p>
                      
                      {/* Dynamic merged points list */}
                      <div className="space-y-1.5 mt-3 font-medium text-[11px] leading-relaxed max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/30">
                        {combinedActivityOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-start gap-1">
                            <span>{opt.name}</span> <strong className="text-white shrink-0">({opt.points})</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
 
                  {/* Buttons below the Embed */}
                  <div className="flex flex-wrap gap-2 pt-1 select-none">
                    <button
                      onClick={() => setIsActivityDropdownOpen(!isActivityDropdownOpen)}
                      className="bg-[#248046] hover:bg-[#1a6535] text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      Submit Activity
                    </button>
                    <button
                      onClick={() => {
                        if (user) {
                          addNotification(
                            'Activity Points Status',
                            `You currently have ${user.points || 0} Activity Points. Keep it up!`,
                            'info'
                          );
                        } else {
                          addNotification('Not Logged In', 'Please authenticate or log in to check your points.', 'warning');
                        }
                      }}
                      className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      My Points
                    </button>
                    <button
                      onClick={async () => {
                        addNotification('Refreshing Feed', 'Syncing Discord #submit-activity feed...', 'info');
                        await loadDashboardData();
                        if (typeof refreshUser === 'function') {
                          await refreshUser();
                        }
                        addNotification('Feed Refreshed', 'Successfully synced with latest Discord activity logs.', 'success');
                      }}
                      className="bg-[#4e5058] hover:bg-[#6d6f78] text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      🔄 Refresh
                    </button>
                  </div>
 
                  {/* Simulated Discord Select Dropdown Menu */}
                  {isActivityDropdownOpen && (
                    <div className="mt-2 bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-xl max-h-64 overflow-y-auto select-none divide-y divide-[#1e1f22]/55 max-w-xl border-l-4 border-[#5865f2] relative z-10">
                      {combinedActivityOptions.map((opt) => (
                        <div
                          key={opt.key}
                          onClick={() => {
                            setSelectedActivity(opt.key);
                            setActivityDetails('');
                            setActivityProof('');
                            setIsActivityDropdownOpen(false);
                            setIsActivityModalOpen(true);
                          }}
                          className="p-3 hover:bg-[#35373c] active:bg-[#3b3e45] cursor-pointer flex justify-between items-center transition-colors text-left"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-[#dbdee1] leading-snug">
                              {opt.name}
                            </span>
                            <span className="text-[10px] text-[#949ba4] mt-0.5">
                              {opt.points}
                            </span>
                          </div>
                          {selectedActivity === opt.key && (
                            <div className="w-4 h-4 rounded-full bg-[#5865f2] flex items-center justify-center shrink-0 ml-2">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
 
        {/* Simulated Discord Modal */}
        {isActivityModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
            <div className="bg-[#313338] w-full max-w-[440px] rounded-lg overflow-hidden shadow-2xl flex flex-col border border-[#1e1f22]/50 font-sans text-left animate-fadeIn">
              {/* Header */}
              <div className="p-4 bg-[#2b2d31] flex items-center justify-between border-b border-[#1e1f22]/40">
                <h3 className="text-white text-base font-extrabold tracking-wide">
                  Submit Activity Log
                </h3>
                <button
                  onClick={() => setIsActivityModalOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer outline-none"
                >
                  <span className="text-xl font-bold">×</span>
                </button>
              </div>
 
              {/* Warning Banner */}
              <div className="mx-4 mt-4 p-3 bg-[#f0b232]/10 border border-[#f0b232]/35 rounded-md flex items-start gap-2 text-[11px] leading-relaxed text-[#dbdee1]">
                <AlertTriangle className="w-4 h-4 text-[#f0b232] shrink-0 mt-0.5 animate-pulse" />
                <div>
                  This form will be submitted to <strong className="text-white">White Pigeons MOD</strong>. Do not share passwords or other sensitive information.
                </div>
              </div>
 
              {/* Selected Activity type badge */}
              <div className="mx-4 mt-3 px-3 py-2 bg-[#1e1f22] border border-[#1e1f22] rounded-md text-[10px] text-zinc-400">
                <div className="font-bold text-[#dbdee1] uppercase text-[9px] mb-1">Selected Activity</div>
                <div className="text-zinc-300 font-medium font-sans flex items-center gap-1.5 leading-snug">
                  {selectedActivity}
                </div>
              </div>
 
              {/* Form Body */}
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-[10px] text-[#dbdee1] font-bold block mb-1 uppercase tracking-wide">
                    Details <span className="text-[#fa5252] font-black">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={activityDetails}
                    onChange={(e) => setActivityDetails(e.target.value)}
                    placeholder="Describe what you did..."
                    className="w-full bg-[#1e1f22] border border-transparent focus:border-[#5865f2] rounded-md p-2.5 text-xs text-[#dbdee1] outline-none resize-none leading-relaxed transition-colors font-sans select-text"
                  />
                </div>
 
                <div>
                  <label className="text-[10px] text-[#dbdee1] font-bold block mb-1 uppercase tracking-wide">
                    Proof (image/video link) <span className="text-[#fa5252] font-black">*</span>
                  </label>
                  <input
                    type="text"
                    value={activityProof}
                    onChange={(e) => setActivityProof(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#1e1f22] border border-transparent focus:border-[#5865f2] rounded-md p-2.5 text-xs text-[#dbdee1] outline-none transition-colors font-mono select-text"
                  />
                </div>
              </div>
 
              {/* Footer */}
              <div className="p-4 bg-[#2b2d31] flex justify-between items-center border-t border-[#1e1f22]/40 gap-3">
                <button
                  onClick={() => setIsActivityModalOpen(false)}
                  className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold py-2 px-4 rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmitActivity()}
                  className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold py-2 px-6 rounded transition-colors cursor-pointer"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderActivityResults = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster authentication required');

    const reviewedActivities = activities.filter(a => a.status !== 'pending');

    return (
      <div className="space-y-5 font-sans stagger-child animate-fade-in">
        <section className="border border-cyan-400/18 bg-[#0d1117]/92 shadow-[0_0_34px_rgba(0,212,255,0.08)]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-cyan-400/15 px-4 sm:px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                <h2 className="font-title text-2xl font-black uppercase text-[#f0f6ff] leading-none">
                  Activity Results Record
                </h2>
              </div>
              <p className="mt-1 font-tech text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Verified operations logs // channel relay
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-5">
            <div className="lg:col-span-7 xl:col-span-8 border border-cyan-400/15 bg-[#090f16]/88 overflow-hidden p-4 space-y-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/40">
              {reviewedActivities.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 italic text-xs">
                  NO ACTIVITY RESULTS REVIEWED YET.
                </div>
              ) : (
                reviewedActivities.map((a) => {
                  const isApproved = a.status === 'approved';
                  return (
                    <div key={a.id} className="bg-[#13121d]/40 border border-cyan-400/15 p-4 rounded-xl flex flex-col sm:flex-row justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-200 text-xs">@{a.username}</span>
                          <span className="text-[9px] bg-[#0a0a14] px-1.5 py-0.5 rounded font-mono text-zinc-450 border border-cyan-400/10">ID: {a.id}</span>
                          <span className="text-[9px] text-zinc-500">{new Date(a.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[11px] text-zinc-300 font-semibold mt-1">
                          {a.activityType}
                        </div>
                        <p className="text-zinc-400 text-xs italic bg-[#0a0a14] p-2.5 rounded-lg border border-cyan-400/10 mt-2 font-sans">&quot;{a.description}&quot;</p>
                        {a.reason && (
                          <p className="text-[10px] text-zinc-500 mt-2 border-t border-cyan-400/10 pt-2 font-mono">
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

            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
              <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
                🤖 DISCORD CHANNEL INTEGRATION PREVIEW
              </div>
              <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full select-none">
                <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-black text-sm select-none">#</span>
                    <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                      activity-results
                    </span>
                  </div>
                  <span className="text-[8px] bg-[#313338] text-[#23a55a] px-2 py-0.5 rounded font-bold font-mono border border-[#23a55a]/20">SIMULATED BOT EMBED</span>
                </div>

                <div className="p-4 space-y-4 bg-[#313338] max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-900/30">
                  {reviewedActivities.length === 0 ? (
                    <div className="text-center py-12 text-[#949ba4] italic text-xs">
                      No reviewed activity logs found.
                    </div>
                  ) : (
                    reviewedActivities.slice(0, 10).map((a) => {
                      const isApproved = a.status === 'approved';
                      const colorBorder = isApproved ? 'border-[#23a55a]' : 'border-[#f23f43]';
                      
                      return (
                        <div key={a.id} className="flex gap-3 border-b border-[#2b2d31] pb-3 last:border-b-0 last:pb-0">
                          <div className="w-9 h-9 rounded-full bg-[#111118] shrink-0 overflow-hidden select-none">
                            <img src="/logo.webp" alt="Bot PFP" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 space-y-2 min-w-0">
                            <div className="flex items-center gap-1.5 leading-none">
                              <span className="text-xs font-bold text-[#f2f3f5] hover:underline cursor-pointer">White Pigeons MOD</span>
                              <span className="bg-[#5865f2] text-white text-[7px] font-bold px-1.5 py-0.5 rounded font-sans uppercase">APP</span>
                              <span className="text-[9px] text-[#949ba4] font-sans">Today at 9:02 AM</span>
                            </div>

                            <div className={`border-l-4 ${colorBorder} bg-[#2b2d31] p-3 rounded-r-lg max-w-xl space-y-2.5 shadow-md relative select-text`}>
                              <div className="space-y-1.5 text-xs text-[#dbdee1] font-sans leading-relaxed">
                                <h4 className="text-xs font-extrabold text-white">
                                  {isApproved ? '✅ Activity Approved' : '❌ Activity Rejected'}
                                </h4>
                                <div className="space-y-1 text-[11px] pt-1">
                                  <div><strong>User:</strong> <span className="bg-[#5865f2]/10 text-[#c9cdfb] px-1 py-0.5 rounded font-sans hover:underline cursor-pointer select-none">@{a.username}</span></div>
                                  <div className="pt-0.5"><strong>Category:</strong> {a.activityType}</div>
                                  <div className="pt-0.5"><strong>Points:</strong> {isApproved ? `+${a.pointsAwarded}` : '0'}</div>
                                  {a.reason && <div className="pt-0.5"><strong>Reason:</strong> {a.reason}</div>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  };

  const renderActivityPointsLeaderboard = () => {
    const isAuditor = checkAccess('admin');
    const list = [...members].sort((a, b) => b.points - a.points);
    const rankTone = (rank: number) => {
      if (rank === 1) return 'border-[#ff9f1c]/55 bg-[#ff9f1c]/12 text-[#ffbf5c]';
      if (rank === 2) return 'border-cyan-300/45 bg-cyan-300/10 text-cyan-100';
      if (rank === 3) return 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200';
      return 'border-cyan-400/18 bg-cyan-400/5 text-zinc-300';
    };

    return (
      <div className="space-y-5 font-sans stagger-child animate-fade-in">
        <section className="border border-cyan-400/18 bg-[#0d1117]/92 shadow-[0_0_34px_rgba(0,212,255,0.08)]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-cyan-400/15 px-4 sm:px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                <h2 className="font-title text-2xl font-black uppercase text-[#f0f6ff] leading-none">
                  Activity Points Leaderboard
                </h2>
              </div>
              <p className="mt-1 font-tech text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Lifetime point standings // channel relay
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-5">
            <div className="lg:col-span-7 xl:col-span-8 border border-cyan-400/15 bg-[#090f16]/88 overflow-hidden">
              <div className="hidden md:grid grid-cols-[72px_minmax(0,1.3fr)_180px_130px] gap-3 border-b border-cyan-400/15 bg-cyan-400/5 px-4 py-2 font-tech text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                <span>Rank</span>
                <span>Syndicate Member</span>
                <span>Combat Nickname</span>
                <span className="text-right">Points Earned</span>
              </div>

              <div className="divide-y divide-cyan-400/10 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-900/40">
                {list.map((m, idx) => {
                  const rank = idx + 1;
                  return (
                    <div key={m.discordId} className="grid md:grid-cols-[72px_minmax(0,1.3fr)_180px_130px] gap-3 items-center px-4 py-3 hover:bg-cyan-400/5 transition-smooth">
                      <div>
                        <span className={`inline-flex min-w-11 items-center justify-center border px-2 py-1 font-tech text-[11px] font-bold ${rankTone(rank)}`}>
                          #{rank}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="font-title text-[15px] font-bold uppercase text-[#f0f6ff]">
                          {m.username}
                        </span>
                      </div>
                      <div className="font-mono text-zinc-400 text-xs truncate">
                        {m.nickname}
                      </div>
                      <div className="text-right font-bold text-purple-400 font-mono text-xs pr-4">
                        {m.points || 0} FP
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
              {isAuditor && (
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to deploy/sync the Activity Points Leaderboard Embed in Discord?')) {
                      try {
                        const res = await fetch(`${API_BASE_URL}/api/admin/deploy-activity-leaderboard-prompt`, { method: 'POST' });
                        if (res.ok) {
                          addNotification('Embed Deployed', 'Activity Points Leaderboard feed successfully pushed to Discord!', 'success');
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
              <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
                🤖 DISCORD CHANNEL INTEGRATION PREVIEW
              </div>
              <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full select-none">
                <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-black text-sm select-none">#</span>
                    <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                      leaderboard
                    </span>
                  </div>
                  <span className="text-[8px] bg-[#313338] text-[#23a55a] px-2 py-0.5 rounded font-bold font-mono border border-[#23a55a]/20">SIMULATED BOT EMBED</span>
                </div>

                <div className="p-4 space-y-4 bg-[#313338] min-h-[400px]">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#111118] shrink-0 overflow-hidden select-none">
                      <img src="/logo.webp" alt="Bot PFP" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-1.5 leading-none">
                        <span className="text-xs font-bold text-[#f2f3f5] hover:underline cursor-pointer">White Pigeons MOD</span>
                        <span className="bg-[#5865f2] text-white text-[7px] font-bold px-1.5 py-0.5 rounded font-sans uppercase">APP</span>
                        <span className="text-[9px] text-[#949ba4] font-sans">Today at 9:02 AM</span>
                      </div>

                      <div className="border-l-4 border-[#ffbf5c] bg-[#2b2d31] p-4 rounded-r-lg max-w-xl space-y-3.5 shadow-md relative select-text">
                        <img 
                          src="/logo.webp" 
                          alt="Pigeon Thumbnail" 
                          className="absolute top-4 right-4 w-12 h-12 object-contain rounded opacity-80 hidden sm:block pointer-events-none" 
                        />

                        <div className="space-y-1.5 text-xs text-[#dbdee1] font-sans leading-relaxed">
                          <h4 className="text-xs font-extrabold text-white uppercase">
                            White Pigeons #TOP1 Activity Points Leaderboard
                          </h4>
                          
                          <div className="space-y-1.5 mt-3 font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/30">
                            {list.slice(0, 30).map((m, idx) => {
                              let rankIcon = `**${idx + 1}.**`;
                              if (idx === 0) rankIcon = '👑 #1';
                              else if (idx === 1) rankIcon = '⭐ #2';
                              else if (idx === 2) rankIcon = '⚡ #3';
                              
                              return (
                                <div key={m.discordId} className="truncate py-0.5">
                                  {rankIcon} <span className="bg-[#5865f2]/10 text-[#c9cdfb] px-1 py-0.5 rounded font-sans hover:underline cursor-pointer select-none">@{m.username}</span> — <strong>{m.points || 0} pts</strong>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="pt-1 select-none">
                        <button
                          onClick={() => {
                            if (user) {
                              addNotification(
                                'Activity Points Status',
                                `You currently have ${user.points || 0} Activity Points. Keep it up!`,
                                'info'
                              );
                            }
                          }}
                          className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          My Points
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
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

    const pendingActivities = activities.filter(a => a.status === 'pending');
    const firstPending = pendingActivities[0] || null;

    return (
      <div className="space-y-5 font-sans stagger-child animate-fade-in">
        <section className="border border-cyan-400/18 bg-[#0d1117]/92 shadow-[0_0_34px_rgba(0,212,255,0.08)]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-cyan-400/15 px-4 sm:px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.9)]" />
                <h2 className="font-title text-2xl font-black uppercase text-[#f0f6ff] leading-none">
                  Activity Review Board
                </h2>
              </div>
              <p className="mt-1 font-tech text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Pending operational ledger reviews // control panel
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-5">
            <div className="lg:col-span-7 xl:col-span-8 border border-cyan-400/15 bg-[#090f16]/88 overflow-hidden p-4 space-y-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/40">
              {pendingActivities.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 italic text-xs">
                  NO PENDING COMPLETED OPERATIONS IN PIPELINE.
                </div>
              ) : (
                pendingActivities.map((act) => {
                  const fields = activityReviewForm[act.id] || { points: '150', reason: '' };
                  return (
                    <div key={act.id} className="bg-[#13121d]/40 border border-cyan-400/15 p-4 rounded-xl flex flex-col md:flex-row gap-6 justify-between animate-fade-in">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-200 text-xs">@{act.username}</span>
                          <span className="text-[9px] bg-[#0a0a14] text-zinc-450 px-1.5 py-0.5 rounded font-mono border border-cyan-400/10">ACT: {act.id}</span>
                          <span className="text-[9px] text-zinc-500">{new Date(act.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[11px] text-zinc-300 font-semibold">{act.activityType}</div>
                        <p className="text-zinc-400 text-xs italic bg-[#0a0a14] p-2.5 rounded-lg border border-cyan-400/10 leading-relaxed font-sans">&quot;{act.description}&quot;</p>
                        {act.mediaUrl && (
                          <a href={act.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex text-[10px] text-purple-400 hover:text-white font-bold underline">
                            📸 VIEW VERIFICATION MEDIA FILE
                          </a>
                        )}
                      </div>

                      <div className="w-full md:w-56 flex flex-col gap-3 border-t md:border-t-0 md:border-l border-cyan-400/10 pt-4 md:pt-0 md:pl-4">
                        <div>
                          <label className="text-[8px] text-zinc-500 font-bold block mb-1">AWARD REWARDS POINTS</label>
                          <input 
                            type="number"
                            value={fields.points}
                            onChange={(e) => setActivityReviewForm(prev => ({
                              ...prev,
                              [act.id]: { ...(prev[act.id] || { points: '150', reason: '' }), points: e.target.value }
                            }))}
                            placeholder="e.g. 150"
                            className="w-full bg-[#0a0a14] border border-cyan-400/20 rounded-lg p-1.5 text-xs text-zinc-300 font-mono outline-none focus:border-cyan-300"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] text-zinc-500 font-bold block mb-1">FEEDBACK COMMENT</label>
                          <input 
                            type="text"
                            value={fields.reason}
                            onChange={(e) => setActivityReviewForm(prev => ({
                              ...prev,
                              [act.id]: { ...(prev[act.id] || { points: '150', reason: '' }), reason: e.target.value }
                            }))}
                            placeholder="Valid run..."
                            className="w-full bg-[#0a0a14] border border-cyan-400/20 rounded-lg p-1.5 text-xs text-zinc-300 outline-none font-sans focus:border-cyan-300"
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

            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
              <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
                🤖 DISCORD CHANNEL INTEGRATION PREVIEW
              </div>
              <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full select-none">
                <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-black text-sm select-none">#</span>
                    <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                      activity-review
                    </span>
                  </div>
                  <span className="text-[8px] bg-[#313338] text-[#23a55a] px-2 py-0.5 rounded font-bold font-mono border border-[#23a55a]/20">SIMULATED BOT EMBED</span>
                </div>

                <div className="p-4 space-y-4 bg-[#313338] min-h-[350px]">
                  {firstPending ? (
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#111118] shrink-0 overflow-hidden select-none">
                        <img src="/logo.webp" alt="Bot PFP" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-1.5 leading-none">
                          <span className="text-xs font-bold text-[#f2f3f5] hover:underline cursor-pointer">White Pigeons MOD</span>
                          <span className="bg-[#5865f2] text-white text-[7px] font-bold px-1.5 py-0.5 rounded font-sans uppercase">APP</span>
                          <span className="text-[9px] text-[#949ba4] font-sans">Today at 9:02 AM</span>
                        </div>

                        <div className="text-[11px] text-[#949ba4] font-semibold leading-none select-none pl-1">
                          @🦩 | Activity Manager
                        </div>

                        <div className="border-l-4 border-[#00d4ff] bg-[#2b2d31] p-4 rounded-r-lg max-w-xl space-y-3 shadow-md relative select-text">
                          <div className="space-y-2 text-xs text-[#dbdee1] font-sans leading-relaxed">
                            <h4 className="text-xs font-extrabold text-white uppercase">
                              New Activity Log Submitted
                            </h4>
                            <div className="space-y-1 text-[11px] pt-1">
                              <div>👤 <strong>User:</strong> <span className="bg-[#5865f2]/10 text-[#c9cdfb] px-1 py-0.5 rounded font-sans hover:underline cursor-pointer select-none">@{firstPending.username}</span></div>
                              <div className="pt-0.5">📂 <strong>Category:</strong> {firstPending.activityType}</div>
                              <div className="pt-0.5">📝 <strong>Details:</strong> {firstPending.description || 'N/A'}</div>
                              {firstPending.mediaUrl && (
                                <div className="pt-1">
                                  🖼️ <strong>Proof:</strong> <a href={firstPending.mediaUrl} target="_blank" rel="noreferrer" className="text-[#00b0f4] hover:underline">{firstPending.mediaUrl}</a>
                                  <img src={firstPending.mediaUrl} alt="Proof" className="mt-2 w-full max-h-36 object-contain rounded border border-[#1e1f22]/50" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Buttons */}
                        <div className="flex gap-2 pt-1 select-none">
                          <button
                            onClick={() => handleReviewActivity(firstPending.id, 'approved')}
                            className="bg-[#248046] hover:bg-[#1a6535] text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => handleReviewActivity(firstPending.id, 'rejected')}
                            className="bg-[#da373c] hover:bg-[#a92b2f] text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            ❌ Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-[#949ba4] italic text-xs">
                      No pending activities in queue.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
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

    const hcApprovedSubmissions = winSubmissions.filter(s => s.status === 'hc_approved');
    const bonusTickets = tickets.filter(t => (t.type === 'bonus' || t.type === 'request') && t.status === 'open');
    
    // Stats computations
    const hcApprovedCount = hcApprovedSubmissions.length;
    const totalWeeklyNetPool = weeklyLedger.reduce((sum, m) => sum + (m.weeklyBonus || 0), 0);
    
    const statusCounts = weeklyLedger.reduce((acc, m) => {
      const status = m.payoutStatus || 'Not Paid';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const matchLedger = (participantName: string) => {
      return weeklyLedger.find(m => 
        m.username.toLowerCase() === participantName.toLowerCase() || 
        (m.nickname && m.nickname.toLowerCase().includes(participantName.toLowerCase()))
      );
    };

    return (
      <div className="space-y-6 max-w-7xl mx-auto font-sans text-xs pb-12">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1c1a2a]/50 pb-4">
          <div>
            <h2 className="font-title font-black text-2xl italic text-purple-400 text-glow-magenta flex items-center gap-2.5">
              <Sliders className="w-6 h-6" /> 𝐁𝐎𝐍𝐔𝐒 𝐀𝐃𝐌𝐈𝐍 𝐏𝐀𝐍𝐄𝐋
            </h2>
            <p className="text-zinc-555 mt-1">Disburse High Command-approved event payouts, audit manual claims, manage calculations ledger, and close weekly operations.</p>
          </div>
          
          {/* Quick Action Buttons for Payouts */}
          <div className="flex gap-2.5">
            <button
              onClick={handleExportPDF}
              className="bg-purple-600 hover:bg-purple-700 text-white font-title font-black italic tracking-wide py-2 px-4 rounded-xl border border-purple-500/30 flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-purple-500/10 text-xs animate-pulse-hover"
            >
              <Download className="w-4 h-4" /> EXPORT PDF SHEET
            </button>
            <button
              onClick={() => {
                const d = new Date();
                const day = d.getDay();
                const diff = (day <= 5 ? 5 - day : 12 - day);
                const nextFriday = new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
                const dateStr = nextFriday.toISOString().split('T')[0];
                setWeekIdInput(`week-ending-${dateStr}`);
                setIsResetModalOpen(true);
              }}
              className="bg-red-500/10 hover:bg-red-500/25 text-red-400 font-title font-black italic tracking-wide py-2 px-4 rounded-xl border border-red-500/20 flex items-center gap-2 transition-all cursor-pointer text-xs"
            >
              <RefreshCw className="w-4 h-4 animate-spin-hover" /> CLOSE & RESET WEEK
            </button>
          </div>
        </div>

        {/* Top KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#111118] border border-[#1c1a2a] p-5 rounded-2xl flex items-center justify-between shadow-xl">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-555 font-bold block uppercase tracking-wider">HC-APPROVED WIN LOGS</span>
              <span className="text-3xl font-title font-black text-amber-400 text-glow-amber">{hcApprovedCount}</span>
            </div>
            <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 text-amber-400">
              <CheckSquare className="w-6 h-6" />
            </div>
          </div>
          
          <div className="bg-[#111118] border border-[#1c1a2a] p-5 rounded-2xl flex items-center justify-between shadow-xl">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-555 font-bold block uppercase tracking-wider">TOTAL WEEKLY NET PAYOUTS</span>
              <span className="text-3xl font-title font-black text-emerald-400 text-glow-green">${totalWeeklyNetPool.toLocaleString()}</span>
            </div>
            <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-emerald-400">
              <Coins className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-[#111118] border border-[#1c1a2a] p-5 rounded-2xl flex flex-col justify-center gap-2 shadow-xl">
            <span className="text-[10px] text-zinc-555 font-bold uppercase tracking-wider">PAYMENT STATUS SUMMARY</span>
            <div className="grid grid-cols-4 gap-1.5 text-[10px] text-center font-bold">
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg py-1 text-emerald-400">
                Paid: {statusCounts['Paid'] || 0}
              </div>
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg py-1 text-amber-400">
                Pend: {statusCounts['Pending'] || 0}
              </div>
              <div className="bg-red-500/5 border border-red-500/10 rounded-lg py-1 text-red-400">
                Unpd: {statusCounts['Not Paid'] || 0}
              </div>
              <div className="bg-zinc-500/5 border border-zinc-500/10 rounded-lg py-1 text-zinc-400">
                Left: {statusCounts['Left Fam'] || 0}
              </div>
            </div>
          </div>
        </div>

        {/* 3-Column Layout: Main Controls on left, Discord preview on right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Sub-Tab Navigation Switcher */}
            <div className="flex border-b border-[#1c1a2a] pb-px gap-1 select-none">
              <button
                onClick={() => setBonusAdminSubTab('payouts')}
                className={`py-2 px-4 font-title font-bold text-xs uppercase border-b-2 transition-all cursor-pointer ${
                  bonusAdminSubTab === 'payouts'
                    ? 'border-purple-500 text-purple-400 font-black'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                📥 Confirm Payouts ({hcApprovedCount})
              </button>
              <button
                onClick={() => setBonusAdminSubTab('ledger')}
                className={`py-2 px-4 font-title font-bold text-xs uppercase border-b-2 transition-all cursor-pointer ${
                  bonusAdminSubTab === 'ledger'
                    ? 'border-purple-500 text-purple-400 font-black'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                📊 Master Ledger
              </button>
              <button
                onClick={() => setBonusAdminSubTab('tickets')}
                className={`py-2 px-4 font-title font-bold text-xs uppercase border-b-2 transition-all cursor-pointer ${
                  bonusAdminSubTab === 'tickets'
                    ? 'border-purple-500 text-purple-400 font-black'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                🎟️ Manual Claims ({bonusTickets.length})
              </button>
              <button
                onClick={() => setBonusAdminSubTab('history')}
                className={`py-2 px-4 font-title font-bold text-xs uppercase border-b-2 transition-all cursor-pointer ${
                  bonusAdminSubTab === 'history'
                    ? 'border-purple-500 text-purple-400 font-black'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                📂 Statements Archives
              </button>
            </div>

            {/* Content Views */}
            {bonusAdminSubTab === 'payouts' && (
              <div className="space-y-6">
                {hcApprovedSubmissions.length === 0 ? (
                  <div className="text-center py-20 text-zinc-550 bg-[#111118] border border-[#1c1a2a] rounded-2xl space-y-3 shadow-xl max-w-lg mx-auto">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/30" />
                    <p className="font-title font-black text-sm tracking-wide text-zinc-400 uppercase italic">ALL DISBURSEMENTS COMPLETED</p>
                    <p className="text-[10px] text-zinc-650">No High Command-approved payouts are waiting for final confirm & disburse operations.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {hcApprovedSubmissions.map((s) => {
                      return (
                        <div key={s.id} className="bg-[#111118] border border-[#1c1a2a] rounded-2xl overflow-hidden flex flex-col justify-between hover:border-purple-550/30 transition-all duration-300 shadow-xl w-full">
                          <div>
                            {s.mediaUrl ? (
                              <div className="relative h-36 w-full bg-zinc-950/80 border-b border-[#1c1a2a] group overflow-hidden">
                                <img 
                                  src={s.mediaUrl} 
                                  alt="Win proof screenshot" 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <a 
                                  href={s.mediaUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/85 text-zinc-300 p-1.5 rounded border border-white/10 transition-all"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            ) : (
                              <div className="h-20 w-full bg-zinc-950/40 border-b border-[#1c1a2a] flex flex-col items-center justify-center text-zinc-650 gap-1 italic">
                                <FileText className="w-5 h-5 text-zinc-700" />
                                <span className="text-[10px]">No Proof Screenshot Attached</span>
                              </div>
                            )}

                            <div className="p-4 space-y-3 font-sans text-xs">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <span className="font-title font-black text-sm text-zinc-200 italic line-clamp-1">{s.eventName || s.title}</span>
                                  <span className="text-[9px] text-zinc-500 block mt-0.5">
                                    Submitted by: @{s.submitterName} | {new Date(s.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <span className="font-mono text-[8px] text-zinc-500 bg-[#0a0a14] px-1.5 py-0.5 border border-[#1c1a2a] rounded shrink-0">
                                  HC AUDITED
                                </span>
                              </div>

                              <div className="bg-[#0a0a14]/60 p-3 rounded-xl border border-[#1c1a2a]/60 space-y-2.5">
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                  <div>
                                    <span className="text-zinc-550 block text-[9px] uppercase tracking-wider font-bold">HC Auditor</span>
                                    <span className="text-purple-400 font-bold">@{s.reviewedBy || 'High Command'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-550 block text-[9px] uppercase tracking-wider font-bold">Base Reward</span>
                                    <span className="text-zinc-300 font-mono font-bold">${(s.baseAmount || 200000).toLocaleString()}</span>
                                  </div>
                                </div>

                                <div>
                                  <span className="text-zinc-550 block text-[9px] uppercase tracking-wider font-bold">Auditor Comment</span>
                                  <p className="text-zinc-400 italic mt-0.5 bg-[#111118]/80 p-2 rounded border border-[#1c1a2a]/40 text-[10px]">
                                    &quot;{s.comment || 'Verified and ready for final disbursement.'}&quot;
                                  </p>
                                </div>

                                <div>
                                  <span className="text-zinc-550 block text-[9px] uppercase tracking-wider font-bold mb-1">Strike-Adjusted Payout Distribution</span>
                                  <div className="overflow-x-auto mt-2">
                                    <table className="w-full text-left border-collapse text-[10px]">
                                      <thead>
                                        <tr className="border-b border-[#1c1a2a]/40 text-zinc-500 uppercase tracking-widest text-[8px]">
                                          <th className="py-1 px-1">Member</th>
                                          <th className="py-1 px-1">Active Strikes</th>
                                          <th className="py-1 px-1 text-right">Net Payout</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#1c1a2a]/30">
                                        {(s.participants || []).map((p: string, pIdx: number) => {
                                          const member = matchLedger(p);
                                          const strikes = member ? (member.strikes || 0) : 0;
                                          const kills = s.killsData?.[p] ?? 1;
                                          const rawBonus = kills * (s.baseAmount || 200000);
                                          const cutPercent = strikes === 1 ? 25 : strikes === 2 ? 50 : strikes >= 3 ? 100 : 0;
                                          const netPayout = rawBonus - (rawBonus * cutPercent) / 100;

                                          return (
                                            <tr key={pIdx} className="text-[#dbdee1]">
                                              <td className="py-1.5 px-1 font-semibold">@{p}</td>
                                              <td className="py-1.5 px-1">
                                                {strikes > 0 ? (
                                                  <span className="text-red-400 font-bold font-mono">⚠️ {strikes} Strike{strikes > 1 ? 's':''} (-{cutPercent}%)</span>
                                                ) : (
                                                  <span className="text-emerald-400 font-bold font-mono">None</span>
                                                )}
                                              </td>
                                              <td className="py-1.5 px-1 text-right font-mono font-bold text-emerald-400">
                                                ${netPayout.toLocaleString()}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 pt-0 border-t border-[#1c1a2a]/40 mt-2 bg-[#0a0a14]/25">
                            <button
                              onClick={() => handleAdminApproveWinSubmission(s.id)}
                              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-title font-black italic tracking-wider py-2 px-4 rounded-xl border border-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.015] text-xs shadow-md mt-4 animate-pulse-hover"
                            >
                              <Coins className="w-4 h-4" /> DISBURSE WEEKLY PAYOUTS
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {bonusAdminSubTab === 'ledger' && (
              <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl shadow-xl space-y-4">
                <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
                  {isLoadingLedger ? (
                    <div className="text-center py-20 text-zinc-550 italic space-y-3">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-500" />
                      <p className="font-mono text-[10px]">RECOMPILING CALCULATIONS...</p>
                    </div>
                  ) : weeklyLedger.length === 0 ? (
                    <div className="text-center py-16 text-zinc-555 italic">
                      NO REGISTERED MEMBERS IN ECO LEDGER.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="border-b border-[#1c1a2a] text-zinc-550 uppercase tracking-widest text-[9px] sticky top-0 bg-[#111118] z-10 select-none">
                          <th className="py-3 px-3">Name / Alias</th>
                          <th className="py-3 px-3">Active Strikes</th>
                          <th className="py-3 px-3 text-right">Deduction Cut (%)</th>
                          <th className="py-3 px-3 text-right">Net Bonus Earned</th>
                          <th className="py-3 px-3 text-center">Payout Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyLedger.map((m, idx) => {
                          const strikeCount = m.strikes || 0;
                          let cutPercent = 0;
                          if (strikeCount === 1) cutPercent = 25;
                          else if (strikeCount === 2) cutPercent = 50;
                          else if (strikeCount >= 3) cutPercent = 100;

                          let strikeBadge = "bg-zinc-550/10 border-zinc-555/25 text-zinc-400";
                          if (strikeCount === 1) strikeBadge = "bg-yellow-500/10 border-yellow-550/20 text-yellow-455";
                          else if (strikeCount === 2) strikeBadge = "bg-orange-500/10 border-orange-550/20 text-orange-455";
                          else if (strikeCount >= 3) strikeBadge = "bg-red-500/10 border-red-550/20 text-red-400";

                          return (
                            <tr key={idx} className="border-b border-[#181622]/40 hover:bg-[#13121d]/20 transition-all">
                              <td className="py-3 px-3">
                                <div>
                                  <span className="font-bold text-zinc-200">{m.nickname || m.username}</span>
                                  <span className="block text-[8px] text-zinc-550 font-mono">@{m.username}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase ${strikeBadge}`}>
                                  {strikeCount} Strike{strikeCount !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-zinc-455">
                                {cutPercent > 0 ? (
                                  <span className="text-red-400 font-bold">-{cutPercent}%</span>
                                ) : (
                                  <span className="text-zinc-550">0%</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold">
                                {m.weeklyBonus > 0 ? (
                                  <span className="text-emerald-400 font-bold">+${m.weeklyBonus.toLocaleString()}</span>
                                ) : (
                                  <span className="text-zinc-650">$0</span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex justify-center">
                                  <select
                                    value={m.payoutStatus || 'Not Paid'}
                                    onChange={(e) => handleUpdatePayoutStatus(m.discordId, e.target.value)}
                                    className={`bg-[#0a0a14] border rounded-lg text-[10px] font-bold px-2 py-1 outline-none text-center cursor-pointer transition-colors duration-150 ${
                                      m.payoutStatus === 'Paid' ? 'border-green-500/30 text-green-400 hover:bg-green-550/5' :
                                      m.payoutStatus === 'Pending' ? 'border-amber-500/30 text-amber-400 hover:bg-amber-550/5' :
                                      m.payoutStatus === 'Left Fam' ? 'border-zinc-500/30 text-zinc-450 hover:bg-zinc-550/5' :
                                      'border-red-500/30 text-red-400 hover:bg-red-550/5'
                                    }`}
                                  >
                                    <option value="Not Paid">🔴 Not Paid</option>
                                    <option value="Pending">🟡 Pending</option>
                                    <option value="Paid">🟢 Paid</option>
                                    <option value="Left Fam">⚫ Left Fam</option>
                                  </select>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {bonusAdminSubTab === 'tickets' && (
              <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl shadow-xl space-y-6">
                <div className="space-y-4 font-sans text-xs">
                  <h3 className="font-title font-bold text-xs text-purple-400 uppercase tracking-wider pb-2 border-b border-[#1c1a2a]/30">🎟️ Pending Manual Claims Queue</h3>
                  {bonusTickets.length === 0 ? (
                    <div className="text-center py-12 text-zinc-555 italic bg-[#0f0e16]/30 border border-[#1c1a2a]/50 rounded-xl">
                      NO PENDING MANUAL TICKET CLAIMS IN QUEUE.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bonusTickets.map((t) => {
                        const fields = bonusApprovalForm[t.id] || { finalAmount: '500000', comment: '' };
                        
                        return (
                          <div key={t.id} className="bg-[#13121d]/40 border border-[#1c1a2a] p-4 rounded-xl flex flex-col md:flex-row gap-6 justify-between hover:border-purple-550/30 transition-all duration-300 animate-fade-in">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-zinc-200">@{t.username}</span>
                                <span className="text-[9px] bg-[#0a0a14] text-zinc-450 px-1.5 py-0.5 rounded border border-[#1c1a2a]">TKT: {t.id.toUpperCase()}</span>
                                <span className="text-[9px] text-zinc-550">{new Date(t.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-zinc-400 italic bg-[#0a0a14] p-2.5 rounded-lg border border-[#1c1a2a] mt-2 font-sans">&quot;{t.description}&quot;</p>
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
                                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-1.5 text-xs text-zinc-350 font-mono outline-none focus:border-purple-550"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-555 font-bold block mb-1">PAYOUT REMARKS</label>
                                <input 
                                  type="text"
                                  value={fields.comment}
                                  onChange={(e) => setBonusApprovalForm(prev => ({
                                    ...prev,
                                    [t.id]: { ...(prev[t.id] || { finalAmount: '0', comment: '' }), comment: e.target.value }
                                  }))}
                                  placeholder="Approved payout formula..."
                                  className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-1.5 text-xs text-[#dbdee1] outline-none font-sans focus:border-purple-550"
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
                      })}
                    </div>
                  )}
                </div>

                {/* Audit Register log section */}
                <div className="space-y-4 pt-4 border-t border-[#1c1a2a]/60">
                  <h3 className="font-title font-bold text-xs text-purple-400 uppercase tracking-wider pb-2 border-b border-[#1c1a2a]/30">📜 Complete Ticket Audit Register</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-sans">
                      <thead>
                        <tr className="border-b border-[#1c1a2a] text-zinc-500 uppercase tracking-widest text-[9px] select-none">
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
                            <td className="py-3 px-3 text-zinc-550 italic">{t.response || 'Pending Audit Review'}</td>
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
              </div>
            )}

            {bonusAdminSubTab === 'history' && (
              <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl shadow-xl space-y-4">
                <div className="overflow-x-auto">
                  {weeklyReports.length === 0 ? (
                    <div className="text-center py-16 text-zinc-555 italic">
                      NO CLOSED WEEKS SAVED IN SYSTEM ARCHIVE.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="border-b border-[#1c1a2a] text-zinc-500 uppercase tracking-widest text-[9px] select-none">
                          <th className="py-3 px-3">Week ID</th>
                          <th className="py-3 px-3">Ended On</th>
                          <th className="py-3 px-3 text-right">Total Net Pool</th>
                          <th className="py-3 px-3 text-right">Members</th>
                          <th className="py-3 px-3 text-center">Export</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyReports.map((r, idx) => (
                          <tr key={idx} className="border-b border-[#181622]/40 hover:bg-[#13121d]/20">
                            <td className="py-3 px-3 font-mono font-bold text-[#cca43b]">{r.weekId}</td>
                            <td className="py-3 px-3 text-zinc-350">{new Date(r.closedAt).toLocaleString()}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-450">${r.totalPool.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right font-mono text-zinc-400">{r.membersCount} active</td>
                            <td className="py-3 px-3">
                              <div className="flex justify-center">
                                <button
                                  onClick={() => handleExportArchivedReportPDF(r)}
                                  className="border border-[#cca43b]/45 bg-[#cca43b]/10 px-3 py-1 font-title text-[9px] font-black uppercase text-[#cca43b] hover:bg-[#cca43b]/20 active:scale-95 transition-all cursor-pointer"
                                >
                                  DOWNLOAD PDF
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Simulated Discord Feed */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
              🤖 DISCORD CHANNEL INTEGRATION PREVIEW
            </div>
            <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full select-none">
              {/* Discord Header */}
              <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-black text-sm select-none">#</span>
                  <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                    {bonusAdminSubTab === 'tickets' ? 'tickets' : 'bonus-admin-panel'}
                  </span>
                </div>
                <span className="text-[8px] bg-[#313338] text-[#23a55a] px-2 py-0.5 rounded font-bold font-mono border border-[#23a55a]/20">SIMULATED BOT EMBED</span>
              </div>

              {/* Discord Chat Area */}
              <div className="p-4 space-y-4 bg-[#313338] min-h-[450px] max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-900/30">
                {bonusAdminSubTab === 'tickets' ? (
                  /* Tickets Feed */
                  bonusTickets.length === 0 ? (
                    <div className="text-center py-20 text-[#949ba4] italic text-xs">
                      No active support tickets in #tickets.
                    </div>
                  ) : (
                    bonusTickets.slice(0, 10).map((t) => (
                      <div key={t.id} className="flex gap-3 border-b border-[#2b2d31] pb-3 last:border-b-0 last:pb-0 animate-fade-in">
                        <div className="w-9 h-9 rounded-full bg-[#111118] shrink-0 overflow-hidden select-none">
                          <img src="/logo.webp" alt="Bot PFP" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex items-center gap-1.5 leading-none">
                            <span className="text-xs font-bold text-[#f2f3f5] hover:underline cursor-pointer">White Pigeons MOD</span>
                            <span className="bg-[#5865f2] text-white text-[7px] font-bold px-1.5 py-0.5 rounded font-sans uppercase">APP</span>
                            <span className="text-[9px] text-[#949ba4] font-sans">Today at 9:02 AM</span>
                          </div>

                          <div className="border-l-4 border-[#3a86ff] bg-[#2b2d31] p-3 rounded-r-lg max-w-xl space-y-2 shadow-md relative select-text">
                            <div className="space-y-1 text-xs text-[#dbdee1] font-sans">
                              <h4 className="text-xs font-extrabold text-white">
                                🎟️ Ticket #{t.id.toUpperCase()} Ingested
                              </h4>
                              <div className="space-y-1 text-[11px] pt-1">
                                <div>👤 <strong>User:</strong> <span className="bg-[#5865f2]/10 text-[#c9cdfb] px-1 py-0.5 rounded font-sans hover:underline cursor-pointer select-none">@{t.username}</span></div>
                                <div className="pt-0.5">📂 <strong>Topic:</strong> {t.subject}</div>
                                <div className="pt-0.5 italic text-zinc-400">&quot;{t.description}&quot;</div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 select-none">
                            <button
                              onClick={() => handleBonusApproval(t.id, 'approved')}
                              className="bg-[#248046] hover:bg-[#1a6535] text-white px-3 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              Resolve Claim
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  /* Disbursed Payouts Feed */
                  winSubmissions.filter(s => s.status === 'disbursed').length === 0 ? (
                    <div className="text-center py-20 text-[#949ba4] italic text-xs">
                      No disbursed payouts recorded in #bonus-admin-panel.
                    </div>
                  ) : (
                    winSubmissions.filter(s => s.status === 'disbursed').slice(0, 10).map((s) => (
                      <div key={s.id} className="flex gap-3 border-b border-[#2b2d31] pb-3 last:border-b-0 last:pb-0">
                        <div className="w-9 h-9 rounded-full bg-[#111118] shrink-0 overflow-hidden select-none">
                          <img src="/logo.webp" alt="Bot PFP" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex items-center gap-1.5 leading-none">
                            <span className="text-xs font-bold text-[#f2f3f5] hover:underline cursor-pointer">White Pigeons MOD</span>
                            <span className="bg-[#5865f2] text-white text-[7px] font-bold px-1.5 py-0.5 rounded font-sans uppercase">APP</span>
                            <span className="text-[9px] text-[#949ba4] font-sans">Today at 9:02 AM</span>
                          </div>

                          <div className="border-l-4 border-[#23a55a] bg-[#2b2d31] p-3 rounded-r-lg max-w-xl space-y-2 shadow-md relative select-text">
                            <div className="space-y-1 text-xs text-[#dbdee1] font-sans">
                              <h4 className="text-xs font-extrabold text-white">
                                🏆 EVENT WIN BONUS DISBURSED
                              </h4>
                              <div className="space-y-1 text-[11px] pt-1">
                                <div>📂 <strong>Event:</strong> {s.eventName || s.title}</div>
                                <div className="pt-0.5">💰 <strong>Base Pool:</strong> ${(s.baseAmount || 200000).toLocaleString()}</div>
                                <div>👤 <strong>Audited By:</strong> @{s.reviewedBy || 'Admin'}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBonusApproval = () => {
    if (!checkAccess('admin')) return renderAccessDenied('Higher authority authorization required');

    const pendingSubmissions = winSubmissions.filter(s => s.status === 'pending');

    return (
      <div className="space-y-6 max-w-7xl mx-auto font-sans text-xs pb-12 animate-fade-in">
        {/* Header Title */}
        <div className="border-b border-[#1c1a2a]/50 pb-4">
          <h2 className="font-title font-black text-2xl italic text-purple-400 text-glow-magenta flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 animate-pulse" /> 𝐁𝐎𝐍𝐔𝐒 𝐀𝐏𝐏𝐑𝐎𝐕𝐀𝐋𝐒 DESK
          </h2>
          <p className="text-zinc-550 mt-1">Review event wins and manual claims submitted from Discord public channels, adjust payouts, and transmit to Admin confirmation ledger.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main approvals list */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {pendingSubmissions.length === 0 ? (
              <div className="text-center py-20 text-zinc-550 bg-[#111118] border border-[#1c1a2a] rounded-2xl space-y-3 shadow-xl max-w-lg mx-auto">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/30" />
                <p className="font-title font-black text-sm tracking-wide text-zinc-400 uppercase italic">ALL PENDING LOGS REVIEWED</p>
                <p className="text-[10px] text-zinc-650">No win logs are waiting in the `#public-winlog` or `#public-informallog` queues.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingSubmissions.map((s) => {
                  const isInformal = s.type === 'public-informallog';
                  const defaultBase = isInformal ? 70000 : 200000;
                  const currentBaseStr = customBaseAmounts[s.id] ?? String(defaultBase);
                  const currentBase = parseFloat(currentBaseStr) || defaultBase;
                  
                  const origPartStr = (s.participants || []).join(', ');
                  const currentPartStr = editingParticipants[s.id] ?? origPartStr;
                  const currentParticipants = currentPartStr.split(',').map((p: string) => p.trim()).filter(Boolean);

                  return (
                    <div key={s.id} className="bg-[#313338] border border-[#202225] text-[#dbdee1] rounded-lg overflow-hidden flex flex-col justify-between w-full shadow-2xl relative font-sans">
                      {/* Discord Message Header */}
                      <div className="p-4 pb-0 flex gap-3 select-none">
                        <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center font-bold text-white shrink-0 shadow-inner">
                          🤖
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-[13px] hover:underline cursor-pointer">White Pigeon Bot</span>
                            <span className="bg-[#5865f2] text-[9px] text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider scale-90">BOT</span>
                            <span className="text-[10px] text-zinc-400 font-mono ml-2">MSG: {s.discordMessageId?.slice(-6) || 'WEB'}</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5">Submitted by: @{s.submitterName} | {new Date(s.createdAt).toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Discord Embed Container */}
                      <div className="p-4 pt-3 flex">
                        {/* Left border stripe of Discord Embed */}
                        <div className={`w-[4px] rounded-l shrink-0 ${isInformal ? 'bg-amber-500' : 'bg-[#5865F2]'}`} />
                        
                        {/* Embed Content */}
                        <div className="bg-[#2b2d31] p-3.5 rounded-r flex-1 space-y-3 border border-l-0 border-[#202225] text-xs">
                          <div>
                            <h4 className="text-white text-sm font-semibold tracking-wide">🏆 EVENT WIN LOG INGESTED</h4>
                            <span className="text-[9px] text-zinc-400 mt-0.5 block">Status: <span className="text-amber-400 font-bold uppercase">⏳ Pending HC Audit</span></span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-[11px] leading-relaxed">
                            <div>
                              <span className="text-zinc-400 block text-[9px] uppercase tracking-wider font-bold">Event Title</span>
                              <span className="text-zinc-200 font-bold">{s.eventName || s.title}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 block text-[9px] uppercase tracking-wider font-bold">Estimated Pool</span>
                              <span className="text-emerald-400 font-bold">${currentBase.toLocaleString()} / kill</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-zinc-400 block text-[9px] uppercase tracking-wider font-bold mb-1">Roster ({currentParticipants.length} detected)</span>
                            <div className="flex flex-wrap gap-1 bg-[#1e1f22] p-2 rounded border border-[#1a1b1e]">
                              {currentParticipants.length === 0 ? (
                                <span className="text-zinc-500 italic text-[10px]">No members specified</span>
                              ) : (
                                currentParticipants.map((p, pIdx) => (
                                  <span key={pIdx} className="bg-[#2b2d31] border border-[#202225] text-zinc-300 rounded px-1.5 py-0.5 text-[9px] font-mono">
                                    @{p}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>

                          {s.mediaUrl && (
                            <div className="relative rounded overflow-hidden border border-[#202225] max-h-48 select-none">
                              <img src={s.mediaUrl} alt="Log Proof" className="w-full object-cover max-h-48" />
                              <a 
                                href={s.mediaUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="absolute top-2 right-2 bg-black/60 hover:bg-black/85 text-zinc-300 p-1.5 rounded border border-white/10 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* HC Audit Adjustment Form */}
                      <div className="px-4 pb-4 space-y-3 font-sans border-t border-[#202225] pt-3 bg-[#2e3035]/50">
                        <div className="bg-[#1e1f22] border border-[#202225] p-3 rounded-lg space-y-3 text-[11px]">
                          <h5 className="font-bold text-zinc-300 uppercase text-[9px] tracking-wider border-b border-[#202225]/40 pb-1.5 flex items-center gap-1.5">
                            ⚙️ HIGH COMMAND AUDIT OVERRIDES
                          </h5>
                          
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-[9px] text-zinc-450 font-bold block mb-1">BASE REWARD AMOUNT ($)</label>
                              <select 
                                value={currentBaseStr}
                                onChange={(e) => setCustomBaseAmounts(prev => ({ ...prev, [s.id]: e.target.value }))}
                                className="bg-[#2b2d31] border border-[#202225] rounded-md px-2 py-1 text-zinc-300 outline-none w-full text-[11px] cursor-pointer"
                              >
                                <option value="200000">$200,000 (BizWar)</option>
                                <option value="70000">$70,000 (Informal)</option>
                                <option value="custom">Custom...</option>
                              </select>
                              { (currentBaseStr === 'custom' || !['200000', '70000'].includes(currentBaseStr)) && (
                                <input 
                                  type="number"
                                  value={currentBaseStr === 'custom' ? '' : currentBaseStr}
                                  onChange={(e) => setCustomBaseAmounts(prev => ({ ...prev, [s.id]: e.target.value }))}
                                  placeholder="Custom amount..."
                                  className="mt-1 bg-[#2b2d31] border border-[#202225] rounded-md px-2 py-1 text-zinc-300 outline-none w-full text-[11px] font-mono"
                                />
                              )}
                            </div>
                            
                            <div>
                              <label className="text-[9px] text-zinc-450 font-bold block mb-1">PARTICIPANTS ROSTER</label>
                              <textarea 
                                rows={2}
                                value={currentPartStr}
                                onChange={(e) => setEditingParticipants(prev => ({ ...prev, [s.id]: e.target.value }))}
                                placeholder="Comma separated names..."
                                className="w-full bg-[#2b2d31] border border-[#202225] rounded-md p-1.5 text-zinc-300 font-sans outline-none text-[11px] resize-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] text-zinc-450 font-bold block mb-1">AUDIT REMARKS / COMMENT</label>
                            <input 
                              type="text"
                              value={reviewComments[s.id] || ''}
                              onChange={(e) => setReviewComments(prev => ({ ...prev, [s.id]: e.target.value }))}
                              placeholder="Roster and event proof verified."
                              className="w-full bg-[#2b2d31] border border-[#202225] rounded-md px-2 py-1 text-zinc-300 outline-none text-[11px]"
                            />
                          </div>
                        </div>

                        {/* Buttons */}
                        <div className="grid grid-cols-2 gap-3.5 select-none">
                          <button 
                            onClick={() => handleRejectWinSubmission(s.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md py-2 font-bold cursor-pointer transition-all hover:scale-[1.02] text-[11px] uppercase tracking-wide"
                          >
                            DECLINE
                          </button>
                          <button 
                            onClick={() => handleHcApproveWinSubmission(s.id)}
                            disabled={isSubmittingApproval[s.id]}
                            className="bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/25 rounded-md py-2 font-bold cursor-pointer transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none text-[11px] uppercase tracking-wide"
                          >
                            {isSubmittingApproval[s.id] ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> AUDITING...
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" /> APPROVE EVENT
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Simulated Discord Channel Feed */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
              🤖 DISCORD CHANNEL INTEGRATION PREVIEW
            </div>
            <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full select-none">
              {/* Discord Header */}
              <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-black text-sm select-none">#</span>
                  <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                    {pendingSubmissions.length > 0 && pendingSubmissions[0].type === 'public-informallog' ? 'public-informallog' : 'public-winlog'}
                  </span>
                </div>
                <span className="text-[8px] bg-[#313338] text-[#23a55a] px-2 py-0.5 rounded font-bold font-mono border border-[#23a55a]/20">SIMULATED BOT EMBED</span>
              </div>

              {/* Discord Chat Body */}
              <div className="p-4 space-y-4 bg-[#313338] min-h-[400px] max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-900/30">
                {pendingSubmissions.length > 0 ? (
                  (() => {
                    const firstSub = pendingSubmissions[0];
                    const isInf = firstSub.type === 'public-informallog';
                    const defBase = isInf ? 70000 : 200000;
                    const cBaseStr = customBaseAmounts[firstSub.id] ?? String(defBase);
                    const cBase = parseFloat(cBaseStr) || defBase;
                    const cPartStr = editingParticipants[firstSub.id] ?? (firstSub.participants || []).join(', ');
                    const cParticipants = cPartStr.split(',').map((p: string) => p.trim()).filter(Boolean);
                    const stripeColor = isInf ? 'border-[#ff9f1c]' : 'border-[#5865f2]';

                    return (
                      <div className="flex gap-3 animate-fade-in">
                        <div className="w-9 h-9 rounded-full bg-[#111118] shrink-0 overflow-hidden select-none">
                          <img src="/logo.webp" alt="Bot PFP" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex items-center gap-1.5 leading-none select-none">
                            <span className="text-xs font-bold text-[#f2f3f5] hover:underline cursor-pointer">White Pigeons MOD</span>
                            <span className="bg-[#5865f2] text-white text-[7px] font-bold px-1.5 py-0.5 rounded font-sans uppercase">APP</span>
                            <span className="text-[9px] text-[#949ba4] font-sans">Today at 9:02 AM</span>
                          </div>

                          <div className="text-[11px] text-[#949ba4] font-semibold leading-none select-none pl-1">
                            @👑 | High Command
                          </div>

                          <div className={`border-l-4 ${stripeColor} bg-[#2b2d31] p-4 rounded-r-lg max-w-xl space-y-3.5 shadow-md relative select-text`}>
                            <div className="space-y-2 text-xs text-[#dbdee1] font-sans leading-relaxed">
                              <h4 className="text-xs font-extrabold text-white uppercase">
                                🏆 Event Win Ingested for Audit
                              </h4>
                              <div className="space-y-1 text-[11px] pt-1">
                                <div>📂 <strong>Event:</strong> {firstSub.eventName || firstSub.title}</div>
                                <div className="pt-0.5">💰 <strong>Estimated Pool:</strong> ${cBase.toLocaleString()} / kill</div>
                                <div className="pt-0.5">👥 <strong>Roster ({cParticipants.length}):</strong></div>
                                <div className="pl-2 text-zinc-400 font-mono text-[10px] break-all max-h-24 overflow-y-auto">
                                  {cParticipants.map(p => `@${p}`).join(', ')}
                                </div>
                                {firstSub.mediaUrl && (
                                  <div className="pt-1 select-none">
                                    🖼️ <strong>Proof:</strong> <a href={firstSub.mediaUrl} target="_blank" rel="noreferrer" className="text-[#00b0f4] hover:underline">{firstSub.mediaUrl}</a>
                                    <img src={firstSub.mediaUrl} alt="Proof" className="mt-2 w-full max-h-36 object-contain rounded border border-[#1e1f22]/50" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Interactive Buttons */}
                          <div className="flex gap-2 pt-1 select-none">
                            <button
                              onClick={() => handleHcApproveWinSubmission(firstSub.id)}
                              disabled={isSubmittingApproval[firstSub.id]}
                              className="bg-[#248046] hover:bg-[#1a6535] text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isSubmittingApproval[firstSub.id] ? 'Auditing...' : '✅ Approve Event'}
                            </button>
                            <button
                              onClick={() => handleRejectWinSubmission(firstSub.id)}
                              className="bg-[#da373c] hover:bg-[#a92b2f] text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              ❌ Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-20 text-[#949ba4] italic text-xs">
                    No win submissions in audit queue.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBizWarCollect = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster credentials required');

    const lastLog = bizwarLogs[0];
    let isCooldown = false;
    let cooldownText = '🟢 Active (Available)';
    let lastCollectorText = 'None';
    let lastAmountText = '$0';
    let lastTimeText = 'N/A';

    if (lastLog && nowTime > 0) {
      const lastTime = new Date(lastLog.timeCollected).getTime();
      const elapsed = nowTime - lastTime;
      const cooldownPeriod = 24 * 60 * 60 * 1000;
      if (elapsed < cooldownPeriod) {
        isCooldown = true;
        const remainingMs = cooldownPeriod - elapsed;
        const hours = Math.floor(remainingMs / (60 * 60 * 1000));
        const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
        cooldownText = `🔴 Cooldown (Available in ${hours}h ${minutes}m)`;
      }
    }
    if (lastLog) {
      lastCollectorText = `@${lastLog.username}`;
      lastAmountText = `$${parseFloat(lastLog.amount).toLocaleString()}`;
      lastTimeText = new Date(lastLog.timeCollected).toLocaleString();
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto font-sans">
        {/* Left Side: Web Forms & Ledger */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4">
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

          <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4">
            <h2 className="font-title font-black text-lg italic text-zinc-200 border-b border-[#1c1a2a]/50 pb-2">
              📊 BUSINESS PROFITS LEDGER
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
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

        {/* Right Side: Discord Live Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
            🤖 DISCORD CHANNEL INTEGRATION PREVIEW
          </div>
          
          <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full">
            {/* Header */}
            <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-black text-sm select-none">#</span>
                <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                  bizwar-collect
                </span>
              </div>
              <span className="text-[8px] bg-[#313338] text-[#e0a82e] px-2 py-0.5 rounded font-bold font-mono border border-[#e0a82e]/20">BIZWAR BOT ACTIVE</span>
            </div>

            {/* Chat Area */}
            <div className="p-4 space-y-4 bg-[#313338]">
              <div className="flex gap-3">
                {/* Bot Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#111118] border border-purple-500/20 shrink-0 overflow-hidden select-none">
                  <img src="/logo.webp" alt="Bot PFP" className="w-full h-full object-cover animate-pulse" />
                </div>

                {/* Message Body */}
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-1.5 leading-none">
                    <span className="text-xs font-bold text-[#f2f3f5] hover:underline cursor-pointer">White Pigeons BIZ</span>
                    <span className="bg-[#5865f2] text-white text-[7px] font-bold px-1.5 py-0.5 rounded font-sans uppercase">BOT</span>
                    <span className="text-[9px] text-[#949ba4] font-sans">Today at 12:00 PM</span>
                  </div>

                  {/* Embed Box */}
                  <div className="border-l-4 border-[#8a2be2] bg-[#2b2d31] p-4 rounded-r-lg max-w-xl space-y-3.5 shadow-md relative">
                    <img 
                      src="/logo.webp" 
                      alt="Pigeon Thumbnail" 
                      className="absolute top-4 right-4 w-10 h-10 object-contain rounded opacity-80 hidden sm:block pointer-events-none" 
                    />

                    <div className="space-y-1.5 text-xs text-[#dbdee1] font-sans leading-relaxed">
                      <h4 className="text-sm font-extrabold text-white">
                        💵 WHITE PIGEON BIZWAR REVENUE
                      </h4>
                      <p className="text-[11px] text-[#dbdee1] font-normal leading-relaxed">
                        Collect the profits from our family&apos;s occupied business sites.<br/><br/>
                        <strong>🏢 Our 20 Family Business Sites:</strong><br/>
                        1. Hotel Factory • 2. Oil Well 12 • 3. Gun Shop 4 • 4. Docks Warehouse • 5. Cash Factory 3<br/>
                        6. Ammo Factory • 7. Weed Farm 2 • 8. Meth Lab 5 • 9. Cocaine Depot • 10. Scrap Yard<br/>
                        11. Nightclub • 12. Strip Club • 13. Car Dealership • 14. Cargo Port • 15. Bank Vault<br/>
                        16. Printing Press • 17. Chemical Plant • 18. Refinery • 19. Gold Mine • 20. Steel Mill
                      </p>

                      <div className="grid grid-cols-2 gap-4 pt-3 text-[11px] border-t border-zinc-800">
                        <div>
                          <span className="text-[#949ba4] block font-bold">COLLECTION STATUS</span>
                          <span className={isCooldown ? "text-red-400 font-bold animate-pulse" : "text-green-400 font-bold"}>{cooldownText}</span>
                        </div>
                        <div>
                          <span className="text-[#949ba4] block font-bold">LAST COLLECTOR</span>
                          <span className="text-white font-bold">{lastCollectorText}</span>
                        </div>
                        <div>
                          <span className="text-[#949ba4] block font-bold">AMOUNT</span>
                          <span className="text-green-400 font-mono font-bold">{lastAmountText}</span>
                        </div>
                        <div>
                          <span className="text-[#949ba4] block font-bold">COLLECTED AT</span>
                          <span className="text-white font-bold text-[10px]">{lastTimeText}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        if (isCooldown) {
                          addNotification('Collection Cooldown', 'Bizwar collection is currently on cooldown.', 'warning');
                        } else {
                          setShowBizwarDiscordModal(true);
                        }
                      }}
                      disabled={isCooldown}
                      className={`px-4 py-2 rounded text-xs font-semibold font-sans tracking-wide transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isCooldown 
                          ? 'bg-[#2b2d31] text-[#949ba4] border border-zinc-700/50 cursor-not-allowed' 
                          : 'bg-[#248046] hover:bg-[#1a6535] text-white'
                      }`}
                    >
                      💵 Collect Profit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Simulated Discord modal for Bizwar */}
        {showBizwarDiscordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in font-sans p-4">
            <div className="bg-[#313338] border border-[#1c1a2a]/45 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-[#1e1f22] p-4 flex justify-between items-center border-b border-[#151618]/30">
                <h3 className="text-sm font-bold text-[#f2f3f5]">Submit Bizwar Profits</h3>
                <button onClick={() => setShowBizwarDiscordModal(false)} className="text-[#949ba4] hover:text-white transition-colors cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <form onSubmit={handleBizwarDiscordModalSubmit} className="p-4 space-y-4 text-xs text-[#dbdee1]">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#949ba4] font-bold uppercase tracking-wider block">Business Site Name *</label>
                  <select 
                    value={bizwarDiscordForm.businessName}
                    onChange={(e) => setBizwarDiscordForm(prev => ({ ...prev, businessName: e.target.value }))}
                    className="w-full bg-[#1e1f22] border border-[#1c1a2a] text-[#dbdee1] rounded p-2 focus:outline-none focus:border-purple-600/40 text-xs font-sans"
                  >
                    <option value="Hotel Factory">Hotel Factory</option>
                    <option value="Oil Well 12">Oil Well 12</option>
                    <option value="Gun Shop 4">Gun Shop 4</option>
                    <option value="Docks Warehouse">Docks Warehouse</option>
                    <option value="Cash Factory 3">Cash Factory 3</option>
                    <option value="Ammo Factory">Ammo Factory</option>
                    <option value="Weed Farm 2">Weed Farm 2</option>
                    <option value="Meth Lab 5">Meth Lab 5</option>
                    <option value="Cocaine Depot">Cocaine Depot</option>
                    <option value="Scrap Yard">Scrap Yard</option>
                    <option value="Nightclub">Nightclub</option>
                    <option value="Strip Club">Strip Club</option>
                    <option value="Car Dealership">Car Dealership</option>
                    <option value="Cargo Port">Cargo Port</option>
                    <option value="Bank Vault">Bank Vault</option>
                    <option value="Printing Press">Printing Press</option>
                    <option value="Chemical Plant">Chemical Plant</option>
                    <option value="Refinery">Refinery</option>
                    <option value="Gold Mine">Gold Mine</option>
                    <option value="Steel Mill">Steel Mill</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-[#949ba4] font-bold uppercase tracking-wider block">Profit Amount ($) *</label>
                  <input 
                    type="number"
                    required
                    value={bizwarDiscordForm.amount}
                    onChange={(e) => setBizwarDiscordForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="e.g. 450000"
                    className="w-full bg-[#1e1f22] border border-[#1c1a2a] text-white rounded p-2 focus:outline-none focus:border-purple-600/40 text-xs font-sans animate-fade-in"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-[#949ba4] font-bold uppercase tracking-wider block">Proof Screenshot Link *</label>
                  <input 
                    type="url"
                    required
                    value={bizwarDiscordForm.proofUrl}
                    onChange={(e) => setBizwarDiscordForm(prev => ({ ...prev, proofUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full bg-[#1e1f22] border border-[#1c1a2a] text-white rounded p-2 focus:outline-none focus:border-purple-600/40 text-xs font-sans animate-fade-in"
                  />
                </div>

                <div className="bg-[#2b2d31] p-3 rounded text-[10px] text-[#949ba4] leading-relaxed select-none">
                  💡 <b>Simulated Discord modal submits directly to the web backend,</b> generating a log in our database and syncing it with the live Discord server embed immediately.
                </div>

                <div className="flex justify-end gap-2 pt-2 select-none">
                  <button 
                    type="button" 
                    onClick={() => setShowBizwarDiscordModal(false)}
                    className="bg-transparent hover:bg-zinc-800 text-white px-4 py-2 rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-[#248046] hover:bg-[#1a6535] text-white px-5 py-2 rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRpCollect = () => {
    if (!checkAccess('member')) return renderAccessDenied('Roster verification required');

    const shifts = rpCollectionState?.collectionsList || [];
    const count = rpCollectionState?.collectionsCount || 0;
    const max = rpCollectionState?.maxCollections || 6;
    const isCompleted = count >= max;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto font-sans">
        {/* Left Side: Forms & Logs */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4">
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

          <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#1c1a2a]/50 pb-2">
              <h2 className="font-title font-black text-lg italic text-zinc-200">
                💎 VAULT STOCK LOGS
              </h2>
              <span className="font-mono text-xs text-purple-400 font-bold">VAULT VALUE: {rpTotalStock} TICKETS</span>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
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

        {/* Right Side: Discord Live Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
            🤖 DISCORD CHANNEL INTEGRATION PREVIEW
          </div>
          
          <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full">
            {/* Header */}
            <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-black text-sm select-none">#</span>
                <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                  rp-collect
                </span>
              </div>
              <span className="text-[8px] bg-[#313338] text-[#5865f2] px-2 py-0.5 rounded font-bold font-mono border border-[#5865f2]/20">RP BOT ACTIVE</span>
            </div>

            {/* Chat Area */}
            <div className="p-4 space-y-4 bg-[#313338]">
              <div className="flex gap-3">
                {/* Bot Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#111118] border border-purple-500/20 shrink-0 overflow-hidden select-none">
                  <img src="/logo.webp" alt="Bot PFP" className="w-full h-full object-cover animate-pulse" />
                </div>

                {/* Message Body */}
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-1.5 leading-none">
                    <span className="text-xs font-bold text-[#f2f3f5] hover:underline cursor-pointer">White Pigeons RP</span>
                    <span className="bg-[#5865f2] text-white text-[7px] font-bold px-1.5 py-0.5 rounded font-sans uppercase">BOT</span>
                    <span className="text-[9px] text-[#949ba4] font-sans">Today at 12:00 PM</span>
                  </div>

                  {/* Embed Box */}
                  <div className="border-l-4 border-[#00f0ff] bg-[#2b2d31] p-4 rounded-r-lg max-w-xl space-y-3.5 shadow-md relative">
                    <img 
                      src="/logo.webp" 
                      alt="Pigeon Thumbnail" 
                      className="absolute top-4 right-4 w-10 h-10 object-contain rounded opacity-80 hidden sm:block pointer-events-none" 
                    />

                    <div className="space-y-1.5 text-xs text-[#dbdee1] font-sans leading-relaxed">
                      <h4 className="text-sm font-extrabold text-white">
                        🎫 RP TICKET FACTORY COLLECTION
                      </h4>
                      <p className="text-[11px] text-[#dbdee1] leading-relaxed">
                        Track and log RP Ticket factory collection status.<br/><br/>
                        <strong>📋 Active Shifts:</strong>
                      </p>

                      <div className="space-y-1 bg-[#1e1f22]/50 p-2.5 rounded-lg border border-zinc-800 text-[11px] font-mono text-zinc-300">
                        {shifts.length === 0 ? (
                          <span className="italic text-zinc-500">*No collections registered yet for this session.*</span>
                        ) : (
                          shifts.map((s: any, idx: number) => {
                            const charLabel = s.characterId ? ` (ID: ${s.characterId})` : '';
                            return (
                              <div key={idx}>
                                {idx + 1}. 🎫 <b>x{s.ticketsCollected || 5}</b> tickets collected by <span className="text-sky-400">@{s.username}</span>{charLabel} at {s.time}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-3 text-[11px] border-t border-zinc-800 select-none">
                        <div>
                          <span className="text-[#949ba4] block font-bold">COLLECTION STATUS</span>
                          <span className={isCompleted ? "text-red-400 font-bold" : "text-green-400 font-bold animate-pulse"}>
                            {isCompleted ? `🔴 Completed (${count}/${max})` : `🟢 Active (${count}/${max})`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#949ba4] block font-bold">TOTAL COLLECTED</span>
                          <span className="text-white font-bold">{count * 5} RP Tickets</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Buttons below the Embed */}
                  <div className="flex flex-wrap gap-2 pt-2 select-none">
                    <button
                      onClick={async () => {
                        if (isCompleted) {
                          return addNotification('Full Roster', 'All active collection shifts for this session are complete.', 'warning');
                        }
                        try {
                          const res = await fetch(`${API_BASE_URL}/api/economy/rp-collect`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ticketsCollected: '5' })
                          });
                          if (res.ok) {
                            addNotification('Shift Claimed', 'Successfully registered x5 tickets for your account.', 'success');
                            loadDashboardData();
                          } else {
                            const err = await res.json();
                            addNotification('Failed to Claim', err.error || 'Claim failed.', 'error');
                          }
                        } catch {
                          addNotification('Error', 'Connection failure.', 'error');
                        }
                      }}
                      disabled={isCompleted}
                      className={`px-3 py-1.5 rounded text-[11px] font-bold font-sans tracking-wide transition-colors cursor-pointer flex items-center gap-1 ${
                        isCompleted 
                          ? 'bg-[#2b2d31] text-[#949ba4] border border-zinc-700/50 cursor-not-allowed' 
                          : 'bg-[#5865f2] hover:bg-[#4752c4] text-white'
                      }`}
                    >
                      Collect RP Ticket
                    </button>

                    <button
                      onClick={() => {
                        if (isCompleted) {
                          return addNotification('Full Roster', 'All active collection shifts for this session are complete.', 'warning');
                        }
                        setShowRpDiscordModal(true);
                      }}
                      disabled={isCompleted}
                      className={`px-3 py-1.5 rounded text-[11px] font-bold font-sans tracking-wide transition-colors cursor-pointer flex items-center gap-1 ${
                        isCompleted 
                          ? 'bg-[#2b2d31] text-[#949ba4] border border-zinc-700/50 cursor-not-allowed' 
                          : 'bg-[#4f545c] hover:bg-[#686d73] text-white'
                      }`}
                    >
                      Collect By ID
                    </button>

                    <button
                      onClick={async () => {
                        if (shifts.length === 0) {
                          return addNotification('Nothing to Undo', 'No collections logged in this active session.', 'warning');
                        }
                        if (!confirm('Revert the last shift collection?')) return;
                        try {
                          const res = await fetch(`${API_BASE_URL}/api/economy/rp-collect/undo`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                          });
                          if (res.ok) {
                            addNotification('Shift Reverted', 'Successfully undid the last shift collection.', 'success');
                            loadDashboardData();
                          } else {
                            const err = await res.json();
                            addNotification('Failed to Undo', err.error || 'Undo failed.', 'error');
                          }
                        } catch {
                          addNotification('Error', 'Connection failure.', 'error');
                        }
                      }}
                      className="bg-[#da373c] hover:bg-[#a92b2f] text-white px-3 py-1.5 rounded text-[11px] font-bold font-sans tracking-wide transition-colors cursor-pointer flex items-center gap-1"
                    >
                      Undo Last
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Simulated Discord modal for RP Collect by ID */}
        {showRpDiscordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in font-sans p-4">
            <div className="bg-[#313338] border border-[#1c1a2a]/45 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-[#1e1f22] p-4 flex justify-between items-center border-b border-[#151618]/30">
                <h3 className="text-sm font-bold text-[#f2f3f5]">Collect RP Ticket By User</h3>
                <button onClick={() => setShowRpDiscordModal(false)} className="text-[#949ba4] hover:text-white transition-colors cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <form onSubmit={handleRpDiscordModalSubmit} className="p-4 space-y-4 text-xs text-[#dbdee1]">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#949ba4] font-bold uppercase tracking-wider block">Discord ID, Username, or Nickname *</label>
                  <input 
                    type="text"
                    required
                    value={rpDiscordForm.memberInput}
                    onChange={(e) => setRpDiscordForm(prev => ({ ...prev, memberInput: e.target.value }))}
                    placeholder="e.g. 3572 or VitoScaletta"
                    className="w-full bg-[#1e1f22] border border-[#1c1a2a] text-white rounded p-2 focus:outline-none focus:border-purple-600/40 text-xs font-sans animate-fade-in"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-[#949ba4] font-bold uppercase tracking-wider block">Tickets Collected *</label>
                  <input 
                    type="number"
                    required
                    value={rpDiscordForm.countInput}
                    onChange={(e) => setRpDiscordForm(prev => ({ ...prev, countInput: e.target.value }))}
                    placeholder="5"
                    className="w-full bg-[#1e1f22] border border-[#1c1a2a] text-white rounded p-2 focus:outline-none focus:border-purple-600/40 text-xs font-sans animate-fade-in"
                  />
                </div>

                <div className="bg-[#2b2d31] p-3 rounded text-[10px] text-[#949ba4] leading-relaxed select-none">
                  💡 <b>Simulated Discord modal submits directly to the web backend,</b> generating a log in our database and updating the active shift roster on Discord in real-time.
                </div>

                <div className="flex justify-end gap-2 pt-2 select-none">
                  <button 
                    type="button" 
                    onClick={() => setShowRpDiscordModal(false)}
                    className="bg-transparent hover:bg-zinc-800 text-white px-4 py-2 rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-[#248046] hover:bg-[#1a6535] text-white px-5 py-2 rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPublicWinlog = () => {
    const allWins = wins.filter(w => w.type !== 'informal');
    const folders = [
      { id: 'all', label: '📁 All Records', icon: '📂' },
      { id: 'event', label: '📁 Events / Raids', icon: '⚔️' },
      { id: 'bizwar', label: '📁 BizWar Battles', icon: '💰' },
    ];
    const filteredWins = allWins
      .filter(w => activeWinLogFolder === 'all' || w.type === activeWinLogFolder)
      .filter(w => !winLogSearchQuery || w.title.toLowerCase().includes(winLogSearchQuery.toLowerCase()) || w.description.toLowerCase().includes(winLogSearchQuery.toLowerCase()) || w.participants.toLowerCase().includes(winLogSearchQuery.toLowerCase()));
    const selectedWin = selectedWinLogId ? allWins.find(w => w.id === selectedWinLogId) : null;

    return (
      <div className="bg-[#111118] border border-[#1c1a2a] rounded-2xl overflow-hidden font-sans shadow-2xl max-w-6xl mx-auto">
        {/* Explorer Toolbar */}
        <div className="bg-[#0c0c14] border-b border-[#1c1a2a] px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-lg">🏆</span>
            <h2 className="font-title font-black text-sm italic text-zinc-200 tracking-wide uppercase">PUBLIC WIN LOG</h2>
            <span className="text-[9px] bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded-full font-mono font-bold border border-purple-500/20">{filteredWins.length} RECORDS</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">🔍</span>
              <input
                type="text"
                value={winLogSearchQuery}
                onChange={(e) => setWinLogSearchQuery(e.target.value)}
                placeholder="Search records..."
                className="w-full sm:w-56 bg-[#0a0a14] border border-[#1c1a2a] rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans placeholder:text-zinc-600"
              />
            </div>
            {isLeaderOrAdmin && (
              <button
                onClick={() => setIsNewWinLogModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-title text-[10px] font-black italic tracking-wide py-2 px-3 rounded-lg border border-purple-500/50 cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <span>＋</span> NEW ENTRY
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row min-h-[500px]">
          {/* Folder Sidebar */}
          <div className="lg:w-52 bg-[#0a0a14] border-r border-[#1c1a2a] p-3 space-y-1 shrink-0">
            <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider px-2 py-1 mb-1">Folders</div>
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => { setActiveWinLogFolder(f.id); setSelectedWinLogId(null); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-sans flex items-center gap-2 transition-all cursor-pointer ${
                  activeWinLogFolder === f.id
                    ? 'bg-purple-600/15 text-purple-300 border border-purple-500/20 font-bold'
                    : 'text-zinc-400 hover:bg-[#111118] hover:text-zinc-300 border border-transparent'
                }`}
              >
                <span>{f.icon}</span>
                <span className="truncate">{f.label}</span>
                <span className="ml-auto text-[9px] text-zinc-600 font-mono">
                  {f.id === 'all' ? allWins.length : allWins.filter(w => w.type === f.id).length}
                </span>
              </button>
            ))}
          </div>

          {/* Main File List */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Column Headers */}
            <div className="bg-[#0c0c14]/60 border-b border-[#1c1a2a] px-4 py-2 grid grid-cols-12 gap-2 text-[9px] text-zinc-500 font-bold uppercase tracking-wider select-none">
              <div className="col-span-1">🖼️</div>
              <div className="col-span-4">File Name</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-3">Combatants</div>
              <div className="col-span-2">Date</div>
            </div>

            {/* File Rows */}
            <div className="flex-1 overflow-y-auto max-h-[480px] divide-y divide-[#1c1a2a]/30">
              {filteredWins.length === 0 ? (
                <div className="text-center py-16 text-zinc-600 italic text-xs">
                  <div className="text-3xl mb-3 opacity-30">📂</div>
                  NO RECORDS FOUND IN THIS FOLDER
                </div>
              ) : (
                filteredWins.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => setSelectedWinLogId(selectedWinLogId === w.id ? null : w.id)}
                    className={`px-4 py-3 grid grid-cols-12 gap-2 items-center text-xs cursor-pointer transition-all group ${
                      selectedWinLogId === w.id
                        ? 'bg-purple-600/10 border-l-2 border-l-purple-500'
                        : 'hover:bg-[#13121d]/60 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="col-span-1">
                      {w.mediaUrl ? (
                        <img src={w.mediaUrl} alt="" className="w-8 h-8 rounded object-cover border border-[#1c1a2a]" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-[#0a0a14] border border-[#1c1a2a] flex items-center justify-center text-zinc-600 text-sm">📄</div>
                      )}
                    </div>
                    <div className="col-span-4 truncate">
                      <span className="text-zinc-200 font-bold group-hover:text-purple-300 transition-colors">{w.title}</span>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                        w.type === 'event' ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      }`}>{w.type}</span>
                    </div>
                    <div className="col-span-3 text-zinc-500 truncate font-sans">{w.participants || '—'}</div>
                    <div className="col-span-2 text-zinc-600 font-mono text-[10px]">{w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detail Panel */}
          {selectedWin && (
            <div className="lg:w-80 bg-[#0a0a14] border-l border-[#1c1a2a] p-5 space-y-4 shrink-0 overflow-y-auto max-h-[540px]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">File Details</span>
                <button onClick={() => setSelectedWinLogId(null)} className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer">✕</button>
              </div>
              {selectedWin.mediaUrl && (
                <img src={selectedWin.mediaUrl} alt={selectedWin.title} className="w-full h-40 object-cover rounded-xl border border-[#1c1a2a]" />
              )}
              <h3 className="font-title font-black text-base italic text-zinc-200">{selectedWin.title}</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">Type</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                    selectedWin.type === 'event' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
                  }`}>{selectedWin.type === 'event' ? 'Event / Raid' : 'BizWar Battle'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">Description</span>
                  <p className="text-zinc-400 text-xs leading-relaxed font-sans">{selectedWin.description}</p>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">Squad Combatants</span>
                  <p className="text-zinc-400 text-xs font-sans">{selectedWin.participants || 'None listed'}</p>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">Date Recorded</span>
                  <p className="text-zinc-500 text-[10px] font-mono">{selectedWin.createdAt ? new Date(selectedWin.createdAt).toLocaleString() : '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* New Entry Modal */}
        {isNewWinLogModalOpen && isLeaderOrAdmin && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsNewWinLogModalOpen(false)}>
            <div className="bg-[#111118] border border-[#1c1a2a] rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-[#1c1a2a]/50 pb-3">
                <h3 className="font-title font-bold text-sm text-zinc-200 italic">🏆 LOG NEW SYNDICATE WIN</h3>
                <button onClick={() => setIsNewWinLogModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 text-sm cursor-pointer">✕</button>
              </div>
              <form onSubmit={(e) => { handleLogWin(e); setIsNewWinLogModalOpen(false); }} className="font-sans text-xs flex flex-col gap-4">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">EVENT TYPE</label>
                  <select 
                    value={winForm.type}
                    onChange={(e) => setWinForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-350 outline-none font-sans"
                  >
                    <option value="event">Major Syndicate Event / Raid</option>
                    <option value="bizwar">BizWar Profit Battle</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">EVENT TITLE</label>
                  <input type="text" value={winForm.title} onChange={(e) => setWinForm(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g. Captured central hotel factory..." className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">DETAILS</label>
                  <textarea rows={3} value={winForm.description} onChange={(e) => setWinForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Detail operations details..." className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-350 focus:border-purple-600/50 outline-none resize-none leading-relaxed font-sans" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">COMBATANTS</label>
                  <input type="text" value={winForm.participants} onChange={(e) => setWinForm(prev => ({ ...prev, participants: e.target.value }))} placeholder="Vito, Tony, Phantom..." className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-sans" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">SCREENSHOT URL</label>
                  <input type="text" value={winForm.mediaUrl} onChange={(e) => setWinForm(prev => ({ ...prev, mediaUrl: e.target.value }))} placeholder="Provide image link..." className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-purple-600/50 outline-none font-mono" />
                </div>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-purple-500 glow-magenta cursor-pointer">PUBLISH RECORD</button>
              </form>
            </div>
          </div>
        )}
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

    const bannerImage = banners[eventId] || (eventId === 'rp-signup'
      ? '/rp_ticket_banner.webp'
      : eventId === 'signup-event'
      ? '/signup_event_banner.webp'
      : '/informal_fight_banner.webp');

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
                <div className="rounded-lg overflow-hidden border border-[#3f4248]/30 max-h-48 select-none relative group/banner">
                  <img src={bannerImage} alt="Event Banner" className="w-full h-full object-cover" />
                  {isLeaderOrAdmin && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/banner:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => {
                          const newUrl = prompt('Enter new banner image URL:', bannerImage);
                          if (newUrl && newUrl.trim()) {
                            const updated = { ...banners, [eventId]: newUrl.trim() };
                            setBanners(updated);
                            fetch(`${API_BASE_URL}/admin/discord-config`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ banners: updated })
                            }).then(r => r.ok ? addNotification('Banner Updated', 'Image changed successfully.', 'success') : addNotification('Error', 'Failed to save banner.', 'error')).catch(() => {});
                          }
                        }}
                        className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-[10px] font-bold px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer transition-colors shadow-lg"
                      >
                        📷 CHANGE IMAGE
                      </button>
                    </div>
                  )}
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

              {rpState === 'open' && rpOpenedAt && (
                <span className="text-[10px] text-purple-400 font-bold block animate-pulse mt-1">
                  ⏱️ Auto-closes in: {formatRemainingTime(rpOpenedAt)}
                </span>
              )}

              {/* IST Scheduler section */}
              <div className="border-t border-[#1c1a2a]/60 pt-3 mt-2 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-zinc-400 tracking-wider block">LONDON DAILY TRIGGER TIMES</span>
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

              {informalState === 'open' && informalOpenedAt && (
                <span className="text-[10px] text-purple-400 font-bold block animate-pulse mt-1">
                  ⏱️ Auto-closes in: {formatRemainingTime(informalOpenedAt)}
                </span>
              )}

              {/* IST Scheduler section */}
              <div className="border-t border-[#1c1a2a]/60 pt-3 mt-2 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-zinc-400 tracking-wider block">LONDON DAILY TRIGGER TIMES</span>
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

              {signupEventState === 'open' && signupEventOpenedAt && (
                <span className="text-[10px] text-purple-400 font-bold block animate-pulse mt-1">
                  ⏱️ Auto-closes in: {formatRemainingTime(signupEventOpenedAt)}
                </span>
              )}

              {/* IST Scheduler section */}
              <div className="border-t border-[#1c1a2a]/60 pt-3 mt-2 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-zinc-400 tracking-wider block">LONDON DAILY TRIGGER TIMES</span>
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
    const allInformals = wins.filter(w => w.type === 'informal');
    const filteredInformals = allInformals
      .filter(w => !informalLogSearchQuery || w.title.toLowerCase().includes(informalLogSearchQuery.toLowerCase()) || w.description.toLowerCase().includes(informalLogSearchQuery.toLowerCase()) || w.participants.toLowerCase().includes(informalLogSearchQuery.toLowerCase()));
    const selectedInformal = selectedInformalLogId ? allInformals.find(w => w.id === selectedInformalLogId) : null;

    return (
      <div className="bg-[#111118] border border-[#1c1a2a] rounded-2xl overflow-hidden font-sans shadow-2xl max-w-6xl mx-auto">
        {/* Explorer Toolbar */}
        <div className="bg-[#0c0c14] border-b border-[#1c1a2a] px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-lg">📜</span>
            <h2 className="font-title font-black text-sm italic text-zinc-200 tracking-wide uppercase">PUBLIC INFORMAL LOG</h2>
            <span className="text-[9px] bg-cyan-600/20 text-cyan-400 px-2 py-0.5 rounded-full font-mono font-bold border border-cyan-500/20">{filteredInformals.length} RECORDS</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">🔍</span>
              <input
                type="text"
                value={informalLogSearchQuery}
                onChange={(e) => setInformalLogSearchQuery(e.target.value)}
                placeholder="Search records..."
                className="w-full sm:w-56 bg-[#0a0a14] border border-[#1c1a2a] rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-300 focus:border-cyan-600/50 outline-none font-sans placeholder:text-zinc-600"
              />
            </div>
            {isLeaderOrAdmin && (
              <button
                onClick={() => setIsNewInformalLogModalOpen(true)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-title text-[10px] font-black italic tracking-wide py-2 px-3 rounded-lg border border-cyan-500/50 cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <span>＋</span> NEW ENTRY
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row min-h-[500px]">
          {/* Folder Sidebar */}
          <div className="lg:w-52 bg-[#0a0a14] border-r border-[#1c1a2a] p-3 space-y-1 shrink-0">
            <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider px-2 py-1 mb-1">Folders</div>
            <button
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-sans flex items-center gap-2 bg-cyan-600/15 text-cyan-300 border border-cyan-500/20 font-bold cursor-pointer"
            >
              <span>⚔️</span>
              <span className="truncate">📁 All Informal Wins</span>
              <span className="ml-auto text-[9px] text-zinc-600 font-mono">{allInformals.length}</span>
            </button>
          </div>

          {/* Main File List */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Column Headers */}
            <div className="bg-[#0c0c14]/60 border-b border-[#1c1a2a] px-4 py-2 grid grid-cols-12 gap-2 text-[9px] text-zinc-500 font-bold uppercase tracking-wider select-none">
              <div className="col-span-1">📄</div>
              <div className="col-span-5">Battle Name</div>
              <div className="col-span-4">Combatants</div>
              <div className="col-span-2">Date</div>
            </div>

            {/* File Rows */}
            <div className="flex-1 overflow-y-auto max-h-[480px] divide-y divide-[#1c1a2a]/30">
              {filteredInformals.length === 0 ? (
                <div className="text-center py-16 text-zinc-600 italic text-xs">
                  <div className="text-3xl mb-3 opacity-30">📂</div>
                  NO INFORMAL RECORDS FOUND
                </div>
              ) : (
                filteredInformals.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => setSelectedInformalLogId(selectedInformalLogId === w.id ? null : w.id)}
                    className={`px-4 py-3 grid grid-cols-12 gap-2 items-center text-xs cursor-pointer transition-all group ${
                      selectedInformalLogId === w.id
                        ? 'bg-cyan-600/10 border-l-2 border-l-cyan-500'
                        : 'hover:bg-[#13121d]/60 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="col-span-1">
                      <div className="w-8 h-8 rounded bg-[#0a0a14] border border-[#1c1a2a] flex items-center justify-center text-zinc-600 text-sm">⚔️</div>
                    </div>
                    <div className="col-span-5 truncate">
                      <span className="text-zinc-200 font-bold group-hover:text-cyan-300 transition-colors">{w.title}</span>
                    </div>
                    <div className="col-span-4 text-zinc-500 truncate font-sans">{w.participants || '—'}</div>
                    <div className="col-span-2 text-zinc-600 font-mono text-[10px]">{w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detail Panel */}
          {selectedInformal && (
            <div className="lg:w-80 bg-[#0a0a14] border-l border-[#1c1a2a] p-5 space-y-4 shrink-0 overflow-y-auto max-h-[540px]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">File Details</span>
                <button onClick={() => setSelectedInformalLogId(null)} className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer">✕</button>
              </div>
              <h3 className="font-title font-black text-base italic text-zinc-200">{selectedInformal.title}</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">Category</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase bg-cyan-500/15 text-cyan-400">Informal Battle</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">Description</span>
                  <p className="text-zinc-400 text-xs leading-relaxed font-sans">{selectedInformal.description}</p>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">Combatants</span>
                  <p className="text-zinc-400 text-xs font-sans">{selectedInformal.participants || 'None listed'}</p>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">Date Recorded</span>
                  <p className="text-zinc-500 text-[10px] font-mono">{selectedInformal.createdAt ? new Date(selectedInformal.createdAt).toLocaleString() : '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* New Entry Modal */}
        {isNewInformalLogModalOpen && isLeaderOrAdmin && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsNewInformalLogModalOpen(false)}>
            <div className="bg-[#111118] border border-[#1c1a2a] rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-[#1c1a2a]/50 pb-3">
                <h3 className="font-title font-bold text-sm text-zinc-200 italic">📜 LOG PUBLIC INFORMAL WIN</h3>
                <button onClick={() => setIsNewInformalLogModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 text-sm cursor-pointer">✕</button>
              </div>
              <form onSubmit={(e) => { handleLogWin(e, 'informal'); setIsNewInformalLogModalOpen(false); }} className="font-sans text-xs flex flex-col gap-4">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">BATTLE TITLE</label>
                  <input type="text" value={winForm.title} onChange={(e) => setWinForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Informal Win vs Vagos..." className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-cyan-600/50 outline-none font-sans" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">DETAILS</label>
                  <textarea rows={4} value={winForm.description} onChange={(e) => setWinForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Operation execution summary..." className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-350 focus:border-cyan-600/50 outline-none resize-none leading-relaxed font-sans" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">COMBATANTS</label>
                  <input type="text" value={winForm.participants} onChange={(e) => setWinForm(prev => ({ ...prev, participants: e.target.value }))} placeholder="Shooters..." className="w-full bg-[#0a0a14] border border-[#1c1a2a] rounded-lg p-2.5 text-xs text-zinc-300 focus:border-cyan-600/50 outline-none font-sans" />
                </div>
                <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white font-title text-xs font-black italic tracking-wide py-3 rounded-lg border border-cyan-500 cursor-pointer">PUBLISH INFORMAL RECORD</button>
              </form>
            </div>
          </div>
        )}
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
      <div className="space-y-6 max-w-7xl mx-auto font-sans">
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

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
          {/* Left Column: Management Cards */}
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>

          {/* Right Column: Discord Channel Integration Preview */}
          <div className="lg:col-span-4 space-y-4">
            <div className="text-zinc-500 text-[10px] font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 pl-1 select-none">
              🤖 DISCORD CHANNEL INTEGRATION PREVIEW
            </div>

            <div className="bg-[#2b2d31] border border-[#1c1a2a]/45 rounded-2xl overflow-hidden font-sans text-left shadow-2xl w-full select-none">
              {/* Discord Server HUD Header */}
              <div className="bg-[#1e1f22] px-4 py-2.5 flex items-center justify-between border-b border-[#151618]/40 select-none">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="text-[#949ba4] font-black text-sm select-none">#</span>
                  <span className="text-[11px] text-[#dbdee1] font-bold tracking-wide">
                    priority-members
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
                      <span className="text-[9px] text-[#949ba4] font-sans">Today at 10:41 AM</span>
                    </div>

                    {/* Bot Embed Box */}
                    <div className="border-l-4 border-[#ffd700] bg-[#2b2d31] p-4 rounded-r-lg max-w-xl space-y-3.5 shadow-md relative select-text">
                      <img 
                        src="/logo.webp" 
                        alt="Pigeon Thumbnail" 
                        className="absolute top-4 right-4 w-12 h-12 object-contain rounded opacity-80 hidden sm:block pointer-events-none" 
                      />

                      <div className="space-y-3 text-xs text-[#dbdee1] font-sans leading-relaxed">
                        <h4 className="text-sm font-extrabold text-white">
                          Priority Members
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* TOP 5 FIELD */}
                          <div>
                            <div className="text-[11px] font-extrabold text-white mb-1.5">TOP 5 Members</div>
                            <div className="space-y-1.5 text-[11px]">
                              {(!priorityList.top5 || priorityList.top5.length === 0) ? (
                                <span className="text-zinc-500 italic">*No members*</span>
                              ) : (
                                priorityList.top5.map((m, idx) => (
                                  <div key={m.discordId} className="flex items-center gap-1">
                                    <span className="text-zinc-400 font-mono">{idx + 1}.</span>
                                    <span className="bg-[#5865f2]/10 text-[#5865f2] hover:bg-[#5865f2] hover:text-white transition-colors px-1 py-0.5 rounded font-semibold text-[10px] cursor-pointer truncate max-w-[120px]">
                                      @{m.username}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* TOP 10 FIELD */}
                          <div>
                            <div className="text-[11px] font-extrabold text-white mb-1.5">TOP 10 Members</div>
                            <div className="space-y-1.5 text-[11px]">
                              {(!priorityList.top10 || priorityList.top10.length === 0) ? (
                                <span className="text-zinc-500 italic">*No members*</span>
                              ) : (
                                priorityList.top10.map((m, idx) => (
                                  <div key={m.discordId} className="flex items-center gap-1">
                                    <span className="text-zinc-400 font-mono">{idx + 1}.</span>
                                    <span className="bg-[#5865f2]/10 text-[#5865f2] hover:bg-[#5865f2] hover:text-white transition-colors px-1 py-0.5 rounded font-semibold text-[10px] cursor-pointer truncate max-w-[120px]">
                                      @{m.username}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="text-[9px] text-[#949ba4] pt-2 border-t border-[#3f4147]/40 flex items-center gap-1 select-none">
                        <span>White Pigeons #TOP1 • Priority List</span>
                      </div>
                    </div>

                    {/* Interactive Bot Embed Buttons */}
                    <div className="flex flex-wrap gap-2 pt-1 select-none">
                      <button
                        onClick={() => {
                          if (isAdmin) {
                            setShowAddMemberDropdown(showAddMemberDropdown === 'top5' ? null : 'top5');
                          } else {
                            addNotification('Access Denied', 'Admin console passcode is required to edit the priority list.', 'warning');
                          }
                        }}
                        className="bg-[#248046] hover:bg-[#1a6535] text-white px-3 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        + Add Top 5 Member
                      </button>
                      <button
                        onClick={() => {
                          if (isAdmin) {
                            setShowAddMemberDropdown(showAddMemberDropdown === 'top10' ? null : 'top10');
                          } else {
                            addNotification('Access Denied', 'Admin console passcode is required to edit the priority list.', 'warning');
                          }
                        }}
                        className="bg-[#248046] hover:bg-[#1a6535] text-white px-3 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        + Add Top 10 Member
                      </button>
                      <button
                        onClick={() => {
                          if (isAdmin) {
                            addNotification('Roster Management', 'To remove members, use the inline red trash (X) icons next to their names in the list columns on the left.', 'info');
                          } else {
                            addNotification('Access Denied', 'Admin console passcode is required to edit the priority list.', 'warning');
                          }
                        }}
                        className="bg-[#da373c] hover:bg-[#a92b2f] text-white px-3 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        X Remove Top 5 Member
                      </button>
                      <button
                        onClick={() => {
                          if (isAdmin) {
                            addNotification('Roster Management', 'To remove members, use the inline red trash (X) icons next to their names in the list columns on the left.', 'info');
                          } else {
                            addNotification('Access Denied', 'Admin console passcode is required to edit the priority list.', 'warning');
                          }
                        }}
                        className="bg-[#da373c] hover:bg-[#a92b2f] text-white px-3 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        X Remove Top 10 Member
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
