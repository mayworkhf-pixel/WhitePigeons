const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const db = require('./database');
const botService = require('./bot');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

// CORS configuration (allow Next.js frontend port 3000)
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', apiRoutes);

// Socket.io integration
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Give botService reference to IO
botService.setIo(io);

// Server status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    botConnected: botService.isReady ? botService.isReady() : false,
    timestamp: new Date().toISOString()
  });
});

// Socket connection listener
io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);
  
  // Send initial data to client on connect
  socket.emit('status_update', {
    nextInformalCountdown: getNextInformalCountdown(),
    botReady: botService.isReady ? botService.isReady() : false
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Client disconnected:', socket.id);
  });
});

// -------------------------------------------------------------
// EVENT SCHEDULERS & TIMER LOOPS
// -------------------------------------------------------------
const INFORMAL_INTERVAL_MS = 104 * 60 * 1000; // 1 hour 44 minutes = 104 minutes
let nextInformalTime = Date.now() + INFORMAL_INTERVAL_MS;

function getNextInformalCountdown() {
  const diff = nextInformalTime - Date.now();
  return diff > 0 ? Math.max(0, diff) : 0;
}

// Scheduled interval for Informal Signup reminder
setInterval(async () => {
  nextInformalTime = Date.now() + INFORMAL_INTERVAL_MS;
  
  // Embed details
  const embed = {
    title: '⚔️ INFORMAL GUNFIGHT REMINDER',
    description: 'An Informal family gunfight is starting in **10 minutes**! Prepare weapons, armor plates, and join the tactical radio frequency.',
    color: 0xff007f // Neon Magenta/Pink
  };

  // Dispatch notifications
  await botService.sendWebhook('informal-signup', embed);
  
  // Push live banner notification to all connected website clients
  io.emit('system_notification', {
    title: 'Informal Reminder',
    message: 'An Informal gunfight is starting in 10 minutes! Join the fight!',
    type: 'warning',
    duration: 15000 // 15 seconds visibility
  });

  io.emit('status_update', {
    nextInformalCountdown: INFORMAL_INTERVAL_MS
  });
  
  botService.logSimulated('Automated reminder fired for hourly Informal Gunfight.');
}, INFORMAL_INTERVAL_MS);

// Helper socket sync broadcast (runs every 10 seconds to sync timers)
setInterval(() => {
  io.emit('timer_sync', {
    nextInformalCountdown: getNextInformalCountdown()
  });
}, 10000);

// -------------------------------------------------------------
// BOOTSTRAP
// -------------------------------------------------------------
const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`[Server] Express listening on http://localhost:${PORT}`);
  
  // Try connecting bot
  try {
    await botService.init();
  } catch (err) {
    console.error('[Server] Bot initialization failed:', err.message);
  }
});
