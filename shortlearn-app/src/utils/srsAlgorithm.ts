/**
 * FSRS v5 (Free Spaced Repetition Scheduler) — Thay thế hoàn toàn SM-2
 *
 * Dựa trên mô hình DSR (Difficulty, Stability, Retrievability) được huấn luyện
 * trên 300M+ lượt review từ dữ liệu Anki. Giảm ~20% số lượt ôn tập so với SM-2
 * ở cùng mức retention target mà không cần hardcode Ease Factor.
 *
 * Tham khảo: https://github.com/open-spaced-repetition/fsrs4anki
 */

// 19 trọng số mặc định FSRS v5 (pretrained toàn cầu)
const W: number[] = [
  0.40255, 1.18385, 3.173,   15.69105, // w0-w3: Initial Stability theo rating
  7.1949,  0.5345,  1.4604,  0.0046,   // w4-w7: Difficulty parameters
  1.54575, 0.1192,  1.01925, 1.9395,   // w8-w11: Stability after recall
  0.11,    0.29605, 2.2698,  0.2315,   // w12-w15: Stability after forget
  2.9898,  0.51655, 0.6621,            // w16-w18: Short-term scheduling
];

/** Rating tương ứng với đánh giá của người dùng */
export enum Rating {
  Again = 1,  // Quên hoàn toàn
  Hard  = 2,  // Nhớ nhưng rất khó khăn
  Good  = 3,  // Nhớ bình thường
  Easy  = 4,  // Nhớ rất dễ dàng
}

/** Trạng thái FSRS của một thẻ từ vựng */
export interface FSRSCard {
  word: string;
  difficulty: number;     // D ∈ [1, 10]
  stability: number;      // S > 0 (ngày)
  retrievability: number; // R ∈ [0, 1]
  reps: number;           // Tổng số lần ôn tập
  lapses: number;         // Tổng số lần quên (rating = Again)
  lastReviewDate: Date;
  nextReviewDate: Date;
  intervalDays: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
}

const DESIRED_RETENTION = 0.9; // 90% xác suất nhớ khi đến ngày ôn
const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // ≈ 19/81

/** Clamp giá trị trong khoảng [min, max] */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Tính xác suất nhớ (Retrievability) sau t ngày kể từ lần ôn gần nhất */
export function calcRetrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

/** Tính khoảng cách ôn tập (ngày) từ Stability và Retention target */
function calcInterval(stability: number, retention: number = DESIRED_RETENTION): number {
  const interval = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return Math.max(1, Math.round(interval));
}

/** Tính Stability khởi tạo cho thẻ mới dựa trên rating lần đầu */
function initStability(rating: Rating): number {
  return Math.max(0.1, W[rating - 1]);
}

/** Tính Difficulty khởi tạo cho thẻ mới */
function initDifficulty(rating: Rating): number {
  return clamp(W[4] - Math.exp(W[5] * (rating - 1)) + 1, 1, 10);
}

/** Cập nhật Difficulty sau mỗi lần ôn tập */
function nextDifficulty(d: number, rating: Rating): number {
  const meanReversion = W[7] * (initDifficulty(Rating.Easy) - d);
  const nextD = d - W[6] * (rating - 3) + meanReversion;
  return clamp(nextD, 1, 10);
}

/** Tính Stability mới sau khi nhớ thành công (recall) */
function nextRecallStability(
  d: number,
  s: number,
  r: number,
  rating: Rating
): number {
  const hardPenalty = rating === Rating.Hard ? W[15] : 1;
  const easyBonus = rating === Rating.Easy ? W[16] : 1;

  return s * (
    1 +
    Math.exp(W[8]) *
    (11 - d) *
    Math.pow(s, -W[9]) *
    (Math.exp((1 - r) * W[10]) - 1) *
    hardPenalty *
    easyBonus
  );
}

/** Tính Stability mới sau khi quên (lapse/forget) */
function nextForgetStability(
  d: number,
  s: number,
  r: number
): number {
  return Math.max(
    0.1,
    W[11] *
    Math.pow(d, -W[12]) *
    (Math.pow(s + 1, W[13]) - 1) *
    Math.exp((1 - r) * W[14])
  );
}

/**
 * Hàm chính: Tính toán trạng thái FSRS tiếp theo cho một thẻ từ vựng
 *
 * @param card Trạng thái thẻ hiện tại (hoặc null nếu là thẻ mới)
 * @param rating Đánh giá của người dùng (1=Again, 2=Hard, 3=Good, 4=Easy)
 * @returns Trạng thái thẻ mới với ngày ôn tập tiếp theo
 */
export function reviewCard(card: FSRSCard | null, rating: Rating): FSRSCard {
  const now = new Date();
  const word = card?.word ?? '';

  // ── Thẻ mới (lần ôn đầu tiên) ──
  if (!card || card.state === 'new') {
    const s = initStability(rating);
    const d = initDifficulty(rating);
    const interval = calcInterval(s);
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + interval);

    return {
      word,
      difficulty: Number(d.toFixed(4)),
      stability: Number(s.toFixed(4)),
      retrievability: 1.0,
      reps: 1,
      lapses: rating === Rating.Again ? 1 : 0,
      lastReviewDate: now,
      nextReviewDate: nextReview,
      intervalDays: interval,
      state: rating === Rating.Again ? 'relearning' : 'review',
    };
  }

  // ── Thẻ đã ôn trước đó ──
  const elapsedDays = Math.max(0,
    (now.getTime() - card.lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const r = calcRetrievability(elapsedDays, card.stability);

  let newS: number;
  let newD: number;
  let lapses = card.lapses;
  let state: FSRSCard['state'];

  if (rating === Rating.Again) {
    // Quên: Stability giảm, Difficulty tăng
    newS = nextForgetStability(card.difficulty, card.stability, r);
    newD = nextDifficulty(card.difficulty, rating);
    lapses += 1;
    state = 'relearning';
  } else {
    // Nhớ: Stability tăng, Difficulty điều chỉnh
    newS = nextRecallStability(card.difficulty, card.stability, r, rating);
    newD = nextDifficulty(card.difficulty, rating);
    state = 'review';
  }

  const interval = calcInterval(newS);
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    word,
    difficulty: Number(newD.toFixed(4)),
    stability: Number(newS.toFixed(4)),
    retrievability: Number(r.toFixed(4)),
    reps: card.reps + 1,
    lapses,
    lastReviewDate: now,
    nextReviewDate: nextReview,
    intervalDays: interval,
    state,
  };
}

/**
 * Tạo thẻ FSRS mới cho từ vựng chưa từng ôn tập
 */
export function createNewCard(word: string): FSRSCard {
  return {
    word,
    difficulty: W[4],
    stability: 0,
    retrievability: 0,
    reps: 0,
    lapses: 0,
    lastReviewDate: new Date(),
    nextReviewDate: new Date(),
    intervalDays: 0,
    state: 'new',
  };
}
