const assert = require('node:assert/strict');
const test = require('node:test');

const db = {
  query: async (sql, params) => {
    if (sql.includes('COUNT(*) AS total_cards')) {
      assert.deepEqual(params, [1]);
      return [[{
        total_cards: 12,
        due_now: 2,
        new_cards: 1,
        learning_cards: 3,
        at_risk_cards: 1,
        average_retrievability: 0.83,
      }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  },
};

const dbModule = require.resolve('../src/config/db');
require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: db };

const { getLearningInsights } = require('../src/controllers/learningInsightsController');

function createResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('returns an explainable adaptive learning recommendation', async () => {
  const response = createResponse();

  await getLearningInsights({ auth: { userId: 1 }, query: {} }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.recommendation.action, 'review_due');
  assert.equal(response.payload.metrics.dueNow, 2);
  assert.match(response.payload.generated_at, /^\d{4}-\d{2}-\d{2}T/);
});
