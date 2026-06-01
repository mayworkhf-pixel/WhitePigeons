const express = require('express');
const router = express.Router();
const db = require('../database');
const botService = require('../bot');

// Session-based authentication middleware for Leadership/Admin
function requireAdmin(req, res, next) {
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
router.get('/discord-config', requireAdmin, (req, res) => {
  const config = db.getConfig();
  
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
  const currentConfig = db.getConfig();

  // If a field is sent as masked (i.e. '••••••••••••••••'), do not overwrite, keep the current value
  const finalBotToken = botToken === '••••••••••••••••' ? currentConfig.botToken : botToken;
  const finalClientSecret = clientSecret === '••••••••••••••••' ? currentConfig.clientSecret : clientSecret;
  const finalAdminPassword = adminPassword === '••••••••••••••••' ? currentConfig.adminPassword : adminPassword;

  const finalWebhooks = { ...(currentConfig.webhooks || {}) };
  if (webhooks) {
    for (const [key, value] of Object.entries(webhooks)) {
      if (value.startsWith('••••••••••••••••')) {
        // Keep existing
        continue;
      }
      finalWebhooks[key] = value;
    }
  }

  const newConfig = {
    botToken: finalBotToken,
    guildId,
    clientId,
    clientSecret: finalClientSecret,
    adminPassword: finalAdminPassword,
    webhooks: finalWebhooks
  };

  db.saveConfig(newConfig);

  // Re-initialize bot client in the background
  botService.init();

  botService.logSimulated('Saved updated Discord server configuration and webhook mapping.');

  return res.json({ success: true, message: 'Configuration saved and bot reloading.' });
});

// POST reset credentials
router.post('/discord-config/reset', requireAdmin, (req, res) => {
  db.saveConfig({
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
    const config = db.getConfig();
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

module.exports = router;
