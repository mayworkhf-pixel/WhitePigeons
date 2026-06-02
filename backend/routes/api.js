const express = require('express');
const router = express.Router();
const db = require('../database');
const botService = require('../bot');
const axios = require('axios');

// Session helper middlewares
async function requireMember(req, res, next) {
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
    if (req.method === 'GET') {
      req.user = { discordId: 'public-guest', username: 'Guest', roles: ['Member'] };
      return next();
    }
    return res.status(401).json({ error: 'Please login to access this area.' });
  }
  try {
    const session = JSON.parse(Buffer.from(cookie, 'base64').toString('utf8'));
    req.user = session;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid session.' });
  }
}

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
    return res.status(401).json({ error: 'Please login.' });
  }
  try {
    const session = JSON.parse(Buffer.from(cookie, 'base64').toString('utf8'));
    const isLead = session.roles && (session.roles.includes('Leadership') || session.roles.includes('Admin'));
    if (!isLead) {
      return res.status(403).json({ error: 'Access denied. Leadership required.' });
    }
    req.user = session;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid session.' });
  }
}

// -------------------------------------------------------------
// MEMBER ROSTER
// -------------------------------------------------------------
router.get('/members', requireMember, async (req, res) => {
  res.json(await db.getMembers());
});

// Admin update member weekly points
router.post('/members/:id/weekly-points', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { weeklyPoints } = req.body;
  const numPoints = parseFloat(weeklyPoints);
  if (isNaN(numPoints)) {
    return res.status(400).json({ error: 'Weekly points must be a valid number.' });
  }

  const member = await db.getMember(id);
  if (!member) {
    return res.status(404).json({ error: 'Member not found.' });
  }

  await db.updateMember(id, { weeklyPoints: numPoints });
  
  // Sync the Discord Weekly Event Leaderboard embed message live!
  await botService.syncWeeklyLeaderboardMessage();

  // Broadcast socket update
  botService.broadcastSocket('leaderboard_update', await db.getMembers());

  return res.json({ success: true, message: 'Member weekly points updated successfully.' });
});// Admin update member total kills
router.post('/members/:id/kills', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { kills } = req.body;
  const numKills = parseInt(kills);
  if (isNaN(numKills)) {
    return res.status(400).json({ error: 'Kills must be a valid integer.' });
  }

  const member = await db.getMember(id);
  if (!member) {
    return res.status(404).json({ error: 'Member not found.' });
  }

  await db.updateMember(id, { kills: numKills });
  
  // Sync the Discord All Time Kills Leaderboard message
  await botService.syncAllTimeKillsMessage();

  // Broadcast socket update
  botService.broadcastSocket('kills_update', await db.getMembers());

  return res.json({ success: true, message: 'Member total kills updated successfully.' });
});

// Admin update member weekly kills
router.post('/members/:id/weekly-kills', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { weeklyKills } = req.body;
  const numKills = parseInt(weeklyKills);
  if (isNaN(numKills)) {
    return res.status(400).json({ error: 'Weekly kills must be a valid integer.' });
  }

  const member = await db.getMember(id);
  if (!member) {
    return res.status(404).json({ error: 'Member not found.' });
  }

  await db.updateMember(id, { weeklyKills: numKills });
  
  // Sync the Discord Weekly Kills Leaderboard message
  await botService.syncWeeklyKillsMessage();

  // Broadcast socket update
  botService.broadcastSocket('weekly_kills_update', await db.getMembers());

  return res.json({ success: true, message: 'Member weekly kills updated successfully.' });
});

// Get all role requests
router.get('/members/role-requests', requireMember, async (req, res) => {
  res.json(await db.getRoleRequests());
});

// Submit role request
router.post('/members/role-request', requireMember, async (req, res) => {
  const { inGameName, characterId, level, rank, forumLink } = req.body;
  const user = req.user;

  if (!inGameName || !characterId || !level || !rank || !forumLink) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const reqData = {
    discordId: user.discordId,
    username: user.username,
    inGameName,
    characterId,
    level,
    rank,
    forumLink,
    status: 'pending',
    selectedRoles: [] // Array of roles selected by admin in Discord
  };

  // 1. Save to DB
  const newRequest = await db.createRoleRequest(reqData);

  // 2. Post notification/message to Discord Review Channel (as interactive message if bot is active, or webhook fallback)
  await botService.sendRoleReviewNotification(newRequest);

  botService.logSimulated(`Role request submitted by @${user.username} (In-game Name: ${inGameName}).`);

  // 3. Broadcast update to web admin screens
  botService.broadcastSocket('role_requests_update', await db.getRoleRequests());

  return res.json({ success: true, message: 'Role request submitted successfully.' });
});

// Admin review role request
router.post('/members/role-review', requireAdmin, async (req, res) => {
  const { requestId, memberId, status, nickname, roleToGrant, reason } = req.body;
  
  if (!requestId || !status) {
    return res.status(400).json({ error: 'Request ID and decision status are required.' });
  }

  const reqs = await db.getRoleRequests();
  const reqObj = reqs.find(r => r.id === requestId);
  if (!reqObj) {
    return res.status(404).json({ error: 'Role request not found.' });
  }

  // Update status in DB
  await db.updateRoleRequest(requestId, {
    status,
    reviewer: req.user.username,
    reason: reason || '',
    roleToGrant: roleToGrant || ''
  });

  const member = await db.getMember(memberId);
  if (member) {
    if (status === 'approved') {
      const currentRoles = member.roles || [];
      if (roleToGrant && !currentRoles.includes(roleToGrant)) {
        currentRoles.push(roleToGrant);
      }
      await db.updateMember(memberId, {
        nickname: nickname || member.nickname,
        roles: currentRoles,
        isTop10: roleToGrant === 'Top-10' || roleToGrant === 'Top 10' ? true : member.isTop10
      });

      // Update Discord live server nickname and roles
      await botService.updateMemberNicknameAndRoles(memberId, nickname, roleToGrant ? [roleToGrant] : [], []);
      await botService.sendDirectMessage(memberId, `🎉 Your role request for **${roleToGrant}** was approved! Nickname updated to: ${nickname}.`);
    } else {
      await botService.sendDirectMessage(memberId, `⚠️ Your role request was declined. Reason: ${reason || 'N/A'}`);
    }
  }

  // Post final decision embed to rolereq-review channel
  const reviewEmbed = {
    title: status === 'approved' ? '📜 ROLE REQUEST APPROVED' : '❌ ROLE REQUEST REJECTED',
    description: `Review completed by Admin **${req.user.username}**.`,
    color: status === 'approved' ? 0x00ff00 : 0xff0000,
    fields: [
      { name: 'Applicant', value: `<@${memberId}> (${reqObj.username})`, inline: true },
      { name: 'Granted Role', value: roleToGrant || 'None', inline: true },
      { name: 'Adjusted Nickname', value: nickname || (member ? member.nickname : ''), inline: true },
      { name: 'Reason / Notes', value: reason || 'Approved after roster review.' }
    ]
  };

  await botService.sendWebhook('rolereq-review', reviewEmbed);
  await botService.closeRoleReviewMessage(requestId, status, roleToGrant);

  // Broadcast update to web admin screens
  botService.broadcastSocket('role_requests_update', await db.getRoleRequests());

  return res.json({ success: true });
});

// -------------------------------------------------------------
// DISCIPLINE & TICKETS
// -------------------------------------------------------------
router.post('/discipline/strike', requireAdmin, async (req, res) => {
  const { memberId, reason, strikeRole } = req.body;

  if (!memberId || !reason) {
    return res.status(400).json({ error: 'Member ID and strike reason are required.' });
  }

  const member = await db.getMember(memberId);
  if (!member) {
    return res.status(404).json({ error: 'Member not found.' });
  }

  const strikes = member.strikes || [];
  const newStrike = {
    id: `str-${Date.now()}`,
    reason,
    date: new Date().toISOString(),
    issuedBy: req.user.username
  };
  strikes.push(newStrike);

  // Award the Strike role on Discord
  const rolesToGrant = [];
  if (strikeRole) rolesToGrant.push(strikeRole);

  await db.updateMember(memberId, { strikes });
  await botService.syncStrikeSystemMessage();

  // Webhook notification
  const embed = {
    title: '🚨 MEMBER STRIKE ISSUED',
    description: `A discipline action has been logged by Admin **${req.user.username}**.`,
    color: 0xff0000,
    fields: [
      { name: 'Player Name', value: `<@${memberId}> (${member.nickname})`, inline: true },
      { name: 'Total Active Strikes', value: `${strikes.length}`, inline: true },
      { name: 'Infraction Detail', value: reason }
    ]
  };
  await botService.sendWebhook('strikes', embed);

  // Run Discord adjustments
  await botService.updateMemberNicknameAndRoles(memberId, null, rolesToGrant, []);
  await botService.sendDirectMessage(memberId, `🚨 A strike has been issued to you by White Pigeon Leadership.\nReason: ${reason}\nActive strikes: ${strikes.length}`);

  return res.json({ success: true, strikes });
});

// Tickets
router.get('/tickets', requireMember, async (req, res) => {
  const tickets = await db.getTickets();
  const isLead = req.user.roles && (req.user.roles.includes('Leadership') || req.user.roles.includes('Admin'));
  
  if (isLead) {
    return res.json(tickets);
  }
  // Standard members only see their own tickets
  res.json(tickets.filter(t => t.memberId === req.user.discordId));
});

router.post('/tickets', requireMember, async (req, res) => {
  const { type, subject, description } = req.body;
  const user = req.user;

  if (!type || !subject || !description) {
    return res.status(400).json({ error: 'Type, subject, and description are required.' });
  }

  const ticket = await db.createTicket({
    memberId: user.discordId,
    username: user.username,
    type,
    subject,
    description
  });

  const embed = {
    title: `🎫 NEW SUPPORT TICKET RAISED [${ticket.id}]`,
    description: `Ticket raised by **${user.username}** via WP Hub.`,
    color: type === 'bonus' ? 0x00ff00 : 0xffaa00,
    fields: [
      { name: 'Type', value: type.toUpperCase(), inline: true },
      { name: 'Subject', value: subject, inline: true },
      { name: 'Description', value: description }
    ]
  };

  await botService.sendWebhook('tickets', embed);
  botService.logSimulated(`Support ticket ${ticket.id} raised by @${user.username}.`);

  return res.json(ticket);
});

router.post('/tickets/:id/resolve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { response } = req.body;

  if (!response) {
    return res.status(400).json({ error: 'Written response is required to resolve tickets.' });
  }

  const ticket = await db.updateTicket(id, { status: 'reviewed', response });
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  const embed = {
    title: `🎫 TICKET RESOLVED [${ticket.id}]`,
    description: `Ticket has been reviewed by leadership.`,
    color: 0x00ff00,
    fields: [
      { name: 'Subject', value: ticket.subject, inline: true },
      { name: 'Submitter', value: `<@${ticket.memberId}>`, inline: true },
      { name: 'Admin Response', value: response }
    ]
  };

  await botService.sendWebhook('tickets', embed);
  await botService.sendDirectMessage(ticket.memberId, `🎫 Your ticket [${ticket.id}] "${ticket.subject}" has been reviewed by leadership:\nResponse: ${response}`);

  return res.json(ticket);
});

// -------------------------------------------------------------
// ECONOMY & TRACKING
// -------------------------------------------------------------
// Get personal balance dashboard data
router.get('/economy/balance', requireMember, async (req, res) => {
  const member = await db.getMember(req.user.discordId);
  return res.json({
    balance: member ? member.balance : 0,
    discordId: req.user.discordId,
    nickname: member ? member.nickname : req.user.username
  });
});

// Log BizWar Collect profits
router.get('/economy/bizwar-collect', requireMember, async (req, res) => {
  res.json(await db.getBizWarLogs());
});

router.post('/economy/bizwar-collect', requireMember, async (req, res) => {
  const { businessName, amount } = req.body;
  const user = req.user;

  if (!businessName || !amount) {
    return res.status(400).json({ error: 'Business name and profit amount are required.' });
  }

  const numericAmount = parseFloat(amount);
  const log = await db.createBizWarLog({
    memberId: user.discordId,
    username: user.username,
    businessName,
    amount: numericAmount,
    timeCollected: new Date().toISOString()
  });

  // Fetch member from database to update their balance (add BizWar collected amount)
  const member = await db.getMember(user.discordId);
  const currentBalance = member ? member.balance : 0;
  await db.updateMember(user.discordId, { balance: currentBalance + numericAmount });

  const embed = {
    title: '💲 BIZWAR COLLECT LOGGED',
    description: `Business profits successfully collected.`,
    color: 0x00ff00,
    fields: [
      { name: 'Collector', value: `@${user.username}`, inline: true },
      { name: 'Business Site', value: businessName, inline: true },
      { name: 'Collected Amount', value: `$${numericAmount.toLocaleString()}`, inline: true }
    ]
  };
  await botService.sendWebhook('bizwar-collect', embed);

  return res.json(log);
});

// RP Ticket tracker
router.get('/economy/rp-collect', requireMember, async (req, res) => {
  const stats = await db.getRpTicketStats();
  res.json({
    logs: await db.getRpTicketLogs(),
    ...stats
  });
});

router.post('/economy/rp-collect', requireMember, async (req, res) => {
  const { ticketsCollected } = req.body;
  const user = req.user;

  if (!ticketsCollected) {
    return res.status(400).json({ error: 'Number of tickets collected is required.' });
  }

  const numTickets = parseInt(ticketsCollected);
  const log = await db.createRpTicketLog({
    memberId: user.discordId,
    username: user.username,
    ticketsCollected: numTickets,
    timeCollected: new Date().toISOString()
  });

  const stats = await db.getRpTicketStats();

  const embed = {
    title: '🎫 RP TICKET FACTORY COLLECTION',
    description: `RP Tickets successfully harvested.`,
    color: 0x00f0ff,
    fields: [
      { name: 'Collector', value: `@${user.username}`, inline: true },
      { name: 'Tickets Collected', value: `${numTickets} RP Tickets`, inline: true },
      { name: 'Total Vault Stock', value: `${stats.totalCollected} RP Tickets`, inline: true }
    ]
  };
  await botService.sendWebhook('rp-collect', embed);

  return res.json(log);
});

// Admin Bonus Log & Bonus Approvals
router.get('/economy/bonus-logs', requireAdmin, async (req, res) => {
  // Bonus requests are tracked under support tickets (type: bonus)
  const tickets = (await db.getTickets()).filter(t => t.type === 'bonus');
  res.json(tickets);
});

router.post('/economy/bonus-approval/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, finalAmount, comment } = req.body; // status: approved / rejected

  if (!status) {
    return res.status(400).json({ error: 'Approval decision (status) is required.' });
  }

  const ticket = await db.updateTicket(id, { 
    status: status === 'approved' ? 'reviewed' : 'closed', 
    response: comment || `Bonus Request ${status.toUpperCase()}`
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Bonus request ticket not found.' });
  }

  if (status === 'approved') {
    const amount = parseFloat(finalAmount || 0);
    // Add bonus to member balance
    const member = await db.getMember(ticket.memberId);
    if (member) {
      await db.updateMember(ticket.memberId, { balance: (member.balance || 0) + amount });
    }

    const approvalEmbed = {
      title: '✅ BONUS REQUEST APPROVED',
      description: `Approved by Admin **${req.user.username}**.`,
      color: 0x00ff00,
      fields: [
        { name: 'Recipient', value: `<@${ticket.memberId}>`, inline: true },
        { name: 'Approved Balance Payout', value: `$${amount.toLocaleString()}`, inline: true },
        { name: 'Comments', value: comment || 'Bonus approved.' }
      ]
    };
    await botService.sendWebhook('bonus-approval', approvalEmbed);
    
    // Log log to general admin panel logs
    const logEmbed = {
      title: '💸 BONUS DISBURSED',
      description: `Logged in Ledger. Submitter: **${ticket.username}**, Approved Amount: $${amount.toLocaleString()}`,
      color: 0x00f0ff
    };
    await botService.sendWebhook('bonus-admin-panel', logEmbed);

    await botService.sendDirectMessage(ticket.memberId, `💰 Your bonus request was APPROVED! Paid out: $${amount.toLocaleString()}`);
  } else {
    await botService.sendDirectMessage(ticket.memberId, `❌ Your bonus request was declined. Reason: ${comment || 'N/A'}`);
  }

  return res.json({ success: true, ticket });
});

// -------------------------------------------------------------
// LEADERBOARDS & STATS
// -------------------------------------------------------------
router.get('/leaderboards', async (req, res) => {
  const members = await db.getMembers();
  
  // All time kill list
  const longTimeKills = [...members].sort((a, b) => b.kills - a.kills);

  // Weekly kill list
  const weeklyKills = [...members].sort((a, b) => b.weeklyKills - a.weeklyKills);

  // Points leaderboards
  const activityPoints = [...members].sort((a, b) => b.points - a.points);

  // Top 10 Priority Wall
  const top10List = members.filter(m => m.isTop10);

  res.json({
    longTimeKills,
    weeklyKills,
    activityPoints,
    top10List
  });
});

// -------------------------------------------------------------
// PRIORITY MEMBERS LIST (TOP 5 & TOP 10)
// -------------------------------------------------------------
router.get('/priority-list', async (req, res) => {
  try {
    const resolved = await botService.getResolvedPriorityList();
    res.json(resolved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/priority-list/add', requireAdmin, async (req, res) => {
  try {
    const { type, discordId } = req.body;
    if (!type || !discordId) {
      return res.status(400).json({ error: 'Missing type or discordId' });
    }
    if (type !== 'top5' && type !== 'top10') {
      return res.status(400).json({ error: 'Invalid type (must be top5 or top10)' });
    }

    const members = await db.getMembers();
    const found = members.find(m => m.discordId === discordId);
    if (!found) {
      return res.status(404).json({ error: 'Member not found in database.' });
    }

    const list = await db.getPriorityList();
    if (type === 'top5') {
      if (!list.top5) list.top5 = [];
      if (list.top5.includes(discordId)) {
        return res.status(400).json({ error: 'Member already in TOP 5 list.' });
      }
      list.top5.push(discordId);
    } else {
      if (!list.top10) list.top10 = [];
      if (list.top10.includes(discordId)) {
        return res.status(400).json({ error: 'Member already in TOP 10 list.' });
      }
      list.top10.push(discordId);
    }

    await db.savePriorityList(list);
    await botService.syncPriorityListMessage();
    const resolved = await botService.getResolvedPriorityList();
    botService.broadcastSocket('priority_list_update', resolved);

    res.json({ success: true, priorityList: resolved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/priority-list/remove', requireAdmin, async (req, res) => {
  try {
    const { type, discordId } = req.body;
    if (!type || !discordId) {
      return res.status(400).json({ error: 'Missing type or discordId' });
    }
    if (type !== 'top5' && type !== 'top10') {
      return res.status(400).json({ error: 'Invalid type (must be top5 or top10)' });
    }

    const list = await db.getPriorityList();
    if (type === 'top5') {
      if (!list.top5 || !list.top5.includes(discordId)) {
        return res.status(400).json({ error: 'Member not in TOP 5 list.' });
      }
      list.top5 = list.top5.filter(id => id !== discordId);
    } else {
      if (!list.top10 || !list.top10.includes(discordId)) {
        return res.status(400).json({ error: 'Member not in TOP 10 list.' });
      }
      list.top10 = list.top10.filter(id => id !== discordId);
    }

    await db.savePriorityList(list);
    await botService.syncPriorityListMessage();
    const resolved = await botService.getResolvedPriorityList();
    botService.broadcastSocket('priority_list_update', resolved);

    res.json({ success: true, priorityList: resolved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// ACTIVITY SYSTEM
// -------------------------------------------------------------
router.get('/activities', requireMember, async (req, res) => {
  const acts = await db.getActivities();
  const isLead = req.user.roles && (req.user.roles.includes('Leadership') || req.user.roles.includes('Admin'));
  if (isLead) {
    return res.json(acts);
  }
  res.json(acts.filter(a => a.memberId === req.user.discordId));
});

router.post('/activities', requireMember, async (req, res) => {
  const { description, mediaUrl } = req.body;
  const user = req.user;

  if (!description || !mediaUrl) {
    return res.status(400).json({ error: 'Description and verification URL/Link are required.' });
  }

  const act = await db.createActivity({
    memberId: user.discordId,
    username: user.username,
    description,
    mediaUrl
  });

  const embed = {
    title: '💯 NEW ACTIVITY SUBMITTED',
    description: `Activity logged by **${user.username}** for review.`,
    color: 0xffaa00,
    fields: [
      { name: 'Activity ID', value: act.id, inline: true },
      { name: 'Detail Description', value: description }
    ],
    image: mediaUrl
  };

  await botService.sendWebhook('submit-activity', embed);
  botService.logSimulated(`New activity ${act.id} submitted for review by @${user.username}.`);

  return res.json(act);
});

router.post('/activities/:id/review', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, points, reason } = req.body; // status: approved / rejected

  if (!status) {
    return res.status(400).json({ error: 'Review status (decision) is required.' });
  }

  const numPoints = parseInt(points || 0);
  const act = await db.updateActivity(id, {
    status,
    pointsAwarded: numPoints,
    reason: reason || 'Reviewed',
    reviewedBy: req.user.username
  });

  if (!act) {
    return res.status(404).json({ error: 'Activity not found.' });
  }

  // Update member points in database
  if (status === 'approved' && numPoints > 0) {
    const member = await db.getMember(act.memberId);
    if (member) {
      await db.updateMember(act.memberId, { 
        points: (member.points || 0) + numPoints,
        activityScore: Math.min(100, (member.activityScore || 0) + 5) // Increase activity metric
      });
    }
  }

  const resultEmbed = {
    title: status === 'approved' ? '💯 ACTIVITY APPROVED' : '❌ ACTIVITY REJECTED',
    description: `Activity review completed by **${req.user.username}**.`,
    color: status === 'approved' ? 0x00ff00 : 0xff0000,
    fields: [
      { name: 'Activity ID', value: act.id, inline: true },
      { name: 'Submitter', value: `<@${act.memberId}>`, inline: true },
      { name: 'Awarded Points', value: `${numPoints} Points`, inline: true },
      { name: 'Review Notes', value: reason || 'Reviewed by Admin.' }
    ]
  };

  await botService.sendWebhook('activity-results', resultEmbed);
  await botService.sendWebhook('activity-review', resultEmbed);

  // If approved, notify activity points leaderboard channel
  if (status === 'approved' && numPoints > 0) {
    const currentPoints = (await db.getMember(act.memberId))?.points || 0;
    const leaderEmbed = {
      title: '📈 ACTIVITY POINTS UPDATE',
      description: `Points granted to **${act.username}**!`,
      color: 0x00ff00,
      fields: [
        { name: 'Player', value: `<@${act.memberId}>`, inline: true },
        { name: 'Earned Points', value: `+${numPoints} Points`, inline: true },
        { name: 'New Total', value: `${currentPoints} Points`, inline: true }
      ]
    };
    await botService.sendWebhook('activity-points-leaderboard', leaderEmbed);
  }

  // Alert member
  await botService.sendDirectMessage(
    act.memberId, 
    `💯 Your activity submission [${act.id}] was **${status.toUpperCase()}**.\nPoints granted: +${numPoints}.\nReason: ${reason || 'N/A'}`
  );

  return res.json(act);
});

// -------------------------------------------------------------
// POINT SHOP & ORDERS
// -------------------------------------------------------------
const shopItems = [
  { id: 'item-1', name: 'Elite Heavy Sniper', price: 1500, category: 'Weapons', stock: 15, image: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=150' },
  { id: 'item-2', name: 'Classified Armor Plate (Tier 3)', price: 600, category: 'Armor', stock: 50, image: 'https://images.unsplash.com/photo-1584438784894-089d6a128f3e?w=150' },
  { id: 'item-3', name: 'White Pigeon Official Bomber Jacket', price: 2000, category: 'Apparel', stock: 5, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=150' },
  { id: 'item-4', name: 'Custom License Plate Voucher', price: 3500, category: 'Vip Perks', stock: 2, image: 'https://images.unsplash.com/photo-1594008696863-bd0df46968f2?w=150' }
];

router.get('/shop/items', requireMember, async (req, res) => {
  const member = await db.getMember(req.user.discordId);
  const currentPoints = member ? member.points : 0;
  res.json({
    items: shopItems,
    pointsBalance: currentPoints
  });
});

router.post('/shop/purchase', requireMember, async (req, res) => {
  const { itemId } = req.body;
  const user = req.user;

  const item = shopItems.find(i => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found in point shop.' });
  }

  const member = await db.getMember(user.discordId);
  const points = member ? member.points : 0;

  if (points < item.price) {
    return res.status(400).json({ error: 'Insufficient family points balance.' });
  }

  // Deduct points
  await db.updateMember(user.discordId, { points: points - item.price });

  // Create order
  const order = await db.createOrder({
    memberId: user.discordId,
    username: user.username,
    itemId: item.id,
    itemName: item.name,
    pointsPrice: item.price
  });

  // Webhook log to Point Shop channel
  const shopEmbed = {
    title: '💰 POINT SHOP TRANSACTION',
    description: `Member purchased an item from the Point Store.`,
    color: 0xff007f,
    fields: [
      { name: 'Customer', value: `@${user.username}`, inline: true },
      { name: 'Redeemed Item', value: item.name, inline: true },
      { name: 'Cost', value: `${item.price} Points`, inline: true }
    ]
  };
  await botService.sendWebhook('point-shop', shopEmbed);

  // Webhook log to Order Details channel
  const orderEmbed = {
    title: '📦 NEW INVENTORY ORDER OUTGOING',
    description: `Purchase order created. Pending delivery.`,
    color: 0xffaa00,
    fields: [
      { name: 'Order ID', value: order.id, inline: true },
      { name: 'Client', value: `<@${user.discordId}>`, inline: true },
      { name: 'Supply Description', value: item.name }
    ]
  };
  await botService.sendWebhook('order-details', orderEmbed);

  botService.logSimulated(`Point shop purchase logged: Order ID: ${order.id} for ${item.name}.`);

  return res.json({ success: true, order, newBalance: points - item.price });
});

router.get('/shop/orders', requireAdmin, async (req, res) => {
  res.json(await db.getOrders());
});

router.post('/shop/orders/:id/complete', requireAdmin, async (req, res) => {
  const { id } = req.params;

  const order = await db.updateOrder(id, { status: 'completed' });
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const embed = {
    title: '📦 ORDER COMPLETED / DELIVERED',
    description: `Order materials delivered to recipient.`,
    color: 0x00ff00,
    fields: [
      { name: 'Order ID', value: order.id, inline: true },
      { name: 'Receiver', value: `<@${order.memberId}>`, inline: true },
      { name: 'Item', value: order.itemName, inline: true },
      { name: 'Dispatched By', value: req.user.username }
    ]
  };
  await botService.sendWebhook('order-details', embed);
  await botService.sendDirectMessage(order.memberId, `📦 Your order [${order.id}] for **${order.itemName}** has been delivered by leadership!`);

  return res.json(order);
});

// -------------------------------------------------------------
// EVENTS & SIGNUPS
// -------------------------------------------------------------
router.get('/events/signup/:eventId', async (req, res) => {
  const { eventId } = req.params;
  res.json(await db.getSignups(eventId));
});

// Member signs up
router.post('/events/signup/:eventId', requireMember, async (req, res) => {
  const { eventId } = req.params;
  const user = req.user;

  const member = await db.getMember(user.discordId);
  const isTop10 = member ? member.isTop10 : false;

  const result = await db.createSignup(eventId, user.discordId, user.username, isTop10);
  
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  if (result.action === 'displaced' && result.displaced) {
    // Notify displaced user
    await botService.sendDirectMessage(
      result.displaced.memberId, 
      `⚠️ Warning: You have been displaced from the **${eventId === 'rp-signup' ? 'RP' : 'Informal'} Signup** roster by a Top 10 shooter (${user.username}).`
    );
  }

  botService.logSimulated(`${user.username} signed up for event ${eventId}. Status: ${result.action}`);

  return res.json({ success: true, signup: result.signup, action: result.action, displaced: result.displaced });
});

// Admin clears signup list
router.post('/events/clear/:eventId', requireAdmin, async (req, res) => {
  const { eventId } = req.params;
  await db.clearSignups(eventId);
  await db.setEventState(eventId, 'closed');
  botService.broadcastSocket('event_state_change', { eventId, state: 'closed' });
  botService.logSimulated(`Cleared signup list for event: ${eventId}`);
  return res.json({ success: true });
});

// Admin triggers manual signup window broadcast
router.post('/events/trigger', requireAdmin, async (req, res) => {
  const { eventId, title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  await db.clearSignups(eventId); // Clear previous signups automatically
  await db.setEventState(eventId, 'open'); // Set registration state to open
  await botService.triggerEventSignup(eventId, title, description || '');
  
  // Broadcast live change via WebSocket
  botService.broadcastSocket('event_state_change', { eventId, state: 'open' });

  return res.json({ success: true, message: 'Signup window opened and broadcasted to Discord.' });
});

// -------------------------------------------------------------
// PUBLIC WIN LOGS
// -------------------------------------------------------------
router.get('/wins', async (req, res) => {
  res.json(await db.getWins());
});

router.post('/wins', requireAdmin, async (req, res) => {
  const { type, title, description, participants, mediaUrl } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }

  const win = await db.createWin({
    type: type || 'event',
    title,
    description,
    participants: participants || '',
    mediaUrl: mediaUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800'
  });

  const channelKey = type === 'informal' ? 'public-informallog' : 'public-winlog';
  const embed = {
    title: `🏆 WHITE PIGEON WINS: ${title}`,
    description: `**Event Detail:** ${description}\n**Combatants/Squad:** ${participants || 'N/A'}`,
    color: 0xffaa00, // Gold
    image: mediaUrl
  };

  await botService.sendWebhook(channelKey, embed);
  botService.logSimulated(`Logged a win for the public records: "${title}"`);

  return res.json(win);
});

// GET active event registration state (open or closed)
router.get('/events/state/:eventId', async (req, res) => {
  const { eventId } = req.params;
  const state = await db.getEventState(eventId);
  return res.json({ eventId, state });
});

// Admin closes signup roster and broadcasts final closed stats + roster to Discord channel
router.post('/events/close/:eventId', requireAdmin, async (req, res) => {
  const { eventId } = req.params;
  const { title } = req.body;

  // 1. Set state to closed in DB
  await db.setEventState(eventId, 'closed');

  // 2. Fetch all signups and sort them
  const signups = await db.getSignups(eventId);
  const confirmedQueue = signups.filter(s => s.status === 'confirmed');
  const reserveQueue = signups.filter(s => s.status === 'reserve' || s.status === 'displaced');

  const totalSignedUp = signups.length;
  const topPriorityConfirmed = confirmedQueue.filter(s => s.isTop10).length;
  const normalConfirmed = confirmedQueue.filter(s => !s.isTop10).length;
  const substitutesCount = reserveQueue.length;

  // 3. Compile lines for embed formatting (matching reference image structure exactly)
  const mainRosterLines = confirmedQueue.map((s, idx) => {
    const icon = s.isTop10 ? '👑' : '⚔️';
    return `${idx + 1}. ${icon} <@${s.memberId}> ✅`;
  });

  const subsListLines = reserveQueue.map((s, idx) => {
    const icon = s.isTop10 ? '👑' : '⚔️';
    return `${idx + 1}. ${icon} <@${s.memberId}>`;
  });

  const bannerImage = eventId === 'rp-signup'
    ? 'https://whitepigeons-35431.web.app/rp_ticket_banner.png'
    : 'https://whitepigeons-35431.web.app/informal_fight_banner.png';

  const embedDescription = [
    `🔴 **Registration is closed!**\n`,
    `**Participants:** ${confirmedQueue.length}/25\n`,
    `**Main Roster:**`,
    mainRosterLines.length > 0 ? mainRosterLines.join('\n') : '*No confirmed players.*',
    `\n**Subs List:**`,
    subsListLines.length > 0 ? subsListLines.join('\n') : '*No substitutes.*',
    `\nHave fun! 🎉`
  ].join('\n');

  const embed = {
    title: `🚀 ${eventId === 'rp-signup' ? 'RP Ticket' : 'Informal Fight'} - CLOSED ✅`,
    description: embedDescription,
    color: 0xff003c, // Vibrant red-pink
    image: bannerImage
  };

  const channelKey = eventId === 'rp-signup' ? 'rp-signup' : 'informal-signup';
  await botService.closeSignupMessage(eventId);
  await botService.sendWebhook(channelKey, embed);

  // 4. Emit live status change to connected browser clients via WebSocket
  botService.broadcastSocket('event_state_change', { eventId, state: 'closed' });
  botService.broadcastSocket('system_notification', {
    title: 'Registration Closed',
    message: `${eventId === 'rp-signup' ? 'RP' : 'Informal'} Registration is now CLOSED. Final roster has been posted to Discord.`,
    type: 'warning'
  });

  botService.logSimulated(`Closed registration for ${eventId}. Posted final roster to Discord.`);

  return res.json({ 
    success: true, 
    stats: {
      totalSignedUp,
      topPriorityConfirmed,
      normalConfirmed,
      substitutesCount
    }
  });
});

// -------------------------------------------------------------
// DISCORD LIVE CHANNEL PULL ROUTE (ON-DEMAND)
// -------------------------------------------------------------
router.get('/discord/messages', requireMember, async (req, res) => {
  const { channelKey } = req.query;
  if (!channelKey) {
    return res.status(400).json({ error: 'channelKey parameter is required.' });
  }

  try {
    const config = await db.getConfig();
    const webhookUrl = config.webhooks ? config.webhooks[channelKey] : null;

    if (!webhookUrl) {
      return res.json([]); // No webhook configured, return empty
    }

    // Extract webhook ID and token from URL
    const match = webhookUrl.match(/discord\.com\/api\/webhooks\/(\d+)\/([\w-]+)/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid Webhook URL format.' });
    }

    const webhookId = match[1];
    const webhookToken = match[2];

    // Fetch Webhook details from Discord API to resolve the channel_id
    const webhookRes = await axios.get(`https://discord.com/api/webhooks/${webhookId}/${webhookToken}`);
    const channelId = webhookRes.data.channel_id;

    if (!channelId) {
      return res.status(404).json({ error: 'Could not resolve channel ID.' });
    }

    // Pull messages using bot token
    if (!config.botToken) {
      return res.json([{
        timestamp: new Date().toISOString(),
        message: `[INFO] Webhook connected to channel. Configure a Discord Bot Token in Settings to display live updates.`
      }]);
    }

    const messagesRes = await axios.get(`https://discord.com/api/v10/channels/${channelId}/messages?limit=25`, {
      headers: {
        Authorization: `Bot ${config.botToken}`
      }
    });

    const messages = messagesRes.data || [];
    
    // Format messages in reverse order so they display oldest first (chronological)
    const formattedLogs = messages
      .map(msg => ({
        timestamp: msg.timestamp,
        message: `Message in #${channelKey} by @${msg.author.username}: "${msg.content || (msg.embeds && msg.embeds.length ? '[Embed notification]' : '[Attachment]')}"`
      }))
      .reverse();

    return res.json(formattedLogs);
  } catch (err) {
    console.error(`Error resolving channel updates for #${channelKey}:`, err.message);
    return res.json([{
      timestamp: new Date().toISOString(),
      message: `[SIMULATED] Log monitor linked to #${channelKey} webhook.`
    }]);
  }
});

// -------------------------------------------------------------
// ABOUT US / FAMILY STATS
// -------------------------------------------------------------

// Get family stats
router.get('/about/stats', requireMember, async (req, res) => {
  try {
    const stats = await db.getFamilyStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve family statistics.' });
  }
});

// Update family stats
router.post('/about/stats', requireAdmin, async (req, res) => {
  try {
    const {
      totalMembers,
      totalGiveaways,
      totalBonuses,
      hcWorkDone,
      totalStrikes,
      totalBlacklisted,
      rpWon,
      eventsWon,
      familyRankingPoints,
      familyRank
    } = req.body;

    const numericStats = {
      totalMembers: Number(totalMembers) || 0,
      totalGiveaways: Number(totalGiveaways) || 0,
      totalBonuses: Number(totalBonuses) || 0,
      hcWorkDone: Number(hcWorkDone) || 0,
      totalStrikes: Number(totalStrikes) || 0,
      totalBlacklisted: Number(totalBlacklisted) || 0,
      rpWon: Number(rpWon) || 0,
      eventsWon: Number(eventsWon) || 0,
      familyRankingPoints: Number(familyRankingPoints) || 0,
      familyRank: familyRank || '#1'
    };

    const saved = await db.saveFamilyStats(numericStats);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save family statistics.' });
  }
});

// Broadcast family stats to Discord
router.post('/about/stats/broadcast', requireAdmin, async (req, res) => {
  try {
    const { channelKey } = req.body;
    const stats = await db.getFamilyStats();
    const broadcastResult = await botService.sendStatsBroadcast(channelKey, stats);
    res.json({ success: broadcastResult });
  } catch (err) {
    res.status(500).json({ error: `Failed to broadcast stats to Discord: ${err.message}` });
  }
});

module.exports = router;
