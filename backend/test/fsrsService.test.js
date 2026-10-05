const assert = require('node:assert/strict');
const test = require('node:test');

const { Rating, isValidRating, scheduleReview } = require('../src/services/fsrsService');

test('accepts only the four FSRS ratings', () => {
  assert.equal(isValidRating(Rating.AGAIN), true);
  assert.equal(isValidRating(Rating.EASY), true);
  assert.equal(isValidRating(0), false);
  assert.equal(isValidRating(5), false);
  assert.equal(isValidRating(2.5), false);
});

test('schedules a new card with bounded FSRS values', () => {
  const now = new Date('2026-10-04T00:00:00.000Z');
  const result = scheduleReview({ state: 'new', repetition_count: 0, lapses: 0 }, Rating.GOOD, now);

  assert.equal(result.state, 'review');
  assert.equal(result.repetitionCount, 1);
  assert.equal(result.lapses, 0);
  assert.ok(result.difficulty >= 1 && result.difficulty <= 10);
  assert.ok(result.stability > 0);
  assert.ok(result.intervalDays >= 1);
  assert.equal(result.nextReviewAt.getTime(), now.getTime() + result.intervalDays * 86_400_000);
});

test('records a lapse and recalculates an existing card from server-side timing', () => {
  const now = new Date('2026-10-14T00:00:00.000Z');
  const result = scheduleReview({
    state: 'review',
    difficulty: 5,
    stability: 4,
    lapses: 1,
    repetition_count: 3,
    last_review_at: new Date('2026-10-04T00:00:00.000Z'),
  }, Rating.AGAIN, now);

  assert.equal(result.state, 'relearning');
  assert.equal(result.lapses, 2);
  assert.equal(result.repetitionCount, 4);
  assert.ok(result.stability > 0);
  assert.ok(result.retrievability >= 0 && result.retrievability <= 1);
});

test('rejects invalid scheduling ratings', () => {
  assert.throws(() => scheduleReview({}, 8), /Rating must be an integer/);
});
