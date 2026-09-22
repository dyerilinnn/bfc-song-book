const mongoose = require('mongoose');

const songSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    singer:      { type: String, trim: true, default: '' },
    originalKey: { type: String, trim: true, default: '' },
    bpm:         { type: String, trim: true, default: '' },
    // Raw sheet text. Chords live inline in square brackets:
    //   "How [1]great is our [4]God"
    // A line ending in ":" that holds no brackets is treated as a section label.
    lyrics:      { type: String, default: '' },
    // The URL as the admin pasted it (kept so the editor can show it back to them).
    youtubeUrl:  { type: String, trim: true, default: '' },
    // The 11-character video ID pulled out of youtubeUrl, used to build the
    // embed. Kept alongside youtubeUrl so the front end never has to parse it.
    youtubeId:   { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

songSchema.index({ title: 'text', singer: 'text' });
songSchema.index({ title: 1 });

module.exports = mongoose.model('Song', songSchema);
