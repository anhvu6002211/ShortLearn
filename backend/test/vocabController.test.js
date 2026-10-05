const assert = require('node:assert/strict');
const test = require('node:test');

const calls = [];
const db = {
  query: async (sql, params) => {
    calls.push({ sql, params });

    if (sql.includes('SELECT id FROM videos')) return [[{ id: 99 }]];
    if (sql.includes('INSERT INTO user_vocabulary')) return [{ affectedRows: 1 }];
    if (sql.includes('COUNT(*) AS total_items')) {
      return [[{ total_items: 203, total_due: 4 }]];
    }
    if (sql.includes('SELECT uv.id')) {
      return [[{
        id: 42,
        word: 'resilient',
        meaning: 'kiên cường',
        is_due: 1,
        state: 'review',
        platform_video_id: 'dQw4w9WgXcQ',
      }]];
    }

    throw new Error(`Unexpected query: ${sql}`);
  },
};

const dbModule = require.resolve('../src/config/db');
require.cache[dbModule] = {
  id: dbModule,
  filename: dbModule,
  loaded: true,
  exports: db,
};

const { getSavedVocabulary, saveVocabulary } = require('../src/controllers/vocabController');

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

test('returns saved items with collection-wide summary and a capped limit', async () => {
  calls.length = 0;
  const response = createResponse();

  await getSavedVocabulary({ auth: { userId: 1 }, query: { limit: '999' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, {
    total_items: 203,
    total_due: 4,
    returned_items: 1,
    items: [{
      id: 42,
      word: 'resilient',
      meaning: 'kiên cường',
      is_due: 1,
      state: 'review',
      platform_video_id: 'dQw4w9WgXcQ',
    }],
  });

  const itemsQuery = calls.find(({ sql }) => sql.includes('SELECT uv.id'));
  assert.deepEqual(itemsQuery.params, [1, 200]);
  assert.ok(calls.some(({ sql }) => sql.includes('COUNT(*) AS total_items')));
});

test('uses the authenticated identity instead of a client-supplied user ID', async () => {
  calls.length = 0;
  const response = createResponse();

  await getSavedVocabulary({ auth: { userId: 27 }, query: { user_id: '999', limit: '10' } }, response);

  assert.equal(response.statusCode, 200);
  const summaryQuery = calls.find(({ sql }) => sql.includes('COUNT(*) AS total_items'));
  const itemsQuery = calls.find(({ sql }) => sql.includes('SELECT uv.id'));
  assert.deepEqual(summaryQuery.params, [27]);
  assert.deepEqual(itemsQuery.params, [27, 10]);
});

test('saves vocabulary against a TikTok video without hardcoding YouTube', async () => {
  calls.length = 0;
  const response = createResponse();
  const videoId = '7381234567890123456';

  await saveVocabulary({
    auth: { userId: 1 },
    body: {
      word: 'hello',
      meaning: 'xin chÃ o',
      video_id: videoId,
      platform: 'tiktok',
      timestamp_mark: 2.5,
    },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.platform, 'tiktok');
  const videoQuery = calls.find(({ sql }) => sql.includes('SELECT id FROM videos'));
  assert.deepEqual(videoQuery.params, [videoId, 'tiktok']);
  const insertQuery = calls.find(({ sql }) => sql.includes('INSERT INTO user_vocabulary'));
  assert.equal(insertQuery.params[5], 99);
});
