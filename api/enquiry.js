// Booking enquiry form (js/site.js) -> email to Connor via Resend.
// The customer never sees the sending address; Reply-To is the customer, so hitting
// Reply in Gmail answers them directly. Nothing is stored on this site.
//
// Vercel environment variables (Production, Sensitive):
//   RESEND_API_KEY  required. A sending-only Resend key for a verified domain.
//   ENQUIRY_FROM    optional. Default: Connor Franklin Music <bookings@drewframe.co.uk>
//   ENQUIRY_TO      optional. Default: connorfranklinmusic@gmail.com
//   DISCORD_WEBHOOK optional. Connor's private Discord channel; gets the full enquiry too.
//
// Answers: 200 {ok:true} sent (or a bot, silently dropped), 400 bad input,
// 429 too many, 503 not configured, 502 Resend refused. On anything but 200 the
// page offers a pre-filled email/WhatsApp instead, so the enquiry isn't lost.
const { ping } = require('./_pulse');

const FROM = process.env.ENQUIRY_FROM || 'Connor Franklin Music <bookings@drewframe.co.uk>';
const TO = process.env.ENQUIRY_TO || 'connorfranklinmusic@gmail.com';
const TYPES = ['Pub or bar', 'Wedding', 'Private party', 'Corporate event', 'Other'];
const EMAIL = /^[^\s@,;<>"()]+@[^\s@,;<>"()]+\.[^\s@,;<>"()]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^[0-9+()\-.\s]{6,25}$/;

// Best-effort limit per server instance: 5 enquiries per 10 minutes from one address.
const recent = new Map();
function limited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 500) recent.delete(recent.keys().next().value);
  return hits.length > 5;
}

const line = (v, max) => (typeof v === 'string' ? v.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) : '');
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function niceDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00Z');
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const from = req.headers['sec-fetch-site'];
  if (from && from !== 'same-origin') return res.status(403).json({ ok: false });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  if (!b || typeof b !== 'object') return res.status(400).json({ ok: false, error: 'bad request' });

  // Bots: the hidden "website" field is filled, or the form was sent within 3 seconds of
  // opening. Pretend it worked so they don't try again.
  if (line(b.website, 200) || !(Number(b.elapsed) >= 3000)) return res.status(200).json({ ok: true });

  const f = {
    name: line(b.name, 100),
    email: line(b.email, 200),
    phone: line(b.phone, 25),
    date: line(b.date, 10),
    location: line(b.location, 150),
    type: line(b.type, 40),
    message: typeof b.message === 'string' ? b.message.replace(/\r\n?/g, '\n').trim().slice(0, 3000) : '',
  };
  const bad = [];
  if (!f.name) bad.push('name');
  if (!EMAIL.test(f.email)) bad.push('email');
  if (f.phone && !PHONE.test(f.phone)) bad.push('phone');
  if (f.date && (!DATE.test(f.date) || !niceDate(f.date))) bad.push('date');
  if (f.type && !TYPES.includes(f.type)) bad.push('type');
  if (bad.length) return res.status(400).json({ ok: false, error: 'invalid', fields: bad });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'too many' });

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('[enquiry] RESEND_API_KEY is not set');
    return res.status(503).json({ ok: false, error: 'not configured' });
  }

  const when = niceDate(f.date);
  // "Booking Enquiry" stays at the start so one Gmail filter catches these and old-style emails.
  const subject = `Booking Enquiry: ${[f.type, when].filter(Boolean).join(', ') || 'new enquiry'} (${f.name})`;
  const rows = [
    ['Name', f.name],
    ['Email', f.email],
    ['Phone', f.phone],
    ['Date', when || 'Not given'],
    ['Venue / town', f.location || 'Not given'],
    ['Event type', f.type || 'Not given'],
  ].filter(([, v]) => v);

  const text = [
    'New booking enquiry from connorfranklinmusic.co.uk',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    f.message || '(No message)',
    '',
    `Reply to this email to answer ${f.name} directly.`,
  ].join('\n');

  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#141210;max-width:560px">
<p style="margin:0 0 14px;font-size:13px;color:#666">New booking enquiry from connorfranklinmusic.co.uk</p>
<table cellpadding="6" style="border-collapse:collapse;margin-bottom:14px">
${rows.map(([k, v]) => `<tr><td style="color:#666;padding-left:0;vertical-align:top">${esc(k)}</td><td><strong>${esc(v)}</strong></td></tr>`).join('\n')}
</table>
<div style="white-space:pre-wrap;border-left:3px solid #e8443c;padding:4px 0 4px 12px;margin-bottom:16px">${esc(f.message || '(No message)')}</div>
<p style="margin:0;font-size:13px;color:#666">Reply to this email to answer ${esc(f.name)} directly.</p>
</div>`;

  // Email first, then Discord (which says whether the email went). Either one arriving is enough: Connor has the details
  // and the customer's email address to reply to.
  const emailed = await sendEmail(key, f.email, subject, text, html);
  const posted = await postDiscord(f, when, emailed);
  if (!emailed && !posted) return res.status(502).json({ ok: false, error: 'send failed' });

  // Pulse counts it; `alerted` stops Pulse posting its own (detail-free) alert as well.
  await ping({ kind: 'enquiry', alerted: posted });
  return res.status(200).json({ ok: true });
};

async function sendEmail(key, replyTo, subject, text, html) {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: replyTo, subject: subject.slice(0, 200), text, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) return true;
    console.error('[enquiry] Resend refused', r.status, (await r.text().catch(() => '')).slice(0, 300));
  } catch (err) {
    console.error('[enquiry] Resend unreachable', err && err.message);
  }
  return false;
}

// The full enquiry in Connor's private Discord channel (DISCORD_WEBHOOK, optional).
// Mentions are switched off, so "@everyone" in a message can't ping anyone.
const md = (s) => s.replace(/([\\*_~`|>#[\]()-])/g, '\\$1');
async function postDiscord(f, when, emailed) {
  const hook = process.env.DISCORD_WEBHOOK;
  if (!hook) return false;
  const field = (name, value, inline = true) => (value ? [{ name, value: md(value).slice(0, 1024), inline }] : []);
  const embed = {
    title: '📩 New booking enquiry',
    color: 0xe8443c,
    fields: [
      ...field('Name', f.name),
      ...field('Event', f.type || 'Not given'),
      ...field('Date', when || 'Not given'),
      ...field('Venue / town', f.location || 'Not given'),
      ...field('Email', f.email),
      ...field('Phone', f.phone),
      ...field('Message', f.message, false),
    ],
    footer: { text: emailed
      ? 'Also emailed to connorfranklinmusic@gmail.com. Reply there to answer them.'
      : "⚠️ The email didn't send, so this is the only copy. Reply to them from your own email." },
    timestamp: new Date().toISOString(),
  };
  try {
    const r = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return true;
    console.error('[enquiry] Discord refused', r.status);
  } catch (err) {
    console.error('[enquiry] Discord unreachable', err && err.message);
  }
  return false;
}
