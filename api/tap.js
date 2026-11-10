// A tap on a booking link (WhatsApp, email or phone), reported by js/site.js. Pulse counts
// it and can alert Discord. A tap is not a booking: the visitor may not send anything.
// Always answers 204.
const { ping, accept } = require('./_pulse');

const KINDS = ['whatsapp', 'email', 'call'];

module.exports = async (req, res) => {
  const ok = accept(req);
  if (ok && KINDS.includes(ok.body.kind)) await ping({ kind: ok.body.kind, page: ok.body.page });
  res.status(204).end();
};
