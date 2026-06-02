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
  Link as LinkIcon
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
  const { user, loading: userLoading, addNotification } = useApp();
  
  const [webhooks, setWebhooks] = useState<Record<string, string>>({});
  const [broadcastForm, setBroadcastForm] = useState({
    channelKey: 'announcements',
    title: '',
    message: '',
    mediaUrl: ''
  });
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  // Load webhooks from localStorage on client-side mount
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
  }, []);

  const handleWebhookChange = (key: string, value: string) => {
    setWebhooks(prev => ({ ...prev, [key]: value }));
  };

  const saveWebhooks = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wp_webhooks', JSON.stringify(webhooks));
      addNotification('Registry Updated', 'Discord webhook addresses saved locally.', 'success');
    }
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
      const embedPayload = {
        embeds: [{
          title: broadcastForm.title,
          description: broadcastForm.message,
          color: 10497791, // Purple #9A33EF
          image: broadcastForm.mediaUrl ? { url: broadcastForm.mediaUrl } : undefined,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'White Pigeon Hub Dispatch'
          }
        }]
      };

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embedPayload)
      });

      if (res.ok) {
        addNotification('Alert Broadcasted', 'Discord announcement dispatched successfully!', 'success');
        setBroadcastForm(prev => ({ ...prev, title: '', message: '', mediaUrl: '' }));
      } else {
        throw new Error('Discord rejected webhook post.');
      }
    } catch (err: any) {
      addNotification('Dispatch Failed', err.message || 'Webhook unreachable.', 'error');
    } finally {
      setBroadcastLoading(false);
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
    <div className="flex flex-col gap-8 pb-12 font-sans">
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
              Paste the Discord Webhook URLs from your channel integration settings. Webhooks are encrypted and saved securely inside your browser's private local storage. When you send messages, they post directly to Discord from your browser without complex server-side bot setups.
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
    </div>
  );
}
