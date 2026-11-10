// Daily check from Drewframe Pulse. This site has no form (bookings go by email or
// WhatsApp), so there is nothing to sign in to: it confirms the site's server code runs
// and has its key. Without the right key it behaves like any missing page.
const { timingSafeEqual } = require('node:crypto');

module.exports = (req, res) => {
  const key = process.env.PULSE_KEY || '';
  const given = String(req.headers['x-pulse-key'] || '');
  const match = key && given.length === key.length && timingSafeEqual(Buffer.from(given), Buffer.from(key));
  if (!match) return res.status(404).send('Not found');
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({ ok: true, checks: [{ name: 'Site functions running (no form to check)', ok: true }] });
};
