export function cleanString(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function cleanText(value, max = 2400) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/[ \t]+/g, ' '))
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

export function validateLead(body = {}) {
  const lead = {
    name: cleanString(body.name, 120),
    contact: cleanString(body.contact, 160),
    niche: cleanString(body.niche, 120),
    message: cleanText(body.message, 2400),
    language: ['uk', 'en'].includes(body.language) ? body.language : 'uk',
    page: cleanString(body.page || 'contact', 80),
    source: cleanString(body.source || 'website', 80),
    meta: typeof body.meta === 'object' && body.meta !== null ? body.meta : {}
  };

  const errors = {};
  if (lead.name.length < 2) errors.name = 'Name is required';
  if (lead.contact.length < 3) errors.contact = 'Phone or Telegram is required';
  if (lead.niche.length < 2) errors.niche = 'Business niche is required';
  if (lead.message.length < 8) errors.message = 'Task description is required';

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    lead
  };
}

export function requireAdmin(req, res, next) {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken || configuredToken === 'change-this-long-random-token') {
    return res.status(500).json({
      ok: false,
      error: 'ADMIN_TOKEN is not configured. Set it in .env before using admin API.'
    });
  }

  const providedToken = req.get('X-Admin-Token') || req.query.token;
  if (providedToken !== configuredToken) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  next();
}
