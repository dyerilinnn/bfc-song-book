/* Turns sheet text into chord rows sitting above lyric rows, and holds the
   data for the number chord chart. Shared by the reader, the admin editor
   preview, and the chart page. */

window.Chords = (function () {

  // "How [1]great is our [4]God"  ->  { chords: "    1            4", words: "How great is our God" }
  function parseLine(raw) {
    const marks = [];
    let words = '';
    let i = 0;

    while (i < raw.length) {
      if (raw[i] === '[') {
        const close = raw.indexOf(']', i);
        if (close > -1) {
          const text = raw.slice(i + 1, close).trim();
          if (text) marks.push({ at: words.length, text: text });
          i = close + 1;
          continue;
        }
      }
      words += raw[i];
      i += 1;
    }

    let chords = '';
    marks.forEach(function (m) {
      // Keep at least one space between neighbouring chords.
      if (chords.length > m.at) chords += ' ';
      else chords = chords.padEnd(m.at, ' ');
      chords += m.text;
    });

    return { chords: chords.replace(/\s+$/, ''), words: words, hasChords: marks.length > 0 };
  }

  // A line like "Chorus:" or "Verse 1:" with no chords in it is a section label.
  function isSection(raw) {
    const t = raw.trim();
    return t.length > 0 && t.endsWith(':') && t.indexOf('[') === -1 && t.length <= 40;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Renders the whole sheet body as HTML.
  function render(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    let html = '';

    lines.forEach(function (raw) {
      if (!raw.trim()) { html += '<div class="line blank"></div>'; return; }

      if (isSection(raw)) {
        html += '<div class="section-label">' + escapeHtml(raw.trim()) + '</div>';
        return;
      }

      const parsed = parseLine(raw);
      html += '<div class="line">';
      if (parsed.hasChords) html += '<div class="chords">' + escapeHtml(parsed.chords) + '</div>';
      html += '<div class="words">' + escapeHtml(parsed.words) + '</div>';
      html += '</div>';
    });

    return html || '<p class="empty">This song has no lyrics yet.</p>';
  }

  const DEGREES = [
    { number: '1', quality: 'major' },
    { number: '2', quality: 'minor' },
    { number: '3', quality: 'minor' },
    { number: '4', quality: 'major' },
    { number: '5', quality: 'major' },
    { number: '6', quality: 'minor' },
    { number: '7', quality: 'diminished' }
  ];

  const KEYS = [
    { key: 'C',      family: ['C',  'Dm',  'Em',  'F',  'G',  'Am',  'Bdim'] },
    { key: 'D\u266D', family: ['D\u266D', 'E\u266Dm', 'Fm', 'G\u266D', 'A\u266D', 'B\u266Dm', 'Cdim'] },
    { key: 'D',      family: ['D',  'Em',  'F\u266Fm', 'G',  'A',  'Bm',  'C\u266Fdim'] },
    { key: 'E\u266D', family: ['E\u266D', 'Fm', 'Gm', 'A\u266D', 'B\u266D', 'Cm', 'Ddim'] },
    { key: 'E',      family: ['E',  'F\u266Fm', 'G\u266Fm', 'A',  'B',  'C\u266Fm', 'D\u266Fdim'] },
    { key: 'F',      family: ['F',  'Gm',  'Am',  'B\u266D', 'C',  'Dm',  'Edim'] },
    { key: 'F\u266F', family: ['F\u266F', 'G\u266Fm', 'A\u266Fm', 'B', 'C\u266F', 'D\u266Fm', 'E\u266Fdim'] },
    { key: 'G',      family: ['G',  'Am',  'Bm',  'C',  'D',  'Em',  'F\u266Fdim'] },
    { key: 'A\u266D', family: ['A\u266D', 'B\u266Dm', 'Cm', 'D\u266D', 'E\u266D', 'Fm', 'Gdim'] },
    { key: 'A',      family: ['A',  'Bm',  'C\u266Fm', 'D',  'E',  'F\u266Fm', 'G\u266Fdim'] },
    { key: 'B\u266D', family: ['B\u266D', 'Cm', 'Dm', 'E\u266D', 'F',  'Gm',  'Adim'] },
    { key: 'B',      family: ['B',  'C\u266Fm', 'D\u266Fm', 'E', 'F\u266F', 'G\u266Fm', 'A\u266Fdim'] }
  ];

  return {
    parseLine: parseLine,
    render: render,
    escapeHtml: escapeHtml,
    DEGREES: DEGREES,
    KEYS: KEYS
  };
})();
