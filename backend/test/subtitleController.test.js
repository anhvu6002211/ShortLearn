const assert = require('node:assert/strict');
const test = require('node:test');

let inserted = false;
const queries = [];
const published = [];

const db = {
  async query(sql, params) {
    queries.push({ sql, params });
    if (sql.includes('SELECT id, platform, status, updated_at FROM videos')) {
      return [inserted ? [{
        id: 7,
        platform: 'tiktok',
        status: 'PENDING',
        updated_at: new Date(),
      }] : []];
    }
    if (sql.includes('INSERT IGNORE INTO videos')) {
      inserted = true;
      return [{ affectedRows: 1 }];
    }
    if (sql.includes("UPDATE videos SET status = 'PROCESSING'")) {
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  },
};

const redisModule = require.resolve('../src/config/redis');
require.cache[redisModule] = {
  id: redisModule,
  filename: redisModule,
  loaded: true,
  exports: { isReady: false },
};

const dbModule = require.resolve('../src/config/db');
require.cache[dbModule] = {
  id: dbModule,
  filename: dbModule,
  loaded: true,
  exports: db,
};

const rabbitModule = require.resolve('../src/config/rabbitmq');
require.cache[rabbitModule] = {
  id: rabbitModule,
  filename: rabbitModule,
  loaded: true,
  exports: {
    async publishSubtitleTask(payload) {
      published.push(payload);
    },
  },
};

const { requestSubtitles } = require('../src/controllers/subtitleController');

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

test('normalizes a TikTok URL and publishes a platform-aware subtitle task', async () => {
  inserted = false;
  queries.length = 0;
  published.length = 0;
  const response = createResponse();
  const videoId = '7381234567890123456';

  await requestSubtitles({
    body: {
      platform: 'TikTok',
      video_id: `https://www.tiktok.com/@shortlearn/video/${videoId}?lang=en`,
    },
  }, response);

  assert.equal(response.statusCode, 202);
  assert.equal(response.payload.status, 'PROCESSING');
  assert.equal(published.length, 1);
  assert.equal(published[0].platform, 'tiktok');
  assert.equal(published[0].video_id, videoId);
  assert.ok(!Number.isNaN(Date.parse(published[0].requested_at)));

  const insert = queries.find(({ sql }) => sql.includes('INSERT IGNORE INTO videos'));
  assert.deepEqual(insert.params, [videoId, 'tiktok']);
});
