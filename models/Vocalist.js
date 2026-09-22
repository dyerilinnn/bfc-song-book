const mongoose = require('mongoose');

// The team roster (e.g. "Singer A", "Singer B" ...). Each song's keys table
// references these names so the admin picks from a fixed list instead of
// retyping names for every song.
const vocalistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vocalist', vocalistSchema);