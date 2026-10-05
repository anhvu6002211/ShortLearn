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
        <ActivityIndicator size="large" color="#38BDF8" />
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
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
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
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
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
  container: {
    padding: 20,
    backgroundColor: '#F7F8FC',
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F8FC',
    padding: 24,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 15,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F8FC',
    padding: 32,
  },
  celebrateEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  offlineEmoji: {
    fontSize: 52,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  refreshButtonText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  badgeContainer: {
    backgroundColor: '#EAF1FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  badgeText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  progressText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    minHeight: 280,
    justifyContent: 'space-between',
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cardWord: {
    color: '#1D4ED8',
    fontSize: 32,
    fontWeight: '900',
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  cardPhonetic: {
    color: '#64748B',
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 4,
  },
  contextContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  contextLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contextText: {
    color: '#334155',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  audioContextButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  audioContextText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '700',
  },
  flipHintContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  flipHintText: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
  },
  backContent: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
  },
  meaningLabel: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  meaningText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
  },
  ratingSection: {
    marginTop: 24,
  },
  ratingTitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  rateButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  againButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  hardButton: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  goodButton: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  easyButton: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  rateButtonLabel: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  rateButtonInterval: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.85,
  },
  submitErrorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 16,
  },
});
