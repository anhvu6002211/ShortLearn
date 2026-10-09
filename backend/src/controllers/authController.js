const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/db');
const {
  createOtpCode,
  createRefreshToken,
  getPositiveInteger,
  hashOtp,
  hashPassword,
  hashRefreshToken,
  safeDigestEqual,
  signAccessToken,
  signPasswordResetToken,
  verifyPassword,
  verifyPasswordResetToken,
} = require('../services/authCryptoService');
const { deliverOtp, exposeDevelopmentCode } = require('../services/otpDeliveryService');
const {
  normalizeChallengeId,
  normalizeDevice,
  normalizeDisplayName,
  normalizeEmail,
  normalizeOtpCode,
  normalizeOtpPurpose,
  normalizePassword,
  normalizeRefreshToken,
  normalizeResetToken,
} = require('../utils/authValidation');

const GENERIC_OTP_MESSAGE = 'If the account can use this method, a verification code has been sent.';
const googleClient = new OAuth2Client();

class AuthHttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AuthHttpError';
    this.status = status;
    this.code = code;
  }
}

async function withTransaction(work) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

function getRequestIp(req) {
  const value = String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  return value.length <= 45 ? value : '';
}

function getUserAgent(req) {
  const value = typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : '';
  return value.slice(0, 512) || null;
}

function publicUser(user) {
  return {
    id: user.public_id,
    email: user.email,
    display_name: user.display_name || null,
    avatar_url: user.avatar_url || null,
    status: user.status,
    email_verified: Boolean(user.email_verified_at),
    current_level: user.current_level,
  };
}

function sendAuthError(res, error, fallbackMessage) {
  if (error instanceof TypeError) {
    return res.status(400).json({ error: error.message, code: 'invalid_request' });
  }
  if (error instanceof AuthHttpError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
    return res.status(401).json({ error: 'The reset token is invalid or expired.', code: 'invalid_reset_token' });
  }
  if (error?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'An account with this email already exists.', code: 'email_in_use' });
  }

  console.error(`Authentication error [${fallbackMessage}]:`, error);
  const payload = { error: fallbackMessage, code: 'internal_error' };
  if (process.env.NODE_ENV !== 'production') payload.details = error.message;
  return res.status(500).json(payload);
}

async function createOtpChallenge(connection, { email, userId, purpose, ipAddress }) {
  const expiresInSeconds = getPositiveInteger('OTP_TTL_SECONDS', 600, { min: 120, max: 1800 });
  const maxAttempts = getPositiveInteger('OTP_MAX_ATTEMPTS', 5, { min: 3, max: 10 });
  const cooldownSeconds = getPositiveInteger('OTP_RESEND_COOLDOWN_SECONDS', 60, { min: 10, max: 300 });
  const [recentRows] = await connection.query(
    `SELECT challenge_key, expires_at
     FROM auth_one_time_codes
     WHERE email_normalized = ? AND purpose = ? AND user_id <=> ?
       AND consumed_at IS NULL AND invalidated_at IS NULL AND expires_at > NOW()
       AND created_at >= ?
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`,
    [email, purpose, userId, new Date(Date.now() - cooldownSeconds * 1000)]
  );
  if (recentRows[0]) {
    return {
      challengeId: recentRows[0].challenge_key,
      code: null,
      expiresInSeconds: Math.max(
        1,
        Math.floor((new Date(recentRows[0].expires_at).getTime() - Date.now()) / 1000)
      ),
      reused: true,
    };
  }

  const challengeId = crypto.randomUUID();
  const code = createOtpCode();
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  await connection.query(
    `UPDATE auth_one_time_codes
     SET invalidated_at = NOW()
     WHERE email_normalized = ? AND purpose = ?
       AND consumed_at IS NULL AND invalidated_at IS NULL`,
    [email, purpose]
  );
  await connection.query(
    `INSERT INTO auth_one_time_codes
      (challenge_key, user_id, email_normalized, purpose, code_hash,
       max_attempts, requested_ip, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, INET6_ATON(NULLIF(?, '')), ?)`,
    [challengeId, userId, email, purpose, hashOtp(challengeId, code), maxAttempts, ipAddress, expiresAt]
  );

  return { challengeId, code, expiresInSeconds };
}

async function createSessionTokens(connection, user, req, device) {
  const sessionKey = crypto.randomUUID();
  const familyKey = crypto.randomUUID();
  const refreshToken = createRefreshToken();
  const refreshTtlDays = getPositiveInteger('REFRESH_TOKEN_TTL_DAYS', 30, { min: 1, max: 90 });
  const expiresAt = new Date(Date.now() + refreshTtlDays * 86_400_000);

  const [sessionResult] = await connection.query(
    `INSERT INTO auth_sessions
      (session_key, user_id, device_platform, device_name, app_version,
       ip_address, user_agent, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, INET6_ATON(NULLIF(?, '')), ?, NOW(), ?)`,
    [
      sessionKey,
      user.id,
      device.platform,
      device.name,
      device.appVersion,
      getRequestIp(req),
      getUserAgent(req),
      expiresAt,
    ]
  );
  await connection.query(
    `INSERT INTO auth_refresh_tokens
      (session_id, family_key, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [sessionResult.insertId, familyKey, hashRefreshToken(refreshToken), expiresAt]
  );

  const access = signAccessToken(user, { sessionKey });
  return {
    access_token: access.token,
    access_token_expires_in: access.expiresInSeconds,
    refresh_token: refreshToken,
    refresh_token_expires_in: refreshTtlDays * 86_400,
    token_type: 'Bearer',
    session_id: sessionKey,
  };
}

async function findOtpEligibleUser(connection, email, purpose) {
  const [rows] = await connection.query(
    `SELECT id, public_id, email, display_name, avatar_url, status,
            email_verified_at, current_level, auth_version
     FROM users
     WHERE email_normalized = ? AND deleted_at IS NULL
     LIMIT 1
     FOR UPDATE`,
    [email]
  );
  const user = rows[0] || null;
  if (!user || user.status === 'disabled' || user.status === 'deleted') return null;
  if (purpose === 'verify_email') return user.status === 'pending_verification' ? user : null;
  return user.status === 'active' ? user : null;
}

async function requestOtpChallenge(req, purposeOverride = null) {
  const email = normalizeEmail(req.body?.email);
  const purpose = purposeOverride || normalizeOtpPurpose(req.body?.purpose);
  const result = await withTransaction(async (connection) => {
    const user = await findOtpEligibleUser(connection, email, purpose);
    const challenge = await createOtpChallenge(connection, {
      email,
      userId: user?.id || null,
      purpose,
      ipAddress: getRequestIp(req),
    });
    return { ...challenge, user };
  });

  if (result.user && result.code) {
    void deliverOtp({
        email,
        code: result.code,
        purpose,
        challengeId: result.challengeId,
        expiresInSeconds: result.expiresInSeconds,
      })
      .catch((error) => {
        // Keep the public response indistinguishable from an unknown email.
        console.error('OTP delivery failed:', error);
      });
  }

  return {
    message: GENERIC_OTP_MESSAGE,
    challenge_id: result.challengeId,
    expires_in: result.expiresInSeconds,
    ...(exposeDevelopmentCode() && result.user && result.code ? { development_code: result.code } : {}),
  };
}

/** POST /api/v1/auth/register */
async function register(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = normalizePassword(req.body?.password);
    const displayName = normalizeDisplayName(req.body?.display_name);
    const passwordHash = await hashPassword(password);

    const result = await withTransaction(async (connection) => {
      const [existing] = await connection.query(
        'SELECT id FROM users WHERE email_normalized = ? LIMIT 1 FOR UPDATE',
        [email]
      );
      if (existing.length > 0) {
        throw new AuthHttpError(409, 'email_in_use', 'An account with this email already exists.');
      }

      const publicId = crypto.randomUUID();
      const [insertResult] = await connection.query(
        `INSERT INTO users
          (public_id, email, password_hash, display_name, status, password_changed_at)
         VALUES (?, ?, ?, ?, 'pending_verification', NOW())`,
        [publicId, email, passwordHash, displayName]
      );
      const challenge = await createOtpChallenge(connection, {
        email,
        userId: insertResult.insertId,
        purpose: 'verify_email',
        ipAddress: getRequestIp(req),
      });
      return {
        challenge,
        user: {
          id: insertResult.insertId,
          public_id: publicId,
          email,
          display_name: displayName,
          avatar_url: null,
          status: 'pending_verification',
          email_verified_at: null,
          current_level: 'B1',
          auth_version: 1,
        },
      };
    });

    await deliverOtp({
      email,
      code: result.challenge.code,
      purpose: 'verify_email',
      challengeId: result.challenge.challengeId,
      expiresInSeconds: result.challenge.expiresInSeconds,
    });

    return res.status(201).json({
      user: publicUser(result.user),
      verification: {
        challenge_id: result.challenge.challengeId,
        expires_in: result.challenge.expiresInSeconds,
        ...(exposeDevelopmentCode() ? { development_code: result.challenge.code } : {}),
      },
    });
  } catch (error) {
    return sendAuthError(res, error, 'Unable to register the account.');
  }
}


/** POST /api/v1/auth/google */
async function googleLogin(req, res) {
  try {
    const idToken = typeof req.body?.id_token === 'string' ? req.body.id_token.trim() : '';
    const audience = process.env.GOOGLE_WEB_CLIENT_ID;
    if (!audience) throw new AuthHttpError(503, 'google_auth_unavailable', 'Google sign-in is not configured.');
    if (!idToken || idToken.length > 10_000) throw new TypeError('id_token is required.');
    const ticket = await googleClient.verifyIdToken({ idToken, audience });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || !profile.email_verified) {
      throw new AuthHttpError(401, 'invalid_google_token', 'Google account verification failed.');
    }
    const email = normalizeEmail(profile.email);
    const device = normalizeDevice(req.body?.device);
    const result = await withTransaction(async (connection) => {
      const [identityRows] = await connection.query(
        `SELECT u.id, u.public_id, u.email, u.display_name, u.avatar_url, u.status,
                u.email_verified_at, u.current_level, u.auth_version
         FROM user_auth_identities i JOIN users u ON u.id = i.user_id
         WHERE i.provider = 'google' AND i.provider_subject = ? AND u.deleted_at IS NULL
         LIMIT 1 FOR UPDATE`, [profile.sub],
      );
      let user = identityRows[0];
      if (!user) {
        const [emailRows] = await connection.query(
          'SELECT id FROM users WHERE email_normalized = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE', [email],
        );
        if (emailRows[0]) throw new AuthHttpError(409, 'email_in_use', 'Use your existing sign-in method for this email.');
        const publicId = crypto.randomUUID();
        const displayName = normalizeDisplayName(profile.name || profile.email.split('@')[0]);
        const [insert] = await connection.query(
          `INSERT INTO users (public_id, email, password_hash, display_name, avatar_url, status, email_verified_at, password_changed_at)
           VALUES (?, ?, NULL, ?, ?, 'active', NOW(), NOW())`,
          [publicId, email, displayName, typeof profile.picture === 'string' ? profile.picture.slice(0, 2048) : null],
        );
        await connection.query(
          `INSERT INTO user_auth_identities (user_id, provider, provider_subject, provider_email)
           VALUES (?, 'google', ?, ?)`, [insert.insertId, profile.sub, email],
        );
        user = { id: insert.insertId, public_id: publicId, email, display_name: displayName, avatar_url: profile.picture || null, status: 'active', email_verified_at: new Date(), current_level: 'B1', auth_version: 1 };
      }
      if (user.status !== 'active') throw new AuthHttpError(403, 'account_unavailable', 'This account is not available.');
      await connection.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
      return { user, tokens: await createSessionTokens(connection, user, req, device) };
    });
    return res.status(200).json({ user: publicUser(result.user), tokens: result.tokens });
  } catch (error) {
    return sendAuthError(res, error, 'Unable to sign in with Google.');
  }
}

/** POST /api/v1/auth/login */
async function login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password || password.length > 128) throw new TypeError('password is required.');
    const device = normalizeDevice(req.body?.device);

    const [rows] = await db.query(
      `SELECT id, public_id, email, password_hash, display_name, avatar_url, status,
              email_verified_at, current_level, auth_version,
              failed_login_attempts, locked_until
       FROM users
       WHERE email_normalized = ? AND deleted_at IS NULL
       LIMIT 1`,
      [email]
    );
    const user = rows[0] || null;
    const passwordMatches = await verifyPassword(password, user?.password_hash);
    const now = Date.now();

    if (user?.locked_until && new Date(user.locked_until).getTime() > now) {
      const retryAfter = Math.max(1, Math.ceil((new Date(user.locked_until).getTime() - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      throw new AuthHttpError(429, 'account_locked', 'Too many failed attempts. Try again later.');
    }

    if (!user || !passwordMatches) {
      if (user) {
        const maxAttempts = getPositiveInteger('LOGIN_MAX_ATTEMPTS', 5, { min: 3, max: 10 });
        const lockMinutes = getPositiveInteger('LOGIN_LOCK_MINUTES', 15, { min: 1, max: 1440 });
        const previousAttempts = user.locked_until ? 0 : Number(user.failed_login_attempts || 0);
        const failedAttempts = previousAttempts + 1;
        const lockedUntil = failedAttempts >= maxAttempts
          ? new Date(Date.now() + lockMinutes * 60_000)
          : null;
        await db.query(
          'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
          [failedAttempts, lockedUntil, user.id]
        );
      }
      throw new AuthHttpError(401, 'invalid_credentials', 'Email or password is incorrect.');
    }

    if (user.status === 'pending_verification') {
      throw new AuthHttpError(403, 'email_not_verified', 'Verify your email before signing in.');
    }
    if (user.status !== 'active') {
      throw new AuthHttpError(403, 'account_unavailable', 'This account is not available.');
    }

    const tokens = await withTransaction(async (connection) => {
      await connection.query(
        `UPDATE users
         SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
         WHERE id = ?`,
        [user.id]
      );
      return createSessionTokens(connection, user, req, device);
    });
    return res.status(200).json({ user: publicUser(user), tokens });
  } catch (error) {
    return sendAuthError(res, error, 'Unable to sign in.');
  }
}

/** POST /api/v1/auth/otp/request */
async function requestOtp(req, res) {
  try {
    const payload = await requestOtpChallenge(req);
    return res.status(202).json(payload);
  } catch (error) {
    return sendAuthError(res, error, 'Unable to request a verification code.');
  }
}

/** POST /api/v1/auth/forgot-password */
async function forgotPassword(req, res) {
  try {
    const payload = await requestOtpChallenge(req, 'password_reset');
    return res.status(202).json(payload);
  } catch (error) {
    return sendAuthError(res, error, 'Unable to request a password reset.');
  }
}

/** POST /api/v1/auth/otp/verify */
async function verifyOtp(req, res) {
  try {
    const challengeId = normalizeChallengeId(req.body?.challenge_id);
    const purpose = normalizeOtpPurpose(req.body?.purpose);
    const code = normalizeOtpCode(req.body?.code);
    const device = normalizeDevice(req.body?.device);

    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.query(
        `SELECT otp.id AS otp_id, otp.challenge_key, otp.purpose, otp.code_hash,
                otp.attempt_count, otp.max_attempts, otp.expires_at,
                otp.consumed_at, otp.invalidated_at,
                u.id AS user_id, u.public_id, u.email, u.display_name, u.avatar_url,
                u.status, u.email_verified_at, u.current_level, u.auth_version
         FROM auth_one_time_codes otp
         LEFT JOIN users u ON u.id = otp.user_id AND u.deleted_at IS NULL
         WHERE otp.challenge_key = ?
         LIMIT 1
         FOR UPDATE`,
        [challengeId]
      );
      const row = rows[0];
      const unavailable = !row
        || row.purpose !== purpose
        || row.consumed_at
        || row.invalidated_at
        || new Date(row.expires_at).getTime() <= Date.now()
        || Number(row.attempt_count) >= Number(row.max_attempts);
      if (unavailable) {
        return { invalid: true };
      }

      const expectedHash = hashOtp(challengeId, code);
      if (!safeDigestEqual(expectedHash, row.code_hash)) {
        const attempts = Number(row.attempt_count) + 1;
        await connection.query(
          `UPDATE auth_one_time_codes
           SET attempt_count = ?, invalidated_at = IF(? >= max_attempts, NOW(), invalidated_at)
           WHERE id = ?`,
          [attempts, attempts, row.otp_id]
        );
        return { invalid: true };
      }
      if (!row.user_id || row.status === 'disabled' || row.status === 'deleted') {
        return { invalid: true };
      }

      await connection.query(
        'UPDATE auth_one_time_codes SET consumed_at = NOW() WHERE id = ?',
        [row.otp_id]
      );

      const user = {
        id: row.user_id,
        public_id: row.public_id,
        email: row.email,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        status: row.status,
        email_verified_at: row.email_verified_at,
        current_level: row.current_level,
        auth_version: row.auth_version,
      };

      if (purpose === 'password_reset') {
        if (user.status !== 'active') {
          throw new AuthHttpError(400, 'invalid_otp', 'The verification code is invalid or expired.');
        }
        const reset = signPasswordResetToken(user, challengeId);
        return {
          kind: 'password_reset',
          payload: { reset_token: reset.token, expires_in: reset.expiresInSeconds },
        };
      }

      if (purpose === 'verify_email') {
        if (user.status !== 'pending_verification' && user.status !== 'active') {
          throw new AuthHttpError(400, 'invalid_otp', 'The verification code is invalid or expired.');
        }
        await connection.query(
          `UPDATE users
           SET status = 'active', email_verified_at = COALESCE(email_verified_at, NOW()),
               failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
           WHERE id = ?`,
          [user.id]
        );
        user.status = 'active';
        user.email_verified_at = user.email_verified_at || new Date();
      } else if (user.status !== 'active') {
        throw new AuthHttpError(400, 'invalid_otp', 'The verification code is invalid or expired.');
      } else {
        await connection.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
      }

      const tokens = await createSessionTokens(connection, user, req, device);
      return { kind: 'authenticated', payload: { user: publicUser(user), tokens } };
    });

    if (result.invalid) {
      throw new AuthHttpError(400, 'invalid_otp', 'The verification code is invalid or expired.');
    }
    return res.status(200).json(result.payload);
  } catch (error) {
    return sendAuthError(res, error, 'Unable to verify the code.');
  }
}

/** POST /api/v1/auth/refresh */
async function refresh(req, res) {
  try {
    const refreshToken = normalizeRefreshToken(req.body?.refresh_token);
    const tokenHash = hashRefreshToken(refreshToken);

    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.query(
        `SELECT rt.id AS refresh_token_id, rt.family_key, rt.used_at,
                rt.revoked_at AS token_revoked_at, rt.expires_at AS token_expires_at,
                s.id AS session_db_id, s.session_key, s.revoked_at AS session_revoked_at,
                s.expires_at AS session_expires_at,
                u.id AS user_id, u.public_id, u.email, u.display_name, u.avatar_url,
                u.status, u.email_verified_at, u.current_level, u.auth_version
         FROM auth_refresh_tokens rt
         JOIN auth_sessions s ON s.id = rt.session_id
         JOIN users u ON u.id = s.user_id
         WHERE rt.token_hash = ?
         LIMIT 1
         FOR UPDATE`,
        [tokenHash]
      );
      const row = rows[0];
      if (!row) return { invalid: true };

      if (row.used_at || row.token_revoked_at) {
        await connection.query(
          `UPDATE auth_refresh_tokens
           SET revoked_at = COALESCE(revoked_at, NOW()), revoke_reason = 'reuse_detected'
           WHERE family_key = ?`,
          [row.family_key]
        );
        await connection.query(
          `UPDATE auth_sessions
           SET revoked_at = COALESCE(revoked_at, NOW()), revoke_reason = 'refresh_reuse'
           WHERE id = ?`,
          [row.session_db_id]
        );
        return { invalid: true };
      }

      const expired = new Date(row.token_expires_at).getTime() <= Date.now()
        || new Date(row.session_expires_at).getTime() <= Date.now();
      if (expired || row.session_revoked_at || row.status !== 'active') {
        await connection.query(
          `UPDATE auth_refresh_tokens
           SET revoked_at = COALESCE(revoked_at, NOW()), revoke_reason = COALESCE(revoke_reason, 'expired')
           WHERE id = ?`,
          [row.refresh_token_id]
        );
        return { invalid: true };
      }

      const nextRefreshToken = createRefreshToken();
      await connection.query(
        `UPDATE auth_refresh_tokens
         SET used_at = NOW(), revoked_at = NOW(), revoke_reason = 'rotated'
         WHERE id = ?`,
        [row.refresh_token_id]
      );
      const [insertResult] = await connection.query(
        `INSERT INTO auth_refresh_tokens
          (session_id, family_key, token_hash, parent_token_id, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          row.session_db_id,
          row.family_key,
          hashRefreshToken(nextRefreshToken),
          row.refresh_token_id,
          row.session_expires_at,
        ]
      );
      await connection.query('UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = ?', [row.session_db_id]);

      const user = {
        id: row.user_id,
        public_id: row.public_id,
        email: row.email,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        status: row.status,
        email_verified_at: row.email_verified_at,
        current_level: row.current_level,
        auth_version: row.auth_version,
      };
      const access = signAccessToken(user, { sessionKey: row.session_key });
      const remainingSeconds = Math.max(
        1,
        Math.floor((new Date(row.session_expires_at).getTime() - Date.now()) / 1000)
      );
      return {
        invalid: false,
        tokenId: insertResult.insertId,
        payload: {
          access_token: access.token,
          access_token_expires_in: access.expiresInSeconds,
          refresh_token: nextRefreshToken,
          refresh_token_expires_in: remainingSeconds,
          token_type: 'Bearer',
          session_id: row.session_key,
        },
      };
    });

    if (result.invalid) {
      throw new AuthHttpError(401, 'invalid_refresh_token', 'The refresh token is invalid or expired.');
    }
    return res.status(200).json({ tokens: result.payload });
  } catch (error) {
    return sendAuthError(res, error, 'Unable to refresh the session.');
  }
}

/** POST /api/v1/auth/logout */
async function logout(req, res) {
  try {
    const refreshToken = normalizeRefreshToken(req.body?.refresh_token);
    const tokenHash = hashRefreshToken(refreshToken);
    await withTransaction(async (connection) => {
      const [rows] = await connection.query(
        `SELECT rt.session_id
         FROM auth_refresh_tokens rt
         WHERE rt.token_hash = ?
         LIMIT 1
         FOR UPDATE`,
        [tokenHash]
      );
      if (!rows[0]) return;
      await connection.query(
        `UPDATE auth_sessions
         SET revoked_at = COALESCE(revoked_at, NOW()), revoke_reason = 'logout'
         WHERE id = ?`,
        [rows[0].session_id]
      );
      await connection.query(
        `UPDATE auth_refresh_tokens
         SET revoked_at = COALESCE(revoked_at, NOW()), revoke_reason = COALESCE(revoke_reason, 'logout')
         WHERE session_id = ?`,
        [rows[0].session_id]
      );
    });
    return res.status(204).send();
  } catch (error) {
    return sendAuthError(res, error, 'Unable to sign out.');
  }
}

/** POST /api/v1/auth/reset-password */
async function resetPassword(req, res) {
  try {
    const resetToken = normalizeResetToken(req.body?.reset_token);
    const password = normalizePassword(req.body?.new_password, { field: 'new_password' });
    const claims = verifyPasswordResetToken(resetToken);
    const passwordHash = await hashPassword(password);

    await withTransaction(async (connection) => {
      const [rows] = await connection.query(
        `SELECT id, public_id, status, auth_version
         FROM users
         WHERE public_id = ? AND deleted_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [claims.sub]
      );
      const user = rows[0];
      if (!user || user.status !== 'active' || Number(user.auth_version) !== Number(claims.ver)) {
        throw new AuthHttpError(401, 'invalid_reset_token', 'The reset token is invalid or expired.');
      }

      await connection.query(
        `UPDATE users
         SET password_hash = ?, password_changed_at = NOW(), auth_version = auth_version + 1,
             failed_login_attempts = 0, locked_until = NULL
         WHERE id = ?`,
        [passwordHash, user.id]
      );
      await connection.query(
        `UPDATE auth_sessions
         SET revoked_at = COALESCE(revoked_at, NOW()), revoke_reason = 'password_reset'
         WHERE user_id = ?`,
        [user.id]
      );
      await connection.query(
        `UPDATE auth_refresh_tokens rt
         JOIN auth_sessions s ON s.id = rt.session_id
         SET rt.revoked_at = COALESCE(rt.revoked_at, NOW()),
             rt.revoke_reason = COALESCE(rt.revoke_reason, 'password_reset')
         WHERE s.user_id = ?`,
        [user.id]
      );
      await connection.query(
        `UPDATE auth_one_time_codes
         SET invalidated_at = COALESCE(invalidated_at, NOW())
         WHERE user_id = ? AND purpose = 'password_reset' AND consumed_at IS NULL`,
        [user.id]
      );
    });

    return res.status(200).json({ message: 'Password updated. Sign in again on your devices.' });
  } catch (error) {
    return sendAuthError(res, error, 'Unable to reset the password.');
  }
}

module.exports = {
  forgotPassword,
  googleLogin,
  login,
  logout,
  refresh,
  register,
  requestOtp,
  resetPassword,
  verifyOtp,
};
