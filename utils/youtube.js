// Pulls the 11-character video ID out of any YouTube URL shape an admin
// might paste in: watch?v=, youtu.be/, /embed/, /shorts/, with or without
// extra query params, www/m/music subdomains.

function extractYouTubeId(input) {
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

module.exports = { extractYouTubeId };
