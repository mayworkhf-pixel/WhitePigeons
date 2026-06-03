const express = require('express');
const router = express.Router();
const db = require('../database');
const botService = require('../bot');
const {
  getConfiguredAdminPassword,
  getSessionFromRequest,
  isDiscordWebhookUrl,
  isHttpUrl,
  isLeadershipSession,
  safeEqual,
  sanitizeMembers,
  sanitizeString
} = require('../security');

// Session-based authentication middleware for Leadership/Admin
async function requireAdmin(req, res, next) {
  const config = await db.getConfig();
  const correctPassword = getConfiguredAdminPassword(config);

  // Optional passcode header supports older clients, but only with the configured server-side passcode.
  const adminPasscodeHeader = req.headers['x-admin-passcode'];
  if (adminPasscodeHeader && correctPassword) {
    if (safeEqual(String(adminPasscodeHeader), correctPassword)) {
      req.user = { roles: ['Admin'], admin_authenticated: true, username: 'WP_Admin' };
      return next();
    }
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  try {
    if (!isLeadershipSession(session)) {
      return res.status(403).json({ error: 'Access denied. Leadership role required.' });
    }
    if (!session.admin_authenticated) {
      return res.status(403).json({ error: 'Passcode authentication required.', needPasscode: true });
    }
    req.user = session;
    next();
  } catch {
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
    rpTicketTimes: config.rpTicketTimes || ["08:30", "15:00", "20:00", "22:30"],
    factoryVoiceChannelId: config.factoryVoiceChannelId || '',
    simulatedVoice: config.simulatedVoice || [],
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
  const { botToken, guildId, clientId, clientSecret, adminPassword, webhooks, rpTicketTimes, factoryVoiceChannelId, simulatedVoice } = req.body;
  const currentConfig = await db.getConfig();

  // If a field is sent as masked (i.e. '••••••••••••••••'), do not overwrite, keep the current value
  const finalBotToken = botToken === undefined ? currentConfig.botToken : (botToken === '••••••••••••••••' ? currentConfig.botToken : (botToken || ''));
  const finalGuildId = guildId === undefined ? currentConfig.guildId : (guildId || '');
  const finalClientId = clientId === undefined ? currentConfig.clientId : (clientId || '');
  const finalClientSecret = clientSecret === undefined ? currentConfig.clientSecret : (clientSecret === '••••••••••••••••' ? currentConfig.clientSecret : (clientSecret || ''));
  const finalAdminPassword = adminPassword === undefined ? currentConfig.adminPassword : (adminPassword === '••••••••••••••••' ? currentConfig.adminPassword : (adminPassword || ''));

  const finalWebhooks = { ...(currentConfig.webhooks || {}) };
  if (webhooks) {
    for (const [key, value] of Object.entries(webhooks)) {
      if (typeof value === 'string' && value.startsWith('••••••••••••••••')) {
        // Keep existing
        continue;
      }
      const cleanValue = sanitizeString(value, 250);
      if (cleanValue && !isDiscordWebhookUrl(cleanValue)) {
        return res.status(400).json({ success: false, message: `Invalid webhook URL for ${key}.` });
      }
      finalWebhooks[key] = cleanValue;
    }
  }

  let finalRpTicketTimes = currentConfig.rpTicketTimes || ["08:30", "15:00", "20:00", "22:30"];
  if (rpTicketTimes !== undefined) {
    if (Array.isArray(rpTicketTimes)) {
      finalRpTicketTimes = rpTicketTimes;
    } else if (typeof rpTicketTimes === 'string') {
      finalRpTicketTimes = rpTicketTimes
        .split(',')
        .map(t => t.trim())
        .filter(t => /^([01]\d|2[0-3]):([0-5]\d)$/.test(t));
    }
  }

  const finalFactoryVoiceChannelId = factoryVoiceChannelId === undefined ? (currentConfig.factoryVoiceChannelId || '') : (factoryVoiceChannelId || '');

  let finalSimulatedVoice = currentConfig.simulatedVoice || [];
  if (simulatedVoice !== undefined) {
    if (Array.isArray(simulatedVoice)) {
      finalSimulatedVoice = simulatedVoice;
    } else if (typeof simulatedVoice === 'string') {
      finalSimulatedVoice = simulatedVoice
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
    }
  }

  const newConfig = {
    botToken: finalBotToken,
    guildId: finalGuildId,
    clientId: finalClientId,
    clientSecret: finalClientSecret,
    adminPassword: finalAdminPassword,
    webhooks: finalWebhooks,
    rpTicketTimes: finalRpTicketTimes,
    factoryVoiceChannelId: finalFactoryVoiceChannelId,
    simulatedVoice: finalSimulatedVoice
  };

  try {
    await db.saveConfig(newConfig);

    // Re-initialize bot client in the background
    botService.init();

    botService.logSimulated('Saved updated Discord server configuration and webhook mapping.');

    return res.json({ success: true, message: 'Configuration saved and bot reloading.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
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
  if (typeof webhookUrl === 'string' && webhookUrl.startsWith('••••••••••••••••')) {
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

  if (!isDiscordWebhookUrl(urlToTest)) {
    return res.status(400).json({ success: false, message: 'Invalid Discord webhook URL.' });
  }

  const result = await botService.testWebhook(urlToTest, sanitizeString(channelName, 80));
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
  if (typeof urlToUse === 'string' && urlToUse.startsWith('••••••••••••••••')) {
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

  if (!isDiscordWebhookUrl(urlToUse)) {
    return res.status(400).json({ success: false, message: 'Invalid Webhook URL format.' });
  }
  const cleanMediaUrl = sanitizeString(mediaUrl || '', 500);
  if (cleanMediaUrl && !isHttpUrl(cleanMediaUrl)) {
    return res.status(400).json({ success: false, message: 'Media URL must be a valid HTTPS URL.' });
  }

  try {
    const embedPayload = {
      embeds: [{
        title: sanitizeString(title, 256),
        description: sanitizeString(message, 4000),
        color: 10497791, // Purple #9A33EF
        image: cleanMediaUrl ? { url: cleanMediaUrl } : undefined,
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
  const cleanTitle = sanitizeString(title, 120);
  const cleanMessage = sanitizeString(message, 4000);

  // Send to public news logs / notifications
  const embed = {
    title: `📢 WHITE PIGEON BROADCAST: ${cleanTitle.toUpperCase()}`,
    description: cleanMessage,
    color: 0xffaa00 // Orange Gold
  };

  // Push to public news channel webhooks if configured
  await botService.sendWebhook('public-winlog', embed);

  // Log in discord logs
  botService.logSimulated(`Broadcasted family announcement: "${cleanTitle}: ${cleanMessage}"`);

  return res.json({ success: true, message: 'Announcement broadcasted.' });
});

// POST deploy interactive family stats / about us prompt in Discord channel
router.post('/deploy-aboutus-prompt', requireAdmin, async (req, res) => {
  try {
    const success = await botService.deployAboutUsPrompt();
    if (success) {
      return res.json({ success: true, message: 'Family Stats / About Us panel deployed in Discord.' });
    } else {
      throw new Error('Bot is not active or could not locate the announcements/about channel.');
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
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

// POST deploy interactive strike system prompt in Discord channel
router.post('/deploy-strike-prompt', requireAdmin, async (req, res) => {
  try {
    const success = await botService.deployStrikeSystemPrompt();
    if (success) {
      return res.json({ success: true, message: 'Strike System panel deployed in Discord.' });
    } else {
      throw new Error('Bot is not active or could not locate the strikes channel.');
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST deploy interactive ticket system prompt in Discord channel
router.post('/deploy-tickets-prompt', requireAdmin, async (req, res) => {
  try {
    const success = await botService.deployTicketsPrompt();
    if (success) {
      return res.json({ success: true, message: 'Ticket System panel deployed in Discord.' });
    } else {
      throw new Error('Bot is not active or could not locate the tickets channel.');
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST deploy interactive balance system prompt in Discord channel
router.post('/deploy-balance-prompt', requireAdmin, async (req, res) => {
  try {
    const success = await botService.deployBalanceSystemPrompt();
    if (success) {
      return res.json({ success: true, message: 'Balance System panel deployed in Discord.' });
    } else {
      throw new Error('Bot is not active or could not locate the check-balance channel.');
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST deploy interactive leaderboard system prompt in Discord channel
router.post('/deploy-leaderboard-prompt', requireAdmin, async (req, res) => {
  try {
    const success = await botService.deployWeeklyLeaderboardPrompt();
    if (success) {
      return res.json({ success: true, message: 'Weekly Event Leaderboard panel deployed in Discord.' });
    } else {
      throw new Error('Bot is not active or could not locate the leaderboard channel.');
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST reset weekly event points for all members
router.post('/reset-weekly-leaderboard', requireAdmin, async (req, res) => {
  try {
    await db.resetWeeklyPoints();
    
    // Sync with Discord message live if active
    await botService.syncWeeklyLeaderboardMessage();
    
    // Trigger live UI reload via socket
    botService.broadcastSocket('leaderboard_update', sanitizeMembers(await db.getMembers()));
    
    botService.logSimulated('Reset all members\' weekly event points to 0.');
    return res.json({ success: true, message: 'Weekly Event Leaderboard reset successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST deploy interactive all time kills leaderboard in Discord
router.post('/deploy-alltime-kills-prompt', requireAdmin, async (req, res) => {
  try {
    const success = await botService.deployAllTimeKillsPrompt();
    if (success) {
      return res.json({ success: true, message: 'All Time Kills Leaderboard panel deployed in Discord.' });
    } else {
      throw new Error('Bot is not active or could not locate the channel.');
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST deploy interactive weekly kills leaderboard in Discord
router.post('/deploy-weekly-kills-prompt', requireAdmin, async (req, res) => {
  try {
    const success = await botService.deployWeeklyKillsPrompt();
    if (success) {
      return res.json({ success: true, message: 'Weekly Kills Leaderboard panel deployed in Discord.' });
    } else {
      throw new Error('Bot is not active or could not locate the channel.');
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST reset weekly kills for all members
router.post('/reset-weekly-kills', requireAdmin, async (req, res) => {
  try {
    // Reset in DB
    const members = await db.getMembers();
    for (const m of members) {
      await db.updateMember(m.discordId, { weeklyKills: 0 });
    }
    
    // Sync with Discord message live if active
    await botService.syncWeeklyKillsMessage();
    
    // Trigger live UI reload via socket
    botService.broadcastSocket('weekly_kills_update', sanitizeMembers(await db.getMembers()));
    
    botService.logSimulated('Reset all members\' weekly kills to 0.');
    return res.json({ success: true, message: 'Weekly kills reset successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST deploy interactive priority list in Discord
router.post('/deploy-priority-prompt', requireAdmin, async (req, res) => {
  try {
    const success = await botService.deployPriorityListPrompt();
    if (success) {
      return res.json({ success: true, message: 'Priority Members panel deployed in Discord.' });
    } else {
      throw new Error('Bot is not active or could not locate the channel.');
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST deploy interactive activity point system in Discord
router.post('/deploy-activity-prompt', requireAdmin, async (req, res) => {
  try {
    const success = await botService.deployActivityPrompt();
    if (success) {
      return res.json({ success: true, message: 'Activity Point System panel deployed in Discord.' });
    } else {
      throw new Error('Bot is not active or could not locate the channel.');
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST approve or reject a registration request
router.post('/approve-member', requireAdmin, async (req, res) => {
  const { discordId, action } = req.body;
  if (!discordId || !action) {
    return res.status(400).json({ success: false, message: 'discordId and action are required.' });
  }

  try {
    const member = await db.getMember(discordId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    if (action === 'approve') {
      await db.updateMember(discordId, { status: 'approved' });
      botService.logSimulated(`Admin approved member registration: ${member.nickname}`);
      
      // Sync client dashboards via WebSocket
      botService.broadcastSocket('leaderboard_update', sanitizeMembers(await db.getMembers()));
      return res.json({ success: true, message: 'Member registration approved.' });
    } else if (action === 'reject') {
      await db.deleteMember(discordId);
      botService.logSimulated(`Admin rejected/deleted member registration: ${member.nickname}`);
      
      // Sync client dashboards via WebSocket
      botService.broadcastSocket('leaderboard_update', sanitizeMembers(await db.getMembers()));
      return res.json({ success: true, message: 'Member registration request rejected and deleted.' });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be approve or reject.' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST update roles and admin access for an approved member
router.post('/update-member-roles', requireAdmin, async (req, res) => {
  const { discordId, roles, admin_authenticated } = req.body;
  if (!discordId) {
    return res.status(400).json({ success: false, message: 'discordId is required.' });
  }

  try {
    const member = await db.getMember(discordId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    const updateData = {};
    if (Array.isArray(roles)) {
      updateData.roles = roles;
    }
    if (typeof admin_authenticated === 'boolean') {
      updateData.admin_authenticated = admin_authenticated;
    }

    await db.updateMember(discordId, updateData);
    
    // Log the change
    botService.logSimulated(`Admin updated access/roles for: ${member.nickname}`);
    
    // Sync client dashboards via WebSocket
    botService.broadcastSocket('leaderboard_update', sanitizeMembers(await db.getMembers()));
    return res.json({ success: true, message: 'Member access and roles updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
