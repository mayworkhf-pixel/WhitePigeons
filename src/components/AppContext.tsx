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
  status?: string;
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
  connectionState: 'connecting' | 'connected' | 'disconnected';
  latencyMs: number | null;
  activeUsers: number;
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
  dismissNotification: (id: string) => void;
  refreshUser: () => Promise<void>;
  API_BASE_URL: string;
}

const getApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'https://whitepigeons.onrender.com';
  }
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.startsWith('192.168.');
  
  if (isLocal) {
    return 'http://localhost:5000';
  }
  
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  
  return 'https://whitepigeons.onrender.com';
};

const API_BASE_URL = getApiBaseUrl();

function getLocalPreviewUser(): User | null {
  if (typeof window === 'undefined') return null;
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const hasAdminAuth = localStorage.getItem('wp_admin_auth') === 'true';
  if (!hasAdminAuth && (!isLocalHost || localStorage.getItem('wp_local_preview') !== 'true')) return null;

  return {
    discordId: 'admin-local',
    username: 'WP_Admin',
    nickname: 'WP | Admin',
    roles: ['Admin', 'Leadership', 'Member'],
    isTop10: true,
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
    isMock: true,
    kills: 542,
    weeklyKills: 38,
    balance: 15400000,
    strikes: [],
    points: 2450,
    activityScore: 92,
    admin_authenticated: true,
    status: 'approved'
  };
}

// Global fetch patch to automatically include credentials (cookies) and Bearer tokens for cross-origin API calls
if (typeof window !== 'undefined' && !(window as any).__wpFetchPatched) {
  const originalFetch = window.fetch.bind(window);
  Object.defineProperty(window, '__wpFetchPatched', { value: true });

  window.fetch = function (input, init = {}) {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
    const shouldAttachSession = url.startsWith('/api')
      || (!!API_BASE_URL && url.startsWith(API_BASE_URL))
      || url.startsWith('http://localhost:5000');

    if (!shouldAttachSession) {
      return originalFetch(input, init);
    }

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const token = localStorage.getItem('wp_session_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return originalFetch(input, {
      ...init,
      credentials: 'include',
      headers
    });
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [botReady, setBotReady] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [activeUsers, setActiveUsers] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [notifications, setNotifications] = useState<WebhookNotification[]>([]);
  const [timers, setTimers] = useState({ nextInformalCountdown: 0 });
  const [activeTab, setActiveTabState] = useState('about-us');

  // Synchronize activeTab state with URL query parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || 'about-us';
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
      const localPreviewUser = getLocalPreviewUser();
      if (localPreviewUser) {
        setUser(localPreviewUser);
        setLoading(false);
        return;
      }

      if (!API_BASE_URL) {
        setUser(null);
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, { cache: 'no-store' });
      const data = await res.json();
      if (data.loggedIn) {
        const updatedUser = { ...data.user };
        if (typeof window !== 'undefined') {
          localStorage.removeItem('wp_admin_auth');
        }
        setUser(updatedUser);
      } else {
        if (typeof window !== 'undefined' && localStorage.getItem('wp_admin_auth') === 'true') {
          localStorage.removeItem('wp_admin_auth');
        }
        setUser(getLocalPreviewUser());
      }
    } catch {
      console.warn('Backend not responding to session check.');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('wp_admin_auth');
      }
      setUser(getLocalPreviewUser());
    } finally {
      setLoading(false);
    }
  };

  // Run initial session check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wp_admin_passcode');
    }
    refreshUser();
  }, []);

  // Initialize Socket.io Connection
  useEffect(() => {
    if (!API_BASE_URL) {
      setConnectionState('disconnected');
      return;
    }

    const socketInstance = io(API_BASE_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      setConnectionState('connected');
    });

    socketInstance.on('disconnect', () => {
      setConnectionState('disconnected');
      setLatencyMs(null);
    });

    socketInstance.on('connect_error', () => {
      setConnectionState('disconnected');
      setLatencyMs(null);
    });

    socketInstance.on('status_update', (data: { nextInformalCountdown: number; botReady: boolean; activeUsers?: number }) => {
      setBotReady(data.botReady);
      if (typeof data.activeUsers === 'number') setActiveUsers(data.activeUsers);
      setTimers(prev => ({ ...prev, nextInformalCountdown: data.nextInformalCountdown }));
    });

    socketInstance.on('timer_sync', (data: { nextInformalCountdown: number; botReady?: boolean; activeUsers?: number }) => {
      if (typeof data.botReady === 'boolean') setBotReady(data.botReady);
      if (typeof data.activeUsers === 'number') setActiveUsers(data.activeUsers);
      setTimers(prev => ({ ...prev, nextInformalCountdown: data.nextInformalCountdown }));
    });

    socketInstance.on('simulated_log', (log: LogEntry) => {
      setLogs(prev => [log, ...prev].slice(0, 100)); // Limit to last 100 logs
    });

    socketInstance.on('system_notification', (notif: { title: string; message: string; type: WebhookNotification['type'] }) => {
      addNotification(notif.title, notif.message, notif.type);
    });

    setSocket(socketInstance);
    const pingInterval = window.setInterval(() => {
      const startedAt = performance.now();
      socketInstance.timeout(3000).emit('client_ping', { clientTime: Date.now() }, (err: Error | null, data?: { activeUsers?: number; botReady?: boolean }) => {
        if (err) {
          setLatencyMs(null);
          return;
        }
        setLatencyMs(Math.round(performance.now() - startedAt));
        if (typeof data?.activeUsers === 'number') setActiveUsers(data.activeUsers);
        if (typeof data?.botReady === 'boolean') setBotReady(data.botReady);
      });
    }, 10000);

    return () => {
      window.clearInterval(pingInterval);
      socketInstance.disconnect();
    };
  }, []);

  // Pull active channel messages from Discord REST API when the active module changes.
  useEffect(() => {
    const validKeys = [
      'role-request', 'rolereq-review', 'strikes', 'tickets', 'check-balance',
      'bonus-approval', 'bizwar-collect', 'rp-collect', 'submit-activity',
      'activity-results', 'activity-points-leaderboard', 'point-shop',
      'activity-review', 'order-details', 'rp-signup', 'informal-signup', 'signup-event',
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
      } catch {
        console.warn('Failed to load active Discord channel logs.');
      }
    };

    fetchChannelLogs();

  }, [activeTab]);

  // Notification Helper
  function addNotification(title: string, message: string, type: WebhookNotification['type'] = 'info') {
    const id = Math.random().toString(36).substring(2, 9);
    const newNotif: WebhookNotification = {
      id,
      title,
      message,
      type,
      timestamp: new Date().toISOString()
    };

    setNotifications(prev => [newNotif, ...prev]);
    window.setTimeout(() => {
      setNotifications(prev => prev.filter(item => item.id !== id));
    }, 4000);

    // Push standard browser notification if permission granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`White Pigeon Command Hub - ${title}`, {
        body: message,
        icon: '/favicon.ico'
      });
    }
  }

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
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
      if (typeof window !== 'undefined') {
        localStorage.removeItem('wp_admin_auth');
        localStorage.removeItem('wp_session_token');
        localStorage.removeItem('wp_local_preview');
      }
      await fetch(`${API_BASE_URL}/api/auth/logout`);
      setUser(null);
      window.location.href = '/';
    } catch (e) {
      console.error(e);
      setUser(null);
      window.location.href = '/';
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      loading,
      botReady,
      connectionState,
      latencyMs,
      activeUsers,
      socket,
      logs,
      notifications,
      timers,
      activeTab,
      setActiveTab,
      loginMock,
      logout,
      addNotification,
      dismissNotification,
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
