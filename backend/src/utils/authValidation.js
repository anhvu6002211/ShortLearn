const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OTP_PURPOSES = Object.freeze(['verify_email', 'login', 'password_reset']);
const DEVICE_PLATFORMS = Object.freeze(['android', 'ios', 'web', 'unknown']);

function normalizeEmail(value) {
  if (typeof value !== 'string') throw new TypeError('email must be a string.');
  const email = value.normalize('NFKC').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new TypeError('email must be a valid email address.');
  }
  return email;
}

function normalizePassword(value, { field = 'password' } = {}) {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string.`);
  if (value.length < 10 || value.length > 128) {
    throw new TypeError(`${field} must contain between 10 and 128 characters.`);
  }
  return value;
}

function normalizeDisplayName(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new TypeError('display_name must be a string.');
  const displayName = value.replace(/\u0000/g, '').trim();
  if (!displayName || displayName.length > 100) {
    throw new TypeError('display_name must contain between 1 and 100 characters.');
  }
  return displayName;
}

function normalizeOtpPurpose(value) {
  if (typeof value !== 'string' || !OTP_PURPOSES.includes(value.trim().toLowerCase())) {
    throw new TypeError(`purpose must be one of: ${OTP_PURPOSES.join(', ')}.`);
  }
  return value.trim().toLowerCase();
}

function normalizeOtpCode(value) {
  const code = typeof value === 'number' ? String(value).padStart(6, '0') : value;
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    throw new TypeError('code must contain exactly 6 digits.');
  }
  return code.trim();
}

function normalizeChallengeId(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new TypeError('challenge_id must be a valid UUID.');
  }
  return value.trim().toLowerCase();
}

function normalizeRefreshToken(value) {
  if (typeof value !== 'string' || !/^slr_[A-Za-z0-9_-]{64}$/.test(value)) {
    throw new TypeError('refresh_token is invalid.');
  }
  return value;
}

function normalizeResetToken(value) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 4096) {
    throw new TypeError('reset_token is invalid.');
  }
  return value;
}

function normalizeDevice(value = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const platform = typeof input.platform === 'string' ? input.platform.trim().toLowerCase() : 'unknown';
  if (!DEVICE_PLATFORMS.includes(platform)) {
    throw new TypeError(`device.platform must be one of: ${DEVICE_PLATFORMS.join(', ')}.`);
  }

  const normalizeOptional = (candidate, field, maxLength) => {
    if (candidate === undefined || candidate === null || candidate === '') return null;
    if (typeof candidate !== 'string') throw new TypeError(`${field} must be a string.`);
    const normalized = candidate.replace(/\u0000/g, '').trim();
    if (normalized.length > maxLength) throw new TypeError(`${field} is too long.`);
    return normalized || null;
  };

  return {
    platform,
    name: normalizeOptional(input.name, 'device.name', 120),
    appVersion: normalizeOptional(input.app_version, 'device.app_version', 32),
  };
}

module.exports = {
  DEVICE_PLATFORMS,
  OTP_PURPOSES,
  normalizeChallengeId,
  normalizeDevice,
  normalizeDisplayName,
  normalizeEmail,
  normalizeOtpCode,
  normalizeOtpPurpose,
  normalizePassword,
  normalizeRefreshToken,
  normalizeResetToken,
};
