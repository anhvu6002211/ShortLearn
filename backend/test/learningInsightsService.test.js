const assert = require('node:assert/strict');
const test = require('node:test');

const { buildLearningInsight } = require('../src/services/learningInsightsService');

test('prioritizes due cards and caps a focused review session', () => {
  const insight = buildLearningInsight({
    total_cards: 48,
    due_now: 31,
    new_cards: 4,
    learning_cards: 2,
    at_risk_cards: 5,
    average_retrievability: 0.74,
  });

  assert.equal(insight.engine, 'adaptive_rules_v1');
  assert.equal(insight.recommendation.action, 'review_due');
  assert.equal(insight.recommendation.recommendedCardCount, 20);
  assert.equal(insight.metrics.averageRetrievability, 0.74);
});

test('suggests a small first deck for a new learner', () => {
  const insight = buildLearningInsight({ total_cards: 0 });

  assert.equal(insight.recommendation.action, 'save_words');
  assert.equal(insight.recommendation.recommendedCardCount, 3);
});
