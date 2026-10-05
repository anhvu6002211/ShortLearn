const WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105,
  7.1949, 0.5345, 1.4604, 0.0046,
  1.54575, 0.1192, 1.01925, 1.9395,
  0.11, 0.29605, 2.2698, 0.2315,
  2.9898, 0.51655, 0.6621,
];

const DESIRED_RETENTION = 0.9;
const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;

const Rating = Object.freeze({
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isValidRating(rating) {
  return Number.isInteger(rating) && rating >= Rating.AGAIN && rating <= Rating.EASY;
}

function initialStability(rating) {
  return Math.max(0.1, WEIGHTS[rating - 1]);
}

function initialDifficulty(rating) {
  return clamp(WEIGHTS[4] - Math.exp(WEIGHTS[5] * (rating - 1)) + 1, 1, 10);
}

function nextDifficulty(difficulty, rating) {
  const meanReversion = WEIGHTS[7] * (initialDifficulty(Rating.EASY) - difficulty);
  return clamp(difficulty - WEIGHTS[6] * (rating - Rating.GOOD) + meanReversion, 1, 10);
}

function calcRetrievability(elapsedDays, stability) {
  if (!Number.isFinite(stability) || stability <= 0) return 0;
  return clamp(
    Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY),
    0,
    1
  );
}

function calcInterval(stability) {
  const interval = (stability / FACTOR) * (Math.pow(DESIRED_RETENTION, 1 / DECAY) - 1);
  return Math.max(1, Math.round(interval));
}

function nextRecallStability(difficulty, stability, retrievability, rating) {
  const hardPenalty = rating === Rating.HARD ? WEIGHTS[15] : 1;
  const easyBonus = rating === Rating.EASY ? WEIGHTS[16] : 1;

  return stability * (
    1 +
    Math.exp(WEIGHTS[8]) *
    (11 - difficulty) *
    Math.pow(stability, -WEIGHTS[9]) *
    (Math.exp((1 - retrievability) * WEIGHTS[10]) - 1) *
    hardPenalty *
    easyBonus
  );
}

function nextForgetStability(difficulty, stability, retrievability) {
  return Math.max(
    0.1,
    WEIGHTS[11] *
    Math.pow(difficulty, -WEIGHTS[12]) *
    (Math.pow(stability + 1, WEIGHTS[13]) - 1) *
    Math.exp((1 - retrievability) * WEIGHTS[14])
  );
}

/**
 * Lập lịch ôn tập trên server. Dữ liệu client không được dùng để ghi đè D/S/R.
 * `lastReviewAt` có thể suy ra từ `next_review - interval_days` của bản ghi hiện có.
 */
function scheduleReview(card, rating, now = new Date()) {
  if (!isValidRating(rating)) {
    throw new TypeError('Rating must be an integer from 1 to 4.');
  }

  const currentState = card.state || 'new';
  const currentStability = Number(card.stability) || 0;
  const currentDifficulty = clamp(Number(card.difficulty) || 5, 1, 10);
  const currentLapses = Math.max(0, Number.parseInt(card.lapses, 10) || 0);
  const currentReps = Math.max(0, Number.parseInt(card.repetition_count, 10) || 0);

  let difficulty;
  let stability;
  let retrievability;
  let lapses = currentLapses;
  let state;

  if (currentState === 'new' || currentStability <= 0) {
    stability = initialStability(rating);
    difficulty = initialDifficulty(rating);
    retrievability = 1;
    state = rating === Rating.AGAIN ? 'relearning' : 'review';
    if (rating === Rating.AGAIN) lapses += 1;
  } else {
    const lastReviewAt = card.last_review_at ? new Date(card.last_review_at) : now;
    const elapsedDays = Number.isNaN(lastReviewAt.getTime())
      ? 0
      : Math.max(0, (now.getTime() - lastReviewAt.getTime()) / 86_400_000);

    retrievability = calcRetrievability(elapsedDays, currentStability);
    difficulty = nextDifficulty(currentDifficulty, rating);

    if (rating === Rating.AGAIN) {
      stability = nextForgetStability(currentDifficulty, currentStability, retrievability);
      lapses += 1;
      state = 'relearning';
    } else {
      stability = nextRecallStability(currentDifficulty, currentStability, retrievability, rating);
      state = 'review';
    }
  }

  stability = Math.max(0.1, stability);
  const intervalDays = calcInterval(stability);
  const nextReviewAt = new Date(now.getTime() + intervalDays * 86_400_000);

  return {
    difficulty: Number(difficulty.toFixed(4)),
    stability: Number(stability.toFixed(4)),
    retrievability: Number(retrievability.toFixed(4)),
    lapses,
    repetitionCount: currentReps + 1,
    intervalDays,
    state,
    reviewedAt: now,
    nextReviewAt,
  };
}

module.exports = {
  Rating,
  isValidRating,
  scheduleReview,
};
