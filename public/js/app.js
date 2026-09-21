/* Song Book front end. Hash-routed, talks to the Express/MongoDB API. */

(function () {
  const view = document.getElementById('view');
  const navLinks = document.getElementById('nav-links');

  const state = { admin: false, username: null };

  /* ---------- API ---------- */

  async function api(path, options) {
    const res = await fetch('/api' + path, Object.assign({ credentials: 'same-origin' }, options));
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const body = isJson ? await res.json() : null;
    if (!res.ok) throw new Error((body && body.error) || 'The server could not complete that.');
    return body;
  }

  /* ---------- player ---------- */

  const player = {
    el: document.getElementById('player'),
    audio: document.getElementById('audio'),
    playBtn: document.getElementById('player-play'),
    title: document.getElementById('player-title'),
    singer: document.getElementById('player-singer'),
    range: document.getElementById('player-range'),
    time: document.getElementById('player-time'),
    note: document.getElementById('player-note'),

    load: function (song) {
      this.title.textContent = song ? song.title : 'Nothing playing';
      this.singer.textContent = song && song.singer ? song.singer : '';
      const src = song && song.audioUrl ? song.audioUrl : '';
      if (this.audio.src !== location.origin + src || !src) {
        this.audio.pause();
        this.audio.removeAttribute('src');
        if (src) this.audio.src = src;
      }
      this.playBtn.disabled = !src;
      this.note.textContent = src ? '' : 'No audio for this song';
      this.range.value = 0;
      this.range.disabled = !src;
      this.time.textContent = '0:00 / 0:00';
      this.setIcon(false);
    },

    setIcon: function (playing) {
      this.playBtn.innerHTML = playing
        ? '<svg viewBox="0 0 12 14" fill="currentColor" aria-hidden="true"><rect x="0" y="0" width="4" height="14"/><rect x="8" y="0" width="4" height="14"/></svg>'
        : '<svg viewBox="0 0 12 14" fill="currentColor" aria-hidden="true"><path d="M0 0l12 7-12 7z"/></svg>';
      this.playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    },

    toggle: function () {
      if (!this.audio.src) return;
      if (this.audio.paused) this.audio.play(); else this.audio.pause();
    }
  };

  function clock(sec) {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  player.playBtn.addEventListener('click', function () { player.toggle(); });
  player.audio.addEventListener('play', function () { player.setIcon(true); });
  player.audio.addEventListener('pause', function () { player.setIcon(false); });
  player.audio.addEventListener('timeupdate', function () {
    const d = player.audio.duration || 0;
    player.range.value = d ? (player.audio.currentTime / d) * 100 : 0;
    player.time.textContent = clock(player.audio.currentTime) + ' / ' + clock(d);
  });
  player.range.addEventListener('input', function () {
    const d = player.audio.duration || 0;
    if (d) player.audio.currentTime = (player.range.value / 100) * d;
  });

  /* ---------- nav ---------- */

  function paintNav() {
    const here = location.hash || '#/';
    navLinks.innerHTML =
      '<a href="#/chart"><span class="hide-sm">Number </span>Chord Chart</a>' +
      '<a href="#/songs">Song List</a>' +
      (state.admin
        ? '<a href="#/admin">Admin</a><button class="btn ghost" id="logout">Log out</button>'
        : '<a class="btn" href="#/login">Log in</a>');

    Array.prototype.forEach.call(navLinks.querySelectorAll('a'), function (a) {
      if (a.getAttribute('href') === here) a.classList.add('current');
    });

    const out = document.getElementById('logout');
    if (out) out.addEventListener('click', async function () {
      await api('/auth/logout', { method: 'POST' });
      state.admin = false;
      location.hash = '#/';
      paintNav();
    });
  }

  /* ---------- shared bits ---------- */

  function searchBoxHTML(placeholder) {
    return (
      '<div class="searchbox">' +
        '<div class="search-field">' +
          '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
            '<circle cx="8.5" cy="8.5" r="5.5"/><path d="M12.8 12.8L18 18"/></svg>' +
          '<input type="search" id="q" autocomplete="off" placeholder="' + placeholder + '" aria-label="Search songs">' +
        '</div>' +
        '<div class="results" id="results" role="listbox"></div>' +
      '</div>'
    );
  }

  function wireSearch() {
    const input = document.getElementById('q');
    const out = document.getElementById('results');
    if (!input) return;
    let timer = null;

    input.addEventListener('input', function () {
      const q = input.value.trim();
      clearTimeout(timer);
      if (!q) { out.innerHTML = ''; return; }

      timer = setTimeout(async function () {
        try {
          const songs = await api('/songs?q=' + encodeURIComponent(q));
          if (!songs.length) {
            out.innerHTML = '<div class="result-empty">No song by that name yet.</div>';
            return;
          }
          out.innerHTML = songs.map(function (s) {
            return '<button class="result" data-id="' + s._id + '">' +
              '<strong>' + Chords.escapeHtml(s.title) + '</strong>' +
              '<span>' + Chords.escapeHtml(s.singer || '\u2014') + '</span></button>';
          }).join('');
        } catch (e) {
          out.innerHTML = '<div class="result-empty">' + Chords.escapeHtml(e.message) + '</div>';
        }
      }, 140);
    });

    out.addEventListener('click', function (e) {
      const btn = e.target.closest('.result');
      if (!btn) return;
      location.hash = '#/song/' + btn.dataset.id;
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.searchbox')) out.innerHTML = '';
    });
  }

  /* ---------- views ---------- */

  const views = {};

  views.home = function () {
    view.innerHTML =
      '<section class="hero">' +
        '<h1>Song Book</h1>' +
        '<p class="tagline">Lyrics written with number chords, so any song can be played in any key.</p>' +
        searchBoxHTML('Find a song from our list') +
      '</section>';
    wireSearch();
    player.load(null);
  };

  views.chart = function () {
    const head = Chords.DEGREES.map(function (d) {
      return '<th data-col="' + d.number + '">' + d.number +
        '<span class="quality">' + d.quality + '</span></th>';
    }).join('');

    const rows = Chords.KEYS.map(function (k) {
      const cells = k.family.map(function (chord, i) {
        return '<td data-col="' + (i + 1) + '">' + chord + '</td>';
      }).join('');
      return '<tr><th class="key" scope="row">' + k.key + '</th>' + cells + '</tr>';
    }).join('');

    view.innerHTML =
      '<div class="wrap wide">' +
        '<header class="page-head"><h1>Number chord chart</h1>' +
        '<p>Every song here is written in numbers instead of letters. Hover a key to see its family of chords, ' +
        'or hover a number to follow it down every key.</p></header>' +
        '<div class="chart-scroll"><table class="chart"><thead><tr><th class="key">Key</th>' + head +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p class="chart-note">Numbers 1, 4 and 5 are <b>major</b>. Numbers 2, 3 and 6 are <b>minor</b>. ' +
        'Number 7 is <b>diminished</b> and is rarely used on its own. Click a key to pin its row while you read a sheet.</p>' +
      '</div>';

    const table = view.querySelector('table.chart');

    table.addEventListener('mouseover', function (e) {
      const cell = e.target.closest('[data-col]');
      light(cell ? cell.dataset.col : null);
    });
    table.addEventListener('mouseleave', function () { light(null); });

    table.addEventListener('click', function (e) {
      const row = e.target.closest('tbody tr');
      if (!row) return;
      const was = row.classList.contains('pinned');
      Array.prototype.forEach.call(table.querySelectorAll('tr'), function (r) { r.classList.remove('pinned'); });
      if (!was) row.classList.add('pinned');
    });

    function light(col) {
      Array.prototype.forEach.call(table.querySelectorAll('td'), function (td) {
        td.classList.toggle('col-lit', Boolean(col) && td.dataset.col === col);
      });
    }

    player.load(null);
  };

  views.songs = async function () {
    view.innerHTML = '<div class="wrap"><header class="page-head"><h1>Song list</h1></header><p class="empty">Loading\u2026</p></div>';
    let songs = [];
    try { songs = await api('/songs'); }
    catch (e) { view.innerHTML = '<div class="wrap"><p class="notice">' + Chords.escapeHtml(e.message) + '</p></div>'; return; }

    const body = songs.length
      ? '<ul class="index">' + songs.map(function (s) {
          return '<li><a href="#/song/' + s._id + '">' +
            '<span class="idx-title">' + Chords.escapeHtml(s.title) + '</span>' +
            '<span class="idx-leader"></span>' +
            '<span class="idx-singer">' + Chords.escapeHtml(s.singer || '\u2014') + '</span></a></li>';
        }).join('') + '</ul>' +
        '<div class="list-meta"><span>' + songs.length + ' song' + (songs.length === 1 ? '' : 's') + '</span><span>Title \u00b7 Singer</span></div>'
      : '<div class="empty"><p>The book is empty. The admin adds the first song.</p></div>';

    view.innerHTML =
      '<div class="wrap"><header class="page-head"><h1>Song list</h1>' +
      '<p>Pick a song to open its sheet.</p></header>' + body + '</div>';

    player.load(null);
  };

  views.song = async function (id) {
    view.innerHTML = '<div class="wrap"><p class="empty">Loading\u2026</p></div>';
    let song;
    try { song = await api('/songs/' + id); }
    catch (e) { view.innerHTML = '<div class="wrap"><p class="notice">' + Chords.escapeHtml(e.message) + '</p></div>'; return; }

    function row(label, value, cls) {
      return '<div class="row ' + (cls || '') + '"><span class="label">' + label + '</span>' +
        '<span class="value">' + Chords.escapeHtml(value || '\u2014') + '</span></div>';
    }

    view.innerHTML =
      '<div class="wrap"><article class="sheet">' +
        '<header class="sheet-head">' +
          row('SONG TITLE:', song.title, 'title') +
          row('Original Key:', song.originalKey) +
          row('SINGER:', song.singer) +
          row('BPM:', song.bpm) +
        '</header>' +
        '<div class="sheet-body">' + Chords.render(song.lyrics) + '</div>' +
        '<div class="sheet-actions">' +
          '<a class="btn ghost" href="#/songs">Back to the list</a>' +
          '<button class="btn quiet" id="print">Print this sheet</button>' +
          (state.admin ? '<a class="btn quiet" href="#/admin/edit/' + song._id + '">Edit</a>' : '') +
        '</div>' +
      '</article></div>';

    document.getElementById('print').addEventListener('click', function () { window.print(); });
    player.load(song);
  };

  views.login = function () {
    if (state.admin) { location.hash = '#/admin'; return; }
    view.innerHTML =
      '<div class="login-wrap">' +
        '<h1>Log in</h1><p class="sub">The admin account keeps the book up to date.</p>' +
        '<form class="form" id="login-form" style="padding-top:0">' +
          '<div class="field"><label for="u">Username</label><input id="u" type="text" autocomplete="username" required></div>' +
          '<div class="field"><label for="p">Password</label><input id="p" type="password" autocomplete="current-password" required></div>' +
          '<div id="login-error"></div>' +
          '<button class="btn" type="submit">Log in</button>' +
        '</form>' +
      '</div>';

    document.getElementById('login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const box = document.getElementById('login-error');
      box.innerHTML = '';
      try {
        await api('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: document.getElementById('u').value, password: document.getElementById('p').value })
        });
        state.admin = true;
        paintNav();
        location.hash = '#/admin';
      } catch (err) {
        box.innerHTML = '<p class="notice">' + Chords.escapeHtml(err.message) + '</p>';
      }
    });

    player.load(null);
  };

  views.admin = async function () {
    if (!state.admin) { location.hash = '#/login'; return; }
    let songs = [];
    try { songs = await api('/songs'); } catch (e) { /* shown below */ }

    view.innerHTML =
      '<div class="wrap"><header class="page-head"><h1>Admin</h1>' +
      '<p>Add a song, or open one to change its words, chords or audio.</p></header>' +
        '<div class="admin-bar">' + searchBoxHTML('Find a song from our list') +
          '<a class="btn" href="#/admin/new">+ Add a song</a></div>' +
        (songs.length
          ? '<ul class="index" id="admin-index">' + songs.map(function (s) {
              return '<li><a href="#/admin/edit/' + s._id + '">' +
                '<span class="idx-title">' + Chords.escapeHtml(s.title) + '</span>' +
                '<span class="idx-leader"></span>' +
                '<span class="idx-singer">' + Chords.escapeHtml(s.singer || '\u2014') + '</span></a></li>';
            }).join('') + '</ul>'
          : '<div class="empty"><p>No songs yet. Add the first one.</p></div>') +
      '</div>';

    wireSearch();
    player.load(null);
  };

  views.editor = async function (id) {
    if (!state.admin) { location.hash = '#/login'; return; }

    let song = { title: '', singer: '', originalKey: '', bpm: '', lyrics: '', audioUrl: '' };
    if (id) {
      try { song = await api('/songs/' + id); }
      catch (e) { view.innerHTML = '<div class="wrap"><p class="notice">' + Chords.escapeHtml(e.message) + '</p></div>'; return; }
    }

    const v = Chords.escapeHtml;

    view.innerHTML =
      '<div class="wrap wide"><header class="page-head"><h1>' + (id ? 'Edit song' : 'Add a song') + '</h1>' +
      '<p>Type the lyrics and put each chord number in square brackets where the change happens, ' +
      'like <code>How [1]great is our [4]God</code>. End a line with a colon to make it a section, like <code>Chorus:</code></p></header>' +

      '<form class="form" id="song-form">' +
        '<div class="form-grid">' +
          '<div class="field"><label for="f-title">Title</label><input id="f-title" type="text" value="' + v(song.title) + '" required></div>' +
          '<div class="field"><label for="f-singer">Singer <span class="hint">optional</span></label><input id="f-singer" type="text" value="' + v(song.singer) + '"></div>' +
          '<div class="field"><label for="f-key">Original key <span class="hint">optional</span></label><input id="f-key" type="text" value="' + v(song.originalKey) + '" placeholder="C"></div>' +
          '<div class="field"><label for="f-bpm">BPM <span class="hint">optional</span></label><input id="f-bpm" type="text" value="' + v(song.bpm) + '" placeholder="78"></div>' +
        '</div>' +

        '<div class="toolbar" id="toolbar">' +
          [1,2,3,4,5,6,7].map(function (n) { return '<button type="button" class="chip" data-chord="' + n + '">[' + n + ']</button>'; }).join('') +
          '<button type="button" class="chip" data-section="Verse 1:">Verse</button>' +
          '<button type="button" class="chip" data-section="Chorus:">Chorus</button>' +
          '<button type="button" class="chip" data-section="Bridge:">Bridge</button>' +
        '</div>' +

        '<div class="editor-split">' +
          '<div class="field"><label for="f-lyrics">Lyrics with number chords</label>' +
            '<textarea id="f-lyrics" spellcheck="false">' + v(song.lyrics) + '</textarea></div>' +
          '<div class="field"><label>Preview</label><div class="preview"><div class="sheet-body" id="preview"></div></div></div>' +
        '</div>' +

        '<div class="field"><label for="f-audio">MP3 <span class="hint">optional</span></label>' +
          '<input id="f-audio" type="file" accept="audio/*">' +
          (song.audioUrl ? '<label class="hint"><input type="checkbox" id="f-remove"> Remove the audio that is on this song</label>' : '') +
        '</div>' +

        '<div id="form-msg"></div>' +
        '<div class="form-actions">' +
          '<button class="btn" type="submit">' + (id ? 'Save changes' : 'Add song') + '</button>' +
          '<a class="btn ghost" href="#/admin">Cancel</a>' +
          (id ? '<button class="btn quiet" type="button" id="delete">Delete song</button>' : '') +
        '</div>' +
      '</form></div>';

    const ta = document.getElementById('f-lyrics');
    const preview = document.getElementById('preview');

    function paint() { preview.innerHTML = Chords.render(ta.value); }
    ta.addEventListener('input', paint);
    paint();

    document.getElementById('toolbar').addEventListener('click', function (e) {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      const insert = btn.dataset.chord ? '[' + btn.dataset.chord + ']' : '\n' + btn.dataset.section + '\n';
      const start = ta.selectionStart;
      ta.value = ta.value.slice(0, start) + insert + ta.value.slice(ta.selectionEnd);
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + insert.length;
      paint();
    });

    document.getElementById('song-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const msg = document.getElementById('form-msg');
      msg.innerHTML = '';

      const data = new FormData();
      data.append('title', document.getElementById('f-title').value);
      data.append('singer', document.getElementById('f-singer').value);
      data.append('originalKey', document.getElementById('f-key').value);
      data.append('bpm', document.getElementById('f-bpm').value);
      data.append('lyrics', ta.value);

      const file = document.getElementById('f-audio').files[0];
      if (file) data.append('audio', file);
      const rm = document.getElementById('f-remove');
      if (rm && rm.checked) data.append('removeAudio', 'true');

      try {
        const saved = await api('/songs' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body: data });
        location.hash = '#/song/' + saved._id;
      } catch (err) {
        msg.innerHTML = '<p class="notice">' + Chords.escapeHtml(err.message) + '</p>';
      }
    });

    const del = document.getElementById('delete');
    if (del) del.addEventListener('click', async function () {
      if (!confirm('Delete "' + song.title + '" from the book?')) return;
      await api('/songs/' + id, { method: 'DELETE' });
      location.hash = '#/admin';
    });

    player.load(null);
  };

  /* ---------- router ---------- */

  function route() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const parts = hash.split('/').filter(Boolean);
    window.scrollTo(0, 0);
    paintNav();

    if (parts.length === 0) return views.home();
    if (parts[0] === 'chart') return views.chart();
    if (parts[0] === 'songs') return views.songs();
    if (parts[0] === 'song' && parts[1]) return views.song(parts[1]);
    if (parts[0] === 'login') return views.login();
    if (parts[0] === 'admin' && parts[1] === 'new') return views.editor(null);
    if (parts[0] === 'admin' && parts[1] === 'edit' && parts[2]) return views.editor(parts[2]);
    if (parts[0] === 'admin') return views.admin();

    view.innerHTML = '<div class="wrap"><div class="empty"><p>That page is not in the book.</p>' +
      '<a class="btn ghost" href="#/">Go to the search</a></div></div>';
  }

  window.addEventListener('hashchange', route);

  (async function start() {
    try {
      const me = await api('/auth/me');
      state.admin = me.admin;
      state.username = me.username;
    } catch (e) { /* stay a visitor */ }
    route();
  })();
})();
