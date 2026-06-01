const express = require('express');
const router = express.Router();
const db = require('../database');
const botService = require('../bot');

// Session helper middlewares
function requireMember(req, res, next) {
  const cookie = req.cookies ? req.cookies['wp_session'] : null;
  if (!cookie) {
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

function requireAdmin(req, res, next) {
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
router.get('/members', requireMember, (req, res) => {
  res.json(db.getMembers());
});

// Submit role request
router.post('/members/role-request', requireMember, async (req, res) => {
  const { gameId, reason, currentRoles } = req.body;
  const user = req.user;

  if (!gameId || !reason) {
    return res.status(400).json({ error: 'Game ID and application reason are required.' });
  }

  // Create an embed for the Discord webhook
  const embed = {
    title: '📋 NEW ROLE REQUEST SUBMISSION',
    description: `A member has submitted a role request via White Pigeon Portal.`,
    color: 0x00f0ff,
    fields: [
      { name: 'Discord Handle', value: `@${user.username} (${user.discordId})`, inline: true },
      { name: 'In-Game ID', value: gameId, inline: true },
      { name: 'Current Role(s)', value: currentRoles || 'None', inline: true },
      { name: 'Reason for requesting role', value: reason }
    ]
  };

  // Post to Discord channel
  await botService.sendWebhook('role-request', embed);
  botService.logSimulated(`Role request submitted for member @${user.username} (ID: ${gameId}).`);

  return res.json({ success: true, message: 'Role request posted to Discord for Leadership review.' });
});

// Admin review role request
router.post('/members/role-review', requireAdmin, async (req, res) => {
  const { memberId, status, nickname, roleToGrant, reason } = req.body;
  
  if (!memberId || !status) {
    return res.status(400).json({ error: 'Member ID and decision status are required.' });
  }

  const member = db.getMember(memberId);
  if (!member) {
    return res.status(404).json({ error: 'Member not found.' });
  }

  const reviewEmbed = {
    title: status === 'approved' ? '📜 ROLE REQUEST APPROVED' : '❌ ROLE REQUEST REJECTED',
    description: `Review completed by Admin **${req.user.username}**.`,
    color: status === 'approved' ? 0x00ff00 : 0xff0000,
    fields: [
      { name: 'Applicant', value: `<@${memberId}> (${member.username})`, inline: true },
      { name: 'Granted Role', value: roleToGrant || 'None', inline: true },
      { name: 'Adjusted Nickname', value: nickname || member.nickname, inline: true },
      { name: 'Reason / Notes', value: reason || 'Approved after roster review.' }
    ]
  };

  // Post results to review channel
  await botService.sendWebhook('rolereq-review', reviewEmbed);

  if (status === 'approved') {
    // Modify database roles and nickname
    const currentRoles = member.roles || [];
    if (roleToGrant && !currentRoles.includes(roleToGrant)) {
      currentRoles.push(roleToGrant);
    }
    db.updateMember(memberId, {
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

  const member = db.getMember(memberId);
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

  db.updateMember(memberId, { strikes });

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
router.get('/tickets', requireMember, (req, res) => {
  const tickets = db.getTickets();
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

  const ticket = db.createTicket({
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

  const ticket = db.updateTicket(id, { status: 'reviewed', response });
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
router.get('/economy/balance', requireMember, (req, res) => {
  const member = db.getMember(req.user.discordId);
  return res.json({
    balance: member ? member.balance : 0,
    discordId: req.user.discordId,
    nickname: member ? member.nickname : req.user.username
  });
});

// Log BizWar Collect profits
router.get('/economy/bizwar-collect', requireMember, (req, res) => {
  res.json(db.getBizWarLogs());
});

router.post('/economy/bizwar-collect', requireMember, async (req, res) => {
  const { businessName, amount } = req.body;
  const user = req.user;

  if (!businessName || !amount) {
    return res.status(400).json({ error: 'Business name and profit amount are required.' });
  }

  const numericAmount = parseFloat(amount);
  const log = db.createBizWarLog({
    memberId: user.discordId,
    username: user.username,
    businessName,
    amount: numericAmount,
    timeCollected: new Date().toISOString()
  });

  // Fetch member from database to update their balance (add BizWar collected amount)
  const member = db.getMember(user.discordId);
  const currentBalance = member ? member.balance : 0;
  db.updateMember(user.discordId, { balance: currentBalance + numericAmount });

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
router.get('/economy/rp-collect', requireMember, (req, res) => {
  const stats = db.getRpTicketStats();
  res.json({
    logs: db.getRpTicketLogs(),
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
  const log = db.createRpTicketLog({
    memberId: user.discordId,
    username: user.username,
    ticketsCollected: numTickets,
    timeCollected: new Date().toISOString()
  });

  const stats = db.getRpTicketStats();

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
router.get('/economy/bonus-logs', requireAdmin, (req, res) => {
  // Bonus requests are tracked under support tickets (type: bonus)
  const tickets = db.getTickets().filter(t => t.type === 'bonus');
  res.json(tickets);
});

router.post('/economy/bonus-approval/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, finalAmount, comment } = req.body; // status: approved / rejected

  if (!status) {
    return res.status(400).json({ error: 'Approval decision (status) is required.' });
  }

  const ticket = db.updateTicket(id, { 
    status: status === 'approved' ? 'reviewed' : 'closed', 
    response: comment || `Bonus Request ${status.toUpperCase()}`
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Bonus request ticket not found.' });
  }

  if (status === 'approved') {
    const amount = parseFloat(finalAmount || 0);
    // Add bonus to member balance
    const member = db.getMember(ticket.memberId);
    if (member) {
      db.updateMember(ticket.memberId, { balance: (member.balance || 0) + amount });
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
router.get('/leaderboards', (req, res) => {
  const members = db.getMembers();
  
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
// ACTIVITY SYSTEM
// -------------------------------------------------------------
router.get('/activities', requireMember, (req, res) => {
  const acts = db.getActivities();
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

  const act = db.createActivity({
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
  const act = db.updateActivity(id, {
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
    const member = db.getMember(act.memberId);
    if (member) {
      db.updateMember(act.memberId, { 
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
    const leaderEmbed = {
      title: '📈 ACTIVITY POINTS UPDATE',
      description: `Points granted to **${act.username}**!`,
      color: 0x00ff00,
      fields: [
        { name: 'Player', value: `<@${act.memberId}>`, inline: true },
        { name: 'Earned Points', value: `+${numPoints} Points`, inline: true },
        { name: 'New Total', value: `${(db.getMember(act.memberId)?.points || 0)} Points`, inline: true }
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

router.get('/shop/items', requireMember, (req, res) => {
  const member = db.getMember(req.user.discordId);
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

  const member = db.getMember(user.discordId);
  const points = member ? member.points : 0;

  if (points < item.price) {
    return res.status(400).json({ error: 'Insufficient family points balance.' });
  }

  // Deduct points
  db.updateMember(user.discordId, { points: points - item.price });

  // Create order
  const order = db.createOrder({
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

router.get('/shop/orders', requireAdmin, (req, res) => {
  res.json(db.getOrders());
});

router.post('/shop/orders/:id/complete', requireAdmin, async (req, res) => {
  const { id } = req.params;

  const order = db.updateOrder(id, { status: 'completed' });
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
router.get('/events/signup/:eventId', (req, res) => {
  const { eventId } = req.params;
  res.json(db.getSignups(eventId));
});

// Member signs up
router.post('/events/signup/:eventId', requireMember, async (req, res) => {
  const { eventId } = req.params;
  const user = req.user;

  const member = db.getMember(user.discordId);
  const isTop10 = member ? member.isTop10 : false;

  const result = db.createSignup(eventId, user.discordId, user.username, isTop10);
  
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  // Socket notification will be fired in server.js, but let's handle live notification here
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
router.post('/events/clear/:eventId', requireAdmin, (req, res) => {
  const { eventId } = req.params;
  db.clearSignups(eventId);
  botService.logSimulated(`Cleared signup list for event: ${eventId}`);
  return res.json({ success: true });
});

// Admin triggers manual signup window broadcast
router.post('/events/trigger', requireAdmin, async (req, res) => {
  const { eventId, title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  db.clearSignups(eventId); // Clear previous signups automatically
  await botService.triggerEventSignup(eventId, title, description || '');
  return res.json({ success: true, message: 'Signup window opened and broadcasted to Discord.' });
});

// -------------------------------------------------------------
// PUBLIC WIN LOGS
// -------------------------------------------------------------
router.get('/wins', (req, res) => {
  res.json(db.getWins());
});

router.post('/wins', requireAdmin, async (req, res) => {
  const { type, title, description, participants, mediaUrl } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }

  const win = db.createWin({
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

module.exports = router;
