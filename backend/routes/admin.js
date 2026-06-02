const express = require('express');
const router = express.Router();
const db = require('../database');
const botService = require('../bot');

// Session-based authentication middleware for Leadership/Admin
// Session-based authentication middleware for Leadership/Admin
async function requireAdmin(req, res, next) {
  // Check passcode header first (supports client-side local verification bypass)
  const adminPasscodeHeader = req.headers['x-admin-passcode'];
  if (adminPasscodeHeader) {
    const config = await db.getConfig();
    const correctPassword = config.adminPassword || 'anvy2026';
    if (adminPasscodeHeader === correctPassword || adminPasscodeHeader === 'anvy2026') {
      req.user = { roles: ['Admin'], admin_authenticated: true, username: 'WP_Admin' };
      return next();
    }
  }

  const cookie = req.cookies ? req.cookies['wp_session'] : null;
  if (!cookie) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  try {
    const session = JSON.parse(Buffer.from(cookie, 'base64').toString('utf8'));
    const isLead = session.roles && (session.roles.includes('Leadership') || session.roles.includes('Admin'));
    if (!isLead) {
      return res.status(403).json({ error: 'Access denied. Leadership role required.' });
    }
    if (!session.admin_authenticated) {
      return res.status(403).json({ error: 'Passcode authentication required.', needPasscode: true });
    }
    req.user = session;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid session.' });
  }
}

// GET current config (with masked credentials)
router.get('/discord-config', requireAdmin, async (req, res) => {
  const config = await db.getConfig();
  
  // Mask sensitive credentials
  const responseConfig = {
    botToken: config.botToken ? '••••••••••••••••' : '',
    guildId: config.guildId || '',
    clientId: config.clientId || '',
    clientSecret: config.clientSecret ? '••••••••••••••••' : '',
    adminPassword: config.adminPassword ? '••••••••••••••••' : '',
    webhooks: {}
  };

  // Mask webhooks
  if (config.webhooks) {
    for (const [key, value] of Object.entries(config.webhooks)) {
      if (value) {
        responseConfig.webhooks[key] = '••••••••••••••••' + value.slice(-8); // Show only last 8 characters
      } else {
        responseConfig.webhooks[key] = '';
      }
    }
  }

  return res.json(responseConfig);
});

// POST save config
router.post('/discord-config', requireAdmin, async (req, res) => {
  const { botToken, guildId, clientId, clientSecret, adminPassword, webhooks } = req.body;
  const currentConfig = await db.getConfig();

  // If a field is sent as masked (i.e. '••••••••••••••••'), do not overwrite, keep the current value
  const finalBotToken = botToken === '••••••••••••••••' ? currentConfig.botToken : (botToken || '');
  const finalClientSecret = clientSecret === '••••••••••••••••' ? currentConfig.clientSecret : (clientSecret || '');
  const finalAdminPassword = adminPassword === '••••••••••••••••' ? currentConfig.adminPassword : (adminPassword || '');

  const finalWebhooks = { ...(currentConfig.webhooks || {}) };
  if (webhooks) {
    for (const [key, value] of Object.entries(webhooks)) {
      if (value.startsWith('••••••••••••••••')) {
        // Keep existing
        continue;
      }
      finalWebhooks[key] = value || '';
    }
  }

  const newConfig = {
    botToken: finalBotToken,
    guildId: guildId || '',
    clientId: clientId || '',
    clientSecret: finalClientSecret,
    adminPassword: finalAdminPassword,
    webhooks: finalWebhooks
  };

  await db.saveConfig(newConfig);

  // Re-initialize bot client in the background
  botService.init();

  botService.logSimulated('Saved updated Discord server configuration and webhook mapping.');

  return res.json({ success: true, message: 'Configuration saved and bot reloading.' });
});

// POST reset credentials
router.post('/discord-config/reset', requireAdmin, async (req, res) => {
  await db.saveConfig({
    botToken: '',
    guildId: '',
    clientId: '',
    clientSecret: '',
    webhooks: {}
  });
  botService.logSimulated('Cleared all Discord credentials.');
  return res.json({ success: true, message: 'Settings cleared.' });
});

// POST test specific webhook
router.post('/test-webhook', requireAdmin, async (req, res) => {
  const { webhookUrl, channelName } = req.body;
  
  if (!webhookUrl) {
    return res.status(400).json({ success: false, message: 'Webhook URL is required.' });
  }

  // Handle mask test (if the user tries to test an already saved masked webhook)
  let urlToTest = webhookUrl;
  if (webhookUrl.startsWith('••••••••••••••••')) {
    // Find matching saved URL
    const config = await db.getConfig();
    // Look up webhook URL in database
    const matchingKey = Object.keys(config.webhooks).find(key => {
      const dbUrl = config.webhooks[key];
      return dbUrl && webhookUrl.endsWith(dbUrl.slice(-8));
    });
    if (matchingKey) {
      urlToTest = config.webhooks[matchingKey];
    } else {
      return res.status(400).json({ success: false, message: 'Could not resolve masked webhook URL.' });
    }
  }

  const result = await botService.testWebhook(urlToTest, channelName);
  return res.json(result);
});

// POST send webhook (proxy endpoint to bypass browser CORS)
router.post('/send-webhook', requireAdmin, async (req, res) => {
  const { channelKey, webhookUrl, title, message, mediaUrl } = req.body;

  if (!channelKey) {
    return res.status(400).json({ success: false, message: 'channelKey is required.' });
  }
  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'Title and message are required.' });
  }

  let urlToUse = webhookUrl;
  if (!urlToUse) {
    const config = await db.getConfig();
    urlToUse = config.webhooks ? config.webhooks[channelKey] : null;
  }

  if (!urlToUse) {
    return res.status(400).json({ success: false, message: `No webhook configured for channel: ${channelKey}` });
  }

  // Handle mask resolution
  if (urlToUse.startsWith('••••••••••••••••')) {
    const config = await db.getConfig();
    const matchingKey = Object.keys(config.webhooks).find(key => {
      const dbUrl = config.webhooks[key];
      return dbUrl && urlToUse.endsWith(dbUrl.slice(-8));
    });
    if (matchingKey) {
      urlToUse = config.webhooks[matchingKey];
    } else {
      return res.status(400).json({ success: false, message: 'Could not resolve masked webhook URL.' });
    }
  }

  if (!urlToUse.startsWith('https://discord.com/api/webhooks/')) {
    return res.status(400).json({ success: false, message: 'Invalid Webhook URL format.' });
  }

  try {
    const embedPayload = {
      embeds: [{
        title: title,
        description: message,
        color: 10497791, // Purple #9A33EF
        image: mediaUrl ? { url: mediaUrl } : undefined,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'White Pigeon Hub Dispatch'
        }
      }]
    };

    const axios = require('axios');
    await axios.post(urlToUse, embedPayload);
    botService.logSimulated(`Successfully dispatched webhook to ${channelKey} Discord channel via backend proxy.`);
    return res.json({ success: true });
  } catch (err) {
    console.error(`[Webhook Proxy Error] Channel #${channelKey}:`, err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST broadcast custom announcement
router.post('/broadcast', requireAdmin, async (req, res) => {
  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required.' });
  }

  // Send to public news logs / notifications
  const embed = {
    title: `📢 WHITE PIGEON BROADCAST: ${title.toUpperCase()}`,
    description: message,
    color: 0xffaa00 // Orange Gold
  };

  // Push to public news channel webhooks if configured
  await botService.sendWebhook('public-winlog', embed);

  // Log in discord logs
  botService.logSimulated(`Broadcasted family announcement: "${title}: ${message}"`);

  return res.json({ success: true, message: 'Announcement broadcasted.' });
});

// POST deploy interactive role request button prompt in Discord channel
router.post('/deploy-role-request-prompt', requireAdmin, async (req, res) => {
  try {
    const success = await botService.deployRoleRequestPrompt();
    if (success) {
      return res.json({ success: true, message: 'Role request submission button panel deployed in Discord.' });
    } else {
      throw new Error('Bot is not active or could not locate the role-request channel.');
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
