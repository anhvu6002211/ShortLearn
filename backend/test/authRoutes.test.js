const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const routes = fs.readFileSync(path.join(root, 'src', 'routes', 'authRoutes.js'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'src', 'controllers', 'authController.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'src', 'server.js'), 'utf8');

test('mounts every required auth endpoint under /api/v1/auth', () => {
  for (const endpoint of [
    '/register',
    '/google',
    '/login',
    '/otp/request',
    '/otp/verify',
    '/forgot-password',
    '/reset-password',
    '/refresh',
    '/logout',
  ]) {
    assert.match(routes, new RegExp(`router\\.post\\('${endpoint.replace('/', '\\/')}'`));
  }
  assert.match(server, /app\.use\('\/api\/v1\/auth', authRoutes\)/);
});

test('applies dedicated rate limits to credential, OTP, and refresh operations', () => {
  assert.match(routes, /credentialLimiter/);
  assert.match(routes, /otpRequestLimiter/);
  assert.match(routes, /refreshLimiter/);
  assert.match(routes, /code: 'rate_limited'/);
});

test('implements refresh rotation, reuse revocation, and password-reset session revocation', () => {
  assert.match(controller, /revoke_reason = 'rotated'/);
  assert.match(controller, /revoke_reason = 'reuse_detected'/);
  assert.match(controller, /revoke_reason = 'refresh_reuse'/);
  assert.match(controller, /revoke_reason = 'password_reset'/);
  assert.match(controller, /auth_version = auth_version \+ 1/);
});
