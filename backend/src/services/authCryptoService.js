const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');

const scrypt = promisify(crypto.scrypt);
const SCRYPT_PARAMETERS = Object.freeze({ N: 32_768, r: 8, p: 3, maxmem: 128 * 1024 * 1024 });
const PASSWORD_KEY_LENGTH = 32;
const DUMMY_PASSWORD_HASH = 'scrypt$32768$8$3$j00jsGeOxFio1QFrclttMw$-J5z4Z44xrrGGwpbH8DMXTXby83mdOUsGDViCNbZcdM';
const JWT_ISSUER = 'shortlearn-api';
const JWT_AUDIENCE = 'shortlearn-app';

function getPositiveInteger(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function requireSecret(name, fallbackName = null) {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : '');
  if (typeof value !== 'string' || value.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }
  return value;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH, SCRYPT_PARAMETERS);
  return [
    'scrypt',
    SCRYPT_PARAMETERS.N,
    SCRYPT_PARAMETERS.r,
    SCRYPT_PARAMETERS.p,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

async function verifyPassword(password, encodedHash) {
  const candidate = typeof encodedHash === 'string' && encodedHash.startsWith('scrypt$')
    ? encodedHash
    : DUMMY_PASSWORD_HASH;

  try {
    const [algorithm, n, r, p, saltValue, hashValue] = candidate.split('$');
    if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = await scrypt(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT_PARAMETERS.maxmem,
    });
    return encodedHash === candidate
      && expected.length === actual.length
      && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function createRefreshToken() {
  return `slr_${crypto.randomBytes(48).toString('base64url')}`;
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest();
}

function createOtpCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashOtp(challengeId, code) {
  return crypto
    .createHmac('sha256', requireSecret('OTP_HMAC_SECRET', 'JWT_SECRET'))
    .update(`${challengeId}:${code}`, 'utf8')
    .digest();
}

function safeDigestEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual || []);
  const expectedBuffer = Buffer.from(expected || []);
  return actualBuffer.length === expectedBuffer.length
    && actualBuffer.length > 0
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function signAccessToken(user, session) {
  const expiresInSeconds = getPositiveInteger('ACCESS_TOKEN_TTL_SECONDS', 900, { min: 60, max: 3600 });
  const token = jwt.sign(
    {
      type: 'access',
      sid: session.sessionKey,
      ver: Number(user.auth_version),
    },
    requireSecret('JWT_SECRET'),
    {
      algorithm: 'HS256',
      audience: JWT_AUDIENCE,
      expiresIn: expiresInSeconds,
      issuer: JWT_ISSUER,
      subject: user.public_id,
    }
  );
  return { token, expiresInSeconds };
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, requireSecret('JWT_SECRET'), {
    algorithms: ['HS256'],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });
  if (payload.type !== 'access') throw new jwt.JsonWebTokenError('Invalid token type.');
  return payload;
}

function signPasswordResetToken(user, challengeId) {
  const expiresInSeconds = getPositiveInteger('PASSWORD_RESET_TOKEN_TTL_SECONDS', 600, {
    min: 60,
    max: 1800,
  });
  const token = jwt.sign(
    {
      type: 'password_reset',
      challenge: challengeId,
      ver: Number(user.auth_version),
    },
    requireSecret('JWT_SECRET'),
    {
      algorithm: 'HS256',
      audience: JWT_AUDIENCE,
      expiresIn: expiresInSeconds,
      issuer: JWT_ISSUER,
      jwtid: crypto.randomUUID(),
      subject: user.public_id,
    }
  );
  return { token, expiresInSeconds };
}

function verifyPasswordResetToken(token) {
  const payload = jwt.verify(token, requireSecret('JWT_SECRET'), {
    algorithms: ['HS256'],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });
  if (payload.type !== 'password_reset') throw new jwt.JsonWebTokenError('Invalid token type.');
  return payload;
}

module.exports = {
  createOtpCode,
  createRefreshToken,
  getPositiveInteger,
  hashOtp,
  hashPassword,
  hashRefreshToken,
  safeDigestEqual,
  signAccessToken,
  signPasswordResetToken,
  verifyAccessToken,
  verifyPassword,
  verifyPasswordResetToken,
};
