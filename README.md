# Song Book

Song lyrics stored with number chords, so any song can be played in any key.
Visitors search and read. One admin account adds and edits.

**Stack:** HTML, CSS, vanilla JavaScript on the front end; Node.js + Express and MongoDB on the back end.

## Running it

```bash
npm install
cp .env.example .env      # then edit the values, especially ADMIN_PASSWORD and SESSION_SECRET
npm run seed              # creates the admin account and two sample songs
npm start                 # http://localhost:3000
```

MongoDB needs to be reachable at `MONGODB_URI`. A local `mongod` or a free
MongoDB Atlas cluster both work; for Atlas, paste the connection string into `.env`.

## How a sheet is written

The admin types plain lyrics and puts each chord number in square brackets at the
exact syllable where the chord changes:

```
Verse 1:
How [1]great is our [4]God
Sing with me h[3]ow great is our G[2]od
```

The reader shows the numbers sitting above the syllable, in a monospace grid:

```
    1            4
How great is our God
```

A line that ends in a colon and holds no brackets becomes a section heading
(`Verse 1:`, `Chorus:`, `Bridge:`).

## Pages

| Route | What it is |
| --- | --- |
| `#/` | Landing page: wordmark and the search field, with live results |
| `#/chart` | Number chord chart — hover a key for its family, hover a number to follow it down every key |
| `#/songs` | Song list, title on the left, singer on the right |
| `#/song/:id` | The sheet, laid out like a printable page |
| `#/login` | Admin log in |
| `#/admin` | Admin home: search, the song index, and **+ Add a song** |
| `#/admin/new`, `#/admin/edit/:id` | Editor with a live preview beside the text |

The audio player is fixed to the bottom of every screen. It loads the MP3 of
whichever song is open, and sits idle elsewhere.

## API

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/songs?q=` | anyone |
| GET | `/api/songs/:id` | anyone |
| POST | `/api/songs` | admin, multipart, optional `audio` file |
| PUT | `/api/songs/:id` | admin |
| DELETE | `/api/songs/:id` | admin |
| GET | `/api/auth/me` | anyone |
| POST | `/api/auth/login` · `/api/auth/logout` | anyone · admin |

## Files

```
server.js            Express app, session store, static files
models/Song.js       title, singer, originalKey, bpm, lyrics, audioUrl
models/Admin.js      username + bcrypt hash
routes/              auth and song endpoints
middleware/          admin guard, multer audio upload
scripts/seed.js      creates the admin, adds sample songs
public/js/chords.js  bracket parser and the chord chart data
public/js/app.js     router, views, search, editor, player
public/css/style.css the whole visual system
uploads/             MP3s land here (served at /uploads)
```
