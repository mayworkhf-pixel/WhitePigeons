const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createRateLimiter, isAllowedOrigin } = require('./security');

const botService = require('./bot');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: function (origin, callback) {
    if (!isAllowedOrigin(origin)) {
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(createRateLimiter({ windowMs: 60_000, max: 240 }));
app.use('/api/auth/verify-admin', createRateLimiter({ windowMs: 15 * 60_000, max: 10 }));
app.use('/api/auth/member-login', createRateLimiter({ windowMs: 15 * 60_000, max: 20 }));
app.use('/api/auth/register', createRateLimiter({ windowMs: 15 * 60_000, max: 12 }));

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
app.use(cookieParser());

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', apiRoutes);

// Server status endpoint
app.get('/api/status', async (req, res) => {
  res.json({
    status: 'online',
    botConnected: botService.isReady ? botService.isReady() : false,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
