require('dotenv').config();

const path = require('path');
const express = require('express');
const dns = require('dns');
dns.setServers(['8.8.8.8']);

const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const app = express();

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Trust proxy when deployed behind a reverse proxy
app.set('trust proxy', 1);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: MONGODB_URI,
      collectionName: 'sessions'
    }),

    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);

// =========================
// API ROUTES
// =========================

app.use('/api/auth', require('./routes/auth'));
app.use('/api/songs', require('./routes/songs'));
app.use('/api/vocalists', require('./routes/vocalists'));

// =========================
// STATIC FILES
// =========================

// Frontend
app.use(express.static(path.join(__dirname, 'public')));

// =========================
// SPA FALLBACK
// =========================

// The frontend uses hash routing.
// Any request that wasn't handled by the API/static files
// should return index.html.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================
// ERROR HANDLER
// =========================

app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    error: err.message || 'Something went wrong on the server.'
  });
});

// =========================
// DATABASE
// =========================

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');

    if (process.env.NODE_ENV !== 'production') {
      app.listen(PORT, () => {
        console.log(
          'Song Book is running on http://localhost:' + PORT
        );
      });
    }
  })
  .catch((err) => {
    console.error('Could not reach MongoDB:', err.message);
  });

module.exports = app;
