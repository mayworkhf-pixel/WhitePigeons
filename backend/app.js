const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const db = require('./database');
const botService = require('./bot');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();

// Dynamic CORS configuration (support both local and Firebase Domains)
const allowedOrigins = [
  'http://localhost:3000',
  'https://whitepigeons-35431.web.app',
  'https://whitepigeons-35431.firebaseapp.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      // Allow dynamic check - if it ends with firebaseapp.com/web.app or is localhost
      if (origin.match(/^https:\/\/whitepigeons-35431\.(web\.app|firebaseapp\.com)$/) || origin.includes('localhost:')) {
        return callback(null, true);
      }
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
