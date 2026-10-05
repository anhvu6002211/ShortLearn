const db = require('../config/db');
const { buildLearningInsight } = require('../services/learningInsightsService');

function authenticatedUserId(req) {
  const userId = req.auth?.userId;
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new Error('Authenticated user context is missing.');
  }
  return userId;
}

/** GET /api/v1/learning/insights */
async function getLearningInsights(req, res) {
  try {
    const userId = authenticatedUserId(req);

    const [rows] = await db.query(
      `SELECT COUNT(*) AS total_cards,
              COALESCE(SUM(next_review <= NOW()), 0) AS due_now,
              COALESCE(SUM(state = 'new'), 0) AS new_cards,
              COALESCE(SUM(state IN ('learning', 'relearning')), 0) AS learning_cards,
              COALESCE(SUM(difficulty >= 7 OR lapses >= 3), 0) AS at_risk_cards,
              COALESCE(AVG(CASE WHEN state <> 'new' THEN retrievability END), 0) AS average_retrievability
       FROM user_vocabulary
       WHERE user_id = ?`,
      [userId]
    );

    const insight = buildLearningInsight(rows[0] || {});
    return res.status(200).json({
      ...insight,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error('❌ [Failed to generate learning insight]', error);
    const payload = { error: 'Failed to generate learning insight.' };
    if (process.env.NODE_ENV !== 'production') payload.details = error.message;
    return res.status(500).json(payload);
  }
}

module.exports = { getLearningInsights };
