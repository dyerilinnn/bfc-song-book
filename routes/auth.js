const express = require('express');
const Admin = require('../models/Admin');

const router = express.Router();

router.get('/me', (req, res) => {
  res.json({ admin: Boolean(req.session.adminId), username: req.session.username || null });
});

router.post('/login', async (req, res) => {
  const username = String(req.body.username || '').toLowerCase().trim();
  const password = String(req.body.password || '');

  const admin = await Admin.findOne({ username });
  if (!admin || !(await admin.verify(password))) {
    return res.status(401).json({ error: 'That username and password do not match.' });
  }

  req.session.adminId = admin._id.toString();
  req.session.username = admin.username;
  res.json({ admin: true, username: admin.username });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ admin: false }));
});

module.exports = router;
