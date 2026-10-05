const db = require('../config/db');
const { isValidRating, scheduleReview } = require('../services/fsrsService');
const {
  normalizeCardLabel,
  normalizeLearningStage,
  normalizePlatform,
  normalizePlatformVideoId,
  normalizeText,
  normalizeWord,
  normalizeWordList,
  parsePositiveIntegerList,
  parseTimestamp,
} = require('../utils/validation');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function authenticatedUserId(req) {
  const userId = req.auth?.userId;
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new Error('Authenticated user context is missing.');
  }
  return userId;
}

function sendControllerError(res, error, fallbackMessage) {
  if (error instanceof TypeError) {
    return res.status(400).json({ error: error.message });
  }

  console.error(`❌ [${fallbackMessage}]`, error);
  const payload = { error: fallbackMessage };
  if (process.env.NODE_ENV !== 'production') payload.details = error.message;
  return res.status(500).json(payload);
}

function deriveLastReviewAt(nextReview, intervalDays) {
  const nextReviewDate = new Date(nextReview);
  if (Number.isNaN(nextReviewDate.getTime())) return new Date();

  const interval = Math.max(0, Number(intervalDays) || 0);
  return new Date(nextReviewDate.getTime() - interval * 86_400_000);
}

function parseCardSelector(payload) {
  const selectsIds = hasOwn(payload, 'id') || hasOwn(payload, 'ids');
  const selectsWords = hasOwn(payload, 'word') || hasOwn(payload, 'words');

  if (selectsIds === selectsWords) {
    throw new TypeError('Provide exactly one selector: id/ids or word/words.');
  }

  if (selectsIds) {
    const ids = [];
    if (hasOwn(payload, 'id')) ids.push(payload.id);
    if (hasOwn(payload, 'ids')) {
      if (!Array.isArray(payload.ids)) throw new TypeError('ids must be an array.');
      ids.push(...payload.ids);
    }
    return { column: 'id', field: 'ids', values: parsePositiveIntegerList(ids) };
  }

  const words = [];
  if (hasOwn(payload, 'word')) words.push(payload.word);
  if (hasOwn(payload, 'words')) {
    if (!Array.isArray(payload.words)) throw new TypeError('words must be an array.');
    words.push(...payload.words);
  }
  return { column: 'word', field: 'words', values: normalizeWordList(words) };
}

/** POST /api/v1/vocabulary/save */
async function saveVocabulary(req, res) {
  try {
    const payload = req.body || {};
    const userId = authenticatedUserId(req);

    const word = normalizeWord(payload.word);
    const meaning = normalizeText(payload.meaning, { field: 'meaning', maxLength: 2_000, required: true });
    const phonetic = normalizeText(payload.phonetic, { field: 'phonetic', maxLength: 100 });
    const contextSentence = normalizeText(payload.context_sentence, {
      field: 'context_sentence',
      maxLength: 2_000,
    });
    const timestampMark = parseTimestamp(payload.timestamp_mark);
    const platform = normalizePlatform(payload.platform);
    const platformVideoId = payload.video_id
      ? normalizePlatformVideoId(payload.video_id, platform)
      : null;

    let videoId = null;
    if (platformVideoId) {
      const [videos] = await db.query(
        'SELECT id FROM videos WHERE platform_video_id = ? AND platform = ? LIMIT 1',
        [platformVideoId, platform]
      );
      if (videos.length > 0) videoId = videos[0].id;
    }

    const [result] = await db.query(
      `INSERT INTO user_vocabulary
        (user_id, word, phonetic, meaning, context_sentence, video_id, timestamp_mark,
         difficulty, stability, retrievability, lapses, state,
         srs_stage, repetition_count, ease_factor, interval_days, next_review)
       VALUES
        (?, ?, ?, ?, ?, ?, ?,
         5.0, 0.0, 0.0, 0, 'new',
         0, 0, 2.5, 0, NOW())
       ON DUPLICATE KEY UPDATE
         phonetic = COALESCE(VALUES(phonetic), phonetic),
         meaning = VALUES(meaning),
         context_sentence = COALESCE(VALUES(context_sentence), context_sentence),
         video_id = COALESCE(VALUES(video_id), video_id),
         timestamp_mark = VALUES(timestamp_mark)`,
      [userId, word, phonetic, meaning, contextSentence, videoId, timestampMark]
    );

    const created = result.affectedRows === 1;
    return res.status(created ? 201 : 200).json({
      success: true,
      created,
      word,
      platform,
      message: created ? 'Vocabulary saved to the SRS deck.' : 'Vocabulary card updated.',
    });
  } catch (error) {
    return sendControllerError(res, error, 'Failed to save vocabulary');
  }
}

/** POST /api/v1/vocabulary/review */
async function reviewVocabulary(req, res) {
  const payload = req.body || {};
  let connection;

  try {
    const userId = authenticatedUserId(req);

    const word = normalizeWord(payload.word);
    const rating = Number(payload.rating);
    if (!isValidRating(rating)) {
      throw new TypeError('rating must be an integer from 1 (Again) to 4 (Easy).');
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, word, difficulty, stability, lapses, state,
              repetition_count, interval_days, next_review
       FROM user_vocabulary
       WHERE user_id = ? AND word = ?
       FOR UPDATE`,
      [userId, word]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Word not found in user vocabulary.' });
    }

    const card = rows[0];
    const schedule = scheduleReview(
      { ...card, last_review_at: deriveLastReviewAt(card.next_review, card.interval_days) },
      rating
    );

    await connection.query(
      `UPDATE user_vocabulary
       SET difficulty = ?, stability = ?, retrievability = ?, lapses = ?, state = ?,
           repetition_count = ?, interval_days = ?, next_review = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        schedule.difficulty,
        schedule.stability,
        schedule.retrievability,
        schedule.lapses,
        schedule.state,
        schedule.repetitionCount,
        schedule.intervalDays,
        schedule.nextReviewAt,
        card.id,
      ]
    );

    await connection.commit();
    return res.status(200).json({
      success: true,
      algorithm: 'FSRS_v5',
      data: {
        word,
        rating,
        difficulty: schedule.difficulty,
        stability: schedule.stability,
        retrievability: schedule.retrievability,
        reps: schedule.repetitionCount,
        lapses: schedule.lapses,
        interval_days: schedule.intervalDays,
        next_review: schedule.nextReviewAt.toISOString(),
        state: schedule.state,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    return sendControllerError(res, error, 'Failed to process SRS review');
  } finally {
    if (connection) connection.release();
  }
}

/** GET /api/v1/vocabulary/due */
async function getDueVocabulary(req, res) {
  try {
    const userId = authenticatedUserId(req);

    const [rows] = await db.query(
      `SELECT uv.id, uv.word, uv.phonetic, uv.meaning, uv.context_sentence,
              uv.timestamp_mark, uv.next_review, uv.difficulty, uv.stability,
              uv.retrievability, uv.lapses, uv.state, uv.repetition_count,
              uv.interval_days, uv.learning_stage, uv.card_label,
              v.platform_video_id, v.platform
       FROM user_vocabulary uv
       LEFT JOIN videos v ON uv.video_id = v.id
       WHERE uv.user_id = ? AND uv.next_review <= NOW()
       ORDER BY uv.next_review ASC
       LIMIT 50`,
      [userId]
    );

    return res.status(200).json({ total_due: rows.length, cards: rows });
  } catch (error) {
    return sendControllerError(res, error, 'Failed to fetch due vocabulary');
  }
}

/** GET /api/v1/vocabulary/saved */
async function getSavedVocabulary(req, res) {
  try {
    const userId = authenticatedUserId(req);

    const requestedLimit = Number.parseInt(String(req.query.limit ?? '100'), 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 200)
      : 100;

    const [summaryResult, itemsResult] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS total_items,
                COALESCE(SUM(next_review <= NOW()), 0) AS total_due
         FROM user_vocabulary
         WHERE user_id = ?`,
        [userId]
      ),
      db.query(
        `SELECT uv.id, uv.word, uv.phonetic, uv.meaning, uv.context_sentence,
                uv.timestamp_mark, uv.next_review, uv.created_at, uv.updated_at,
                uv.difficulty, uv.stability, uv.retrievability, uv.lapses, uv.state,
                uv.repetition_count, uv.interval_days, uv.learning_stage, uv.card_label,
                v.platform_video_id, v.platform,
                (uv.next_review <= NOW()) AS is_due
         FROM user_vocabulary uv
         LEFT JOIN videos v ON uv.video_id = v.id
         WHERE uv.user_id = ?
         ORDER BY is_due DESC, uv.updated_at DESC, uv.id DESC
         LIMIT ?`,
        [userId, limit]
      ),
    ]);
    const [[summary]] = summaryResult;
    const [rows] = itemsResult;

    return res.status(200).json({
      total_items: Number(summary.total_items) || 0,
      total_due: Number(summary.total_due) || 0,
      returned_items: rows.length,
      items: rows,
    });
  } catch (error) {
    return sendControllerError(res, error, 'Failed to fetch saved vocabulary');
  }
}

/**
 * PATCH /api/v1/vocabulary/cards
 * Updates learning metadata for one or many saved words atomically.
 */
async function updateVocabularyCards(req, res) {
  const payload = req.body || {};
  let connection;

  try {
    const userId = authenticatedUserId(req);

    const selector = parseCardSelector(payload);
    const updates = [];
    const updateValues = [];
    const responseUpdates = {};

    if (hasOwn(payload, 'learning_stage')) {
      const learningStage = normalizeLearningStage(payload.learning_stage);
      updates.push('learning_stage = ?');
      updateValues.push(learningStage);
      responseUpdates.learning_stage = learningStage;
    }
    if (hasOwn(payload, 'card_label')) {
      const cardLabel = normalizeCardLabel(payload.card_label);
      updates.push('card_label = ?');
      updateValues.push(cardLabel);
      responseUpdates.card_label = cardLabel;
    }
    if (updates.length === 0) {
      throw new TypeError('Provide learning_stage and/or card_label to update.');
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const placeholders = selector.values.map(() => '?').join(', ');
    const [lockedRows] = await connection.query(
      `SELECT id, word
       FROM user_vocabulary
       WHERE user_id = ? AND ${selector.column} IN (${placeholders})
       FOR UPDATE`,
      [userId, ...selector.values]
    );

    const matchedValues = new Set(lockedRows.map((row) => row[selector.column]));
    const missingValues = selector.values.filter((value) => !matchedValues.has(value));
    if (missingValues.length > 0) {
      await connection.rollback();
      return res.status(404).json({
        error: 'One or more vocabulary cards were not found.',
        missing: { [selector.field]: missingValues },
      });
    }

    const cardIds = lockedRows.map((row) => row.id);
    const idPlaceholders = cardIds.map(() => '?').join(', ');
    const [updateResult] = await connection.query(
      `UPDATE user_vocabulary
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE user_id = ? AND id IN (${idPlaceholders})`,
      [...updateValues, userId, ...cardIds]
    );

    const [items] = await connection.query(
      `SELECT id, word, learning_stage, card_label, updated_at
       FROM user_vocabulary
       WHERE user_id = ? AND id IN (${idPlaceholders})
       ORDER BY id ASC`,
      [userId, ...cardIds]
    );

    await connection.commit();
    return res.status(200).json({
      success: true,
      updated_count: items.length,
      changed_count: Number(updateResult.changedRows ?? updateResult.affectedRows) || 0,
      updates: responseUpdates,
      items,
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    return sendControllerError(res, error, 'Failed to update vocabulary cards');
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getDueVocabulary,
  getSavedVocabulary,
  reviewVocabulary,
  saveVocabulary,
  updateVocabularyCards,
};
