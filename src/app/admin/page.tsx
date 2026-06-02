'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/components/AppContext';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Megaphone, 
  Save, 
  Send, 
  Info,
  Link as LinkIcon,
  Key,
  Cpu,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Activity,
  Server,
  Users,
  Search
} from 'lucide-react';
import Link from 'next/link';

interface WebhookChannel {
  key: string;
  name: string;
  description: string;
}

const channelsList: WebhookChannel[] = [
  { key: 'announcements', name: '📢┃𝐀𝐧𝐧𝐨𝐮𝐧𝐜𝐞𝐦𝐞𝐧𝐭𝐬', description: 'General family announcements' },
  { key: 'role-request', name: '📋┃𝐑𝐨𝐥𝐞-𝐑𝐞𝐪𝐮𝐞𝐬𝐭', description: 'Member role application requests' },
  { key: 'strikes', name: '🚨┃𝐒𝐭𝐫𝐢𝐤𝐞𝐬', description: 'Disciplinary warnings and strikes' },
  { key: 'tickets', name: '🎫┃𝐓𝐢𝐜𝐤𝐞𝐭𝐬', description: 'General support and complaints' },
  { key: 'check-balance', name: '💸┃𝐂𝐡𝐞𝐜𝐤-𝐁𝐚𝐥𝐚𝐧𝐜𝐞', description: 'Economy and banking logs' },
  { key: 'bizwar-collect', name: '💲┃𝐁𝐢𝐳𝐰𝐚𝐫-𝐂𝐨𝐥𝐥𝐞𝐜𝐭', description: 'BizWar collection logs' },
  { key: 'rp-collect', name: '🎫┃𝐑𝐏-𝐂𝐨𝐥𝐥𝐞𝐜𝐭', description: 'Ticket output collections' },
  { key: 'weekly-kill-list', name: '🔻┃𝐰𝐞𝐞𝐤𝐥𝐲-𝐊𝐢𝐥𝐥-𝐋𝐢𝐬𝐭', description: 'Weekly kills resets' },
  { key: 'point-shop', name: '💰┃𝐏𝐨𝐢𝐧𝐭-𝐒𝐡𝐨𝐩', description: 'Point shop order details' }
];

const DEFAULT_ROLES = ['Leader', 'Co-Leader', 'Underboss', 'Soldier', 'Associate', 'Recruit'];

export default function AdminDashboard() {
  const { user, loading: userLoading, addNotification, API_BASE_URL } = useApp();
  
  const [activeSubTab, setActiveSubTab] = useState<'dispatch' | 'bot-config' | 'member-requests' | 'members'>('dispatch');
  const [members, setMembers] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customRoleInput, setCustomRoleInput] = useState<Record<string, string>>({}); // memberId -> role text
  const [savingMembers, setSavingMembers] = useState<Record<string, boolean>>({}); // memberId -> isSaving boolean
  const [webhooks, setWebhooks] = useState<Record<string, string>>({});
  const [showWebhooks, setShowWebhooks] = useState<Record<string, boolean>>({});
  const [broadcastForm, setBroadcastForm] = useState({
    channelKey: 'announcements',
    title: '',
    message: '',
    mediaUrl: ''
  });
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  // Bot Credentials form state
  const [credentials, setCredentials] = useState({
    botToken: '',
    guildId: '',
    clientId: '',
    clientSecret: '',
    adminPassword: '',
    rpTicketTimes: '08:30, 15:00, 20:00, 22:30',
    factoryVoiceChannelId: '',
    simulatedVoice: ''
  });
  const [credsLoading, setCredsLoading] = useState(false);

  // Load webhooks from localStorage and try to load from backend too
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('wp_webhooks');
      if (stored) {
        try {
          setWebhooks(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    }

    const loadBackendConfig = async () => {
      try {
        const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
        if (!passcode) return;
        const res = await fetch(`${API_BASE_URL}/api/admin/discord-config`, {
          headers: { 'x-admin-passcode': passcode }
        });
        if (res.ok) {
          const data = await res.json();
          // Load backend credentials to form if the user is in bot tab
          setCredentials({
            botToken: data.botToken || '',
            guildId: data.guildId || '',
            clientId: data.clientId || '',
            clientSecret: data.clientSecret || '',
            adminPassword: data.adminPassword || '',
            rpTicketTimes: Array.isArray(data.rpTicketTimes) ? data.rpTicketTimes.join(', ') : (data.rpTicketTimes || ''),
            factoryVoiceChannelId: data.factoryVoiceChannelId || '',
            simulatedVoice: Array.isArray(data.simulatedVoice) ? data.simulatedVoice.join(', ') : (data.simulatedVoice || '')
          });

          // Sync backend webhooks if they exist
          if (data.webhooks) {
            setWebhooks(prev => {
              const merged = { ...prev };
              for (const [k, v] of Object.entries(data.webhooks)) {
                if (v && !v.toString().startsWith('••••••••••••••••')) {
                  merged[k] = v.toString();
                }
              }
              return merged;
            });
          }
        }
      } catch (e) {
        console.warn('Could not load credentials from backend on mount.');
      }
    };

    if (user && user.admin_authenticated) {
      loadBackendConfig();
    }
  }, [user, API_BASE_URL]);

  const fetchMembers = async () => {
    setLoadingRequests(true);
    try {
      const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
      const res = await fetch(`${API_BASE_URL}/api/members`, {
        headers: { 'x-admin-passcode': passcode }
      });
      if (res.ok) {
        setMembers(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveReject = async (discordId: string, action: 'approve' | 'reject') => {
    try {
      const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
      const res = await fetch(`${API_BASE_URL}/api/admin/approve-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode
        },
        body: JSON.stringify({ discordId, action })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addNotification(
          action === 'approve' ? 'Request Approved' : 'Request Rejected',
          action === 'approve' ? 'The user is now approved to access the hub.' : 'The registration request has been deleted.',
          'success'
        );
        fetchMembers();
      } else {
        throw new Error(data.message || 'Action failed.');
      }
    } catch (err: any) {
      addNotification('Action Failed', err.message || 'Error occurred.', 'error');
    }
  };

  // Fetch members when requests tab is activated
  useEffect(() => {
    if (user?.admin_authenticated) {
      fetchMembers();
    }
  }, [activeSubTab, user]);

  const handleWebhookChange = (key: string, value: string) => {
    setWebhooks(prev => ({ ...prev, [key]: value }));
  };

  const toggleWebhookVisibility = (key: string) => {
    setShowWebhooks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveWebhooks = async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wp_webhooks', JSON.stringify(webhooks));
    }
    
    // Attempt sync to backend DB config
    try {
      const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
      if (passcode) {
        const res = await fetch(`${API_BASE_URL}/api/admin/discord-config`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-admin-passcode': passcode
          },
          body: JSON.stringify({ webhooks })
        });
        if (res.ok) {
          addNotification('Registry Updated', 'Discord webhooks saved locally and synced to backend database.', 'success');
          return;
        }
      }
    } catch (err) {
      console.warn('Backend sync failed on webhooks save:', err);
    }
    
    addNotification('Registry Updated', 'Discord webhook addresses saved locally in browser.', 'success');
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const webhookUrl = webhooks[broadcastForm.channelKey];
    if (!webhookUrl) {
      addNotification('Dispatch Failed', 'No webhook configured for the selected channel.', 'error');
      return;
    }

    if (!broadcastForm.title || !broadcastForm.message) {
      addNotification('Validation Error', 'Title and message description are required.', 'warning');
      return;
    }

    setBroadcastLoading(true);
    try {
      const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
      
      // Try sending via backend proxy first (handles CORS bypass automatically)
      const res = await fetch(`${API_BASE_URL}/api/admin/send-webhook`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode
        },
        body: JSON.stringify({
          channelKey: broadcastForm.channelKey,
          webhookUrl: webhookUrl,
          title: broadcastForm.title,
          message: broadcastForm.message,
          mediaUrl: broadcastForm.mediaUrl
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addNotification('Alert Broadcasted', 'Discord announcement dispatched successfully!', 'success');
        setBroadcastForm(prev => ({ ...prev, title: '', message: '', mediaUrl: '' }));
      } else {
        throw new Error(data.message || 'Server rejected post request.');
      }
    } catch (err: any) {
      console.warn('Backend dispatch proxy failed, attempting browser direct fallback:', err.message);
      
      // Direct browser fallback (often blocked by CORS in production but we try)
      try {
        const embedPayload = {
          embeds: [{
            title: broadcastForm.title,
            description: broadcastForm.message,
            color: 10497791, // Purple #9A33EF
            image: broadcastForm.mediaUrl ? { url: broadcastForm.mediaUrl } : undefined,
            timestamp: new Date().toISOString(),
            footer: { text: 'White Pigeon Hub Dispatch' }
          }]
        };

        const directRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(embedPayload)
        });

        if (directRes.ok) {
          addNotification('Alert Broadcasted', 'Discord announcement dispatched directly!', 'success');
          setBroadcastForm(prev => ({ ...prev, title: '', message: '', mediaUrl: '' }));
        } else {
          throw new Error('Discord rejected webhook post directly.');
        }
      } catch (directErr: any) {
        addNotification(
          'Dispatch Failed', 
          'Webhook blocked by browser CORS policy. Connect to Express backend to proxy the request.', 
          'error'
        );
      }
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Bot configuration handlers
  const handleCredChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const fetchBotConfig = async () => {
    setCredsLoading(true);
    try {
      const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
      const res = await fetch(`${API_BASE_URL}/api/admin/discord-config`, {
        headers: { 'x-admin-passcode': passcode }
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials({
          botToken: data.botToken || '',
          guildId: data.guildId || '',
          clientId: data.clientId || '',
          clientSecret: data.clientSecret || '',
          adminPassword: data.adminPassword || '',
          rpTicketTimes: Array.isArray(data.rpTicketTimes) ? data.rpTicketTimes.join(', ') : (data.rpTicketTimes || ''),
          factoryVoiceChannelId: data.factoryVoiceChannelId || '',
          simulatedVoice: Array.isArray(data.simulatedVoice) ? data.simulatedVoice.join(', ') : (data.simulatedVoice || '')
        });
        addNotification('Sync Successful', 'Synced bot credentials from backend.', 'success');
      } else {
        throw new Error('Could not load credentials.');
      }
    } catch (err: any) {
      addNotification('API Fetch Failed', 'Could not fetch credentials. Ensure backend is running.', 'error');
    } finally {
      setCredsLoading(false);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredsLoading(true);
    try {
      const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
      const res = await fetch(`${API_BASE_URL}/api/admin/discord-config`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode
        },
        body: JSON.stringify(credentials)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addNotification('Configuration Saved', 'Bot credentials updated and bot service reloaded.', 'success');
        // Update passcode locally if changed
        if (credentials.adminPassword && credentials.adminPassword !== '••••••••••••••••') {
          localStorage.setItem('wp_admin_passcode', credentials.adminPassword);
        }
      } else {
        throw new Error(data.message || 'Failed to save configuration.');
      }
    } catch (err: any) {
      addNotification('Update Failed', err.message || 'Could not save credentials.', 'error');
    } finally {
      setCredsLoading(false);
    }
  };

  const handleResetCredentials = async () => {
    if (!confirm('Are you sure you want to clear all Discord credentials from the server? This will reset the bot to mock mode.')) return;
    setCredsLoading(true);
    try {
      const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
      const res = await fetch(`${API_BASE_URL}/api/admin/discord-config/reset`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addNotification('Credentials Reset', 'All bot settings cleared on the backend.', 'success');
        setCredentials({
          botToken: '',
          guildId: '',
          clientId: '',
          clientSecret: '',
          adminPassword: '',
          rpTicketTimes: '',
          factoryVoiceChannelId: '',
          simulatedVoice: ''
        });
      }
    } catch (err: any) {
      addNotification('Reset Failed', err.message || 'Could not reset credentials.', 'error');
    } finally {
      setCredsLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="text-center py-24 font-tech text-xs text-purple-400 animate-pulse tracking-widest">
        AUTHENTICATING ADMINISTRATIVE TIERS & SECURITY CONSOL...
      </div>
    );
  }

  if (!user || !user.admin_authenticated) {
    return (
      <div className="max-w-md mx-auto bg-[#0b0a0e] border border-red-500/20 rounded-2xl p-8 flex flex-col items-center gap-5 text-center mt-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
        <ShieldAlert className="w-16 h-16 text-red-500 animate-pulse mt-2" />
        <h2 className="font-title font-black text-2xl italic text-red-500 uppercase tracking-wide">ACCESS RESTRICTED</h2>
        <p className="font-sans text-xs text-zinc-400 leading-relaxed">
          Admin Dashboard workspaces are restricted to verified family administrators. Provide a valid security passcode.
        </p>
        <Link href="/" className="mt-4 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-title font-bold text-xs py-2.5 px-6 rounded-xl hover:border-purple-600/30 transition-smooth">
          RETURN TO PORTAL
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12 font-sans max-w-7xl mx-auto">
      {/* HUD Redesigned Premium Header */}
      <div className="bg-gradient-to-r from-[#111016]/95 to-[#1c1a24]/95 border border-[#1c1a2a] p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-[80px]" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-[80px]" />
        
        <div className="relative z-10">
          <span className="bg-purple-900/20 text-purple-400 text-[8px] font-tech font-black tracking-[0.25em] px-2.5 py-1 rounded-md border border-purple-800/35 uppercase">
            🔒 Security Clearance: Level 1 Admin
          </span>
          <h1 className="font-title font-black text-2xl md:text-3xl italic text-white flex items-center gap-2 mt-2">
            <ShieldCheck className="w-7 h-7 text-purple-400" /> ADMIN CONTROL CENTER
          </h1>
          <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-bold">
            Consolidated family audit interface & secure webhook communication networks.
          </p>
        </div>

        <div className="bg-[#09080d]/80 border border-[#201d2d]/65 px-4 py-2 rounded-xl flex items-center gap-3 shrink-0 relative z-10 backdrop-blur-sm">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </div>
          <div className="text-left leading-tight">
            <span className="text-[9px] text-zinc-500 font-bold block">DISCORD BOT STATUS</span>
            <span className="text-xs font-mono font-bold text-zinc-200">Active / Simulated</span>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-[#201d2d]/60 gap-1 bg-[#09080d]/40 p-1.5 rounded-xl border border-[#1c1a2a]/40 w-fit">
        <button
          onClick={() => setActiveSubTab('dispatch')}
          className={`py-2 px-5 rounded-lg font-title font-black text-xs italic tracking-wider transition-smooth cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'dispatch'
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)] border border-purple-500/50'
              : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" /> DISPATCH CENTER
        </button>
        <button
          onClick={() => setActiveSubTab('bot-config')}
          className={`py-2 px-5 rounded-lg font-title font-black text-xs italic tracking-wider transition-smooth cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'bot-config'
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)] border border-purple-500/50'
              : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" /> BOT CONFIGURATION
        </button>
        <button
          onClick={() => setActiveSubTab('member-requests')}
          className={`py-2 px-5 rounded-lg font-title font-black text-xs italic tracking-wider transition-smooth cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'member-requests'
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)] border border-purple-500/50'
              : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 animate-pulse text-purple-400" /> MEMBER REQUESTS
          {members.filter(m => m.status === 'pending').length > 0 && (
            <span className="bg-red-500 text-white text-[8px] font-sans font-bold px-1.5 py-0.5 rounded-full animate-pulse ml-1">
              {members.filter(m => m.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('members')}
          className={`py-2 px-5 rounded-lg font-title font-black text-xs italic tracking-wider transition-smooth cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'members'
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)] border border-purple-500/50'
              : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-purple-400" /> MEMBERS LIST
        </button>
      </div>

      {/* Dispatch & Webhooks Content */}
      {activeSubTab === 'dispatch' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left Column: Announcement terminal */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-[#111118] border border-[#1c1a2a] p-5 rounded-2xl flex flex-col gap-4 shadow-xl">
              <div className="border-b border-[#201d2d]/60 pb-2 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-900/10">
                  <Megaphone className="w-4 h-4 text-purple-400 animate-pulse" />
                </div>
                <h3 className="font-title font-black text-xs text-zinc-100 tracking-wider uppercase">
                  DISPATCH CHANNEL ALERTS
                </h3>
              </div>
              
              <form onSubmit={handleBroadcast} className="text-xs flex flex-col gap-4 mt-1">
                <div>
                  <label className="text-[9px] text-zinc-500 font-black tracking-wide block mb-1">TARGET CHANNEL</label>
                  <select
                    value={broadcastForm.channelKey}
                    onChange={(e) => setBroadcastForm(prev => ({ ...prev, channelKey: e.target.value }))}
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs text-zinc-300 focus:border-purple-600/40 outline-none transition-smooth"
                  >
                    {channelsList.map(ch => (
                      <option key={ch.key} value={ch.key}>
                        {ch.name} {!webhooks[ch.key] ? '(Unconfigured)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="text-[9px] text-zinc-500 font-sans block mt-1.5 italic">
                    {channelsList.find(c => c.key === broadcastForm.channelKey)?.description}
                  </span>
                </div>

                <div>
                  <label className="text-[9px] text-zinc-500 font-black tracking-wide block mb-1">ALERT HEADER TITLE</label>
                  <input 
                    type="text"
                    value={broadcastForm.title}
                    onChange={(e) => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Mandatory meeting at Docks"
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs text-zinc-300 focus:border-purple-600/40 outline-none transition-smooth"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-zinc-500 font-black tracking-wide block mb-1">ALERT DESCRIPTION</label>
                  <textarea 
                    rows={4}
                    value={broadcastForm.message}
                    onChange={(e) => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Type details that will compile into the Discord embed..."
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs text-zinc-300 focus:border-purple-600/40 outline-none resize-none leading-relaxed transition-smooth"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-zinc-500 font-black tracking-wide block mb-1">IMAGE URL (OPTIONAL)</label>
                  <input 
                    type="text"
                    value={broadcastForm.mediaUrl}
                    onChange={(e) => setBroadcastForm(prev => ({ ...prev, mediaUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs text-zinc-300 focus:border-purple-600/40 outline-none transition-smooth"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={broadcastLoading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-900 text-white font-title text-xs font-black italic py-3 rounded-xl border border-purple-500 disabled:border-transparent glow-magenta transition-smooth cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {broadcastLoading ? 'DISPATCHING...' : 'DISPATCH EMBED'}
                </button>
              </form>
            </div>

            {/* Quick Panel Deployment Card */}
            {['role-request', 'strikes', 'tickets', 'check-balance', 'weekly-kill-list'].includes(broadcastForm.channelKey) && (
              <div className="bg-[#111118] border border-[#1c1a2a] p-5 rounded-2xl flex flex-col gap-4 shadow-xl animate-fade-in">
                <div className="border-b border-[#201d2d]/60 pb-2 flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-900/10">
                    <Server className="w-4 h-4 text-amber-500" />
                  </div>
                  <h3 className="font-title font-black text-xs text-amber-500 tracking-wider uppercase">
                    INTERACTIVE BOT PANEL DEPLOY
                  </h3>
                </div>
                
                <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                  Deploy an interactive panel message with buttons and dropdowns to the corresponding Discord channel on the official server.
                </p>

                <div className="flex flex-col gap-2 mt-1">
                  {broadcastForm.channelKey === 'role-request' && (
                    <button 
                      onClick={async () => {
                        if (!confirm('Are you sure you want to deploy the interactive Role Request Submission Button in the channel?')) return;
                        try {
                          const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
                          const res = await fetch(`${API_BASE_URL}/api/admin/deploy-role-request-prompt`, {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'x-admin-passcode': passcode
                            }
                          });
                          if (res.ok) {
                            addNotification('Button Deployed', 'Role request submission button deployed in Discord.', 'success');
                          } else {
                            throw new Error('Failed to deploy button.');
                          }
                        } catch (err: any) {
                          addNotification('Deployment Failed', err.message || 'Error deploying button.', 'error');
                        }
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-title text-xs font-black italic py-2.5 rounded-xl border border-amber-500 glow-amber transition-smooth cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> DEPLOY ROLE SELECTION PANEL
                    </button>
                  )}

                  {broadcastForm.channelKey === 'strikes' && (
                    <button 
                      onClick={async () => {
                        if (!confirm('Are you sure you want to deploy the interactive Strike System Panel in the channel?')) return;
                        try {
                          const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
                          const res = await fetch(`${API_BASE_URL}/api/admin/deploy-strike-prompt`, {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'x-admin-passcode': passcode
                            }
                          });
                          if (res.ok) {
                            addNotification('Panel Deployed', 'Strike system panel deployed in Discord.', 'success');
                          } else {
                            throw new Error('Failed to deploy panel.');
                          }
                        } catch (err: any) {
                          addNotification('Deployment Failed', err.message || 'Error deploying panel.', 'error');
                        }
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-title text-xs font-black italic py-2.5 rounded-xl border border-amber-500 glow-amber transition-smooth cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> DEPLOY STRIKE PANEL
                    </button>
                  )}

                  {broadcastForm.channelKey === 'tickets' && (
                    <button 
                      onClick={async () => {
                        if (!confirm('Are you sure you want to deploy the interactive Ticket System Panel in the channel?')) return;
                        try {
                          const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
                          const res = await fetch(`${API_BASE_URL}/api/admin/deploy-tickets-prompt`, {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'x-admin-passcode': passcode
                            }
                          });
                          if (res.ok) {
                            addNotification('Panel Deployed', 'Ticket System panel deployed in Discord.', 'success');
                          } else {
                            throw new Error('Failed to deploy panel.');
                          }
                        } catch (err: any) {
                          addNotification('Deployment Failed', err.message || 'Error deploying panel.', 'error');
                        }
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-title text-xs font-black italic py-2.5 rounded-xl border border-amber-500 glow-amber transition-smooth cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> DEPLOY TICKET SELECTION PANEL
                    </button>
                  )}

                  {broadcastForm.channelKey === 'check-balance' && (
                    <button 
                      onClick={async () => {
                        if (!confirm('Are you sure you want to deploy the interactive Balance System Panel in the channel?')) return;
                        try {
                          const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
                          const res = await fetch(`${API_BASE_URL}/api/admin/deploy-balance-prompt`, {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'x-admin-passcode': passcode
                            }
                          });
                          if (res.ok) {
                            addNotification('Panel Deployed', 'Balance System panel deployed in Discord.', 'success');
                          } else {
                            throw new Error('Failed to deploy panel.');
                          }
                        } catch (err: any) {
                          addNotification('Deployment Failed', err.message || 'Error deploying panel.', 'error');
                        }
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-title text-xs font-black italic py-2.5 rounded-xl border border-amber-500 glow-amber transition-smooth cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> DEPLOY BANK BALANCE PANEL
                    </button>
                  )}

                  {broadcastForm.channelKey === 'weekly-kill-list' && (
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={async () => {
                          if (!confirm('Are you sure you want to deploy the interactive Weekly Event Leaderboard Embed in the channel?')) return;
                          try {
                            const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
                            const res = await fetch(`${API_BASE_URL}/api/admin/deploy-leaderboard-prompt`, {
                              method: 'POST',
                              headers: { 
                                'Content-Type': 'application/json',
                                'x-admin-passcode': passcode
                              }
                            });
                            if (res.ok) {
                              addNotification('Panel Deployed', 'Weekly Event Leaderboard panel deployed in Discord.', 'success');
                            } else {
                              throw new Error('Failed to deploy panel.');
                            }
                          } catch (err: any) {
                            addNotification('Deployment Failed', err.message || 'Error deploying panel.', 'error');
                          }
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic py-2.5 rounded-xl border border-purple-500 glow-magenta transition-smooth cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> DEPLOY EVENT LEADERBOARD
                      </button>

                      <button 
                        onClick={async () => {
                          if (!confirm('Are you sure you want to reset all members\' Weekly Event Points to 0? This will sync to Discord instantly.')) return;
                          try {
                            const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
                            const res = await fetch(`${API_BASE_URL}/api/admin/reset-weekly-leaderboard`, {
                              method: 'POST',
                              headers: { 
                                'Content-Type': 'application/json',
                                'x-admin-passcode': passcode
                              }
                            });
                            if (res.ok) {
                              addNotification('Leaderboard Reset', 'All weekly event points successfully reset to 0.', 'success');
                            } else {
                              throw new Error('Failed to reset leaderboard.');
                            }
                          } catch (err: any) {
                            addNotification('Reset Failed', err.message || 'Error resetting weekly leaderboard.', 'error');
                          }
                        }}
                        className="bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-700/50 text-red-400 font-title text-xs font-black italic py-2.5 rounded-xl transition-smooth cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> RESET WEEKLY EVENT POINTS
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Webhook config grid */}
          <div className="lg:col-span-2 bg-[#111118] border border-[#1c1a2a] p-5 rounded-2xl flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#201d2d]/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-900/10">
                  <LinkIcon className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="font-title font-black text-lg italic text-zinc-100 uppercase leading-none">
                    DISCORD INTEGRATION REGISTRY
                  </h2>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-1 block">
                    Register webhook tokens for automated bot routing.
                  </span>
                </div>
              </div>
              
              <button
                onClick={saveWebhooks}
                className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic py-2 px-5 rounded-xl border border-purple-500 transition-smooth cursor-pointer flex items-center gap-1.5 shadow-[0_0_10px_rgba(168,85,247,0.15)]"
              >
                <Save className="w-3.5 h-3.5" /> SAVE WEBHOOKS
              </button>
            </div>

            <div className="bg-[#09080d]/60 p-4 border border-[#201d2d]/30 rounded-2xl flex gap-3 text-zinc-400">
              <Info className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <p className="text-[10px] leading-relaxed font-sans">
                Paste the Discord Webhook URLs from your server integration settings. Webhooks are synchronized with the backend database. Messages are sent via the backend proxy to avoid browser CORS blocks. Click the eye icon to preview the tokens.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[550px] overflow-y-auto pr-1">
              {channelsList.map((ch) => {
                const isConfigured = !!webhooks[ch.key];
                const isVisible = !!showWebhooks[ch.key];
                
                return (
                  <div 
                    key={ch.key} 
                    className={`p-4 rounded-xl border flex flex-col gap-2.5 transition-smooth bg-[#09080d]/30 ${
                      isConfigured 
                        ? 'border-[#1c1a2a] hover:border-purple-500/20' 
                        : 'border-red-950/20 hover:border-red-900/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-200 text-[11px] truncate w-2/3">
                        {ch.name}
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8px] font-sans font-bold uppercase px-1.5 py-0.5 rounded-full ${
                          isConfigured 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {isConfigured ? 'Active' : 'Missing'}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => toggleWebhookVisibility(ch.key)}
                          className="text-zinc-500 hover:text-zinc-300 transition-smooth p-0.5"
                          title={isVisible ? "Hide URL" : "Show URL"}
                        >
                          {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    
                    <input 
                      type={isVisible ? "text" : "password"}
                      value={webhooks[ch.key] || ''}
                      onChange={(e) => handleWebhookChange(ch.key, e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full bg-[#09080d] border border-[#201d2d]/60 rounded-xl py-2 px-3 text-[11px] font-mono text-zinc-400 focus:text-zinc-200 focus:border-purple-650 outline-none transition-smooth"
                    />
                    
                    <span className="text-[9px] text-zinc-550 font-sans italic truncate">
                      {ch.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Discord Bot Credentials tab */}
      {activeSubTab === 'bot-config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
          {/* Left Advice Column */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-[#111118] border border-[#1c1a2a] p-5 rounded-2xl flex flex-col gap-3 shadow-xl">
              <div className="border-b border-[#201d2d]/60 pb-2 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-900/10">
                  <Info className="w-4 h-4 text-purple-400" />
                </div>
                <h3 className="font-title font-black text-xs text-zinc-100 tracking-wider uppercase">
                  DISCORD BOT INSTRUCTIONS
                </h3>
              </div>
              
              <div className="text-[11px] text-zinc-400 leading-relaxed space-y-3 font-sans">
                <p>
                  To link your test Discord Server to the White Pigeon Hub, follow these instructions:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-zinc-450">
                  <li>Visit the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline hover:text-purple-300 font-bold">Discord Developer Portal</a>.</li>
                  <li>Create a new Application and add a **Bot** under the Bot menu.</li>
                  <li>Enable the **Gateway Intents** (specifically <b>Guild Members</b>, <b>Guild Messages</b>, and <b>Message Content</b>).</li>
                  <li>Copy your **Bot Token** and paste it here.</li>
                  <li>Under OAuth2, copy your **Client ID** and **Client Secret**.</li>
                  <li>Generate an invite link, add the Bot to your Discord server, and paste your **Guild ID** (Server ID) into the form.</li>
                </ol>
                <p className="text-[9px] text-zinc-550 pt-2 border-t border-[#1c1a2a] leading-tight">
                  All bot credentials are stored securely and encrypted in the backend db.json registry.
                </p>
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="lg:col-span-2 bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl flex flex-col gap-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#201d2d]/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-900/10">
                  <Key className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="font-title font-black text-lg italic text-zinc-100 uppercase leading-none">
                    SERVER CREDENTIALS VAULT
                  </h2>
                  <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider block mt-1">
                    Manage core bot API tokens and administrative clearance passcode.
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchBotConfig}
                  disabled={credsLoading}
                  className="bg-[#0c0b11] hover:bg-[#1a1924] text-zinc-400 hover:text-zinc-200 border border-[#201d2d] hover:border-purple-500/20 p-2 rounded-xl transition-smooth cursor-pointer"
                  title="Reload config from server"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${credsLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleResetCredentials}
                  disabled={credsLoading}
                  className="bg-red-950/15 hover:bg-red-950/30 text-red-400 border border-red-900/30 hover:border-red-800/50 py-2 px-4 rounded-xl text-xs font-sans font-bold transition-smooth flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> RESET SETTINGS
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] text-zinc-500 font-black block mb-1">DISCORD BOT TOKEN</label>
                  <input 
                    type="password"
                    name="botToken"
                    value={credentials.botToken}
                    onChange={handleCredChange}
                    placeholder={credentials.botToken ? '••••••••••••••••' : 'Enter Bot Token'} 
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs font-mono text-zinc-350 focus:text-zinc-100 focus:border-purple-600/40 outline-none transition-smooth"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-zinc-500 font-black block mb-1">GUILD / SERVER ID</label>
                  <input 
                    type="text"
                    name="guildId"
                    value={credentials.guildId}
                    onChange={handleCredChange}
                    placeholder="e.g. 10482938491829384" 
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs font-mono text-zinc-350 focus:text-zinc-100 focus:border-purple-600/40 outline-none transition-smooth"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-zinc-500 font-black block mb-1">OAUTH2 CLIENT ID</label>
                  <input 
                    type="text"
                    name="clientId"
                    value={credentials.clientId}
                    onChange={handleCredChange}
                    placeholder="Enter Client ID" 
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs font-mono text-zinc-350 focus:text-zinc-100 focus:border-purple-600/40 outline-none transition-smooth"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-zinc-500 font-black block mb-1">OAUTH2 CLIENT SECRET</label>
                  <input 
                    type="password"
                    name="clientSecret"
                    value={credentials.clientSecret}
                    onChange={handleCredChange}
                    placeholder={credentials.clientSecret ? '••••••••••••••••' : 'Enter Client Secret'} 
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs font-mono text-zinc-350 focus:text-zinc-100 focus:border-purple-600/40 outline-none transition-smooth"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[9px] text-zinc-500 font-black block mb-1">MASTER ADMIN PASSWORD (PASSCODE)</label>
                  <input 
                    type="password"
                    name="adminPassword"
                    value={credentials.adminPassword}
                    onChange={handleCredChange}
                    placeholder="Enter new master passcode (defaults to 'anvy2026')" 
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs font-mono text-zinc-350 focus:text-zinc-100 focus:border-purple-600/40 outline-none transition-smooth"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[9px] text-zinc-500 font-black block mb-1">AUTOMATED RP TICKET TIMES (HH:MM COMMA SEPARATED)</label>
                  <input 
                    type="text"
                    name="rpTicketTimes"
                    value={credentials.rpTicketTimes}
                    onChange={handleCredChange}
                    placeholder="e.g. 08:30, 15:00, 20:00, 22:30" 
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs font-mono text-zinc-350 focus:text-zinc-100 focus:border-purple-600/40 outline-none transition-smooth"
                  />
                  <span className="text-[9px] text-zinc-500 mt-1 block">Specify the local times (24-hour HH:MM format) when the bot should automatically open the RP Ticket signup and trigger the Discord embed.</span>
                </div>

                <div>
                  <label className="text-[9px] text-zinc-500 font-black block mb-1">RP ROSTER VOICE CHANNEL ID</label>
                  <input 
                    type="text"
                    name="factoryVoiceChannelId"
                    value={credentials.factoryVoiceChannelId}
                    onChange={handleCredChange}
                    placeholder="e.g. 10482938491829384" 
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs font-mono text-zinc-350 focus:text-zinc-100 focus:border-purple-600/40 outline-none transition-smooth"
                  />
                  <span className="text-[9px] text-zinc-500 mt-1 block">The voice channel ID where members must be present to get a green checkmark in the active roster.</span>
                </div>

                <div>
                  <label className="text-[9px] text-zinc-500 font-black block mb-1">SIMULATED VOICE USERS (DISCORD IDS COMMA SEPARATED)</label>
                  <input 
                    type="text"
                    name="simulatedVoice"
                    value={credentials.simulatedVoice}
                    onChange={handleCredChange}
                    placeholder="e.g. 123456789012345, 98765432109876" 
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs font-mono text-zinc-350 focus:text-zinc-100 focus:border-purple-600/40 outline-none transition-smooth"
                  />
                  <span className="text-[9px] text-zinc-500 mt-1 block">Comma-separated list of user IDs to force simulate as being inside the voice channel for testing.</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[#1e1b29] flex justify-end">
                <button
                  type="submit"
                  disabled={credsLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic py-3 px-6 rounded-xl border border-purple-500 transition-smooth cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.15)] flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> {credsLoading ? 'SAVING...' : 'SAVE BOT CREDENTIALS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Requests Content */}
      {activeSubTab === 'member-requests' && (
        <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl flex flex-col gap-6 shadow-xl relative overflow-hidden font-sans">
          <div className="border-b border-[#201d2d]/60 pb-3 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-950/20 border border-purple-800/35 text-purple-400">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-title font-black text-lg italic text-zinc-100 uppercase leading-none">
                MEMBER REGISTRATION REQUESTS
              </h2>
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-1 block">
                Review and approve or reject player registration requests.
              </span>
            </div>
          </div>

          {loadingRequests ? (
            <div className="text-center py-12 text-zinc-500 font-tech text-xs tracking-wider animate-pulse">
              FETCHING REGISTRATION RECORDS...
            </div>
          ) : members.filter(m => m.status === 'pending').length === 0 ? (
            <div className="text-center py-16 bg-[#09080d]/40 rounded-xl border border-[#1c1a2a]/30">
              <ShieldCheck className="w-10 h-10 text-green-500/40 mx-auto mb-2 animate-bounce" />
              <h3 className="font-title font-bold text-zinc-300 text-sm">NO PENDING REQUESTS</h3>
              <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wide">
                All registration requests have been cleared.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="border-b border-[#1c1a2a] text-zinc-500 uppercase tracking-widest text-[9px] font-black">
                    <th className="py-3 px-4">Player Name</th>
                    <th className="py-3 px-4">In-Game ID</th>
                    <th className="py-3 px-4">Discord ID / Username</th>
                    <th className="py-3 px-4">First Name</th>
                    <th className="py-3 px-4">Last Name</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members
                    .filter(m => m.status === 'pending')
                    .map((m) => (
                      <tr key={m.discordId} className="border-b border-[#181622]/40 hover:bg-[#13121d]/20 transition-smooth">
                        <td className="py-4 px-4 font-bold text-zinc-200">{m.username || 'Unknown'}</td>
                        <td className="py-4 px-4 text-purple-400 font-mono font-bold">{m.inGameId || 'N/A'}</td>
                        <td className="py-4 px-4 text-zinc-450 font-mono">@{m.discordId}</td>
                        <td className="py-4 px-4 text-zinc-400">{m.firstName || 'N/A'}</td>
                        <td className="py-4 px-4 text-zinc-400">{m.lastName || 'N/A'}</td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApproveReject(m.discordId, 'approve')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-title text-[9px] font-black italic tracking-wider py-1.5 px-3 rounded-lg border border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:scale-[1.02] active:scale-[0.98] transition-smooth cursor-pointer"
                            >
                              APPROVE
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to reject the registration request from ${m.username}?`)) {
                                  handleApproveReject(m.discordId, 'reject');
                                }
                              }}
                              className="bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 hover:border-rose-700/50 text-rose-400 hover:text-white font-title text-[9px] font-black italic tracking-wider py-1.5 px-3 rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-smooth cursor-pointer"
                            >
                              REJECT
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Members Management Content */}
      {activeSubTab === 'members' && (
        <div className="bg-[#111118] border border-[#1c1a2a] p-6 rounded-2xl flex flex-col gap-6 shadow-xl relative overflow-hidden font-sans">
          {/* Header */}
          <div className="border-b border-[#201d2d]/60 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-950/20 border border-purple-800/35 text-purple-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-title font-black text-lg italic text-zinc-100 uppercase leading-none">
                  MEMBERS DIRECTORY & ACCESS
                </h2>
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-1 block">
                  Assign dynamic roles, manage administrative credentials, and search approved players.
                </span>
              </div>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                <Search className="w-4 h-4" />
              </span>
              <input 
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by ID, Name or Role..."
                className="w-full bg-[#09080d]/60 border border-[#201d2d]/60 rounded-xl py-2 pl-10 pr-4 text-xs text-zinc-355 focus:text-zinc-100 focus:border-purple-650 outline-none transition-smooth"
              />
            </div>
          </div>

          {/* Members Table */}
          {loadingRequests ? (
            <div className="text-center py-12 text-zinc-500 font-tech text-xs tracking-wider animate-pulse">
              LOADING MEMBER DIRECTORY...
            </div>
          ) : members.filter(m => m.status !== 'pending').length === 0 ? (
            <div className="text-center py-16 bg-[#09080d]/40 rounded-xl border border-[#1c1a2a]/30">
              <Users className="w-10 h-10 text-purple-500/40 mx-auto mb-2" />
              <h3 className="font-title font-bold text-zinc-300 text-sm">NO APPROVED MEMBERS FOUND</h3>
              <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wide">
                There are no approved family members in the database.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="border-b border-[#1c1a2a] text-zinc-500 uppercase tracking-widest text-[9px] font-black">
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-4">In-Game ID</th>
                    <th className="py-3 px-4">Discord Account</th>
                    <th className="py-3 px-4">Admin Access</th>
                    <th className="py-3 px-4">Family Roles</th>
                    <th className="py-3 px-4 text-right">Assign Roles</th>
                    <th className="py-3 px-4 text-right">Revoke Access</th>
                  </tr>
                </thead>
                <tbody>
                  {members
                    .filter(m => m.status !== 'pending')
                    .filter(m => {
                      const search = searchTerm.toLowerCase();
                      return (
                        (m.nickname || '').toLowerCase().includes(search) ||
                        (m.username || '').toLowerCase().includes(search) ||
                        (m.discordId || '').toLowerCase().includes(search) ||
                        (m.inGameId || '').toLowerCase().includes(search) ||
                        (m.firstName || '').toLowerCase().includes(search) ||
                        (m.lastName || '').toLowerCase().includes(search) ||
                        (m.roles || []).some((r: string) => r.toLowerCase().includes(search))
                      );
                    })
                    .map((m) => {
                      const isSaving = !!savingMembers[m.discordId];
                      const currentRoles = m.roles || [];
                      
                      const handleRoleUpdate = async (newRolesList: string[], isNewAdmin?: boolean) => {
                        setSavingMembers(prev => ({ ...prev, [m.discordId]: true }));
                        try {
                          const passcode = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_passcode') || '' : '';
                          const res = await fetch(`${API_BASE_URL}/api/admin/update-member-roles`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'x-admin-passcode': passcode
                            },
                            body: JSON.stringify({
                              discordId: m.discordId,
                              roles: newRolesList,
                              admin_authenticated: isNewAdmin !== undefined ? isNewAdmin : !!m.admin_authenticated
                            })
                          });
                          const data = await res.json();
                          if (res.ok && data.success) {
                            addNotification('Member Updated', `Access parameters for ${m.nickname || m.username} saved.`, 'success');
                            fetchMembers();
                          } else {
                            throw new Error(data.message || 'Update failed.');
                          }
                        } catch (err: any) {
                          addNotification('Update Failed', err.message || 'Error updating member parameters.', 'error');
                        } finally {
                          setSavingMembers(prev => ({ ...prev, [m.discordId]: false }));
                        }
                      };

                      const addRole = (roleName: string) => {
                        if (!roleName) return;
                        const trimmed = roleName.trim();
                        if (!trimmed || currentRoles.includes(trimmed)) return;
                        const updated = [...currentRoles, trimmed];
                        handleRoleUpdate(updated);
                      };

                      const removeRole = (roleName: string) => {
                        const updated = currentRoles.filter((r: string) => r !== roleName);
                        handleRoleUpdate(updated);
                      };

                      return (
                        <tr key={m.discordId} className="border-b border-[#181622]/40 hover:bg-[#13121d]/20 transition-smooth">
                          {/* Player Identity */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <img 
                                src={m.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=50"} 
                                alt="" 
                                className="w-8 h-8 rounded-lg border border-purple-500/20 animate-fade-in"
                              />
                              <div>
                                <div className="font-bold text-zinc-200">{m.nickname || m.username || 'Unknown'}</div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">{m.firstName || ''} {m.lastName || ''}</div>
                              </div>
                            </div>
                          </td>
                          
                          {/* In Game ID */}
                          <td className="py-4 px-4 text-purple-400 font-mono font-bold">{m.inGameId || 'N/A'}</td>
                          
                          {/* Discord Username */}
                          <td className="py-4 px-4 text-zinc-400 font-mono">@{m.discordId}</td>
                          
                          {/* Admin Access Toggle */}
                          <td className="py-4 px-4">
                            <label className="relative inline-flex items-center cursor-pointer select-none">
                              <input 
                                type="checkbox"
                                checked={!!m.admin_authenticated}
                                disabled={isSaving}
                                onChange={(e) => handleRoleUpdate(currentRoles, e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-[#09080d] border border-[#201d2d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600 peer-checked:after:bg-white peer-checked:after:border-purple-300"></div>
                              <span className="ml-2 text-[10px] font-bold text-zinc-400 peer-checked:text-purple-400 uppercase">
                                {m.admin_authenticated ? 'Admin' : 'Member'}
                              </span>
                            </label>
                          </td>
                          
                          {/* Current Roles List */}
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {currentRoles.length === 0 ? (
                                <span className="text-[10px] text-zinc-500 italic">No roles assigned</span>
                              ) : (
                                currentRoles.map((role: string) => (
                                  <span 
                                    key={role} 
                                    className="inline-flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                                  >
                                    {role}
                                    <button 
                                      onClick={() => removeRole(role)}
                                      disabled={isSaving}
                                      className="text-purple-500 hover:text-purple-300 transition-colors ml-0.5 cursor-pointer disabled:cursor-not-allowed"
                                    >
                                      &times;
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          
                          {/* Role Assignment Actions */}
                          <td className="py-4 px-4 text-right">
                            {isSaving ? (
                              <div className="text-[10px] font-mono text-purple-400 animate-pulse uppercase pr-4">
                                Updating...
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 text-xs">
                                {/* Preset Roles Dropdown */}
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      addRole(e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  className="bg-[#09080d] border border-[#201d2d] rounded-lg py-1 px-2 text-[11px] text-zinc-350 focus:border-purple-650 outline-none transition-smooth max-w-[120px]"
                                >
                                  <option value="">+ Preset Role</option>
                                  {DEFAULT_ROLES.filter(r => !currentRoles.includes(r)).map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>

                                {/* Custom Role Add */}
                                <div className="flex items-center border border-[#201d2d] bg-[#09080d] rounded-lg overflow-hidden max-w-[150px]">
                                  <input 
                                    type="text"
                                    placeholder="Custom role..."
                                    value={customRoleInput[m.discordId] || ''}
                                    onChange={(e) => setCustomRoleInput(prev => ({ ...prev, [m.discordId]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        addRole(customRoleInput[m.discordId]);
                                        setCustomRoleInput(prev => ({ ...prev, [m.discordId]: '' }));
                                      }
                                    }}
                                    className="w-full bg-transparent px-2 py-1 text-[11px] text-zinc-350 outline-none placeholder-zinc-600"
                                  />
                                  <button
                                    onClick={() => {
                                      addRole(customRoleInput[m.discordId]);
                                      setCustomRoleInput(prev => ({ ...prev, [m.discordId]: '' }));
                                    }}
                                    className="bg-purple-600 text-white hover:bg-purple-700 px-2 py-1 cursor-pointer transition-colors text-[11px] font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                          
                          {/* Revoke Access Action */}
                          <td className="py-4 px-4 text-right">
                            <button
                              disabled={isSaving}
                              onClick={() => {
                                if (confirm(`Are you sure you want to revoke website access for ${m.nickname || m.username}? This will remove their registration and password.`)) {
                                  handleApproveReject(m.discordId, 'reject');
                                }
                              }}
                              className="bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-700/50 text-red-400 hover:text-white font-title text-[9px] font-black italic tracking-wider py-1.5 px-3 rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-smooth cursor-pointer flex items-center justify-center gap-1 ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> REVOKE
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
