'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/components/AppContext';
import Link from 'next/link';
import { ShieldAlert, Bot, Link2, Play, Save, RotateCcw, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface WebhookChannel {
  key: string;
  name: string;
  category: string;
  description: string;
  icon: string;
}

const channelsList: WebhookChannel[] = [
  { key: 'role-request', name: '📋┃𝐑𝐨𝐥𝐞-𝐑𝐞𝐪𝐮𝐞𝐬𝐭', category: 'Member Management', description: 'New members role requests and forms', icon: '📋' },
  { key: 'rolereq-review', name: '📜╰𝐑𝐨𝐥𝐞𝐑𝐞𝐪-𝐑𝐞𝐯𝐢𝐞𝐰', category: 'Member Management', description: 'Approvals/denials review results', icon: '📜' },
  { key: 'strikes', name: '🚨┃𝐒𝐭𝐫𝐢𝐤𝐞𝐬', category: 'Discipline', description: 'Log strike points issued to members', icon: '🚨' },
  { key: 'tickets', name: '🎫┃tickets', category: 'Discipline', description: 'Raised complaints and general support', icon: '🎫' },
  { key: 'check-balance', name: '💸┃𝐂𝐡𝐞𝐜𝐤-𝐁𝐚𝐥𝐚𝐧𝐜𝐞', category: 'Economy', description: 'Log balance checking statements', icon: '💸' },
  { key: 'bonus-admin-panel', name: '💰┃𝐁𝐨𝐧𝐮𝐬-𝐀𝐝𝐦𝐢𝐧-𝐏𝐚𝐧𝐞𝐥', category: 'Economy', description: 'Internal admin ledger bonus views', icon: '💰' },
  { key: 'bonus-approval', name: '✅┃𝐁𝐨𝐧𝐮𝐬-𝐀𝐩𝐩𝐫𝐨𝐯𝐚𝐥', category: 'Economy', description: 'Calculation approvals and alerts', icon: '✅' },
  { key: 'bizwar-collect', name: '💲┃𝐁𝐢𝐳𝐰𝐚𝐫-𝐂𝐨𝐥𝐥𝐞𝐜𝐭', category: 'Economy', description: 'Business profit logs hourly collection', icon: '💲' },
  { key: 'rp-collect', name: '🎫┃𝐑𝐏-𝐂𝐨𝐥𝐥𝐞𝐜𝐭', category: 'Economy', description: 'Factory ticket outputs logging timer', icon: '🎫' },
  { key: 'long-time-kill-list', name: '🔻┃𝐋𝐨𝐧𝐠-𝐓𝐢𝐦𝐞-𝐊𝐢𝐥𝐥-𝐋𝐢𝐬𝐭', category: 'Leaderboards & Stats', description: 'All time family combat kill stats', icon: '🔻' },
  { key: 'weekly-kill-list', name: '🔻┃weekly-𝐊𝐢𝐥𝐥-𝐋𝐢𝐬𝐭', category: 'Leaderboards & Stats', description: 'Week specific combat kills resets', icon: '🔻' },
  { key: 'leaderboard', name: '💪︱𝐋𝐞𝐚𝐝𝐞𝐫𝐛𝐨𝐚𝐫𝐝', category: 'Leaderboards & Stats', description: 'Overall ranking in turf and signups', icon: '💪' },
  { key: 'top-10-list', name: '🎖️╭𝐓𝐨𝐩-𝟏0-𝐋𝐢𝐬𝐭', category: 'Leaderboards & Stats', description: 'Selected high-tier priority shooters', icon: '🎖' },
  { key: 'submit-activity', name: '💯╭submit-activity', category: 'Activity System', description: 'Member activity submissions and proof', icon: '💯' },
  { key: 'activity-results', name: '💯︱𝝖ctivity-𝗥esults', category: 'Activity System', description: 'Leadership decisions review details', icon: '💯' },
  { key: 'activity-points-leaderboard', name: '💯╰𝝖ctivity-𝗣oints-𝗟eader𝗕oard', category: 'Activity System', description: 'Aggregated points from reviews', icon: '💯' },
  { key: 'point-shop', name: '💰╭point-shop', category: 'Point Shop & Orders', description: 'Transaction details from purchases', icon: '💰' },
  { key: 'activity-review', name: '💪︱𝐀𝐜𝐭𝐢𝐯𝐢𝐭𝐲-𝐑𝐞𝐯𝐢𝐞𝐰', category: 'Point Shop & Orders', description: 'Operations reviews and points validation log', icon: '💪' },
  { key: 'order-details', name: '💰╰order-details', category: 'Point Shop & Orders', description: 'Supply deliveries and outgoing logs', icon: '💰' },
  { key: 'rp-signup', name: '⏰┃𝐑𝐏-𝐒𝐢𝐠𝐧𝐮𝐩', category: 'Events, Signups & Public', description: 'Roster signups, countdown pings', icon: '⏰' },
  { key: 'informal-signup', name: '⏰╭𝐈𝐧𝐟𝐨𝐫𝐦𝐚𝐥-𝐒𝐢𝐠𝐧𝐮𝐩', category: 'Events, Signups & Public', description: 'Gunfight alerts timer loop every 1h44m', icon: '⏰' },
  { key: 'public-winlog', name: '💵︱𝐏𝐮𝐛𝐥𝐢𝐜-𝐖𝐢𝐧𝐥𝐨𝐠', category: 'Events, Signups & Public', description: 'Wins visible on the public records', icon: '💵' },
  { key: 'public-informallog', name: '📜╰public-informallog', category: 'Events, Signups & Public', description: 'Public informal match log links', icon: '📜' }
];

export default function DiscordConfig() {
  const { user, loading: userLoading, addNotification, API_BASE_URL } = useApp();

  const [credentials, setCredentials] = useState({
    botToken: '',
    guildId: '',
    clientId: '',
    clientSecret: '',
    adminPassword: ''
  });
  
  const [webhooks, setWebhooks] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, 'Connected' | 'Invalid' | 'Empty' | 'Testing'>>({});
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Guard: Check role access
  const isLeaderOrAdmin = user?.roles && (user.roles.includes('Leadership') || user.roles.includes('Admin'));

  // Load existing credentials
  useEffect(() => {
    if (!isLeaderOrAdmin) return;
    
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/discord-config`);
        const data = await res.json();
        
        setCredentials({
          botToken: data.botToken || '',
          guildId: data.guildId || '',
          clientId: data.clientId || '',
          clientSecret: data.clientSecret || '',
          adminPassword: data.adminPassword || ''
        });

        // Load webhooks and set initial connection statuses
        const loadedWebhooks: Record<string, string> = {};
        const initialStatuses: Record<string, any> = {};

        channelsList.forEach(ch => {
          const url = data.webhooks ? data.webhooks[ch.key] || '' : '';
          loadedWebhooks[ch.key] = url;
          initialStatuses[ch.key] = url ? 'Connected' : 'Empty';
        });

        setWebhooks(loadedWebhooks);
        setStatuses(initialStatuses);
      } catch (e) {
        addNotification('Error Loading', 'Failed to retrieve server configurations.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [isLeaderOrAdmin]);

  // Status counters calculations
  const totalCount = channelsList.length;
  const connectedCount = Object.values(statuses).filter(s => s === 'Connected').length;
  const emptyCount = Object.values(statuses).filter(s => s === 'Empty').length;
  const pendingCount = totalCount - connectedCount - emptyCount;

  // Handle credentials changes
  const handleCredChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  // Handle webhooks changes
  const handleWebhookChange = (key: string, value: string) => {
    setWebhooks(prev => ({ ...prev, [key]: value }));
    setStatuses(prev => ({
      ...prev,
      [key]: value === '' ? 'Empty' : value.startsWith('https://discord.com/api/webhooks/') ? 'Connected' : 'Invalid'
    }));
  };

  // Test individual webhook URL
  const testWebhook = async (key: string) => {
    const url = webhooks[key];
    const ch = channelsList.find(c => c.key === key);
    if (!url) return;

    setStatuses(prev => ({ ...prev, [key]: 'Testing' }));
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/test-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: url,
          channelName: ch ? ch.name.split('┃').pop() || ch.key : key
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setStatuses(prev => ({ ...prev, [key]: 'Connected' }));
        addNotification('Connection Success', `Webhook test passed for channel: #${key}`, 'success');
      } else {
        setStatuses(prev => ({ ...prev, [key]: 'Invalid' }));
        addNotification('Connection Failed', `Webhook test failed for #${key}: ${data.message}`, 'error');
      }
    } catch (e) {
      setStatuses(prev => ({ ...prev, [key]: 'Invalid' }));
      addNotification('Connection Failed', `Server could not ping webhook: #${key}`, 'error');
    }
  };

  // Test all webhooks sequentially
  const testAllWebhooks = async () => {
    addNotification('Verification Initiated', 'Pinging all configured Discord webhook endpoints...', 'info');
    
    for (const ch of channelsList) {
      if (webhooks[ch.key]) {
        await testWebhook(ch.key);
      }
    }
  };

  // Save Settings Server-Side
  const saveConfig = async () => {
    setSaveLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/discord-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...credentials,
          webhooks
        })
      });
      const data = await res.json();
      if (data.success) {
        addNotification('Settings Saved', 'Discord integration settings encrypted and updated server-side.', 'success');
      } else {
        addNotification('Save Failed', data.error || 'Check fields.', 'error');
      }
    } catch (e) {
      addNotification('Save Failed', 'Communication with backend failed.', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  // Reset all configuration settings
  const resetConfig = async () => {
    if (!confirm('Are you sure you want to clear all Discord credentials and webhooks from the server? This will wipe integration.')) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/discord-config/reset`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCredentials({ botToken: '', guildId: '', clientId: '', clientSecret: '', adminPassword: '' });
        const clearedWebhooks: Record<string, string> = {};
        const clearedStatuses: Record<string, any> = {};
        channelsList.forEach(ch => {
          clearedWebhooks[ch.key] = '';
          clearedStatuses[ch.key] = 'Empty';
        });
        setWebhooks(clearedWebhooks);
        setStatuses(clearedStatuses);
        addNotification('Configuration Reset', 'All integration values cleared.', 'info');
      }
    } catch (e) {
      addNotification('Reset Failed', 'Server error during reset.', 'error');
    }
  };

  // Access check
  if (userLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-t-transparent border-primary rounded-full animate-spin" />
        <span className="font-tech text-xs mt-3 text-zinc-400">AUTHORIZING PERMISSIONS...</span>
      </div>
    );
  }

  if (!user || !isLeaderOrAdmin) {
    return (
      <div className="max-w-md mx-auto bg-zinc-950 border border-red-500/30 rounded p-8 flex flex-col items-center gap-4 text-center mt-12 shadow-2xl glow-red">
        <ShieldAlert className="w-16 h-16 text-red-500 animate-pulse" />
        <h2 className="font-title font-black text-2xl italic text-red-400">ACCESS RESTRICTED</h2>
        <p className="font-tech text-xs text-zinc-500 leading-relaxed">
          The Discord Integration Panel is exclusively reserved for members holding **Leadership** or **Admin** status in the White Pigeon server hierarchy. Credentials are AES-256 encrypted.
        </p>
        <Link 
          href="/" 
          className="mt-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-title font-bold text-xs italic tracking-wider py-2 px-6 rounded transition-all"
        >
          RETURN TO HOME
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950 border border-zinc-850 p-6 rounded shadow-lg">
        <div>
          <h1 className="font-title font-black text-2xl md:text-3xl italic text-white flex items-center gap-2">
            <Bot className="w-8 h-8 text-primary" /> DISCORD CONFIGURATION PANEL
          </h1>
          <p className="font-tech text-xs text-zinc-400 mt-1">
            Connect bot, register server webhooks, and sync tabs in real-time. Settings are saved encrypted.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={testAllWebhooks}
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-title text-xs font-bold py-2 px-4 rounded border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> TEST ALL
          </button>
          <button 
            onClick={saveConfig}
            disabled={saveLoading}
            className="bg-primary hover:bg-primary-hover text-white font-title text-xs font-bold py-2 px-4 rounded border border-primary-hover glow-magenta transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> {saveLoading ? 'SAVING...' : 'SAVE CONFIG'}
          </button>
          <button 
            onClick={resetConfig}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-title text-xs font-bold py-2 px-4 rounded border border-red-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> RESET
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'TOTAL MODULES', value: totalCount, color: 'text-zinc-400 bg-zinc-950/40 border-zinc-850' },
          { label: 'CONNECTED CHANNELS', value: connectedCount, color: 'text-green-400 bg-green-500/5 border-green-500/20' },
          { label: 'PENDING CHECK', value: pendingCount, color: 'text-amber-400 bg-amber-500/5 border-amber-500/20' },
          { label: 'EMPTY WEBHOOKS', value: emptyCount, color: 'text-zinc-500 bg-zinc-900/10 border-zinc-900' }
        ].map((item, idx) => (
          <div key={idx} className={`border p-4 rounded text-center select-none ${item.color}`}>
            <span className="text-[10px] font-tech tracking-wider block font-bold uppercase">{item.label}</span>
            <span className="font-title font-black text-2xl block italic mt-1">{item.value}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-24 font-tech text-xs text-zinc-500 animate-pulse">
          RETRIEVING ENCRYPTED CREDENTIALS FROM VAULT...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Credentials section */}
          <div className="lg:col-span-1 bg-zinc-950 border border-zinc-850 p-6 rounded flex flex-col gap-5">
            <h2 className="font-title font-bold text-sm text-primary tracking-wide uppercase border-b border-zinc-850 pb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-primary" /> BOT & SERVER CREDENTIALS
            </h2>

            <div className="flex flex-col gap-4 font-tech">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">DISCORD BOT TOKEN</label>
                <input 
                  type="password"
                  name="botToken"
                  value={credentials.botToken}
                  onChange={handleCredChange}
                  placeholder="MzA4ODEx..." 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 focus:border-primary/50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">GUILD / SERVER ID</label>
                <input 
                  type="text"
                  name="guildId"
                  value={credentials.guildId}
                  onChange={handleCredChange}
                  placeholder="859385929..." 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 focus:border-primary/50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">OAUTH2 CLIENT ID</label>
                <input 
                  type="text"
                  name="clientId"
                  value={credentials.clientId}
                  onChange={handleCredChange}
                  placeholder="1048293..." 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 focus:border-primary/50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">OAUTH2 CLIENT SECRET</label>
                <input 
                  type="password"
                  name="clientSecret"
                  value={credentials.clientSecret}
                  onChange={handleCredChange}
                  placeholder="••••••••" 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 focus:border-primary/50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">MASTER ADMIN PASSWORD</label>
                <input 
                  type="password"
                  name="adminPassword"
                  value={credentials.adminPassword}
                  onChange={handleCredChange}
                  placeholder="••••••••" 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 focus:border-primary/50 outline-none"
                />
              </div>
            </div>

            <div className="bg-zinc-900/60 p-4 border border-zinc-800 rounded flex gap-3 text-zinc-500 mt-2">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed">
                OAuth2 setup is required to allow members to log in with their Discord accounts and synchronize their family ranking automatically.
              </p>
            </div>
          </div>

          {/* Webhooks Section */}
          <div className="lg:col-span-2 bg-zinc-950 border border-zinc-850 p-6 rounded flex flex-col gap-4">
            <h2 className="font-title font-bold text-sm text-secondary tracking-wide uppercase border-b border-zinc-850 pb-2 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-secondary" /> CHANNEL WEBHOOK URL CONFIGURATION
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-tech text-xs">
                <thead>
                  <tr className="text-[10px] font-bold text-zinc-500 border-b border-zinc-850">
                    <th className="py-2">CHANNEL TABS</th>
                    <th className="py-2">WEBHOOK INTEGRATION URL</th>
                    <th className="py-2 text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {channelsList.map((ch) => {
                    const status = statuses[ch.key] || 'Empty';
                    let statusBadge = 'bg-zinc-900 text-zinc-500 border-zinc-800';
                    if (status === 'Connected') statusBadge = 'bg-green-500/10 text-green-400 border-green-500/20';
                    if (status === 'Invalid') statusBadge = 'bg-red-500/10 text-red-400 border-red-500/20';
                    if (status === 'Testing') statusBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse';

                    return (
                      <tr key={ch.key} className="hover:bg-zinc-900/20">
                        <td className="py-3 pr-4 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{ch.icon}</span>
                            <div>
                              <span className="font-bold text-zinc-300 block">{ch.name}</span>
                              <span className="text-[9px] text-zinc-500 uppercase font-tech">{ch.category}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <input 
                            type="password"
                            value={webhooks[ch.key] || ''}
                            onChange={(e) => handleWebhookChange(ch.key, e.target.value)}
                            placeholder="https://discord.com/api/webhooks/..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-1.5 text-xs text-zinc-400 focus:border-secondary/50 outline-none font-mono"
                          />
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase ${statusBadge}`}>
                              {status}
                            </span>
                            {webhooks[ch.key] && (
                              <button 
                                onClick={() => testWebhook(ch.key)}
                                className="p-1 text-zinc-500 hover:text-secondary hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Footer warning */}
      <div className="border border-amber-500/20 bg-amber-500/5 p-4 rounded flex gap-3 text-amber-400">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <span className="font-bold text-xs block font-title">IMPORTANT SECURITY ADVISORY</span>
          <span className="font-tech text-xs text-zinc-400 block mt-1 leading-relaxed">
            All bot tokens and client credentials are encrypted server-side using AES-256-CBC. Once configuration is saved, webhooks are never returned in plain text to the client web panel; they are permanently masked like password credentials.
          </span>
        </div>
      </div>
    </div>
  );
}
