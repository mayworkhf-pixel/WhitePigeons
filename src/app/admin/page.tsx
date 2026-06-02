'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/components/AppContext';
import { 
  ShieldAlert, 
  Users, 
  Megaphone, 
  TrendingUp, 
  PackageOpen, 
  ClipboardCheck,
  Settings,
  ShieldCheck,
  FileCheck,
  Award
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const { user, loading: userLoading, addNotification, API_BASE_URL } = useApp();

  const [members, setMembers] = useState<any[]>([]);
  const [pendingActsCount, setPendingActsCount] = useState(0);
  const [pendingTktCount, setPendingTktCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  
  // Announcement Form
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '' });
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  const isLeaderOrAdmin = user?.roles && (user.roles.includes('Leadership') || user.roles.includes('Admin'));

  const loadData = async () => {
    try {
      const memRes = await fetch(`${API_BASE_URL}/api/members`);
      if (memRes.ok) setMembers(await memRes.json());

      const actRes = await fetch(`${API_BASE_URL}/api/activities`);
      if (actRes.ok) {
        const acts = await actRes.json();
        setPendingActsCount(acts.filter((a: any) => a.status === 'pending').length);
      }

      const tktRes = await fetch(`${API_BASE_URL}/api/tickets`);
      if (tktRes.ok) {
        const tkts = await tktRes.json();
        setPendingTktCount(tkts.filter((t: any) => t.status === 'open').length);
      }

      const orderRes = await fetch(`${API_BASE_URL}/api/shop/orders`);
      if (orderRes.ok) {
        const ords = await orderRes.json();
        setPendingOrdersCount(ords.filter((o: any) => o.status === 'pending').length);
      }
    } catch (e) {
      console.warn('Backend not responding during admin dashboard loading.');
    }
  };

  useEffect(() => {
    if (isLeaderOrAdmin) {
      loadData();
    }
  }, [isLeaderOrAdmin]);

  // Broadcast announcement
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title || !broadcastForm.message) return;

    setBroadcastLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(broadcastForm)
      });
      if (res.ok) {
        addNotification('Broadcast Sent', 'Site-wide notification and Discord announcement dispatched.', 'success');
        setBroadcastForm({ title: '', message: '' });
      }
    } catch (e) {
      addNotification('Broadcast Failed', 'Server error.', 'error');
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

  if (!user || !isLeaderOrAdmin) {
    return (
      <div className="max-w-md mx-auto bg-zinc-950 border border-red-500/30 rounded p-8 flex flex-col items-center gap-4 text-center mt-12 shadow-2xl">
        <ShieldAlert className="w-16 h-16 text-red-500 animate-pulse" />
        <h2 className="font-title font-black text-2xl italic text-red-400">ACCESS RESTRICTED</h2>
        <p className="font-tech text-xs text-zinc-500 leading-relaxed">
          Admin Dashboard workspaces are restricted to family administrators.
        </p>
        <Link href="/" className="mt-4 bg-zinc-900 border border-zinc-800 text-zinc-300 font-title font-bold text-xs py-2 px-6 rounded">
          BACK TO HUB
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* HUD Header */}
      <div className="bg-zinc-950 border border-zinc-850 p-6 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-title font-black text-2xl md:text-3xl italic text-white flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" /> LEADERSHIP CONTROL CENTER
          </h1>
          <p className="font-tech text-xs text-zinc-400 mt-1">
            Global audit dashboard, member rosters, operations ledger, and announcement terminals.
          </p>
        </div>
      </div>

      {/* Grid count alerts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-tech text-xs">
        <div className="bg-zinc-950 border border-zinc-850 p-5 rounded flex items-center justify-between">
          <div>
            <span className="text-zinc-500 block uppercase font-bold">Pending Activities</span>
            <span className="text-2xl font-title font-black text-secondary italic block mt-1">{pendingActsCount} QUEUED</span>
          </div>
          <Link href="/?tab=activity-review" className="p-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-zinc-400 hover:text-white transition-all">
            <FileCheck className="w-5 h-5 text-secondary" />
          </Link>
        </div>

        <div className="bg-zinc-950 border border-zinc-850 p-5 rounded flex items-center justify-between">
          <div>
            <span className="text-zinc-500 block uppercase font-bold">Active Support Tickets</span>
            <span className="text-2xl font-title font-black text-primary italic block mt-1">{pendingTktCount} TICKETS</span>
          </div>
          <Link href="/?tab=tickets" className="p-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-zinc-400 hover:text-white transition-all">
            <ShieldAlert className="w-5 h-5 text-primary" />
          </Link>
        </div>

        <div className="bg-zinc-950 border border-zinc-850 p-5 rounded flex items-center justify-between">
          <div>
            <span className="text-zinc-500 block uppercase font-bold">Unfulfilled Shop Orders</span>
            <span className="text-2xl font-title font-black text-accent italic block mt-1">{pendingOrdersCount} ORDERS</span>
          </div>
          <Link href="/?tab=order-details" className="p-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-zinc-400 hover:text-white transition-all">
            <PackageOpen className="w-5 h-5 text-accent" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Announcement terminal */}
        <div className="lg:col-span-1 flex flex-col gap-8">
          {/* Announcement broadsheet */}
          <div className="bg-zinc-950 border border-zinc-850 p-6 rounded flex flex-col gap-4">
            <h3 className="font-title font-bold text-xs text-primary tracking-wide uppercase border-b border-zinc-850 pb-2 flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-primary animate-pulse" /> DISPATCH FAMILY ANNOUNCEMENT
            </h3>
            
            <form onSubmit={handleBroadcast} className="font-tech text-xs flex flex-col gap-4 mt-2">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">ALERT HEADER TITLE</label>
                <input 
                  type="text"
                  value={broadcastForm.title}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Mandatory turf war meeting"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2.5 text-xs text-zinc-300 focus:border-primary/50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold block mb-1">ALERT MASSAGE DESCRIPTION</label>
                <textarea 
                  rows={4}
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Type the message detail that will flash on screens and publish to Discord channels..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2.5 text-xs text-zinc-300 focus:border-primary/50 outline-none resize-none leading-relaxed"
                />
              </div>

              <button 
                type="submit"
                disabled={broadcastLoading}
                className="bg-primary hover:bg-primary-hover text-white font-title text-xs font-black italic py-3 rounded border border-primary glow-magenta transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Megaphone className="w-4 h-4" /> {broadcastLoading ? 'BROADCASTING...' : 'BROADCAST ALERT'}
              </button>
            </form>
          </div>

          {/* Quick links settings */}
          <div className="bg-zinc-950 border border-zinc-850 p-6 rounded flex flex-col gap-3">
            <h3 className="font-title font-bold text-xs text-zinc-300 tracking-wide uppercase border-b border-zinc-850 pb-2 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-zinc-400" /> SYSTEM DIRECTORIES
            </h3>
            
            <Link 
              href="/admin/discord-config" 
              className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 p-3 rounded flex items-center justify-between text-xs font-tech text-zinc-300 transition-all cursor-pointer"
            >
              <span>⚙️ Credentials & Webhook Registry</span>
              <span className="text-secondary font-bold font-title text-[10px] italic">MANAGE</span>
            </Link>

            <Link 
              href="/?tab=strikes" 
              className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 p-3 rounded flex items-center justify-between text-xs font-tech text-zinc-300 transition-all cursor-pointer"
            >
              <span>🚨 Disciplinary & Strikes Roster</span>
              <span className="text-primary font-bold font-title text-[10px] italic">MANAGE</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Member roster table */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-850 p-6 rounded flex flex-col gap-4 shadow-md">
          <h2 className="font-title font-black text-lg italic text-secondary text-glow-cyan border-b border-zinc-850 pb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-secondary" /> FAMILY MEMBER ROSTER VAULT
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left font-tech text-xs">
              <thead>
                <tr className="text-[10px] font-bold text-zinc-500 border-b border-zinc-900 uppercase">
                  <th className="py-2.5">MEMBER</th>
                  <th className="py-2.5">ROLES</th>
                  <th className="py-2.5">STRIKES</th>
                  <th className="py-2.5">FP POINTS</th>
                  <th className="py-2.5 text-right">BANK BALANCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 font-tech">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-500 italic">
                      ROSTER EMPTY OR VAULT LOADING...
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.discordId} className="hover:bg-zinc-900/10">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <img 
                            src={m.avatar} 
                            alt={m.nickname} 
                            className="w-7 h-7 rounded border border-zinc-800"
                          />
                          <div>
                            <span className="font-bold text-zinc-200 block select-text">{m.nickname}</span>
                            <span className="text-[8px] text-zinc-500 block">@{m.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="text-zinc-400 text-[10px] uppercase font-bold">{m.roles.join(', ')}</span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded border text-[9px] font-bold font-tech ${
                          m.strikes?.length > 1 
                            ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                            : m.strikes?.length === 1 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                              : 'bg-zinc-900 text-zinc-500 border-zinc-850'
                        }`}>
                          {m.strikes?.length || 0} STRIKES
                        </span>
                      </td>
                      <td className="py-3 font-bold text-zinc-300 font-tech">
                        {m.points || 0} FP
                      </td>
                      <td className="py-3 text-right font-bold text-green-400 font-mono select-text">
                        ${(m.balance || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
