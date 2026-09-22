const express = require('express');
const Vocalist = require('../models/Vocalist');
const requireAdmin = require('../middleware/auth');

const router = express.Router();

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The full roster, alphabetical. Public so the reader's key dropdown and
// the admin's keys-table both have names to work with.
router.get('/', async (req, res) => {
  const vocalists = await Vocalist.find().sort({ name: 1 }).lean();
  res.json(vocalists);
});

router.post('/', requireAdmin, async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'A singer needs a name.' });
  if (name.toLowerCase() === 'original') {
    return res.status(400).json({ error: '"Original" is reserved for the song\u2019s own key.' });
  }

  const exists = await Vocalist.findOne({ name: new RegExp('^' + escapeRegex(name) + '$', 'i') }).lean();
  if (exists) return res.status(400).json({ error: 'That singer is already on the list.' });

  const vocalist = await Vocalist.create({ name });
  res.status(201).json(vocalist);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const vocalist = await Vocalist.findByIdAndDelete(req.params.id).catch(() => null);
  if (!vocalist) return res.status(404).json({ error: 'No singer with that id.' });
  res.json({ deleted: true });
});

module.exports = router;