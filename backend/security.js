const crypto = require('crypto');

const SESSION_COOKIE = 'wp_session';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LEGACY_SESSION_ALLOWED = process.env.ALLOW_LEGACY_SESSIONS === 'true' || process.env.NODE_ENV !== 'production';

function getSecret(name) {
  const value = process.env[name];
  if (value && value.length >= 32) {
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set to at least 32 characters in production.`);
  }
  return crypto.createHash('sha256').update(`${name}:white-pigeon-local-development`).digest('hex');
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function signSession(session) {
  const payload = base64UrlEncode(JSON.stringify({
    ...session,
    issuedAt: Date.now()
  }));
  const signature = crypto
    .createHmac('sha256', getSecret('SESSION_SECRET'))
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function parseSessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  if (token.includes('.')) {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = crypto
      .createHmac('sha256', getSecret('SESSION_SECRET'))
      .update(payload)
      .digest('base64url');
    if (!safeEqual(signature, expected)) return null;
    return JSON.parse(base64UrlDecode(payload));
  }

  if (!LEGACY_SESSION_ALLOWED) return null;
  return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
}

function getSessionFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  let token = req.cookies ? req.cookies[SESSION_COOKIE] : null;
  if (!token && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  if (!token) return null;
  try {
    return parseSessionToken(token);
  } catch {
    return null;
  }
}

function setSessionCookie(res, session) {
  const token = signSession(session);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: SESSION_MAX_AGE_MS
  });
  return token;
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
}

function getConfiguredAdminPassword(config = {}) {
  return process.env.ADMIN_PASSCODE || config.adminPassword || 'Grand2026';
}

function isLeadershipSession(session) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];
  return roles.some(role => [
    'Leadership',
    'Admin',
    'High Command',
    'HIGH COMMAND',
    'High-Command',
    'HC',
    '👑 | Leader',
    '🥇 | UnderBoss'
  ].includes(role));
}

function sanitizeString(value, maxLength = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function sanitizeMember(member) {
  if (!member) return member;
  const safeMember = { ...member };
  delete safeMember.password;
  delete safeMember.passwordHash;
  return safeMember;
}

function sanitizeMembers(members) {
  return Array.isArray(members) ? members.map(sanitizeMember) : [];
}

function isDiscordWebhookUrl(value) {
  return /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(String(value || ''));
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:');
  } catch {
    return false;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
  return `pbkdf2$sha256$210000$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!password || !stored) return false;
  const value = String(stored);
  if (!value.startsWith('pbkdf2$')) {
    return safeEqual(password.trim(), value.trim());
  }

  const [, algorithm, iterationsText, salt, expectedHash] = value.split('$');
  const iterations = Number(iterationsText);
  if (algorithm !== 'sha256' || !iterations || !salt || !expectedHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, algorithm).toString('hex');
  return safeEqual(hash, expectedHash);
}

function createRateLimiter({ windowMs = 60_000, max = 120 } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${req.baseUrl || ''}:${req.path || ''}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt > windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({ error: 'Too many requests. Please wait and try again.' });
    }
    return next();
  };
}

function getAllowedOrigins() {
  const configured = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  return [
    'http://localhost:3000',
    'https://whitepigeons-35431.web.app',
    'https://whitepigeons-35431.firebaseapp.com',
    ...configured
  ];
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (getAllowedOrigins().includes(origin)) return true;
  return /^http:\/\/localhost:\d+$/.test(origin)
    || /^https:\/\/whitepigeons-35431\.(web\.app|firebaseapp\.com)$/.test(origin);
}

module.exports = {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  clearSessionCookie,
  createRateLimiter,
  getAllowedOrigins,
  getConfiguredAdminPassword,
  getSessionFromRequest,
  hashPassword,
  isAllowedOrigin,
  isDiscordWebhookUrl,
  isHttpUrl,
  isLeadershipSession,
  safeEqual,
  sanitizeMember,
  sanitizeMembers,
  sanitizeString,
  setSessionCookie,
  verifyPassword
};
