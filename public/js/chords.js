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

  function shortenLines(text, maxLength) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const result = [];

    lines.forEach(function (line) {
      if (!line.trim() || isSection(line)) {
        result.push(line);
        return;
      }

      if (line.length <= maxLength) {
        result.push(line);
        return;
      }

      // Split the line into words while keeping [chord] attached
      const tokens = line.match(/\[[^\]]+\]\S*|\S+/g) || [];

      let current = '';

      tokens.forEach(function (token) {
        const candidate = current
          ? current + ' ' + token
          : token;

        if (current && candidate.length > maxLength) {
          result.push(current);
          current = token;
        } else {
          current = candidate;
        }
      });

      if (current) {
        result.push(current);
      }
    });

    return result.join('\n');
  }

  // Renders the whole sheet body as HTML.
  function render(text) {
    const maxLength = window.innerWidth <= 540 ? 30 : 9999;
    const shortened = shortenLines(text, 38);

    const lines = String(shortened || '')
      .replace(/\r\n?/g, '\n')
      .split('\n');

    let html = '';

    lines.forEach(function (raw) {
      if (!raw.trim()) {
        html += '<div class="line blank"></div>';
        return;
      }

      if (isSection(raw)) {
        html += '<div class="section-label">' +
          escapeHtml(raw.trim()) +
          '</div>';
        return;
      }

      const parsed = parseLine(raw);

      html += '<div class="line">';

      if (parsed.hasChords) {
        html += '<div class="chords">' +
          escapeHtml(parsed.chords) +
          '</div>';
      }

      html += '<div class="words">' +
        escapeHtml(parsed.words) +
        '</div>';

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
    { key: 'C',  family: ['C',  'Dm',  'Em',  'F',  'G',  'Am',  'Bdim'] },
    { key: 'C#', family: ['C#', 'D#m', 'Fm',  'F#', 'G#', 'A#m', 'Cdim'] },
    { key: 'D',  family: ['D',  'Em',  'F#m', 'G',  'A',  'Bm',  'C#dim'] },
    { key: 'D#', family: ['D#', 'Fm',  'Gm',  'G#', 'A#', 'Cm',  'Ddim'] },
    { key: 'E',  family: ['E',  'F#m', 'G#m', 'A',  'B',  'C#m', 'D#dim'] },
    { key: 'F',  family: ['F',  'Gm',  'Am',  'A#', 'C',  'Dm',  'Edim'] },
    { key: 'F#', family: ['F#', 'G#m', 'A#m', 'B',  'C#', 'D#m', 'E#dim'] },
    { key: 'G',  family: ['G',  'Am',  'Bm',  'C',  'D',  'Em',  'F#dim'] },
    { key: 'G#', family: ['G#', 'A#m', 'Cm',  'C#', 'D#', 'Fm',  'Gdim'] },
    { key: 'A',  family: ['A',  'Bm',  'C#m', 'D',  'E',  'F#m', 'G#dim'] },
    { key: 'A#', family: ['A#', 'Cm',  'Dm',  'D#', 'F',  'Gm',  'Adim'] },
    { key: 'B',  family: ['B',  'C#m', 'D#m', 'E',  'F#', 'G#m', 'A#dim'] }
  ];


  // Pulls the 11-character video ID out of any YouTube URL shape: watch?v=,
  // youtu.be/, /embed/, /shorts/, /live/, with or without extra query params.
  function youtubeId(input) {
    if (!input) return null;
    let url;
    try { url = new URL(String(input).trim()); }
    catch (e) { return null; }

    const host = url.hostname.toLowerCase().replace(/^www\.|^m\.|^music\./, '');
    const idPattern = /^[\w-]{11}$/;

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return idPattern.test(id) ? id : null;
    }

    if (host === 'youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        return id && idPattern.test(id) ? id : null;
      }
      let m = url.pathname.match(/^\/embed\/([\w-]{11})/);
      if (m) return m[1];
      m = url.pathname.match(/^\/shorts\/([\w-]{11})/);
      if (m) return m[1];
      m = url.pathname.match(/^\/live\/([\w-]{11})/);
      if (m) return m[1];
    }

    return null;
  }

  return {
    parseLine: parseLine,
    render: render,
    escapeHtml: escapeHtml,
    youtubeId: youtubeId,
    DEGREES: DEGREES,
    KEYS: KEYS
  };
})();
