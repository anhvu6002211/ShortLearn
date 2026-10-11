import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Rating, FSRSCard, reviewCard } from '../utils/srsAlgorithm';
import { VideoPlatform } from '../services/videoPlatform';
import { colors, radii, spacing, touchTarget, typography } from '../styles/theme';

export interface DueCard {
  id: number;
  word: string;
  phonetic?: string;
  meaning: string;
  context_sentence?: string;
  timestamp_mark?: number;
  platform_video_id?: string;
  platform?: VideoPlatform;
  difficulty?: number;
  stability?: number;
  retrievability?: number;
  lapses?: number;
  state?: 'new' | 'learning' | 'review' | 'relearning';
  interval_days?: number;
  repetition_count?: number;
  next_review?: string;
  updated_at?: string;
}

interface FlashcardReviewProps {
  cards: DueCard[];
  isLoading: boolean;
  errorMessage?: string | null;
  onRefresh: () => void;
  onRateCard: (card: DueCard, rating: Rating) => Promise<void>;
  onReplayContext: (videoId: string, timestamp: number, platform?: VideoPlatform) => void;
}

export const FlashcardReview: React.FC<FlashcardReviewProps> = ({
  cards,
  isLoading,
  errorMessage,
  onRefresh,
  onRateCard,
  onReplayContext,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentIndex((index) => Math.max(0, Math.min(index, cards.length - 1)));
    setIsFlipped(false);
    setSubmitError(null);
  }, [cards.length]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Đang tải danh sách từ vựng cần ôn...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.offlineEmoji}>📡</Text>
        <Text style={styles.emptyTitle}>Chưa thể tải thẻ ôn tập</Text>
        <Text style={styles.emptySubtext}>{errorMessage}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tải lại thẻ ôn tập" style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>↻ Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Khi đã ôn tập xong hết thẻ hôm nay
  if (!cards || cards.length === 0 || currentIndex >= cards.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.celebrateEmoji}>🎉</Text>
        <Text style={styles.emptyTitle}>Tuyệt vời! Bạn đã hoàn thành!</Text>
        <Text style={styles.emptySubtext}>
          Hôm nay không còn từ vựng nào đến hạn ôn tập theo thuật toán FSRS v5.
        </Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tải lại thẻ ôn tập" style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>🔄 Kiểm tra lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentCard = cards[currentIndex];

  // Khởi tạo thẻ FSRS Card từ dữ liệu DB
  const fsrsInstance: FSRSCard = {
    word: currentCard.word,
    difficulty: currentCard.difficulty ?? 5.0,
    stability: currentCard.stability ?? 0.0,
    retrievability: currentCard.retrievability ?? 0.0,
    reps: currentCard.repetition_count ?? 0,
    lapses: currentCard.lapses ?? 0,
    lastReviewDate: getLastReviewDate(currentCard),
    nextReviewDate: new Date(),
    intervalDays: currentCard.interval_days ?? 0,
    state: currentCard.state ?? 'new',
  };

  // Dự đoán khoảng thời gian cho 4 nút FSRS
  const previewAgain = reviewCard(fsrsInstance, Rating.Again);
  const previewHard  = reviewCard(fsrsInstance, Rating.Hard);
  const previewGood  = reviewCard(fsrsInstance, Rating.Good);
  const previewEasy  = reviewCard(fsrsInstance, Rating.Easy);

  const formatInterval = (days: number): string => {
    if (days <= 0) return '< 1 ngày';
    if (days === 1) return '1 ngày';
    if (days < 30) return `${days} ngày`;
    const months = Math.round(days / 30);
    return `${months} tháng`;
  };

  const handleRate = async (rating: Rating) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await onRateCard(currentCard, rating);
      // Parent loại thẻ vừa ôn khỏi hàng đợi; giữ index hợp lệ cho thẻ kế tiếp.
      setIsFlipped(false);
      setCurrentIndex((prev) => Math.max(0, Math.min(prev, cards.length - 2)));
    } catch {
      setSubmitError('Chưa lưu được đánh giá. Kiểm tra kết nối rồi thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header Tiến độ */}
      <View style={styles.header}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>FSRS v5</Text>
        </View>
        <Text style={styles.progressText}>
          Thẻ {currentIndex + 1} / {cards.length}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((currentIndex + 1) / cards.length) * 100}%` }]} />
      </View>

      {/* Thẻ Flashcard chính */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={isFlipped ? `Ẩn nghĩa của từ ${currentCard.word}` : `Xem nghĩa của từ ${currentCard.word}`}
        accessibilityState={{ expanded: isFlipped }}
        activeOpacity={0.9}
        onPress={() => setIsFlipped(!isFlipped)}
        style={styles.card}
      >
        {/* Mặt trước: Từ vựng & Câu ngữ cảnh */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardWord}>{currentCard.word}</Text>
          {currentCard.phonetic && (
            <Text style={styles.cardPhonetic}>{currentCard.phonetic}</Text>
          )}
        </View>

        {currentCard.context_sentence && (
          <View style={styles.contextContainer}>
            <Text style={styles.contextLabel}>Ngữ cảnh trong Shorts:</Text>
            <Text style={styles.contextText}>"{currentCard.context_sentence}"</Text>
          </View>
        )}

        {/* Nút Nghe lại ngữ cảnh Video Shorts */}
        {currentCard.platform_video_id && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Nghe lại ngữ cảnh video"
            style={styles.audioContextButton}
            onPress={(e) => {
              e.stopPropagation();
              onReplayContext(
                currentCard.platform_video_id!,
                currentCard.timestamp_mark || 0,
                currentCard.platform,
              );
            }}
          >
            <Text style={styles.audioContextText}>🎧 Nghe lại giọng bản xứ (-2s)</Text>
          </TouchableOpacity>
        )}

        {/* Mặt sau: Nghĩa & Giải thích khi bấm Lật thẻ */}
        {isFlipped ? (
          <View style={styles.backContent}>
            <View style={styles.divider} />
            <Text style={styles.meaningLabel}>Định nghĩa tiếng Việt:</Text>
            <Text style={styles.meaningText}>{currentCard.meaning}</Text>
          </View>
        ) : (
          <View style={styles.flipHintContainer}>
            <Text style={styles.flipHintText}>👆 Chạm vào thẻ để xem nghĩa</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 4 Nút đánh giá FSRS v5 (Chỉ hiển thị khi đã lật thẻ) */}
      {isFlipped && (
        <View style={styles.ratingSection}>
          <Text style={styles.ratingTitle}>Mức độ ghi nhớ của bạn:</Text>
          <View style={styles.buttonGrid}>
            {/* 1. Again */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Lại, ôn sau ${formatInterval(previewAgain.intervalDays)}`}
              style={[styles.rateButton, styles.againButton]}
              onPress={() => handleRate(Rating.Again)}
              disabled={isSubmitting}
            >
              <Text style={styles.rateButtonLabel}>Quên</Text>
              <Text style={styles.rateButtonInterval}>
                {formatInterval(previewAgain.intervalDays)}
              </Text>
            </TouchableOpacity>

            {/* 2. Hard */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Khó, ôn sau ${formatInterval(previewHard.intervalDays)}`}
              style={[styles.rateButton, styles.hardButton]}
              onPress={() => handleRate(Rating.Hard)}
              disabled={isSubmitting}
            >
              <Text style={styles.rateButtonLabel}>Khó</Text>
              <Text style={styles.rateButtonInterval}>
                {formatInterval(previewHard.intervalDays)}
              </Text>
            </TouchableOpacity>

            {/* 3. Good */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Tốt, ôn sau ${formatInterval(previewGood.intervalDays)}`}
              style={[styles.rateButton, styles.goodButton]}
              onPress={() => handleRate(Rating.Good)}
              disabled={isSubmitting}
            >
              <Text style={styles.rateButtonLabel}>Nhớ</Text>
              <Text style={styles.rateButtonInterval}>
                {formatInterval(previewGood.intervalDays)}
              </Text>
            </TouchableOpacity>

            {/* 4. Easy */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Dễ, ôn sau ${formatInterval(previewEasy.intervalDays)}`}
              style={[styles.rateButton, styles.easyButton]}
              onPress={() => handleRate(Rating.Easy)}
              disabled={isSubmitting}
            >
              <Text style={styles.rateButtonLabel}>Dễ</Text>
              <Text style={styles.rateButtonInterval}>
                {formatInterval(previewEasy.intervalDays)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {submitError && <Text style={styles.submitErrorText}>{submitError}</Text>}
    </ScrollView>
  );
};

function getLastReviewDate(card: DueCard): Date {
  const nextReview = card.next_review ? new Date(card.next_review) : null;
  if (nextReview && !Number.isNaN(nextReview.getTime())) {
    const interval = Math.max(0, card.interval_days ?? 0);
    return new Date(nextReview.getTime() - interval * 86_400_000);
  }
  if (card.updated_at) {
    const updatedAt = new Date(card.updated_at);
    if (!Number.isNaN(updatedAt.getTime())) return updatedAt;
  }
  return new Date();
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.canvas, flexGrow: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas, padding: spacing.xl },
  loadingText: { color: colors.textMuted, fontSize: 15, marginTop: spacing.md },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas, padding: 32 },
  celebrateEmoji: { fontSize: 60, marginBottom: spacing.lg },
  offlineEmoji: { fontSize: 52, marginBottom: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: spacing.sm },
  emptySubtext: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  refreshButton: { minHeight: touchTarget, backgroundColor: colors.surfaceElevated, paddingVertical: 12, paddingHorizontal: 24, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.primaryBorder, justifyContent: 'center' },
  refreshButtonText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  progressTrack: { height: 5, borderRadius: radii.pill, backgroundColor: colors.surfaceOverlay, overflow: 'hidden', marginBottom: 20 },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.primary },
  badgeContainer: { backgroundColor: 'rgba(56,189,248,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.md, borderWidth: 1, borderColor: colors.primaryBorder },
  badgeText: { color: colors.primaryLight, fontSize: 12, fontWeight: '700' },
  progressText: { color: colors.textMuted, fontSize: typography.bodyMedium, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: radii.sheet, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 5, minHeight: 280, justifyContent: 'space-between' },
  cardHeader: { alignItems: 'center', marginBottom: spacing.lg },
  cardWord: { color: colors.english, fontSize: 32, fontWeight: '900', textTransform: 'capitalize', textAlign: 'center' },
  cardPhonetic: { color: colors.textMuted, fontSize: typography.bodyLarge, fontStyle: 'italic', marginTop: 4 },
  contextContainer: { backgroundColor: colors.surfaceElevated, borderRadius: radii.lg, padding: 14, marginBottom: spacing.lg },
  contextLabel: { color: colors.textSubdued, fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  contextText: { color: colors.text, fontSize: 15, fontStyle: 'italic', lineHeight: 22 },
  audioContextButton: { minHeight: touchTarget, backgroundColor: 'rgba(56,189,248,0.10)', borderWidth: 1, borderColor: colors.primaryBorder, paddingVertical: 10, paddingHorizontal: 16, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  audioContextText: { color: colors.primaryLight, fontSize: typography.bodyMedium, fontWeight: '700' },
  flipHintContainer: { alignItems: 'center', paddingVertical: spacing.md },
  flipHintText: { color: colors.textMuted, fontSize: typography.bodySmall, fontStyle: 'italic' },
  backContent: { marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.borderStrong, marginBottom: spacing.lg },
  meaningLabel: { color: colors.vietnamese, fontSize: typography.bodySmall, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  meaningText: { color: colors.text, fontSize: 18, fontWeight: '600', lineHeight: 26 },
  ratingSection: { marginTop: spacing.xl },
  ratingTitle: { color: colors.textMuted, fontSize: typography.bodyMedium, fontWeight: '600', marginBottom: spacing.md, textAlign: 'center' },
  buttonGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  rateButton: { flex: 1, minHeight: 60, paddingVertical: 10, paddingHorizontal: 4, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  againButton: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.65)' },
  hardButton: { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.65)' },
  goodButton: { backgroundColor: 'rgba(56,189,248,0.15)', borderColor: 'rgba(56,189,248,0.65)' },
  easyButton: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.65)' },
  rateButtonLabel: { color: colors.text, fontSize: typography.bodyMedium, fontWeight: '800', marginBottom: 2 },
  rateButtonInterval: { color: colors.textMuted, fontSize: typography.label, fontWeight: '500' },
  submitErrorText: { color: '#FCA5A5', fontSize: typography.bodySmall, lineHeight: 19, textAlign: 'center', marginTop: spacing.lg },
});
