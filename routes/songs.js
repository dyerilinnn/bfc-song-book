const express = require('express');
const fs = require('fs');
const path = require('path');
const Song = require('../models/Song');
const requireAdmin = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// List, with optional live search. Used by both the search bar and the song list.
router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const filter = q
    ? { $or: [
        { title:  new RegExp(escapeRegex(q), 'i') },
        { singer: new RegExp(escapeRegex(q), 'i') }
      ] }
    : {};

  const songs = await Song.find(filter)
    .select('title singer originalKey bpm audioUrl')
    .sort({ title: 1 })
    .limit(q ? 12 : 500)
    .lean();

  res.json(songs);
});

router.get('/:id', async (req, res) => {
  const song = await Song.findById(req.params.id).lean().catch(() => null);
  if (!song) return res.status(404).json({ error: 'No song with that address.' });
  res.json(song);
});

function fields(body) {
  return {
    title:       String(body.title || '').trim(),
    singer:      String(body.singer || '').trim(),
    originalKey: String(body.originalKey || '').trim(),
    bpm:         String(body.bpm || '').trim(),
    lyrics:      String(body.lyrics || '')
  };
}

router.post('/', requireAdmin, upload.single('audio'), async (req, res) => {
  const data = fields(req.body);
  if (!data.title) return res.status(400).json({ error: 'A song needs a title.' });
  if (req.file) data.audioUrl = '/uploads/' + req.file.filename;

  const song = await Song.create(data);
  res.status(201).json(song);
});

router.put('/:id', requireAdmin, upload.single('audio'), async (req, res) => {
  const song = await Song.findById(req.params.id).catch(() => null);
  if (!song) return res.status(404).json({ error: 'No song with that address.' });

  Object.assign(song, fields(req.body));
  if (!song.title) return res.status(400).json({ error: 'A song needs a title.' });

  if (req.file) {
    removeAudio(song.audioUrl);
    song.audioUrl = '/uploads/' + req.file.filename;
  } else if (req.body.removeAudio === 'true') {
    removeAudio(song.audioUrl);
    song.audioUrl = '';
  }

  await song.save();
  res.json(song);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const song = await Song.findByIdAndDelete(req.params.id).catch(() => null);
  if (!song) return res.status(404).json({ error: 'No song with that address.' });
  removeAudio(song.audioUrl);
  res.json({ deleted: true });
});

function removeAudio(url) {
  if (!url) return;
  const file = path.join(__dirname, '..', 'uploads', path.basename(url));
  fs.promises.unlink(file).catch(() => {});
}

module.exports = router;
