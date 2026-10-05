const assert = require('node:assert/strict');
const test = require('node:test');

const calls = [];
const transactionState = {
  began: 0,
  committed: 0,
  rolledBack: 0,
  released: 0,
  lockedRows: [],
};

const connection = {
  async beginTransaction() {
    transactionState.began += 1;
  },
  async commit() {
    transactionState.committed += 1;
  },
  async rollback() {
    transactionState.rolledBack += 1;
  },
  release() {
    transactionState.released += 1;
  },
  async query(sql, params) {
    calls.push({ sql, params });

    if (sql.includes('FOR UPDATE')) return [transactionState.lockedRows];
    if (sql.includes('UPDATE user_vocabulary')) {
      return [{ affectedRows: transactionState.lockedRows.length, changedRows: transactionState.lockedRows.length }];
    }
    if (sql.includes('SELECT id, word, learning_stage')) {
      return [transactionState.lockedRows.map((row) => ({
        ...row,
        learning_stage: 'known',
        card_label: 'blue',
        updated_at: '2026-10-04T00:00:00.000Z',
      }))];
    }

    throw new Error(`Unexpected query: ${sql}`);
  },
};

const db = {
  async getConnection() {
    return connection;
  },
};

const dbModule = require.resolve('../src/config/db');
require.cache[dbModule] = {
  id: dbModule,
  filename: dbModule,
  loaded: true,
  exports: db,
};

const { updateVocabularyCards } = require('../src/controllers/vocabController');

function createResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function resetTransaction(lockedRows) {
  calls.length = 0;
  transactionState.began = 0;
  transactionState.committed = 0;
  transactionState.rolledBack = 0;
  transactionState.released = 0;
  transactionState.lockedRows = lockedRows;
}

test('updates learning stage and legacy card label atomically', async () => {
  resetTransaction([
    { id: 7, word: 'alpha' },
    { id: 9, word: 'beta' },
  ]);
  const response = createResponse();

  await updateVocabularyCards({
    auth: { userId: 1 },
    body: {
      ids: [7, 9],
      learning_stage: 'known',
      card_label: 'blue',
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.success, true);
  assert.equal(response.payload.updated_count, 2);
  assert.equal(response.payload.changed_count, 2);
  assert.deepEqual(response.payload.updates, {
    learning_stage: 'known',
    card_label: 'blue',
  });
  assert.equal(transactionState.began, 1);
  assert.equal(transactionState.committed, 1);
  assert.equal(transactionState.rolledBack, 0);
  assert.equal(transactionState.released, 1);

  const updateCall = calls.find(({ sql }) => sql.includes('UPDATE user_vocabulary'));
  assert.deepEqual(updateCall.params, ['known', 'blue', 1, 7, 9]);
});

test('rolls back the whole bulk update if one requested card is missing', async () => {
  resetTransaction([{ id: 7, word: 'alpha' }]);
  const response = createResponse();

  await updateVocabularyCards({
    auth: { userId: 1 },
    body: { ids: [7, 9], learning_stage: 'later' },
  }, response);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.payload, {
    error: 'One or more vocabulary cards were not found.',
    missing: { ids: [9] },
  });
  assert.equal(transactionState.committed, 0);
  assert.equal(transactionState.rolledBack, 1);
  assert.equal(transactionState.released, 1);
  assert.equal(calls.some(({ sql }) => sql.includes('UPDATE user_vocabulary')), false);
});

test('rejects ambiguous selectors before opening a transaction', async () => {
  resetTransaction([]);
  const response = createResponse();

  await updateVocabularyCards({
    auth: { userId: 1 },
    body: {
      ids: [7],
      words: ['alpha'],
      learning_stage: 'learning',
    },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.error, /exactly one selector/);
  assert.equal(transactionState.began, 0);
  assert.equal(transactionState.released, 0);
});
