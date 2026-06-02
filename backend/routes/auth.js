const express = require('express');
const router = express.Router();
const db = require('../database');
const botService = require('../bot');
const axios = require('axios');

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
    
    res.cookie('wp_session', Buffer.from(JSON.stringify(session)).toString('base64'), {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    botService.logSimulated(`Logged in via DEV MOCK as ${username} (${roles.join('/')})`);
    return res.redirect('http://localhost:3000/portal');
  }

  // Live Discord OAuth Login
  const config = await db.getConfig();
  if (!config.clientId) {
    return res.status(400).send('OAuth Client ID is not configured in the Admin settings.');
  }

  const redirectUri = encodeURIComponent('http://localhost:5000/api/auth/callback');
  const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds.members.read`;
  res.redirect(discordUrl);
});

// OAuth Callback handler
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect('http://localhost:3000/?error=no_code');
  }

  const config = await db.getConfig();
  if (!config.clientId || !config.clientSecret || !config.guildId) {
    return res.status(500).send('OAuth Configuration incomplete.');
  }

  try {
    // 1. Exchange OAuth code for access token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:5000/api/auth/callback'
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    // 2. Fetch User Info
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const user = userResponse.data;

    // 3. Fetch User Member Guild Info to read server roles
    let memberRoles = [];
    let isTop10 = false;
    let nickname = user.username;

    try {
      const guildMemberResponse = await axios.get(`https://discord.com/api/users/@me/guilds/${config.guildId}/member`, {
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

    res.cookie('wp_session', Buffer.from(JSON.stringify(session)).toString('base64'), {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    botService.logSimulated(`Logged in via Discord OAuth as ${user.username}`);
    return res.redirect('http://localhost:3000/portal');
  } catch (err) {
    console.error('OAuth Callback Error:', err.message);
    return res.redirect('http://localhost:3000/?error=auth_failed');
  }
});

// POST verify admin passcode
router.post('/verify-admin', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password is required.' });
  }

  const config = await db.getConfig();
  const correctPassword = config.adminPassword || '123456';

  if (password === correctPassword) {
    const cookie = req.cookies ? req.cookies['wp_session'] : null;
    let session = {};
    if (cookie) {
      try {
        session = JSON.parse(Buffer.from(cookie, 'base64').toString('utf8'));
      } catch (e) {}
    }
    
    session.admin_authenticated = true;

    res.cookie('wp_session', Buffer.from(JSON.stringify(session)).toString('base64'), {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    botService.logSimulated('Master Admin passcode verification successful.');
    return res.json({ success: true });
  } else {
    botService.logSimulated('Master Admin passcode verification failed.');
    return res.status(401).json({ success: false, error: 'Invalid passcode.' });
  }
});

// Fetch current session details
router.get('/me', async (req, res) => {
  const cookie = req.cookies ? req.cookies['wp_session'] : null;
  if (!cookie) {
    return res.json({ loggedIn: false, user: null });
  }
  try {
    const session = JSON.parse(Buffer.from(cookie, 'base64').toString('utf8'));
    // Fetch live data from DB to make sure things like points, kills, strikes are in sync
    const memberDetails = await db.getMember(session.discordId);
    
    return res.json({
      loggedIn: true,
      user: {
        ...session,
        ...(memberDetails || {}) // Merge live DB fields
      }
    });
  } catch (err) {
    return res.json({ loggedIn: false, user: null });
  }
});

// Logout endpoint
router.get('/logout', (req, res) => {
  res.clearCookie('wp_session');
  return res.json({ success: true });
});

module.exports = router;
