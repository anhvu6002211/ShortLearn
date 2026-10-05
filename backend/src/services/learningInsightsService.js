function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * A small, explainable recommendation layer over FSRS state.
 *
 * This deliberately stays deterministic: it is safe to run for every request,
 * produces an auditable reason for each suggestion, and creates a stable
 * baseline before enough review-event data exists to train a personal model.
 */
function buildLearningInsight(rawMetrics) {
  const metrics = {
    totalCards: Math.max(0, Math.round(toFiniteNumber(rawMetrics.total_cards))),
    dueNow: Math.max(0, Math.round(toFiniteNumber(rawMetrics.due_now))),
    newCards: Math.max(0, Math.round(toFiniteNumber(rawMetrics.new_cards))),
    learningCards: Math.max(0, Math.round(toFiniteNumber(rawMetrics.learning_cards))),
    atRiskCards: Math.max(0, Math.round(toFiniteNumber(rawMetrics.at_risk_cards))),
    averageRetrievability: clamp(toFiniteNumber(rawMetrics.average_retrievability), 0, 1),
  };

  let recommendation;
  if (metrics.totalCards === 0) {
    recommendation = {
      priority: 'start',
      title: 'Tạo nền tảng học',
      message: 'Lưu 3–5 từ xuất hiện trong video hôm nay để ShortLearn bắt đầu cá nhân hoá lịch ôn.',
      action: 'save_words',
      recommendedCardCount: 3,
    };
  } else if (metrics.dueNow > 0) {
    recommendation = {
      priority: 'high',
      title: 'Ưu tiên thẻ đến hạn',
      message: `Ôn ${metrics.dueNow} thẻ đến hạn trước để giữ nhịp ghi nhớ ổn định.`,
      action: 'review_due',
      recommendedCardCount: Math.min(metrics.dueNow, 20),
    };
  } else if (metrics.atRiskCards > 0) {
    recommendation = {
      priority: 'medium',
      title: 'Củng cố thẻ khó',
      message: `${metrics.atRiskCards} thẻ có dấu hiệu khó nhớ; hãy ưu tiên chúng trong phiên ôn tiếp theo.`,
      action: 'reinforce_risk_cards',
      recommendedCardCount: Math.min(metrics.atRiskCards, 10),
    };
  } else if (metrics.newCards > 8) {
    recommendation = {
      priority: 'medium',
      title: 'Giảm tải thẻ mới',
      message: `Bạn đang có ${metrics.newCards} thẻ mới. Hãy ôn các thẻ này trước khi lưu thêm nhiều từ.`,
      action: 'review_new_cards',
      recommendedCardCount: Math.min(metrics.newCards, 10),
    };
  } else {
    recommendation = {
      priority: 'low',
      title: 'Bạn đang đi đúng nhịp',
      message: 'Không có thẻ đến hạn ngay bây giờ. Hãy tiếp tục xem video và lưu từ xuất hiện trong ngữ cảnh thật.',
      action: 'continue_learning',
      recommendedCardCount: 0,
    };
  }

  return {
    engine: 'adaptive_rules_v1',
    metrics: {
      ...metrics,
      averageRetrievability: Number(metrics.averageRetrievability.toFixed(2)),
    },
    recommendation,
  };
}

module.exports = { buildLearningInsight };
