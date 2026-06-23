import crypto from 'node:crypto';

const COOKIE_NAME = 'avant_admin_session';
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = 'sha256';

export function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(String(password), salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST)
    .toString('hex');

  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash = '') {
  const parts = String(storedHash || '').split('$');

  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return false;
  }

  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expected = parts[3];

  if (!iterations || !salt || !expected) {
    return false;
  }

  const actual = crypto
    .pbkdf2Sync(String(password), salt, iterations, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST)
    .toString('hex');

  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function createSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

export function hashSessionToken(token) {
  const secret = String(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_TOKEN || 'dev-secret');
  return crypto
    .createHmac('sha256', secret)
    .update(String(token))
    .digest('hex');
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';

  return header.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index === -1) return acc;

    const key = decodeURIComponent(part.slice(0, index).trim());
    const value = decodeURIComponent(part.slice(index + 1).trim());

    if (key) acc[key] = value;
    return acc;
  }, {});
}

function buildCookie(name, value, options = {}) {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  return parts.join('; ');
}

export function sessionCookie(token, maxAgeSeconds) {
  return buildCookie(COOKIE_NAME, token, { maxAge: maxAgeSeconds });
}

export function clearSessionCookie() {
  return buildCookie(COOKIE_NAME, '', {
    maxAge: 0,
    expires: new Date(0)
  });
}

export function getSessionTokenFromRequest(req) {
  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME] || '';
}

export function safeAdminUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}
