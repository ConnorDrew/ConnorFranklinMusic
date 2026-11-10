// Drewframe Pulse: counts page views and taps on the booking links for this site.
// PULSE_KEY is a Vercel environment variable (Production, Sensitive). Without it nothing is
// sent. Pulse never receives anything that identifies a visitor: no IP, no cookie, no ID.
// Files starting with _ in api/ are not deployed as their own functions.

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|python|curl|wget|httpclient/i;
const PAGE = /^\/[\w\-./]{0,120}$/;

async function ping(body) {
  const key = process.env.PULSE_KEY;
  if (!key) return;
  try {
    await fetch('https://pulse.drewframe.co.uk/ping', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pulse-key': key },
      body: JSON.stringify({ ...body, site: 'cfmusic' }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error('[pulse] ping failed', err && err.message);
  }
}

/** Common checks: POST from this site's own pages, by a real browser. Returns the body or null. */
function accept(req) {
  if (req.method !== 'POST') return null;
  const from = req.headers['sec-fetch-site'];
  if (from && from !== 'same-origin') return null;
  const ua = req.headers['user-agent'] || '';
  if (!ua || BOT.test(ua)) return null;
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return null; } }
  if (!body || typeof body.page !== 'string' || !PAGE.test(body.page)) return null;
  return { body, ua };
}

module.exports = { ping, accept };
