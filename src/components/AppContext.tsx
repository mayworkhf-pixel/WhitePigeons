'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Strike {
  id: string;
  reason: string;
  date: string;
  issuedBy: string;
}

export interface User {
  discordId: string;
  username: string;
  nickname: string;
  roles: string[];
  isTop10: boolean;
  avatar: string;
  isMock: boolean;
  kills: number;
  weeklyKills: number;
  balance: number;
  strikes: Strike[];
  points: number;
  activityScore: number;
  admin_authenticated?: boolean;
}

export interface LogEntry {
  timestamp: string;
  message: string;
}

export interface WebhookNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  timestamp: string;
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  botReady: boolean;
  socket: Socket | null;
  logs: LogEntry[];
  notifications: WebhookNotification[];
  timers: {
    nextInformalCountdown: number;
  };
  activeTab: string;
  setActiveTab: (tab: string) => void;
  loginMock: (role: string, username: string) => void;
  logout: () => Promise<void>;
  addNotification: (title: string, message: string, type: WebhookNotification['type']) => void;
  refreshUser: () => Promise<void>;
  API_BASE_URL: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [botReady, setBotReady] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [notifications, setNotifications] = useState<WebhookNotification[]>([]);
  const [timers, setTimers] = useState({ nextInformalCountdown: 0 });
  const [activeTab, setActiveTabState] = useState('home');

  // Synchronize activeTab state with URL query parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || 'home';
      setActiveTabState(tab);
    }
  }, []);

  const setActiveTab = (tabName: string) => {
    setActiveTabState(tabName);
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}?tab=${tabName}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  };


  // Refresh current user session
  const refreshUser = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, { cache: 'no-store' });
      const data = await res.json();
      if (data.loggedIn) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      console.warn('Backend not responding to session check.');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Run initial session check
  useEffect(() => {
    refreshUser();
  }, []);

  // Initialize Socket.io Connection
  useEffect(() => {
    const socketInstance = io(API_BASE_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log(`Websocket Connected to ${API_BASE_URL}`);
    });

    socketInstance.on('status_update', (data: { nextInformalCountdown: number; botReady: boolean }) => {
      setBotReady(data.botReady);
      setTimers(prev => ({ ...prev, nextInformalCountdown: data.nextInformalCountdown }));
    });

    socketInstance.on('timer_sync', (data: { nextInformalCountdown: number }) => {
      setTimers(prev => ({ ...prev, nextInformalCountdown: data.nextInformalCountdown }));
    });

    socketInstance.on('simulated_log', (log: LogEntry) => {
      setLogs(prev => [log, ...prev].slice(0, 100)); // Limit to last 100 logs
    });

    socketInstance.on('system_notification', (notif: { title: string; message: string; type: WebhookNotification['type'] }) => {
      addNotification(notif.title, notif.message, notif.type);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Pull active channel messages from Discord REST API on tab change/periodically
  useEffect(() => {
    const validKeys = [
      'role-request', 'rolereq-review', 'strikes', 'tickets', 'check-balance',
      'bonus-approval', 'bizwar-collect', 'rp-collect', 'submit-activity',
      'activity-results', 'activity-points-leaderboard', 'point-shop',
      'activity-review', 'order-details', 'rp-signup', 'informal-signup',
      'public-winlog', 'public-informallog', 'top-10-list'
    ];

    if (!validKeys.includes(activeTab)) {
      return;
    }

    const fetchChannelLogs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/discord/messages?channelKey=${activeTab}`, { cache: 'no-store' });
        if (res.ok) {
          const channelLogs = await res.json();
          if (Array.isArray(channelLogs)) {
            setLogs(channelLogs);
          }
        }
      } catch (e) {
        console.warn('Failed to load active Discord channel logs.');
      }
    };

    fetchChannelLogs();

    // Poll logs every 15 seconds for live serverless updating
    const interval = setInterval(fetchChannelLogs, 15000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Notification Helper
  const addNotification = (title: string, message: string, type: WebhookNotification['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    const newNotif: WebhookNotification = {
      id,
      title,
      message,
      type,
      timestamp: new Date().toISOString()
    };

    setNotifications(prev => [newNotif, ...prev]);

    // Push standard browser notification if permission granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`White Pigeon Command Hub - ${title}`, {
        body: message,
        icon: '/favicon.ico'
      });
    }

    // Play notification sound if desired (visual is mandatory, audio triggers clean)
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(type === 'warning' ? 300 : 520, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  // Request browser permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Dev Mock Login redirect
  const loginMock = (role: string, username: string) => {
    window.location.href = `${API_BASE_URL}/api/auth/login?mockRole=${role}&mockUsername=${username}`;
  };

  // Logout routine
  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`);
      setUser(null);
      window.location.href = '/';
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      loading,
      botReady,
      socket,
      logs,
      notifications,
      timers,
      activeTab,
      setActiveTab,
      loginMock,
      logout,
      addNotification,
      refreshUser,
      API_BASE_URL
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
