// Daily check from Drewframe Pulse: confirms the booking form (api/enquiry.js) is set up to
// send email, without sending anything. Without the right key it behaves like any missing page.
const { timingSafeEqual } = require('node:crypto');

module.exports = (req, res) => {
  const key = process.env.PULSE_KEY || '';
  const given = String(req.headers['x-pulse-key'] || '');
  const match = key && given.length === key.length && timingSafeEqual(Buffer.from(given), Buffer.from(key));
  if (!match) return res.status(404).send('Not found');
  res.setHeader('cache-control', 'no-store');
  const checks = [
    process.env.RESEND_API_KEY
      ? { name: 'Booking form email (Resend key set)', ok: true }
      : { name: 'Booking form email', ok: false, detail: 'RESEND_API_KEY is not set in Vercel' },
  ];
  res.status(200).json({ ok: checks.every((c) => c.ok), checks });
};
