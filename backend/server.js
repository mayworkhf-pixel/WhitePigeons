require('./env');
const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const botService = require('./bot');
const database = require('./database');
const { isAllowedOrigin } = require('./security');

const server = http.createServer(app);

// Socket.io integration (allow Next.js frontend port 3000)
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      if (!isAllowedOrigin(origin)) {
        return callback(new Error('Socket origin not allowed'), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Give botService reference to IO
botService.setIo(io);

// Socket connection listener
io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);
  
  // Send initial data to client on connect
  socket.emit('status_update', {
    nextInformalCountdown: getNextInformalCountdown(),
    botReady: botService.isReady ? botService.isReady() : false,
    activeUsers: io.engine.clientsCount
  });

  socket.on('client_ping', (_payload, ack) => {
    if (typeof ack === 'function') {
      ack({
        serverTime: Date.now(),
        activeUsers: io.engine.clientsCount,
        botReady: botService.isReady ? botService.isReady() : false
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Client disconnected:', socket.id);
  });
});

// -------------------------------------------------------------
// EVENT SCHEDULERS & TIMER LOOPS
// -------------------------------------------------------------
const INFORMAL_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes (1 hour)
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
    nextInformalCountdown: INFORMAL_INTERVAL_MS,
    activeUsers: io.engine.clientsCount,
    botReady: botService.isReady ? botService.isReady() : false
  });
  
  botService.logSimulated('Automated reminder fired for hourly Informal Gunfight.');
}, INFORMAL_INTERVAL_MS);

// Helper socket sync broadcast (runs every 10 seconds to sync timers)
setInterval(() => {
  io.emit('timer_sync', {
    nextInformalCountdown: getNextInformalCountdown(),
    activeUsers: io.engine.clientsCount,
    botReady: botService.isReady ? botService.isReady() : false
  });
}, 10000);

// Minute-by-minute automated signup scheduler loop in London Server Time (Europe/London)
let lastTriggeredMinutes = {}; // Track eventId-day-time to prevent double triggering

setInterval(async () => {
  try {
    const options = { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false };
    const londonTimeStr = new Date().toLocaleTimeString('en-US', options); // e.g. "14:30"
    const currentLondonDay = new Date().toLocaleDateString('en-US', { timeZone: 'Europe/London' }); // e.g. "6/2/2026"

    const eventIds = ['rp-signup', 'informal-signup', 'signup-event'];
    
    // Auto-close open events that have been active for more than 15 minutes
    for (const eventId of eventIds) {
      try {
        const stateObj = await database.getEventState(eventId);
        if (stateObj && stateObj.state === 'open' && stateObj.openedAt) {
          const elapsedMs = Date.now() - stateObj.openedAt;
          if (elapsedMs >= 15 * 60 * 1000) {
            console.log(`[Scheduler] Automatically closing ${eventId} (open for ${Math.round(elapsedMs / 1000 / 60)} minutes)`);
            await botService.closeEvent(eventId);
          }
        }
      } catch (err) {
        console.error(`[Scheduler] Error checking auto-close for ${eventId}:`, err.message);
      }
    }
    
    for (const eventId of eventIds) {
      const schedule = await database.getEventSchedule(eventId);
      if (!schedule || !schedule.enabled || !schedule.times || schedule.times.length === 0) {
        continue;
      }

      // Check if "set for a day" schedule has rolled over to a new day (expired)
      if (schedule.mode === 'day' && schedule.lastTriggeredDate && schedule.lastTriggeredDate !== currentLondonDay) {
        schedule.enabled = false;
        await database.setEventSchedule(eventId, schedule);
        io.emit('event_schedule_change', { eventId, schedule });
        continue;
      }

      // Check if we already triggered this minute
      const trackingKey = `${eventId}-${currentLondonDay}-${londonTimeStr}`;
      if (lastTriggeredMinutes[trackingKey]) {
        continue;
      }

      // Compare current London time with configured times
      const matchedTime = schedule.times.find(t => t && t.trim() === londonTimeStr);
      if (matchedTime) {
        lastTriggeredMinutes[trackingKey] = true;
        console.log(`[Scheduler] Automatically opening ${eventId} at scheduled London time: ${londonTimeStr} (Mode: ${schedule.mode})`);
        
        const title = schedule.title || (eventId === 'rp-signup' ? 'Roster control' : eventId === 'signup-event' ? 'Signup-Event' : 'Roster control');
        const description = schedule.description || '';

        // Clear previous signups and open registration
        await database.clearSignups(eventId);
        await database.setEventState(eventId, 'open', title, description);
        const eventState = await database.getEventState(eventId);
        
        // Emit socket updates to web clients
        io.emit('event_state_change', { 
          eventId, 
          state: 'open', 
          title, 
          description,
          openedAt: eventState ? eventState.openedAt : Date.now()
        });
        io.emit('signup_change', { eventId, signups: [] });
        io.emit('system_notification', {
          title: 'Roster Opened',
          message: `The scheduled roster event "${title}" is now open!`,
          type: 'success'
        });
        
        // Trigger the Discord bot message
        await botService.triggerEventSignup(eventId, title, description);

        // Update schedule metadata or disable based on mode
        let shouldSaveUpdate = false;
        if (schedule.mode === 'once') {
          schedule.enabled = false;
          shouldSaveUpdate = true;
        } else if (schedule.mode === 'day') {
          schedule.lastTriggeredDate = currentLondonDay;
          shouldSaveUpdate = true;
        }

        if (shouldSaveUpdate) {
          await database.setEventSchedule(eventId, schedule);
          io.emit('event_schedule_change', { eventId, schedule });
        }
        
        botService.logSimulated(`Automated scheduler fired ${eventId} signup at ${londonTimeStr} London time.`);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error in check loop:', err);
  }
}, 20000);

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
