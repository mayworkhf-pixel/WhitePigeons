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
  Trash2
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

export default function AdminDashboard() {
  const { user, loading: userLoading, addNotification, API_BASE_URL } = useApp();
  
  const [activeSubTab, setActiveSubTab] = useState<'dispatch' | 'bot-config'>('dispatch');
  const [webhooks, setWebhooks] = useState<Record<string, string>>({});
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
    adminPassword: ''
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
            adminPassword: data.adminPassword || ''
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

  const handleWebhookChange = (key: string, value: string) => {
    setWebhooks(prev => ({ ...prev, [key]: value }));
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
          'Webhook blocked by browser CORS policy. Please ensure the Express backend is running on http://localhost:5000 to proxy the request.', 
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
          adminPassword: data.adminPassword || ''
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
          adminPassword: ''
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
      <div className="text-center py-24 font-tech text-xs text-zinc-500 animate-pulse">
        LOADING ADMINISTRATIVE HUB SECURE TIERS...
      </div>
    );
  }

  if (!user || !user.admin_authenticated) {
    return (
      <div className="max-w-md mx-auto bg-zinc-950 border border-red-500/30 rounded-2xl p-8 flex flex-col items-center gap-4 text-center mt-12 shadow-2xl">
        <ShieldAlert className="w-16 h-16 text-red-500 animate-pulse" />
        <h2 className="font-title font-black text-2xl italic text-red-400">ACCESS RESTRICTED</h2>
        <p className="font-tech text-xs text-zinc-500 leading-relaxed">
          Admin Dashboard workspaces are restricted to verified family administrators.
        </p>
        <Link href="/" className="mt-4 bg-zinc-900 border border-zinc-800 text-zinc-300 font-title font-bold text-xs py-2 px-6 rounded-xl hover:border-purple-600/30 transition-smooth">
          BACK TO HUB
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12 font-sans">
      {/* HUD Header */}
      <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <h1 className="font-title font-black text-2xl md:text-3xl italic text-white flex items-center gap-2.5">
            <ShieldCheck className="w-8 h-8 text-purple-400" /> ADMIN PANEL & DISPATCH CENTER
          </h1>
          <p className="font-tech text-xs text-zinc-400 mt-1 uppercase tracking-wider">
            Consolidated family audit interface & secure webhook communication networks.
          </p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-[#201d2d] gap-2">
        <button
          onClick={() => setActiveSubTab('dispatch')}
          className={`py-3 px-6 font-title font-bold text-xs italic tracking-wider transition-smooth border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'dispatch'
              ? 'border-purple-500 text-purple-400 bg-purple-950/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Megaphone className="w-4 h-4" /> DISPATCH CONSOLE & WEBHOOKS
        </button>
        <button
          onClick={() => setActiveSubTab('bot-config')}
          className={`py-3 px-6 font-title font-bold text-xs italic tracking-wider transition-smooth border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'bot-config'
              ? 'border-purple-500 text-purple-400 bg-purple-950/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Cpu className="w-4 h-4" /> DISCORD BOT CREDENTIALS
        </button>
      </div>

      {/* Dispatch & Webhooks Content */}
      {activeSubTab === 'dispatch' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Announcement terminal */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
              <h3 className="font-title font-black text-xs text-purple-400 tracking-wider uppercase border-b border-[#201d2d] pb-2.5 flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-purple-400 animate-pulse" /> DISPATCH CHANNEL ALERTS
              </h3>
              
              <form onSubmit={handleBroadcast} className="text-xs flex flex-col gap-4 mt-2">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">TARGET DISCORD CHANNEL</label>
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
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">ALERT HEADER TITLE</label>
                  <input 
                    type="text"
                    value={broadcastForm.title}
                    onChange={(e) => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Mandatory turf war meeting"
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs text-zinc-300 focus:border-purple-600/40 outline-none transition-smooth"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">ALERT DESCRIPTION</label>
                  <textarea 
                    rows={4}
                    value={broadcastForm.message}
                    onChange={(e) => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Type details that will compile into the Discord message embed..."
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs text-zinc-300 focus:border-purple-600/40 outline-none resize-none leading-relaxed transition-smooth"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">OPTIONAL EMBED IMAGE URL</label>
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
                  <Send className="w-4 h-4" /> {broadcastLoading ? 'DISPATCHING...' : 'DISPATCH EMBED'}
                </button>

                {broadcastForm.channelKey === 'role-request' && (
                  <button 
                    type="button"
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
                    className="bg-amber-600 hover:bg-amber-700 text-white font-title text-xs font-black italic py-3 rounded-xl border border-amber-500 glow-amber transition-smooth cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" /> DEPLOY INTERACTIVE SUBMISSION BUTTON
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Right Column: Webhook config grid */}
          <div className="lg:col-span-2 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#201d2d] pb-2.5">
              <h2 className="font-title font-black text-lg italic text-purple-400 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-purple-400" /> DISCORD WEBHOOK INTEGRATION REGISTRY
              </h2>
              <button
                onClick={saveWebhooks}
                className="bg-purple-600 hover:bg-purple-700 text-white font-title text-xs font-black italic py-2 px-5 rounded-xl border border-purple-500 transition-smooth cursor-pointer flex items-center gap-1.5 shadow-[0_0_10px_rgba(168,85,247,0.1)]"
              >
                <Save className="w-3.5 h-3.5" /> SAVE WEBHOOKS
              </button>
            </div>

            <div className="bg-[#09080d] p-4 border border-[#201d2d] rounded-2xl flex gap-3 text-zinc-400">
              <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed font-sans">
                Paste the Discord Webhook URLs from your channel integration settings. Webhooks are saved in your browser storage and synchronised with the backend database. Messages are sent via the backend proxy to avoid browser CORS blocks.
              </p>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {channelsList.map((ch) => (
                <div key={ch.key} className="bg-[#09080d]/40 border border-[#181622] hover:border-purple-600/10 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-smooth">
                  <div className="w-full sm:w-1/3 leading-tight">
                    <div className="font-bold text-zinc-100 flex items-center gap-2 text-xs">
                      <span>{ch.name}</span>
                    </div>
                    <span className="text-[9px] text-zinc-500 font-sans mt-0.5 block">{ch.description}</span>
                  </div>
                  <div className="flex-1 w-full">
                    <input 
                      type="password"
                      value={webhooks[ch.key] || ''}
                      onChange={(e) => handleWebhookChange(ch.key, e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl py-2 px-3.5 text-xs font-mono text-zinc-400 focus:text-zinc-200 focus:border-purple-600/40 outline-none transition-smooth"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Discord Bot Credentials tab */}
      {activeSubTab === 'bot-config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
          {/* Left Advice Column */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
              <h3 className="font-title font-black text-xs text-purple-400 tracking-wider uppercase border-b border-[#201d2d] pb-2.5 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-purple-400" /> DISCORD BOT SETUP
              </h3>
              <div className="text-xs text-zinc-450 leading-relaxed space-y-3 font-sans">
                <p>
                  To link your test Discord Server to the White Pigeon Hub, follow these instructions:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-zinc-400">
                  <li>Visit the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline hover:text-purple-300">Discord Developer Portal</a>.</li>
                  <li>Create a new Application and add a **Bot** under the Bot menu.</li>
                  <li>Enable the **Gateway Intents** (specifically <b>Guild Members</b>, <b>Guild Messages</b>, and <b>Message Content</b>).</li>
                  <li>Copy your **Bot Token** and paste it here.</li>
                  <li>Under OAuth2, copy your **Client ID** and **Client Secret**.</li>
                  <li>Generate an invite link, add the Bot to your Discord server, and paste your **Guild ID** (Server ID) into the form.</li>
                </ol>
                <p className="text-[10px] text-zinc-500 pt-2 border-t border-[#1e1b29]">
                  All bot credentials are stored securely and encrypted in the backend SQLite registry.
                </p>
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="lg:col-span-2 bg-[#121118] border border-[#1e1b29] p-6 rounded-2xl flex flex-col gap-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#201d2d] pb-2.5">
              <h2 className="font-title font-black text-lg italic text-purple-400 flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-400" /> SERVER CREDENTIALS VAULT
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchBotConfig}
                  disabled={credsLoading}
                  className="bg-[#121118] hover:bg-[#1a1924] text-zinc-400 hover:text-zinc-200 border border-[#201d2d] hover:border-purple-600/30 p-2 rounded-xl transition-smooth cursor-pointer"
                  title="Reload configuration from server"
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
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">DISCORD BOT TOKEN</label>
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
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">GUILD / SERVER ID</label>
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
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">OAUTH2 CLIENT ID</label>
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
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">OAUTH2 CLIENT SECRET</label>
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
                  <label className="text-[10px] text-zinc-500 font-bold block mb-1">MASTER ADMIN PASSWORD (PASSCODE)</label>
                  <input 
                    type="password"
                    name="adminPassword"
                    value={credentials.adminPassword}
                    onChange={handleCredChange}
                    placeholder="Enter new master passcode (defaults to 'anvy2026')" 
                    className="w-full bg-[#09080d] border border-[#201d2d] rounded-xl p-3 text-xs font-mono text-zinc-350 focus:text-zinc-100 focus:border-purple-600/40 outline-none transition-smooth"
                  />
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
    </div>
  );
}
