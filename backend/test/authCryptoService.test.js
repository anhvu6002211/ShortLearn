const assert = require('node:assert/strict');
const test = require('node:test');

process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters';
process.env.OTP_HMAC_SECRET = 'test-otp-secret-with-at-least-32-characters';

const {
  createRefreshToken,
  hashOtp,
  hashPassword,
  hashRefreshToken,
  safeDigestEqual,
  signAccessToken,
  signPasswordResetToken,
  verifyAccessToken,
  verifyPassword,
  verifyPasswordResetToken,
} = require('../src/services/authCryptoService');
const {
  normalizeChallengeId,
  normalizeDevice,
  normalizeEmail,
  normalizeOtpCode,
  normalizePassword,
  normalizeRefreshToken,
} = require('../src/utils/authValidation');

test('hashes passwords with scrypt and compares them safely', async () => {
  const encoded = await hashPassword('Learning123!');

  assert.match(encoded, /^scrypt\$32768\$8\$3\$/);
  assert.equal(await verifyPassword('Learning123!', encoded), true);
  assert.equal(await verifyPassword('Incorrect123!', encoded), false);
  assert.equal(await verifyPassword('Learning123!', '$2b$10$legacy'), false);
});

test('creates opaque refresh tokens and stable SHA-256 digests', () => {
  const token = createRefreshToken();

  assert.equal(normalizeRefreshToken(token), token);
  assert.equal(hashRefreshToken(token).length, 32);
  assert.deepEqual(hashRefreshToken(token), hashRefreshToken(token));
  assert.notDeepEqual(hashRefreshToken(token), hashRefreshToken(createRefreshToken()));
});

test('binds OTP digests to both challenge and code', () => {
  const challenge = '1bb4c31d-7c28-4b6e-83ae-18ada3c36923';
  const digest = hashOtp(challenge, '012345');

  assert.equal(digest.length, 32);
  assert.equal(safeDigestEqual(digest, hashOtp(challenge, '012345')), true);
  assert.equal(safeDigestEqual(digest, hashOtp(challenge, '012346')), false);
  assert.equal(safeDigestEqual(digest, hashOtp('d0783dce-04f6-4ca5-9d77-a061f52229d2', '012345')), false);
});

test('signs access and password-reset JWTs with isolated token types', () => {
  const user = { public_id: '01a624b6-0336-4d7f-90de-2a13241811fa', auth_version: 3 };
  const access = signAccessToken(user, { sessionKey: '06eddf58-4f2f-4e19-ae6b-fd085bc7b885' });
  const reset = signPasswordResetToken(user, '592bd8ad-8088-4361-859a-c0504a98d890');

  assert.equal(verifyAccessToken(access.token).type, 'access');
  assert.equal(verifyPasswordResetToken(reset.token).type, 'password_reset');
  assert.throws(() => verifyAccessToken(reset.token), /Invalid token type/);
  assert.throws(() => verifyPasswordResetToken(access.token), /Invalid token type/);
});

test('validates normalized auth input and rejects weak values', () => {
  assert.equal(normalizeEmail('  Learner@Example.COM '), 'learner@example.com');
  assert.equal(normalizePassword('Bilingual2026!'), 'Bilingual2026!');
  assert.equal(normalizeOtpCode(42), '000042');
  assert.equal(
    normalizeChallengeId('1BB4C31D-7C28-4B6E-83AE-18ADA3C36923'),
    '1bb4c31d-7c28-4b6e-83ae-18ada3c36923'
  );
  assert.deepEqual(normalizeDevice({ platform: 'Android', name: 'Pixel' }), {
    platform: 'android',
    name: 'Pixel',
    appVersion: null,
  });
  assert.throws(() => normalizeEmail('not-an-email'), /valid email/);
  assert.throws(() => normalizePassword('short1'), /between 10 and 128/);
  assert.equal(normalizePassword('onlyletters'), 'onlyletters');
  assert.throws(() => normalizeOtpCode('12345'), /exactly 6 digits/);
});
