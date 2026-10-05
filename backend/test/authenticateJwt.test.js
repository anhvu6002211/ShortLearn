const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters';

const queries = [];
let queryResult = [[]];
const fakeDb = {
  async query(sql, params) {
    queries.push({ sql, params });
    return queryResult;
  },
};
const dbModule = require.resolve('../src/config/db');
require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: fakeDb };

const { signAccessToken } = require('../src/services/authCryptoService');
const {
  authenticateJwt,
  readBearerToken,
  rejectClientUserId,
} = require('../src/middleware/authenticateJwt');

const user = {
  public_id: 'ae0f65d1-38f1-48c5-8d2d-353f073475bb',
  auth_version: 4,
};
const sessionKey = '24e93257-f875-440b-a3e3-3479e0282282';

function response() {
  return {
    statusCode: null,
    payload: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('accepts only a Bearer authorization scheme', () => {
  assert.equal(readBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(readBearerToken('bearer token'), 'token');
  assert.equal(readBearerToken('Basic token'), null);
  assert.equal(readBearerToken('Bearer'), null);
  assert.equal(readBearerToken(null), null);
});

test('hydrates the internal user ID only after JWT and active-session verification', async () => {
  queries.length = 0;
  queryResult = [[{
    user_id: 41,
    public_id: user.public_id,
    email: 'learner@example.com',
    display_name: 'Learner',
    auth_version: 4,
    session_id: 88,
    session_key: sessionKey,
    expires_at: new Date(Date.now() + 60_000),
  }]];
  const access = signAccessToken(user, { sessionKey });
  const req = { headers: { authorization: `Bearer ${access.token}` }, requestId: 'test-request' };
  const res = response();
  let nextCalls = 0;

  await authenticateJwt(req, res, () => { nextCalls += 1; });

  assert.equal(nextCalls, 1);
  assert.equal(res.statusCode, null);
  assert.deepEqual(req.auth, {
    userId: 41,
    userPublicId: user.public_id,
    email: 'learner@example.com',
    displayName: 'Learner',
    authVersion: 4,
    sessionId: 88,
    sessionKey,
  });
  assert.deepEqual(queries[0].params, [user.public_id, sessionKey, 4]);
  assert.match(queries[0].sql, /s\.revoked_at IS NULL AND s\.expires_at > NOW\(\)/);
});

test('rejects a valid JWT when its session or auth version is no longer active', async () => {
  queries.length = 0;
  queryResult = [[]];
  const access = signAccessToken(user, { sessionKey });
  const req = { headers: { authorization: `Bearer ${access.token}` } };
  const res = response();
  let nextCalls = 0;

  await authenticateJwt(req, res, () => { nextCalls += 1; });

  assert.equal(nextCalls, 0);
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.code, 'unauthenticated');
  assert.equal(res.headers['WWW-Authenticate'], 'Bearer realm="shortlearn-api"');
});

test('rejects malformed tokens before querying the database', async () => {
  queries.length = 0;
  const res = response();

  await authenticateJwt({ headers: { authorization: 'Bearer invalid.jwt.value' } }, res, () => {
    throw new Error('next must not run');
  });

  assert.equal(res.statusCode, 401);
  assert.equal(queries.length, 0);
});

test('rejects client-selected identities in query or body', () => {
  for (const req of [
    { query: { user_id: '2' }, body: {}, params: {} },
    { query: {}, body: { userId: 2 }, params: {} },
  ]) {
    const res = response();
    let nextCalls = 0;
    rejectClientUserId(req, res, () => { nextCalls += 1; });
    assert.equal(nextCalls, 0);
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.code, 'client_identity_forbidden');
  }

  const cleanResponse = response();
  let cleanNextCalls = 0;
  rejectClientUserId({ query: { limit: '20' }, body: {}, params: {} }, cleanResponse, () => {
    cleanNextCalls += 1;
  });
  assert.equal(cleanNextCalls, 1);
});

test('places the JWT boundary in front of every user-owned business route', () => {
  for (const routeFile of ['vocabRoutes.js', 'learningRoutes.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', routeFile), 'utf8');
    const boundary = source.indexOf('router.use(authenticateJwt, rejectClientUserId)');
    const firstBusinessRoute = source.search(/router\.(get|post|patch|put|delete)\(/);
    assert.ok(boundary >= 0, `${routeFile} must install the JWT middleware.`);
    assert.ok(boundary < firstBusinessRoute, `${routeFile} must authenticate before route handlers.`);
  }
});
