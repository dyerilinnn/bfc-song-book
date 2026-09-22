(function () {
  const view = document.getElementById('view');
  const navLinks = document.getElementById('nav-links');

  const state = {
    admin: false,
    username: null
  };

  /*
   * Every time the URL changes, this number increases.
   * Async views compare their version with the current version
   * before changing the page. This prevents an old API request
   * from overwriting a newer page.
   */
  let routeVersion = 0;

  /* ---------- API ---------- */

  async function api(path, options) {
    const res = await fetch(
      '/api' + path,
      Object.assign(
        { credentials: 'same-origin' },
        options
      )
    );

    const isJson = (res.headers.get('content-type') || '')
      .includes('application/json');

    const body = isJson ? await res.json() : null;

    if (!res.ok) {
      throw new Error(
        (body && body.error) ||
        'The server could not complete that.'
      );
    }

    return body;
  }

  /* ---------- Song Player ---------- */

  const player = {
    el: document.getElementById('player'),
    toggle: document.getElementById('player-toggle'),

    videoBox: document.getElementById('player-video'),
    title: document.getElementById('player-title'),
    singer: document.getElementById('player-singer'),
    note: document.getElementById('player-note'),
    openLink: document.getElementById('player-open'),

    collapsed: false,

    setCollapsed: function (collapsed) {
      this.collapsed = collapsed;

      this.el.classList.toggle(
        'is-collapsed',
        collapsed
      );

      this.toggle.textContent = collapsed ? '⌃' : '⌄';

      this.toggle.setAttribute(
        'aria-expanded',
        collapsed ? 'false' : 'true'
      );

      this.toggle.setAttribute(
        'aria-label',
        collapsed
          ? 'Expand player'
          : 'Collapse player'
      );
    },

    load: function (song) {
      this.title.textContent = song
        ? song.title
        : 'Nothing playing';

      this.singer.textContent =
        song && song.singer
          ? song.singer
          : '';

      this.videoBox.innerHTML = '';

      const id = song && song.youtubeId
        ? song.youtubeId
        : (
            song && song.youtubeUrl
              ? Chords.youtubeId(song.youtubeUrl)
              : null
          );

      if (id) {
        const iframe =
          document.createElement('iframe');

        iframe.src =
          'https://www.youtube-nocookie.com/embed/' +
          encodeURIComponent(id) +
          '?rel=0&playsinline=1';

        iframe.title =
          song.title + ' video';

        iframe.width = '100%';
        iframe.height = '180';

        iframe.allow =
          'accelerometer; autoplay; clipboard-write; ' +
          'encrypted-media; gyroscope; picture-in-picture; ' +
          'web-share';

        iframe.referrerPolicy =
          'strict-origin-when-cross-origin';

        iframe.loading = 'lazy';
        iframe.allowFullscreen = true;

        this.videoBox.appendChild(iframe);

        this.videoBox.classList.add('has-video');

        this.note.textContent = '';

        this.openLink.href =
          song.youtubeUrl;

        this.openLink.classList.remove(
          'is-hidden'
        );
      } else {
        this.videoBox.classList.remove(
          'has-video'
        );

        this.note.textContent =
          song
            ? 'No video for this song'
            : '';

        this.openLink.classList.add(
          'is-hidden'
        );

        this.openLink.removeAttribute(
          'href'
        );
      }
    }
  };

  player.toggle.addEventListener(
    'click',
    function () {
      player.setCollapsed(
        !player.collapsed
      );
    }
  );

  /* ---------- Navigation ---------- */

  function paintNav() {
    const here =
      location.hash || '#/';

    navLinks.innerHTML =
      '<a href="#/chart">' +
        '<span class="hide-sm">Number </span>' +
        'Chord Chart' +
      '</a>' +

      '<a href="#/songs">' +
        'Song List' +
      '</a>' +

      (
        state.admin
          ? '<a href="#/admin">Admin</a>' +
            '<button class="btn ghost" id="logout">' +
              'Log out' +
            '</button>'
          : '<a class="btn" href="#/login">' +
              'Log in' +
            '</a>'
      );

    Array.prototype.forEach.call(
      navLinks.querySelectorAll('a'),
      function (a) {
        if (
          a.getAttribute('href') === here
        ) {
          a.classList.add('current');
        }
      }
    );

    const out =
      document.getElementById('logout');

    if (out) {
      out.addEventListener(
        'click',
        async function () {
          try {
            await api(
              '/auth/logout',
              { method: 'POST' }
            );
          } catch (e) {
            // Even if logout request fails,
            // clear the local admin state.
          }

          state.admin = false;
          state.username = null;

          location.hash = '#/';
          paintNav();
        }
      );
    }
  }

  /* ---------- Shared Bits ---------- */

  function searchBoxHTML(placeholder) {
    return (
      '<div class="searchbox">' +

        '<div class="search-field">' +

          '<svg viewBox="0 0 20 20" ' +
            'fill="none" ' +
            'stroke="currentColor" ' +
            'stroke-width="1.6" ' +
            'aria-hidden="true">' +

            '<circle cx="8.5" cy="8.5" r="5.5"/>' +
            '<path d="M12.8 12.8L18 18"/>' +

          '</svg>' +

          '<input ' +
            'type="search" ' +
            'id="q" ' +
            'autocomplete="off" ' +
            'placeholder="' + placeholder + '" ' +
            'aria-label="Search songs">' +

        '</div>' +

        '<div class="results" ' +
          'id="results" ' +
          'role="listbox">' +
        '</div>' +

      '</div>'
    );
  }

  function wireSearch() {
    const input =
      document.getElementById('q');

    const out =
      document.getElementById('results');

    if (!input || !out) {
      return;
    }

    let timer = null;

    input.addEventListener(
      'input',
      function () {
        const q =
          input.value.trim();

        clearTimeout(timer);

        if (!q) {
          out.innerHTML = '';
          return;
        }

        const searchVersion =
          routeVersion;

        timer = setTimeout(
          async function () {
            try {
              const songs =
                await api(
                  '/songs?q=' +
                  encodeURIComponent(q)
                );

              /*
               * Do not display search results if
               * the user has already navigated away.
               */
              if (
                searchVersion !==
                routeVersion
              ) {
                return;
              }

              if (!Array.isArray(songs) ||
                  !songs.length) {
                out.innerHTML =
                  '<div class="result-empty">' +
                    'No song by that name yet.' +
                  '</div>';

                return;
              }

              out.innerHTML =
                songs.map(function (s) {
                  return (
                    '<button ' +
                      'class="result" ' +
                      'data-id="' +
                        s._id +
                      '">' +

                      '<strong>' +
                        Chords.escapeHtml(
                          s.title
                        ) +
                      '</strong>' +

                      '<span>' +
                        Chords.escapeHtml(
                          s.singer || '—'
                        ) +
                      '</span>' +

                    '</button>'
                  );
                }).join('');

            } catch (e) {
              if (
                searchVersion !==
                routeVersion
              ) {
                return;
              }

              out.innerHTML =
                '<div class="result-empty">' +
                  Chords.escapeHtml(
                    e.message
                  ) +
                '</div>';
            }
          },
          140
        );
      }
    );

    out.addEventListener(
      'click',
      function (e) {
        const btn =
          e.target.closest('.result');

        if (!btn) {
          return;
        }

        location.hash =
          '#/song/' +
          btn.dataset.id;
      }
    );

    document.addEventListener(
      'click',
      function (e) {
        if (
          !e.target.closest(
            '.searchbox'
          )
        ) {
          out.innerHTML = '';
        }
      }
    );
  }

  /* ---------- Views ---------- */

  const views = {};

  /* ---------- Home ---------- */

  views.home = function () {
    view.innerHTML =
      '<section class="hero">' +

        '<h1>Song Book</h1>' +

        '<p class="tagline">' +
          'Lyrics written with number chords, ' +
          'so any song can be played in any key.' +
        '</p>' +

        searchBoxHTML(
          'Find a song from our list'
        ) +

      '</section>';

    wireSearch();
    player.load(null);
  };

  /* ---------- Chord Chart ---------- */

  views.chart = function () {
    const head =
      Chords.DEGREES.map(
        function (d) {
          return (
            '<th data-col="' +
              d.number +
            '">' +

              d.number +

              '<span class="quality">' +
                d.quality +
              '</span>' +

            '</th>'
          );
        }
      ).join('');

    const rows =
      Chords.KEYS.map(
        function (k) {
          const cells =
            k.family.map(
              function (chord, i) {
                return (
                  '<td data-col="' +
                    (i + 1) +
                  '">' +
                    chord +
                  '</td>'
                );
              }
            ).join('');

          return (
            '<tr>' +
              '<th class="key" scope="row">' +
                k.key +
              '</th>' +
              cells +
            '</tr>'
          );
        }
      ).join('');

    view.innerHTML =
      '<div class="wrap wide">' +

        '<header class="page-head">' +

          '<h1>Number chord chart</h1>' +

          '<p>' +
            'Every song here is written in numbers ' +
            'instead of letters. Hover a key to see ' +
            'its family of chords, or hover a number ' +
            'to follow it down every key.' +
          '</p>' +

        '</header>' +

        '<div class="chart-scroll">' +

          '<table class="chart">' +

            '<thead>' +
              '<tr>' +
                '<th class="key">Key</th>' +
                head +
              '</tr>' +
            '</thead>' +

            '<tbody>' +
              rows +
            '</tbody>' +

          '</table>' +

        '</div>' +

        '<p class="chart-note">' +
          'Numbers 1, 4 and 5 are <b>major</b>. ' +
          'Numbers 2, 3 and 6 are <b>minor</b>. ' +
          'Number 7 is <b>diminished</b> and is ' +
          'rarely used on its own. Click a key to ' +
          'pin its row while you read a sheet.' +
        '</p>' +

      '</div>';

    const table =
      view.querySelector(
        'table.chart'
      );

    table.addEventListener(
      'mouseover',
      function (e) {
        const cell =
          e.target.closest(
            '[data-col]'
          );

        light(
          cell
            ? cell.dataset.col
            : null
        );
      }
    );

    table.addEventListener(
      'mouseleave',
      function () {
        light(null);
      }
    );

    table.addEventListener(
      'click',
      function (e) {
        const row =
          e.target.closest(
            'tbody tr'
          );

        if (!row) {
          return;
        }

        const was =
          row.classList.contains(
            'pinned'
          );

        Array.prototype.forEach.call(
          table.querySelectorAll('tr'),
          function (r) {
            r.classList.remove(
              'pinned'
            );
          }
        );

        if (!was) {
          row.classList.add(
            'pinned'
          );
        }
      }
    );

    function light(col) {
      Array.prototype.forEach.call(
        table.querySelectorAll('td'),
        function (td) {
          td.classList.toggle(
            'col-lit',
            Boolean(col) &&
            td.dataset.col === col
          );
        }
      );
    }

    player.load(null);
  };

  /* ---------- Song List ---------- */

  views.songs = async function (version) {
    view.innerHTML =
      '<div class="wrap">' +

        '<header class="page-head">' +
          '<h1>Song list</h1>' +
        '</header>' +

        '<p class="empty">Loading…</p>' +

      '</div>';

    let songs = [];

    try {
      songs =
        await api('/songs');

      if (
        version !== routeVersion
      ) {
        return;
      }

      if (!Array.isArray(songs)) {
        songs = [];
      }

    } catch (e) {
      if (
        version !== routeVersion
      ) {
        return;
      }

      view.innerHTML =
        '<div class="wrap">' +
          '<p class="notice">' +
            Chords.escapeHtml(
              e.message
            ) +
          '</p>' +
        '</div>';

      return;
    }

    const body =
      songs.length

        ? '<ul class="index">' +

            songs.map(
              function (s) {
                const href =
                  state.admin
                    ? '#/admin/edit/' +
                      s._id
                    : '#/song/' +
                      s._id;

                return (
                  '<li>' +

                    '<a href="' +
                      href +
                    '">' +

                      '<span class="idx-title">' +
                        Chords.escapeHtml(
                          s.title
                        ) +
                      '</span>' +

                      '<span class="idx-leader"></span>' +

                      '<span class="idx-singer">' +
                        Chords.escapeHtml(
                          s.singer || '—'
                        ) +
                      '</span>' +

                    '</a>' +

                  '</li>'
                );
              }
            ).join('') +

          '</ul>' +

          '<div class="list-meta">' +

            '<span>' +
              songs.length +
              ' song' +
              (
                songs.length === 1
                  ? ''
                  : 's'
              ) +
            '</span>' +

            '<span>' +
              'Title · Singer' +
            '</span>' +

          '</div>'

        : '<div class="empty">' +
            '<p>' +
              'The book is empty. ' +
              'The admin adds the first song.' +
            '</p>' +
          '</div>';

    /*
     * Check once more before rendering.
     */
    if (
      version !== routeVersion
    ) {
      return;
    }

    view.innerHTML =
      '<div class="wrap">' +

        '<header class="page-head">' +

          '<h1>Song list</h1>' +

          '<p>' +
            'Pick a song to open its sheet.' +
          '</p>' +

        '</header>' +

        body +

      '</div>';

    player.load(null);
  };

  /* ---------- Public Song ---------- */

  views.song = async function (id) {
    view.innerHTML =
      '<div class="wrap">' +
        '<p class="empty">Loading…</p>' +
      '</div>';

    let song;

    try {
      song =
        await api(
          '/songs/' + id
        );
    } catch (e) {
      view.innerHTML =
        '<div class="wrap">' +
          '<p class="notice">' +
            Chords.escapeHtml(
              e.message
            ) +
          '</p>' +
        '</div>';

      return;
    }

    function row(
      label,
      value,
      cls
    ) {
      return (
        '<div class="row ' +
          (cls || '') +
        '">' +

          '<span class="label">' +
            label +
          '</span>' +

          '<span class="value">' +
            Chords.escapeHtml(
              value || '—'
            ) +
          '</span>' +

        '</div>'
      );
    }

    function keyRowHTML() {
      const rows =
        (
          Array.isArray(song.keys)
            ? song.keys
            : []
        ).filter(
          function (r) {
            return r && r.key;
          }
        );

      if (!rows.length) {
        return row(
          'KEY:',
          ''
        );
      }

      const options =
        rows.map(
          function (r, i) {
            return (
              '<option value="' +
                Chords.escapeHtml(
                  r.key
                ) +
              '"' +
                (
                  i === 0
                    ? ' selected'
                    : ''
                ) +
              '>' +

                Chords.escapeHtml(
                  r.singer
                ) +

                ' — ' +

                Chords.escapeHtml(
                  r.key
                ) +

              '</option>'
            );
          }
        ).join('');

      return (
        '<div class="row">' +

          '<span class="label">' +
            'KEY:' +
          '</span>' +

          '<span class="value">' +

            '<select ' +
              'id="key-select" ' +
              'class="key-select">' +

              options +

            '</select>' +

          '</span>' +

        '</div>'
      );
    }

    view.innerHTML =
      '<div class="wrap">' +

        '<article class="sheet">' +

          '<header class="sheet-head">' +

            row(
              'SONG TITLE:',
              song.title,
              'title'
            ) +

            keyRowHTML() +

            row(
              'SINGER:',
              song.singer
            ) +

            row(
              'BPM:',
              song.bpm
            ) +

          '</header>' +

          '<div class="sheet-body">' +
            Chords.render(
              song.lyrics
            ) +
          '</div>' +

          '<div class="sheet-actions">' +

            '<a class="btn ghost" href="#/songs">' +
              'Back to the list' +
            '</a>' +

            '<button ' +
              'class="btn quiet" ' +
              'id="print">' +
              'Print this sheet' +
            '</button>' +

            (
              state.admin
                ? '<a class="btn quiet" href="#/admin/edit/' +
                    song._id +
                  '">Edit</a>'
                : ''
            ) +

          '</div>' +

        '</article>' +

      '</div>';

    const print =
      document.getElementById(
        'print'
      );

    if (print) {
      print.addEventListener(
        'click',
        function () {
          window.print();
        }
      );
    }

    player.load(song);
  };

  /* ---------- Login ---------- */

  views.login = function () {
    if (state.admin) {
      location.hash = '#/admin';
      return;
    }

    view.innerHTML =
      '<div class="login-wrap">' +

        '<h1>Log in</h1>' +

        '<p class="sub">' +
          'The admin account keeps ' +
          'the book up to date.' +
        '</p>' +

        '<form class="form" ' +
          'id="login-form" ' +
          'style="padding-top:0">' +

          '<div class="field">' +
            '<label for="u">' +
              'Username' +
            '</label>' +

            '<input ' +
              'id="u" ' +
              'type="text" ' +
              'autocomplete="username" ' +
              'required>' +

          '</div>' +

          '<div class="field">' +

            '<label for="p">' +
              'Password' +
            '</label>' +

            '<input ' +
              'id="p" ' +
              'type="password" ' +
              'autocomplete="current-password" ' +
              'required>' +

          '</div>' +

          '<div id="login-error"></div>' +

          '<button class="btn" type="submit">' +
            'Log in' +
          '</button>' +

        '</form>' +

      '</div>';

    document
      .getElementById('login-form')
      .addEventListener(
        'submit',
        async function (e) {
          e.preventDefault();

          const box =
            document.getElementById(
              'login-error'
            );

          box.innerHTML = '';

          try {
            await api(
              '/auth/login',
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json'
                },

                body: JSON.stringify({
                  username:
                    document.getElementById(
                      'u'
                    ).value,

                  password:
                    document.getElementById(
                      'p'
                    ).value
                })
              }
            );

            state.admin = true;

            paintNav();

            location.hash =
              '#/admin';

          } catch (err) {
            box.innerHTML =
              '<p class="notice">' +
                Chords.escapeHtml(
                  err.message
                ) +
              '</p>';
          }
        }
      );

    player.load(null);
  };

  /* ---------- Admin ---------- */

  views.admin = async function (version) {
    if (!state.admin) {
      location.hash = '#/login';
      return;
    }

    let songs = [];

    try {
      songs =
        await api('/songs');

      if (
        version !== routeVersion
      ) {
        return;
      }

      if (!Array.isArray(songs)) {
        songs = [];
      }

    } catch (e) {
      if (
        version !== routeVersion
      ) {
        return;
      }

      songs = [];
    }

    if (
      version !== routeVersion
    ) {
      return;
    }

    view.innerHTML =
      '<div class="wrap">' +

        '<header class="page-head">' +

          '<h1>Admin</h1>' +

          '<p>' +
            'Add a song, or open one to ' +
            'change its words, chords or video.' +
          '</p>' +

        '</header>' +

        '<div class="admin-bar">' +

          searchBoxHTML(
            'Find a song from our list'
          ) +

          '<a class="btn ghost" ' +
            'href="#/admin/singers">' +
            'Manage singers' +
          '</a>' +

          '<a class="btn" ' +
            'href="#/admin/new">' +
            '+ Add a song' +
          '</a>' +

        '</div>' +

        (
          songs.length

            ? '<ul class="index" id="admin-index">' +

                songs.map(
                  function (s) {
                    return (
                      '<li>' +

                        '<a href="#/admin/edit/' +
                          s._id +
                        '">' +

                          '<span class="idx-title">' +
                            Chords.escapeHtml(
                              s.title
                            ) +
                          '</span>' +

                          '<span class="idx-leader"></span>' +

                          '<span class="idx-singer">' +
                            Chords.escapeHtml(
                              s.singer || '—'
                            ) +
                          '</span>' +

                        '</a>' +

                      '</li>'
                    );
                  }
                ).join('') +

              '</ul>'

            : '<div class="empty">' +
                '<p>' +
                  'No songs yet. ' +
                  'Add the first one.' +
                '</p>' +
              '</div>'
        ) +

      '</div>';

    wireSearch();
    player.load(null);
  };

  /* ---------- Song Editor ---------- */

  views.editor = async function (
    id,
    version
  ) {
    if (!state.admin) {
      location.hash = '#/login';
      return;
    }

    let song = {
      title: '',
      singer: '',
      bpm: '',
      lyrics: '',
      youtubeUrl: '',
      keys: [
        {
          singer: 'Original',
          key: ''
        }
      ]
    };

    /*
     * IMPORTANT:
     * Only load an existing song if an ID exists.
     * For #/admin/new, id is null.
     */
    if (id) {
      try {
        song =
          await api(
            '/songs/' + id
          );

        if (
          version !== routeVersion
        ) {
          return;
        }

      } catch (e) {
        if (
          version !== routeVersion
        ) {
          return;
        }

        view.innerHTML =
          '<div class="wrap">' +
            '<p class="notice">' +
              Chords.escapeHtml(
                e.message
              ) +
            '</p>' +
          '</div>';

        return;
      }
    }

    /*
     * Always use an array for vocalists.
     * This prevents vocalists.length errors
     * if the API returns null.
     */
    let vocalists = [];

    try {
      vocalists =
        await api('/vocalists') || [];

      if (
        !Array.isArray(vocalists)
      ) {
        vocalists = [];
      }

      if (
        version !== routeVersion
      ) {
        return;
      }

    } catch (e) {
      if (
        version !== routeVersion
      ) {
        return;
      }

      vocalists = [];
    }

    const v =
      function (value) {
        return Chords.escapeHtml(
          value == null
            ? ''
            : String(value)
        );
      };

    /*
     * Existing songs saved before the keys
     * table existed may only have originalKey.
     */
    const keyRows =
      (
        Array.isArray(song.keys) &&
        song.keys.length
      )
        ? song.keys
        : [
            {
              singer: 'Original',
              key:
                song.originalKey || ''
            }
          ];

    function keysRowHTML(row) {
      const isOriginal =
        row.singer === 'Original';

      return (
        '<tr class="key-row' +
          (
            isOriginal
              ? ' original'
              : ''
          ) +
          '" data-singer="' +
            v(row.singer) +
          '">' +

          '<td>' +
            v(row.singer) +
          '</td>' +

          '<td>' +

            '<input ' +
              'type="text" ' +
              'class="key-input" ' +
              'value="' +
                v(row.key) +
              '" ' +
              'placeholder="e.g. C">' +

          '</td>' +

          '<td>' +

            (
              isOriginal
                ? ''
                : '<button ' +
                    'type="button" ' +
                    'class="row-remove" ' +
                    'data-remove="' +
                      v(row.singer) +
                    '">' +
                    'Remove' +
                  '</button>'
            ) +

          '</td>' +

        '</tr>'
      );
    }

    function keysTableHTML() {
      return (
        '<div class="field">' +

          '<label>' +
            'Keys table ' +
            '<span class="hint">' +
              'optional' +
            '</span>' +
          '</label>' +

          '<div class="chart-scroll">' +

            '<table ' +
              'class="chart keys-table" ' +
              'id="keys-table">' +

              '<thead>' +

                '<tr>' +
                  '<th>Singer</th>' +
                  '<th>Key</th>' +
                  '<th></th>' +
                '</tr>' +

              '</thead>' +

              '<tbody id="keys-tbody">' +

                keyRows
                  .map(keysRowHTML)
                  .join('') +

              '</tbody>' +

            '</table>' +

          '</div>' +

          '<div class="toolbar keys-add">' +

            '<select ' +
              'id="keys-add-select">' +
            '</select>' +

            '<button ' +
              'type="button" ' +
              'class="btn quiet" ' +
              'id="keys-add-btn">' +

              '+ Add singer' +

            '</button>' +

          '</div>' +

          (
            vocalists.length
              ? ''
              : '<p class="hint">' +
                  'No singers on the roster yet. ' +
                  '<a href="#/admin/singers">' +
                    'Add some' +
                  '</a>.' +
                '</p>'
          ) +

        '</div>'
      );
    }

    /*
     * Make sure the route has not changed before
     * rendering the editor.
     */
    if (
      version !== routeVersion
    ) {
      return;
    }

    view.innerHTML =
      '<div class="wrap wide">' +

        '<header class="page-head">' +

          '<h1>' +
            (
              id
                ? 'Edit song'
                : 'Add a song'
            ) +
          '</h1>' +

          '<p>' +
            'Type the lyrics and put each chord ' +
            'number in square brackets where the ' +
            'change happens, like ' +
            '<code>How [1]great is our [4]God</code>. ' +
            'End a line with a colon to make a ' +
            'section, like <code>Chorus:</code>.' +
          '</p>' +

        '</header>' +

        '<form class="form" id="song-form">' +

          '<div class="form-grid">' +

            '<div class="field">' +

              '<label for="f-title">' +
                'Title' +
              '</label>' +

              '<input ' +
                'id="f-title" ' +
                'type="text" ' +
                'value="' +
                  v(song.title) +
                '" ' +
                'required>' +

            '</div>' +

            '<div class="field">' +

              '<label for="f-singer">' +
                'Singer ' +
                '<span class="hint">' +
                  'optional' +
                '</span>' +
              '</label>' +

              '<input ' +
                'id="f-singer" ' +
                'type="text" ' +
                'value="' +
                  v(song.singer) +
                '">' +

            '</div>' +

            '<div class="field">' +

              '<label for="f-bpm">' +
                'BPM ' +
                '<span class="hint">' +
                  'optional' +
                '</span>' +
              '</label>' +

              '<input ' +
                'id="f-bpm" ' +
                'type="text" ' +
                'value="' +
                  v(song.bpm) +
                '" ' +
                'placeholder="78">' +

            '</div>' +

          '</div>' +

          keysTableHTML() +

          '<div class="toolbar" id="toolbar">' +

            [1, 2, 3, 4, 5, 6, 7]
              .map(
                function (n) {
                  return (
                    '<button ' +
                      'type="button" ' +
                      'class="chip" ' +
                      'data-chord="' +
                        n +
                      '">' +

                      '[' +
                        n +
                      ']' +

                    '</button>'
                  );
                }
              )
              .join('') +

            '<button ' +
              'type="button" ' +
              'class="chip" ' +
              'data-section="Verse 1:">' +
              'Verse' +
            '</button>' +

            '<button ' +
              'type="button" ' +
              'class="chip" ' +
              'data-section="Chorus:">' +
              'Chorus' +
            '</button>' +

            '<button ' +
              'type="button" ' +
              'class="chip" ' +
              'data-section="Bridge:">' +
              'Bridge' +
            '</button>' +

          '</div>' +

          '<div class="editor-split">' +

            '<div class="field">' +

              '<label for="f-lyrics">' +
                'Lyrics with number chords' +
              '</label>' +

              '<textarea ' +
                'id="f-lyrics" ' +
                'spellcheck="false">' +
                v(song.lyrics) +
              '</textarea>' +

            '</div>' +

            '<div class="field">' +

              '<label>Preview</label>' +

              '<div class="preview">' +
                '<div ' +
                  'class="sheet-body" ' +
                  'id="preview">' +
                '</div>' +
              '</div>' +

            '</div>' +

          '</div>' +

          '<div class="field">' +

            '<label for="f-youtube">' +
              'YouTube link ' +
              '<span class="hint">' +
                'optional' +
              '</span>' +
            '</label>' +

            '<input ' +
              'id="f-youtube" ' +
              'type="text" ' +
              'inputmode="url" ' +
              'value="' +
                v(song.youtubeUrl) +
              '" ' +
              'placeholder="https://www.youtube.com/watch?v=…">' +

            '<span ' +
              'class="hint" ' +
              'id="f-youtube-check">' +
            '</span>' +

          '</div>' +

          '<div id="form-msg"></div>' +

          '<div class="form-actions">' +

            '<button ' +
              'class="btn" ' +
              'type="submit">' +

              (
                id
                  ? 'Save changes'
                  : 'Add song'
              ) +

            '</button>' +

            '<a ' +
              'class="btn ghost" ' +
              'href="#/admin">' +
              'Cancel' +
            '</a>' +

            (
              id
                ? '<button ' +
                    'class="btn quiet" ' +
                    'type="button" ' +
                    'id="delete">' +
                    'Delete song' +
                  '</button>'
                : ''
            ) +

          '</div>' +

        '</form>' +

      '</div>';

    /* ---------- Key Table ---------- */

    function usedSingers() {
      return Array.prototype.map.call(
        document.querySelectorAll(
          '#keys-tbody tr'
        ),
        function (tr) {
          return tr.dataset.singer;
        }
      );
    }

    function refreshKeysAddOptions() {
      const used =
        usedSingers();

      const select =
        document.getElementById(
          'keys-add-select'
        );

      const addBtn =
        document.getElementById(
          'keys-add-btn'
        );

      const available =
        vocalists.filter(
          function (s) {
            return (
              used.indexOf(
                s.name
              ) === -1
            );
          }
        );

      select.innerHTML =
        available.length

          ? available.map(
              function (s) {
                return (
                  '<option value="' +
                    v(s.name) +
                  '">' +
                    v(s.name) +
                  '</option>'
                );
              }
            ).join('')

          : '<option value="">' +
              (
                vocalists.length
                  ? 'Everyone’s on the table'
                  : 'No singers on the roster'
              ) +
            '</option>';

      select.disabled =
        !available.length;

      addBtn.disabled =
        !available.length;
    }

    refreshKeysAddOptions();

    document
      .getElementById(
        'keys-add-btn'
      )
      .addEventListener(
        'click',
        function () {
          const select =
            document.getElementById(
              'keys-add-select'
            );

          const name =
            select.value;

          if (!name) {
            return;
          }

          document
            .getElementById(
              'keys-tbody'
            )
            .insertAdjacentHTML(
              'beforeend',
              keysRowHTML({
                singer: name,
                key: ''
              })
            );

          refreshKeysAddOptions();
        }
      );

    document
      .getElementById(
        'keys-tbody'
      )
      .addEventListener(
        'click',
        function (e) {
          const btn =
            e.target.closest(
              '.row-remove'
            );

          if (!btn) {
            return;
          }

          btn.closest(
            'tr'
          ).remove();

          refreshKeysAddOptions();
        }
      );

    /* ---------- Lyrics Preview ---------- */

    const ta =
      document.getElementById(
        'f-lyrics'
      );

    const preview =
      document.getElementById(
        'preview'
      );

    function paint() {
      preview.innerHTML =
        Chords.render(
          ta.value
        );
    }

    ta.addEventListener(
      'input',
      paint
    );

    paint();

    /* ---------- Toolbar ---------- */

    document
      .getElementById(
        'toolbar'
      )
      .addEventListener(
        'click',
        function (e) {
          const btn =
            e.target.closest(
              '.chip'
            );

          if (!btn) {
            return;
          }

          const insert =
            btn.dataset.chord
              ? '[' +
                btn.dataset.chord +
                ']'
              : '\n' +
                btn.dataset.section +
                '\n';

          const start =
            ta.selectionStart;

          ta.value =
            ta.value.slice(
              0,
              start
            ) +

            insert +

            ta.value.slice(
              ta.selectionEnd
            );

          ta.focus();

          ta.selectionStart =
            ta.selectionEnd =
              start +
              insert.length;

          paint();
        }
      );

    /* ---------- YouTube ---------- */

    const ytInput =
      document.getElementById(
        'f-youtube'
      );

    const ytCheck =
      document.getElementById(
        'f-youtube-check'
      );

    function checkYoutube() {
      const val =
        ytInput.value.trim();

      if (!val) {
        ytCheck.textContent = '';
        return;
      }

      ytCheck.textContent =
        Chords.youtubeId(val)
          ? '✓ Link recognized'
          : 'Doesn’t look like a YouTube link yet';
    }

    ytInput.addEventListener(
      'input',
      checkYoutube
    );

    checkYoutube();

    /* ---------- Save Song ---------- */

    document
      .getElementById(
        'song-form'
      )
      .addEventListener(
        'submit',
        async function (e) {
          e.preventDefault();

          const msg =
            document.getElementById(
              'form-msg'
            );

          msg.innerHTML = '';

          const keys =
            Array.prototype.map.call(
              document.querySelectorAll(
                '#keys-tbody tr'
              ),
              function (tr) {
                return {
                  singer:
                    tr.dataset.singer,

                  key:
                    tr.querySelector(
                      '.key-input'
                    ).value
                };
              }
            );

          const payload = {
            title:
              document.getElementById(
                'f-title'
              ).value,

            singer:
              document.getElementById(
                'f-singer'
              ).value,

            keys: keys,

            bpm:
              document.getElementById(
                'f-bpm'
              ).value,

            lyrics:
              ta.value,

            youtubeUrl:
              ytInput.value
          };

          try {
            const saved =
              await api(
                '/songs' +
                  (
                    id
                      ? '/' + id
                      : ''
                  ),
                {
                  method:
                    id
                      ? 'PUT'
                      : 'POST',

                  headers: {
                    'Content-Type':
                      'application/json'
                  },

                  body:
                    JSON.stringify(
                      payload
                    )
                }
              );

            location.hash =
              '#/song/' +
              saved._id;

          } catch (err) {
            msg.innerHTML =
              '<p class="notice">' +
                Chords.escapeHtml(
                  err.message
                ) +
              '</p>';
          }
        }
      );

    /* ---------- Delete Song ---------- */

    const del =
      document.getElementById(
        'delete'
      );

    if (del) {
      del.addEventListener(
        'click',
        async function () {
          if (
            !confirm(
              'Delete "' +
              song.title +
              '" from the book?'
            )
          ) {
            return;
          }

          try {
            await api(
              '/songs/' + id,
              {
                method: 'DELETE'
              }
            );

            location.hash =
              '#/admin';

          } catch (err) {
            alert(
              err.message
            );
          }
        }
      );
    }

    player.load(null);
  };

  /* ---------- Manage Singers ---------- */

  views.singers = async function (
    version
  ) {
    if (!state.admin) {
      location.hash = '#/login';
      return;
    }

    let vocalists = [];
    let loadError = null;

    try {
      vocalists =
        await api('/vocalists') || [];

      if (
        !Array.isArray(vocalists)
      ) {
        vocalists = [];
      }

      if (
        version !== routeVersion
      ) {
        return;
      }

    } catch (e) {
      if (
        version !== routeVersion
      ) {
        return;
      }

      loadError =
        e.message;

      vocalists = [];
    }

    if (
      version !== routeVersion
    ) {
      return;
    }

    view.innerHTML =
      '<div class="wrap">' +

        '<header class="page-head">' +

          '<h1>Singers</h1>' +
          
          '<p>' +
            'The team roster used when building ' +
            'a song’s keys table. Add or remove a ' +
            'name here; it won’t change keys already ' +
            'saved on a song.' +
          '</p>' +

        '</header>' +

        (
          loadError
            ? '<p class="notice">' +
                Chords.escapeHtml(
                  loadError
                ) +
              '</p>'
            : ''
        ) +

        '<form class="form" ' +
          'id="singer-form" ' +
          'style="padding-top:0">' +

          '<div class="form-grid">' +

            '<div class="field">' +

              '<label for="f-singer-name">' +
                'Singer name' +
              '</label>' +

              '<input ' +
                'id="f-singer-name" ' +
                'type="text" ' +
                'placeholder="Singer H" ' +
                'required>' +

            '</div>' +

          '</div>' +

          '<div id="singer-form-msg"></div>' +

          '<div class="form-actions">' +

            '<button ' +
              'class="btn" ' +
              'type="submit">' +

              '+ Add singer' +

            '</button>' +

          '</div>' +

        '</form>' +

        (
          vocalists.length

            ? '<ul class="index singer-index" id="singer-index">' +

                vocalists.map(
                  function (s) {
                    return (
                      '<li class="singer-item">' +

                        '<span class="idx-title">' +
                          Chords.escapeHtml(
                            s.name
                          ) +
                        '</span>' +

                        '<span class="idx-leader"></span>' +

                        '<span class="row-actions">' +

                          '<button ' +
                            'type="button" ' +
                            'class="singer-remove" ' +
                            'data-id="' +
                              s._id +
                            '" ' +
                            'data-name="' +
                              Chords.escapeHtml(
                                s.name
                              ) +
                            '">' +

                            'Remove' +

                          '</button>' +

                        '</span>' +

                      '</li>'
                    );
                  }
                ).join('') +

              '</ul>'

            : '<div class="empty">' +
                '<p>' +
                  'No singers yet. ' +
                  'Add the first one above.' +
                '</p>' +
              '</div>'
        ) +

        '<button ' + 'type="button" ' + 'class="btn" ' + 'onclick="history.back()">' + '← Back' + '</button>' +

      '</div>';

    /* ---------- Add Singer ---------- */

    document
      .getElementById(
        'singer-form'
      )
      .addEventListener(
        'submit',
        async function (e) {
          e.preventDefault();

          const msg =
            document.getElementById(
              'singer-form-msg'
            );

          msg.innerHTML = '';

          const input =
            document.getElementById(
              'f-singer-name'
            );

          try {
            await api(
              '/vocalists',
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json'
                },

                body:
                  JSON.stringify({
                    name:
                      input.value
                  })
              }
            );

            /*
             * Navigate through the router instead
             * of directly calling views.singers().
             */
            views.singers(
              routeVersion
            );

          } catch (err) {
            msg.innerHTML =
              '<p class="notice">' +
                Chords.escapeHtml(
                  err.message
                ) +
              '</p>';
          }
        }
      );

    /* ---------- Remove Singer ---------- */

    const index =
      document.getElementById(
        'singer-index'
      );

    if (index) {
      index.addEventListener(
        'click',
        async function (e) {
          const btn =
            e.target.closest(
              '.singer-remove'
            );

          if (!btn) {
            return;
          }

          if (
            !confirm(
              'Remove "' +
              btn.dataset.name +
              '" from the singers list?'
            )
          ) {
            return;
          }

          try {
            await api(
              '/vocalists/' +
                btn.dataset.id,
              {
                method: 'DELETE'
              }
            );

            views.singers(
              routeVersion
            );

          } catch (err) {
            alert(
              err.message
            );
          }
        }
      );
    }

    player.load(null);
  };

  /* ---------- Router ---------- */

  function route() {
    /*
     * Every navigation gets a new version.
     */
    const version =
      ++routeVersion;

    const hash =
      location.hash.replace(
        /^#/,
        ''
      ) || '/';

    const parts =
      hash
        .split('/')
        .filter(Boolean);

    window.scrollTo(
      0,
      0
    );

    paintNav();

    if (
      parts.length === 0
    ) {
      return views.home();
    }

    if (
      parts[0] === 'chart'
    ) {
      return views.chart();
    }

    if (
      parts[0] === 'songs'
    ) {
      return views.songs(
        version
      );
    }

    if (
      parts[0] === 'song' &&
      parts[1]
    ) {
      return views.song(
        parts[1]
      );
    }

    if (
      parts[0] === 'login'
    ) {
      return views.login();
    }

    if (
      parts[0] === 'admin' &&
      parts[1] === 'singers'
    ) {
      return views.singers(
        version
      );
    }

    if (
      parts[0] === 'admin' &&
      parts[1] === 'new'
    ) {
      return views.editor(
        null,
        version
      );
    }

    if (
      parts[0] === 'admin' &&
      parts[1] === 'edit' &&
      parts[2]
    ) {
      return views.editor(
        parts[2],
        version
      );
    }

    if (
      parts[0] === 'admin'
    ) {
      return views.admin(
        version
      );
    }

    view.innerHTML =
      '<div class="wrap">' +

        '<div class="empty">' +

          '<p>' +
            'That page is not in the book.' +
          '</p>' +

          '<a class="btn ghost" href="#/">' +
            'Go to the search' +
          '</a>' +

        '</div>' +

      '</div>';
  }

  window.addEventListener(
    'hashchange',
    route
  );

  /* ---------- Start ---------- */

  (async function start() {
    try {
      const me =
        await api(
          '/auth/me'
        );

      state.admin =
        me.admin;

      state.username =
        me.username;

    } catch (e) {
      state.admin = false;
      state.username = null;
    }

    route();
  })();

})();