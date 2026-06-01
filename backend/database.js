const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'white-pigeon-command-hub-secret-key-32chars!'; // Must be 32 bytes

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial DB structure
const initialDb = {
  config: {
    botToken: '',
    guildId: '',
    clientId: '',
    clientSecret: '',
    webhooks: {}
  },
  members: [
    {
      discordId: 'mock-admin',
      username: 'PigeonBoss',
      nickname: 'WP | PigeonBoss',
      roles: ['Leadership', 'Admin'],
      kills: 542,
      weeklyKills: 38,
      balance: 15400000,
      strikes: [],
      points: 2450,
      isTop10: true,
      activityScore: 92
    },
    {
      discordId: 'mock-member1',
      username: 'VitoScaletta',
      nickname: 'WP | VitoScaletta',
      roles: ['Member'],
      kills: 310,
      weeklyKills: 15,
      balance: 4200000,
      strikes: [
        { id: 'str-1', reason: 'Missed Informal battle without notice', date: '2026-05-28T18:00:00Z', issuedBy: 'PigeonBoss' }
      ],
      points: 850,
      isTop10: false,
      activityScore: 75
    },
    {
      discordId: 'mock-member2',
      username: 'TonyMontana',
      nickname: 'WP | TonyMontana',
      roles: ['Member'],
      kills: 890,
      weeklyKills: 67,
      balance: 8900000,
      strikes: [],
      points: 1200,
      isTop10: true,
      activityScore: 88
    }
  ],
  tickets: [
    {
      id: 'tkt-101',
      memberId: 'mock-member1',
      username: 'VitoScaletta',
      type: 'complaint',
      subject: 'Car stolen by green family',
      description: 'They stole my sports car during a non-RP event. Need backup to retrieve it or file a complaint.',
      status: 'open',
      response: '',
      createdAt: '2026-06-01T12:00:00Z'
    }
  ],
  activities: [
    {
      id: 'act-201',
      memberId: 'mock-member1',
      username: 'VitoScaletta',
      description: 'Collected BizWar profits from the hotel factory.',
      mediaUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500',
      pointsAwarded: 150,
      status: 'approved',
      reason: 'Valid proof, well done.',
      reviewedBy: 'PigeonBoss',
      createdAt: '2026-05-30T10:00:00Z'
    }
  ],
  orders: [],
  bizwarLogs: [
    {
      id: 'biz-301',
      memberId: 'mock-member2',
      username: 'TonyMontana',
      businessName: 'Hotel Factory',
      amount: 450000,
      timeCollected: '2026-06-02T01:00:00Z',
      createdAt: '2026-06-02T01:05:00Z'
    }
  ],
  rpTicketLogs: [
    {
      id: 'rp-401',
      memberId: 'mock-member2',
      username: 'TonyMontana',
      ticketsCollected: 5,
      timeCollected: '2026-06-02T02:00:00Z',
      createdAt: '2026-06-02T02:02:00Z'
    }
  ],
  signups: [],
  wins: [
    {
      id: 'win-501',
      type: 'event',
      title: 'BizWar Win vs Marabunta',
      description: 'Captured the docks area. Full team coordination was flawless.',
      date: '2026-06-01T20:00:00Z',
      participants: 'PigeonBoss, VitoScaletta, TonyMontana, and 12 others',
      mediaUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800',
      createdAt: '2026-06-01T20:30:00Z'
    }
  ]
};

// Encryption Helper
function encrypt(text) {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(16);
    // Ensure key is exactly 32 bytes
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption failed:', err);
    return '';
  }
}

function decrypt(text) {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err);
    return '';
  }
}

// Read DB file
function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
    return initialDb;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading JSON DB, returning defaults:', err);
    return initialDb;
  }
}

// Write DB file
function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Error writing JSON DB:', err);
    return false;
  }
}

// Public DB API
const db = {
  // Config
  getConfig: () => {
    const data = readDb();
    const config = { ...data.config };
    // Decrypt credentials before returning
    if (config.botToken) config.botToken = decrypt(config.botToken);
    if (config.clientSecret) config.clientSecret = decrypt(config.clientSecret);
    if (config.adminPassword) {
      config.adminPassword = decrypt(config.adminPassword);
    } else {
      config.adminPassword = 'pigeon123';
    }
    return config;
  },
  
  saveConfig: (newConfig) => {
    const data = readDb();
    // Encrypt sensitive fields
    const encryptedConfig = {
      botToken: newConfig.botToken ? encrypt(newConfig.botToken) : '',
      guildId: newConfig.guildId || '',
      clientId: newConfig.clientId || '',
      clientSecret: newConfig.clientSecret ? encrypt(newConfig.clientSecret) : '',
      adminPassword: newConfig.adminPassword ? encrypt(newConfig.adminPassword) : encrypt('pigeon123'),
      webhooks: newConfig.webhooks || {}
    };
    data.config = encryptedConfig;
    writeDb(data);
    return true;
  },

  // Members
  getMembers: () => {
    return readDb().members;
  },
  
  getMember: (discordId) => {
    const members = readDb().members;
    return members.find(m => m.discordId === discordId) || null;
  },
  
  updateMember: (discordId, updateData) => {
    const data = readDb();
    const idx = data.members.findIndex(m => m.discordId === discordId);
    if (idx !== -1) {
      data.members[idx] = { ...data.members[idx], ...updateData };
    } else {
      // Create new member if not found
      data.members.push({
        discordId,
        username: updateData.username || 'Unknown',
        nickname: updateData.nickname || `WP | ${updateData.username || 'Unknown'}`,
        roles: updateData.roles || ['Member'],
        kills: updateData.kills || 0,
        weeklyKills: updateData.weeklyKills || 0,
        balance: updateData.balance || 0,
        strikes: updateData.strikes || [],
        points: updateData.points || 0,
        isTop10: updateData.isTop10 || false,
        activityScore: updateData.activityScore || 0,
        ...updateData
      });
    }
    writeDb(data);
    return db.getMember(discordId);
  },

  // Tickets
  getTickets: () => {
    return readDb().tickets;
  },
  
  createTicket: (ticketData) => {
    const data = readDb();
    const newTicket = {
      id: `tkt-${Math.floor(100 + Math.random() * 900)}`,
      status: 'open',
      response: '',
      createdAt: new Date().toISOString(),
      ...ticketData
    };
    data.tickets.unshift(newTicket);
    writeDb(data);
    return newTicket;
  },
  
  updateTicket: (id, updateData) => {
    const data = readDb();
    const idx = data.tickets.findIndex(t => t.id === id);
    if (idx !== -1) {
      data.tickets[idx] = { ...data.tickets[idx], ...updateData };
      writeDb(data);
      return data.tickets[idx];
    }
    return null;
  },

  // Activities
  getActivities: () => {
    return readDb().activities;
  },
  
  createActivity: (actData) => {
    const data = readDb();
    const newAct = {
      id: `act-${Math.floor(100 + Math.random() * 900)}`,
      status: 'pending',
      pointsAwarded: 0,
      reason: '',
      createdAt: new Date().toISOString(),
      ...actData
    };
    data.activities.unshift(newAct);
    writeDb(data);
    return newAct;
  },
  
  updateActivity: (id, updateData) => {
    const data = readDb();
    const idx = data.activities.findIndex(a => a.id === id);
    if (idx !== -1) {
      data.activities[idx] = { ...data.activities[idx], ...updateData };
      writeDb(data);
      return data.activities[idx];
    }
    return null;
  },

  // Point Shop Orders
  getOrders: () => {
    return readDb().orders;
  },
  
  createOrder: (orderData) => {
    const data = readDb();
    const newOrder = {
      id: `ord-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...orderData
    };
    data.orders.unshift(newOrder);
    writeDb(data);
    return newOrder;
  },
  
  updateOrder: (id, updateData) => {
    const data = readDb();
    const idx = data.orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      data.orders[idx] = { ...data.orders[idx], ...updateData };
      writeDb(data);
      return data.orders[idx];
    }
    return null;
  },

  // BizWar
  getBizWarLogs: () => {
    return readDb().bizwarLogs;
  },
  
  createBizWarLog: (logData) => {
    const data = readDb();
    const newLog = {
      id: `biz-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      ...logData
    };
    data.bizwarLogs.unshift(newLog);
    writeDb(data);
    return newLog;
  },

  // RP Ticket Collect
  getRpTicketLogs: () => {
    return readDb().rpTicketLogs;
  },
  
  createRpTicketLog: (logData) => {
    const data = readDb();
    const newLog = {
      id: `rp-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      ...logData
    };
    data.rpTicketLogs.unshift(newLog);
    writeDb(data);
    return newLog;
  },
  
  getRpTicketStats: () => {
    const logs = db.getRpTicketLogs();
    const totalCollected = logs.reduce((acc, curr) => acc + (curr.ticketsCollected || 0), 0);
    const lastCollect = logs.length > 0 ? logs[0] : null;
    return {
      totalCollected,
      lastCollect
    };
  },

  // Signups
  getSignups: (eventId) => {
    const data = readDb();
    return data.signups.filter(s => s.eventId === eventId);
  },
  
  createSignup: (eventId, memberId, username, isTop10) => {
    const data = readDb();
    // Filter signups for this event
    const eventSignups = data.signups.filter(s => s.eventId === eventId);
    
    // Check if user already signed up
    const existing = eventSignups.find(s => s.memberId === memberId);
    if (existing) {
      return { success: false, message: 'Already signed up!' };
    }

    const newSignup = {
      eventId,
      memberId,
      username,
      signedUpAt: new Date().toISOString(),
      isTop10,
      status: 'confirmed'
    };

    if (eventSignups.length < 25) {
      // Free slot available
      data.signups.push(newSignup);
      writeDb(data);
      return { success: true, signup: newSignup, action: 'confirmed' };
    }

    // Slots are full (>= 25)
    if (isTop10) {
      // Top 10 priority: find the last signed up non-Top-10 member to displace
      const nonTop10s = eventSignups
        .filter(s => !s.isTop10 && s.status === 'confirmed')
        .sort((a, b) => new Date(b.signedUpAt) - new Date(a.signedUpAt)); // Sort descending to displace the latest one

      if (nonTop10s.length > 0) {
        const displacedMember = nonTop10s[0];
        
        // Update displaced member's status to 'displaced' / reserve
        const displacedIdx = data.signups.findIndex(
          s => s.eventId === eventId && s.memberId === displacedMember.memberId
        );
        if (displacedIdx !== -1) {
          data.signups[displacedIdx].status = 'displaced';
        }

        // Add the new Top 10 member as confirmed
        data.signups.push(newSignup);
        writeDb(data);
        
        return { 
          success: true, 
          signup: newSignup, 
          action: 'displaced', 
          displaced: displacedMember 
        };
      }
    }

    // No non-Top-10 to displace, or this user is not Top 10. Put in reserve queue.
    newSignup.status = 'reserve';
    data.signups.push(newSignup);
    writeDb(data);
    return { success: true, signup: newSignup, action: 'reserve' };
  },
  
  clearSignups: (eventId) => {
    const data = readDb();
    data.signups = data.signups.filter(s => s.eventId !== eventId);
    writeDb(data);
    return true;
  },

  // Wins Log
  getWins: () => {
    return readDb().wins;
  },
  
  createWin: (winData) => {
    const data = readDb();
    const newWin = {
      id: `win-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      ...winData
    };
    data.wins.unshift(newWin);
    writeDb(data);
    return newWin;
  }
};

module.exports = db;
