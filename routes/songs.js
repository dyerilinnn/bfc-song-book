const express = require('express');
const Song = require('../models/Song');
const requireAdmin = require('../middleware/auth');
const { extractYouTubeId } = require('../utils/youtube');

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
    .select('title singer originalKey bpm youtubeUrl youtubeId')
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

// Pulls the plain fields off the body and resolves the YouTube link.
// Throws a plain Error with a message meant to be shown to the admin.
function fieldsFrom(body) {
  const data = {
    title:       String(body.title || '').trim(),
    singer:      String(body.singer || '').trim(),
    originalKey: String(body.originalKey || '').trim(),
    bpm:         String(body.bpm || '').trim(),
    lyrics:      String(body.lyrics || ''),
    youtubeUrl:  '',
    youtubeId:   ''
  };

  const rawLink = String(body.youtubeUrl || '').trim();
  if (rawLink) {
    const id = extractYouTubeId(rawLink);
    if (!id) throw new Error('That doesn\u2019t look like a valid YouTube link. Paste the full video URL.');
    data.youtubeUrl = rawLink;
    data.youtubeId = id;
  }

  return data;
}

router.post('/', requireAdmin, async (req, res) => {
  let data;
  try { data = fieldsFrom(req.body); }
  catch (err) { return res.status(400).json({ error: err.message }); }

  if (!data.title) return res.status(400).json({ error: 'A song needs a title.' });

  const song = await Song.create(data);
  res.status(201).json(song);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const song = await Song.findById(req.params.id).catch(() => null);
  if (!song) return res.status(404).json({ error: 'No song with that address.' });

  let data;
  try { data = fieldsFrom(req.body); }
  catch (err) { return res.status(400).json({ error: err.message }); }

  if (!data.title) return res.status(400).json({ error: 'A song needs a title.' });

  Object.assign(song, data);
  await song.save();
  res.json(song);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const song = await Song.findByIdAndDelete(req.params.id).catch(() => null);
  if (!song) return res.status(404).json({ error: 'No song with that address.' });
  res.json({ deleted: true });
});

module.exports = router;
