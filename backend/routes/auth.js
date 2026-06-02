const express = require('express');
const router = express.Router();
const db = require('../database');
const botService = require('../bot');
const axios = require('axios');
const {
  clearSessionCookie,
  getConfiguredAdminPassword,
  getSessionFromRequest,
  hashPassword,
  safeEqual,
  sanitizeMember,
  sanitizeString,
  setSessionCookie,
  verifyPassword
} = require('../security');

function getFrontendUrl() {
  return process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production'
    ? 'https://whitepigeons-35431.web.app'
    : 'http://localhost:3000');
}

function getBackendUrl(req) {
  return process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
}

// Login endpoint (Redirects to Discord OAuth or handles Mock login)
router.get('/login', async (req, res) => {
  const { mockRole, mockUsername } = req.query;

  // Handle Mock Login (extremely helpful for local development / testing)
  if (mockRole) {
    let roles = ['Member'];
    let id = 'mock-member1';
    let username = mockUsername || 'VitoScaletta';
    let isTop10 = false;

    if (mockRole.toLowerCase() === 'admin' || mockRole.toLowerCase() === 'leadership') {
      roles = ['Leadership', 'Admin'];
      id = 'mock-admin';
      username = mockUsername || 'PigeonBoss';
      isTop10 = true;
    } else if (mockRole.toLowerCase() === 'public') {
      roles = [];
      id = 'mock-public';
      username = mockUsername || 'GuestPigeon';
      isTop10 = false;
    }

    // Find or create member in DB
    let member = await db.getMember(id);
    if (!member && roles.length > 0) {
      member = await db.updateMember(id, {
        username,
        nickname: `WP | ${username}`,
        roles,
        isTop10
      });
    }

    // Set cookie session (base64 encoded JSON for simplicity and portability)
    const session = {
      discordId: id,
      username,
      nickname: member ? member.nickname : username,
      roles,
      isTop10,
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
      isMock: true
    };
    
    setSessionCookie(res, session);

    botService.logSimulated(`Logged in via DEV MOCK as ${username} (${roles.join('/')})`);
    return res.redirect(`${getFrontendUrl()}/portal`);
  }

  // Live Discord OAuth Login
  const config = await db.getConfig();
  if (!config.clientId) {
    return res.status(400).send('OAuth Client ID is not configured in the Admin settings.');
  }

  const redirectUri = `${getBackendUrl(req)}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds.members.read'
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

// OAuth Callback handler
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect(`${getFrontendUrl()}/?error=no_code`);
  }

  const config = await db.getConfig();
  if (!config.clientId || !config.clientSecret || !config.guildId) {
    return res.status(500).send('OAuth Configuration incomplete.');
  }

  try {
    // 1. Exchange OAuth code for access token
    const redirectUri = `${getBackendUrl(req)}/api/auth/callback`;
    const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    // 2. Fetch User Info
    const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const user = userResponse.data;

    // 3. Fetch User Member Guild Info to read server roles
    let memberRoles = [];
    let isTop10 = false;
    let nickname = user.username;

    try {
      const guildMemberResponse = await axios.get(`https://discord.com/api/v10/users/@me/guilds/${config.guildId}/member`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const memberData = guildMemberResponse.data;
      nickname = memberData.nick || user.username;

      // Sync server roles.
      memberRoles = ['Member'];
      
      // Fetch details from bot client if available
      if (botService.isReady && botService.isReady()) {
        // Safe check
      }
    } catch (e) {
      console.warn('Could not fetch guild member roles, defaulting to basic permissions:', e.message);
      memberRoles = ['Member']; // Fallback
    }

    // 4. Save/Update user in database
    const dbMember = await db.updateMember(user.id, {
      username: user.username,
      nickname,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
      roles: memberRoles,
      isTop10
    });

    // 5. Create Session Cookie
    const session = {
      discordId: user.id,
      username: user.username,
      nickname,
      roles: dbMember.roles,
      isTop10: dbMember.isTop10,
      avatar: dbMember.avatar,
      isMock: false
    };

    setSessionCookie(res, session);

    botService.logSimulated(`Logged in via Discord OAuth as ${user.username}`);
    return res.redirect(`${getFrontendUrl()}/portal`);
  } catch (err) {
    console.error('OAuth Callback Error:', err.message);
    return res.redirect(`${getFrontendUrl()}/?error=auth_failed`);
  }
});

// GET registration status for a player
router.get('/registration-status', async (req, res) => {
  try {
    const { inGameId } = req.query;
    if (!inGameId) {
      return res.status(400).json({ error: 'inGameId is required.' });
    }
    const member = await db.getMember(sanitizeString(inGameId, 32));
    if (!member) {
      return res.json({ status: 'none' });
    }
    return res.json({ status: member.status || 'approved' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST register member request
router.post('/register', async (req, res) => {
  const { inGameId, firstName, lastName, password } = req.body;
  if (!inGameId || !firstName || !lastName || !password) {
    return res.status(400).json({ success: false, error: 'All fields, including password, are required.' });
  }

  const normalizedId = sanitizeString(inGameId, 32);
  const cleanFirstName = sanitizeString(firstName, 48);
  const cleanLastName = sanitizeString(lastName, 48);
  const cleanPassword = String(password).trim();
  if (!/^\d{2,18}$/.test(normalizedId)) {
    return res.status(400).json({ success: false, error: 'In-game ID must be numeric.' });
  }
  if (!cleanFirstName || !cleanLastName || cleanPassword.length < 6 || cleanPassword.length > 72) {
    return res.status(400).json({ success: false, error: 'Names are required and password must be 6-72 characters.' });
  }
  
  // Check if member already exists
  const existing = await db.getMember(normalizedId);
  if (existing) {
    if (existing.status === 'pending') {
      return res.status(400).json({ success: false, error: 'Your registration request is already pending admin approval.' });
    }
    if (existing.status === 'approved' || !existing.status) {
      return res.status(400).json({ success: false, error: 'This account is already registered and approved. Please log in.' });
    }
  }

  // Check if password is already taken by another member
  const members = await db.getMembers();
  const duplicatePassword = members.find(m => verifyPassword(cleanPassword, m.passwordHash || m.password));
  if (duplicatePassword) {
    return res.status(400).json({ success: false, error: 'This password is already in use by another member. Please choose a unique password.' });
  }

  // Create new member with status: pending
  const nickname = `@${cleanFirstName}_${cleanLastName} | ${normalizedId}`;
  await db.updateMember(normalizedId, {
    discordId: normalizedId,
    username: `${cleanFirstName} ${cleanLastName}`,
    nickname,
    inGameId: normalizedId,
    firstName: cleanFirstName,
    lastName: cleanLastName,
    password: '',
    passwordHash: hashPassword(cleanPassword),
    status: 'pending',
    roles: ['Member'],
    kills: 0,
    weeklyKills: 0,
    balance: 0,
    strikes: [],
    points: 0,
    isTop10: false,
    activityScore: 70
  });

  botService.logSimulated(`New registration request submitted for ${cleanFirstName} ${cleanLastName} (In-Game ID: ${normalizedId})`);
  return res.json({ success: true, message: 'Registration has been sent and admin will review it soon' });
});

// POST login as a registered member
router.post('/member-login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password is required.' });
  }

  const enteredPassword = String(password).trim();

  // Find member by password
  const members = await db.getMembers();
  const member = members.find(m => verifyPassword(enteredPassword, m.passwordHash || m.password));

  if (!member) {
    return res.status(400).json({ success: false, error: 'Invalid password. No approved member found with this password.' });
  }

  if (member.status === 'pending') {
    return res.status(400).json({ success: false, error: 'Your registration request is still pending admin approval.' });
  }

  // Approved or pre-existing member
  const session = {
    discordId: member.discordId,
    username: member.username,
    nickname: member.nickname,
    roles: member.roles,
    isTop10: member.isTop10,
    avatar: member.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
    isMock: true
  };

  const sessionToken = setSessionCookie(res, session);

  if (member.password && !member.passwordHash) {
    await db.updateMember(member.discordId, {
      password: '',
      passwordHash: hashPassword(enteredPassword)
    });
  }

  botService.logSimulated(`Logged in as approved member ${member.nickname}`);
  return res.json({ success: true, user: sanitizeMember(member), token: sessionToken });
});

// POST verify admin passcode
router.post('/verify-admin', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password is required.' });
  }

  const config = await db.getConfig();
  const correctPassword = getConfiguredAdminPassword(config);

  if (!correctPassword) {
    return res.status(503).json({ success: false, error: 'Admin passcode is not configured on the server.' });
  }

  if (safeEqual(String(password), correctPassword)) {
    let session = getSessionFromRequest(req) || {};
    
    session.admin_authenticated = true;
    session.discordId = session.discordId || 'admin-local';
    session.username = session.username || 'WP_Admin';
    session.nickname = session.nickname || 'WP | Admin';
    session.roles = Array.from(new Set([...(session.roles || []), 'Admin']));
    session.isMock = session.isMock ?? true;

    const sessionToken = setSessionCookie(res, session);

    botService.logSimulated('Master Admin passcode verification successful.');
    return res.json({ success: true, token: sessionToken });
  } else {
    botService.logSimulated('Master Admin passcode verification failed.');
    return res.status(401).json({ success: false, error: 'Invalid passcode.' });
  }
});

// Fetch current session details
router.get('/me', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.json({ loggedIn: false, user: null });
  }
  try {
    // Fetch live data from DB to make sure things like points, kills, strikes are in sync
    const memberDetails = await db.getMember(session.discordId);
    
    return res.json({
      loggedIn: true,
      user: sanitizeMember({
        ...session,
        ...(memberDetails || {}) // Merge live DB fields
      })
    });
  } catch {
    return res.json({ loggedIn: false, user: null });
  }
});

// Logout endpoint
router.get('/logout', (req, res) => {
  clearSessionCookie(res);
  return res.json({ success: true });
});

module.exports = router;
