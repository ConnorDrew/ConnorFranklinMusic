// One page view, reported by js/site.js. Pulse counts every view (not a sample) with the
// page, whether it started a visit, the referring site's name, a device type and a country.
// Always answers 204.
const { ping, accept } = require('./_pulse');

module.exports = async (req, res) => {
  const ok = accept(req);
  if (ok) {
    const { body, ua } = ok;
    const visit = body.visit === true;
    const ref = visit && typeof body.ref === 'string' ? body.ref.toLowerCase().replace(/^www\./, '').slice(0, 100) : '';
    const device = /iPad|Tablet|Silk|Android(?!.*Mobile)/i.test(ua) ? 'tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'mobile' : 'desktop';
    const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
    await ping({ kind: 'view', page: body.page, visit, ref, device, country });
  }
  res.status(204).end();
};
