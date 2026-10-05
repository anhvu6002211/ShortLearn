const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters';
process.env.OTP_HMAC_SECRET = 'test-otp-secret-with-at-least-32-characters';

const connectionCalls = [];
let connectionQuery;
const transactionState = { commits: 0, rollbacks: 0 };
const connection = {
  async beginTransaction() {},
  async commit() { transactionState.commits += 1; },
  async rollback() { transactionState.rollbacks += 1; },
  release() {},
  async query(sql, params) {
    connectionCalls.push({ sql, params });
    return connectionQuery(sql, params);
  },
};
const fakeDb = {
  async getConnection() { return connection; },
  async query() { throw new Error('Unexpected pool query.'); },
};

const dbModule = require.resolve('../src/config/db');
require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: fakeDb };

const deliveryModule = require.resolve('../src/services/otpDeliveryService');
require.cache[deliveryModule] = {
  id: deliveryModule,
  filename: deliveryModule,
  loaded: true,
  exports: { deliverOtp: async () => {}, exposeDevelopmentCode: () => false },
};

const { hashOtp, createRefreshToken, hashRefreshToken } = require('../src/services/authCryptoService');
const { refresh, verifyOtp } = require('../src/controllers/authController');

function resetState() {
  connectionCalls.length = 0;
  transactionState.commits = 0;
  transactionState.rollbacks = 0;
}

function response() {
  return {
    statusCode: null,
    payload: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    send() { return this; },
  };
}

test('persists a failed OTP attempt before returning the generic error', async () => {
  resetState();
  const challengeId = '1bb4c31d-7c28-4b6e-83ae-18ada3c36923';
  connectionQuery = async (sql) => {
    if (sql.includes('FROM auth_one_time_codes otp')) {
      return [[{
        otp_id: 21,
        challenge_key: challengeId,
        purpose: 'login',
        code_hash: hashOtp(challengeId, '654321'),
        attempt_count: 0,
        max_attempts: 5,
        expires_at: new Date(Date.now() + 60_000),
        consumed_at: null,
        invalidated_at: null,
        user_id: 7,
        status: 'active',
      }]];
    }
    if (sql.includes('SET attempt_count = ?')) return [{ affectedRows: 1 }];
    throw new Error(`Unexpected query: ${sql}`);
  };
  const res = response();

  await verifyOtp({
    body: { challenge_id: challengeId, purpose: 'login', code: '123456' },
    headers: {},
    ip: '127.0.0.1',
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.code, 'invalid_otp');
  assert.equal(transactionState.commits, 1);
  assert.equal(transactionState.rollbacks, 0);
  const attemptUpdate = connectionCalls.find(({ sql }) => sql.includes('SET attempt_count = ?'));
  assert.deepEqual(attemptUpdate.params, [1, 1, 21]);
});

test('revokes the token family and session when a rotated token is reused', async () => {
  resetState();
  const oldToken = createRefreshToken();
  connectionQuery = async (sql, params) => {
    if (sql.includes('FROM auth_refresh_tokens rt') && sql.includes('JOIN auth_sessions')) {
      assert.deepEqual(params[0], hashRefreshToken(oldToken));
      return [[{
        refresh_token_id: 31,
        family_key: '7d18eed6-4bfc-4e83-bcda-d2fe3387d610',
        used_at: new Date(),
        token_revoked_at: new Date(),
        token_expires_at: new Date(Date.now() + 60_000),
        session_db_id: 9,
        session_key: '70ac0098-aaf8-4919-ae57-3abb5aa7ba4b',
        session_revoked_at: null,
        session_expires_at: new Date(Date.now() + 60_000),
        status: 'active',
      }]];
    }
    if (sql.includes("revoke_reason = 'reuse_detected'")) return [{ affectedRows: 2 }];
    if (sql.includes("revoke_reason = 'refresh_reuse'")) return [{ affectedRows: 1 }];
    throw new Error(`Unexpected query: ${sql}`);
  };
  const res = response();

  await refresh({ body: { refresh_token: oldToken }, headers: {}, ip: '127.0.0.1' }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.code, 'invalid_refresh_token');
  assert.equal(transactionState.commits, 1);
  assert.equal(transactionState.rollbacks, 0);
  assert.ok(connectionCalls.some(({ sql }) => sql.includes("revoke_reason = 'reuse_detected'")));
  assert.ok(connectionCalls.some(({ sql }) => sql.includes("revoke_reason = 'refresh_reuse'")));
});
