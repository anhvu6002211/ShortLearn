const db = require('../config/db');
const { verifyAccessToken } = require('../services/authCryptoService');

function sendUnauthorized(res) {
  res.setHeader('WWW-Authenticate', 'Bearer realm="shortlearn-api"');
  return res.status(401).json({
    error: 'A valid signed-in session is required.',
    code: 'unauthenticated',
  });
}

function readBearerToken(header) {
  if (typeof header !== 'string' || header.length > 4096) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] || null;
}

async function authenticateJwt(req, res, next) {
  const token = readBearerToken(req.headers?.authorization);
  if (!token) return sendUnauthorized(res);

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    return sendUnauthorized(res);
  }

  if (
    typeof claims.sub !== 'string'
    || typeof claims.sid !== 'string'
    || !Number.isSafeInteger(Number(claims.ver))
    || Number(claims.ver) < 1
  ) {
    return sendUnauthorized(res);
  }

  try {
    const [rows] = await db.query(
      `SELECT u.id AS user_id, u.public_id, u.email, u.display_name,
              u.auth_version, s.id AS session_id, s.session_key, s.expires_at
       FROM users u
       JOIN auth_sessions s ON s.user_id = u.id
       WHERE u.public_id = ? AND s.session_key = ?
         AND u.status = 'active' AND u.deleted_at IS NULL
         AND u.auth_version = ?
         AND s.revoked_at IS NULL AND s.expires_at > NOW()
       LIMIT 1`,
      [claims.sub, claims.sid, Number(claims.ver)]
    );
    const identity = rows[0];
    if (!identity) return sendUnauthorized(res);

    req.auth = Object.freeze({
      userId: Number(identity.user_id),
      userPublicId: identity.public_id,
      email: identity.email,
      displayName: identity.display_name || null,
      authVersion: Number(identity.auth_version),
      sessionId: Number(identity.session_id),
      sessionKey: identity.session_key,
    });
    return next();
  } catch (error) {
    console.error(`Authentication lookup failed [${req.requestId || 'no-request-id'}]:`, error);
    return res.status(503).json({
      error: 'Authentication service is temporarily unavailable.',
      code: 'auth_service_unavailable',
    });
  }
}

function rejectClientUserId(req, res, next) {
  const hasOwn = (value, key) => value
    && typeof value === 'object'
    && Object.prototype.hasOwnProperty.call(value, key);
  const suppliesIdentity = ['user_id', 'userId'].some((key) => (
    hasOwn(req.query, key) || hasOwn(req.body, key) || hasOwn(req.params, key)
  ));

  if (suppliesIdentity) {
    return res.status(400).json({
      error: 'Do not send user_id; the authenticated user is taken from the access token.',
      code: 'client_identity_forbidden',
    });
  }
  return next();
}

module.exports = { authenticateJwt, readBearerToken, rejectClientUserId };
