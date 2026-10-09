import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  LearningInsight,
  SavedItem,
  SavedItemsBulkLearningUpdate,
  SavedItemsView,
} from '../components/SavedItemsView';
import { DueCard } from '../components/FlashcardReview';
import { Rating } from '../utils/srsAlgorithm';
import { getApiError } from '../services/api';
import { useAuth } from '../providers/AuthProvider';
import { CardLabelColor, LearningStage } from '../types/learning';

interface ReviewScreenProps {
  isActive: boolean;
  refreshToken: number;
  onDueCountChange?: (due: number) => void;
  onSavedItemsChange?: (items: SavedItem[]) => void;
  onReplayContext: (videoId: string, timestamp: number) => void;
}

/**
 * ReviewScreen tự fetch và quản lý saved items khi tab active.
 * Badge bottom-tab được đồng bộ qua onDueCountChange; highlight từ vựng
 * ở ShortsScreen được đồng bộ qua onSavedItemsChange — App không fetch trực tiếp.
 */
export const ReviewScreen: React.FC<ReviewScreenProps> = ({
  isActive,
  refreshToken,
  onDueCountChange,
  onSavedItemsChange,
  onReplayContext,
}) => {
  const { authenticatedRequest, isAuthenticated } = useAuth();
  const abortRef = useRef<AbortController | null>(null);
  const dueRef = useRef(onDueCountChange);
  dueRef.current = onDueCountChange;
  const itemsRef = useRef(onSavedItemsChange);
  itemsRef.current = onSavedItemsChange;

  const [items, setItems] = useState<SavedItem[]>([]);
  const [summary, setSummary] = useState({ totalItems: 0, totalDue: 0 });
  const [insight, setInsight] = useState<LearningInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSavedItems = useCallback(async () => {
    abortRef.current?.abort();
    if (!isAuthenticated) {
      setItems([]);
      setSummary({ totalItems: 0, totalDue: 0 });
      setInsight(null);
      setIsLoading(false);
      setErrorMessage('Đăng nhập ShortLearn để xem và đồng bộ các mục đã lưu.');
      dueRef.current?.(0);
      itemsRef.current?.([]);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const insightRequest = authenticatedRequest('/learning/insights', {
        signal: controller.signal,
      })
        .then(async (response) => (response.ok ? response.json() : null))
        .catch(() => null);
      const response = await authenticatedRequest('/vocabulary/saved?limit=100', {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await getApiError(response));
      const data = await response.json();
      const nextItems: SavedItem[] = Array.isArray(data.items) ? data.items : [];
      const totalItems = Number(data.total_items);
      const totalDue = Number(data.total_due);
      const nextSummary = {
        totalItems: Number.isFinite(totalItems) ? totalItems : nextItems.length,
        totalDue: Number.isFinite(totalDue)
          ? totalDue
          : nextItems.reduce((count: number, item: SavedItem) => count + (Number(item.is_due) ? 1 : 0), 0),
      };
      setItems(nextItems);
      setSummary(nextSummary);
      dueRef.current?.(nextSummary.totalDue);
      itemsRef.current?.(nextItems);
      const insightPayload = await insightRequest;
      if (
        insightPayload?.engine === 'adaptive_rules_v1' &&
        insightPayload?.recommendation &&
        insightPayload?.metrics
      ) {
        if (!controller.signal.aborted) setInsight(insightPayload as LearningInsight);
      } else if (!controller.signal.aborted) {
        setInsight(null);
      }
    } catch {
      if (controller.signal.aborted) return;
      setItems([]);
      setSummary({ totalItems: 0, totalDue: 0 });
      setInsight(null);
      setErrorMessage('Không thể tải mục đã lưu. Hãy kiểm tra kết nối rồi thử lại.');
      dueRef.current?.(0);
      itemsRef.current?.([]);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }, [authenticatedRequest, isAuthenticated]);

  useEffect(() => {
    if (isActive) fetchSavedItems();
  }, [isActive, fetchSavedItems]);

  useEffect(() => {
    if (refreshToken > 0) fetchSavedItems();
  }, [refreshToken, fetchSavedItems]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateVocabularyCards = useCallback(
    async (itemIds: number[], updates: { learningStage?: LearningStage; cardLabel?: CardLabelColor | null }) => {
      if (itemIds.length === 0) return;
      const response = await authenticatedRequest('/vocabulary/cards', {
        method: 'PATCH',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: itemIds,
          ...(updates.learningStage ? { learning_stage: updates.learningStage } : {}),
          ...(updates.cardLabel !== undefined ? { card_label: updates.cardLabel } : {}),
        }),
      });
      if (!response.ok) throw new Error(await getApiError(response));
      await fetchSavedItems();
    },
    [authenticatedRequest, fetchSavedItems],
  );

  const handleRateCard = useCallback(
    async (card: DueCard, rating: Rating) => {
      const response = await authenticatedRequest('/vocabulary/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: card.word, rating }),
      });
      if (!response.ok) throw new Error(await getApiError(response));
      await fetchSavedItems();
    },
    [authenticatedRequest, fetchSavedItems],
  );

  const handleBulkUpdate = useCallback(
    async ({ itemIds, learningStage }: SavedItemsBulkLearningUpdate) => {
      await updateVocabularyCards(itemIds, { learningStage });
    },
    [updateVocabularyCards],
  );

  return (
    <View style={styles.container}>
      <SavedItemsView
        items={items}
        totalItems={summary.totalItems}
        totalDue={summary.totalDue}
        learningInsight={insight}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onRefresh={fetchSavedItems}
        onRateCard={handleRateCard}
        onReplayContext={onReplayContext}
        onBulkUpdateLearningStage={handleBulkUpdate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});
