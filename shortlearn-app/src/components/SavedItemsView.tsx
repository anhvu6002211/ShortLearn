import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Rating } from '../utils/srsAlgorithm';
import {
  CARD_LABEL_COLORS,
  CardLabelColor,
  LEARNING_STAGE_LABELS,
  LearningStage,
} from '../types/learning';
import { DueCard, FlashcardReview } from './FlashcardReview';
import { VideoPlatform } from '../services/videoPlatform';
import { EmptyState, ErrorState, LoadingState } from './common/StateViews';

export interface SavedItem extends DueCard {
  is_due?: number | boolean;
  created_at?: string;
  learning_stage?: LearningStage | null;
  card_label?: CardLabelColor | null;
}

export interface SavedItemsBulkLearningUpdate {
  itemIds: number[];
  learningStage: LearningStage;
  sourceLabel: CardLabelColor | 'all';
}

export interface LearningInsight {
  engine: string;
  metrics: {
    totalCards: number;
    dueNow: number;
    newCards: number;
    learningCards: number;
    atRiskCards: number;
    averageRetrievability: number;
  };
  recommendation: {
    priority: 'start' | 'high' | 'medium' | 'low';
    title: string;
    message: string;
    action: string;
    recommendedCardCount: number;
  };
}

type SavedFilter = 'all' | 'due' | 'learning';
type CardLabelFilter = CardLabelColor | 'all';

export interface SavedItemsViewProps {
  items: SavedItem[];
  totalItems?: number;
  totalDue?: number;
  learningInsight?: LearningInsight | null;
  isLoading: boolean;
  errorMessage?: string | null;
  onRefresh: () => void;
  onRateCard: (card: DueCard, rating: Rating) => Promise<void>;
  onReplayContext: (videoId: string, timestamp: number, platform?: VideoPlatform) => void;
  onBulkUpdateLearningStage?: (update: SavedItemsBulkLearningUpdate) => Promise<void> | void;
}

const isDue = (item: SavedItem): boolean => Boolean(Number(item.is_due));

const stageLabel = (item: SavedItem): string => {
  if (item.learning_stage) return LEARNING_STAGE_LABELS[item.learning_stage];
  if (isDue(item)) return 'Ôn lại';
  switch (item.state) {
    case 'learning':
    case 'relearning':
      return 'Đang học';
    case 'review':
      return 'Đã học';
    default:
      return 'Mới';
  }
};

const LABEL_FILTERS: Array<{ value: CardLabelFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'red', label: 'Đỏ' },
  { value: 'green', label: 'Xanh lá' },
  { value: 'yellow', label: 'Vàng' },
  { value: 'blue', label: 'Xanh dương' },
];

const LEARNING_STAGES: Array<{
  value: LearningStage;
  description: string;
  accent: string;
}> = [
  { value: 'known', description: 'Từ đã biết', accent: '#F8FAFC' },
  { value: 'learning', description: 'Đánh dấu để học', accent: '#F59E0B' },
  { value: 'later', description: 'Chưa cần học', accent: '#9CA3AF' },
];

const formatTimestamp = (seconds?: number): string => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
};

const ContextLine: React.FC<{ item: SavedItem }> = ({ item }) => {
  const context = item.context_sentence?.trim();
  const needle = item.word.trim();
  if (!context || !needle) return null;

  const matchIndex = context.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (matchIndex === -1) return <Text style={styles.contextText}>{context}</Text>;

  const matchEnd = matchIndex + needle.length;
  return (
    <Text style={styles.contextText}>
      {context.slice(0, matchIndex)}
      <Text style={styles.contextHighlight}>{context.slice(matchIndex, matchEnd)}</Text>
      {context.slice(matchEnd)}
    </Text>
  );
};

export const SavedItemsView: React.FC<SavedItemsViewProps> = ({
  items,
  totalItems,
  totalDue,
  learningInsight,
  isLoading,
  errorMessage,
  onRefresh,
  onRateCard,
  onReplayContext,
  onBulkUpdateLearningStage,
}) => {
  const [filter, setFilter] = useState<SavedFilter>('all');
  const [query, setQuery] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isBulkPanelOpen, setIsBulkPanelOpen] = useState(false);
  const [labelFilter, setLabelFilter] = useState<CardLabelFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [selectedStage, setSelectedStage] = useState<LearningStage>('learning');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const dueCards = useMemo(() => items.filter(isDue), [items]);
  const displayedTotalItems = Number.isFinite(totalItems) ? totalItems! : items.length;
  const displayedTotalDue = Number.isFinite(totalDue) ? totalDue! : dueCards.length;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesFilter = filter === 'all'
      || (filter === 'due' && isDue(item))
      || (filter === 'learning' && ['learning', 'relearning', 'new'].includes(item.state || ''));
    if (!matchesFilter) return false;
    if (labelFilter !== 'all' && item.card_label !== labelFilter) return false;
    if (!normalizedQuery) return true;
    return [item.word, item.meaning, item.context_sentence]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery));
  }), [filter, items, labelFilter, normalizedQuery]);

  const visibleIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);
  const selectedVisibleCount = useMemo(
    () => visibleIds.reduce((count, id) => count + (selectedIds.has(id) ? 1 : 0), 0),
    [selectedIds, visibleIds],
  );
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  useEffect(() => {
    const availableIds = new Set(items.map((item) => item.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const toggleItemSelection = (itemId: number) => {
    setBulkError(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setBulkError(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const chooseLabelFilter = (nextFilter: CardLabelFilter) => {
    setLabelFilter(nextFilter);
    setSelectedIds(new Set());
    setBulkError(null);
  };

  const applyLearningStage = async () => {
    if (!onBulkUpdateLearningStage || selectedIds.size === 0 || isBulkUpdating) return;
    try {
      setIsBulkUpdating(true);
      setBulkError(null);
      await onBulkUpdateLearningStage({
        itemIds: [...selectedIds],
        learningStage: selectedStage,
        sourceLabel: labelFilter,
      });
      setSelectedIds(new Set());
    } catch {
      setBulkError('Chưa cập nhật được các thẻ. Vui lòng thử lại.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (isReviewing) {
    return (
      <View style={styles.reviewWorkspace}>
        <View style={styles.reviewTopBar}>
          <TouchableOpacity accessibilityRole="button" onPress={() => setIsReviewing(false)}>
            <Text style={styles.backToSaved}>‹ Saved items</Text>
          </TouchableOpacity>
          <Text style={styles.reviewTopTitle}>Ôn tập</Text>
          <View style={styles.reviewTopSpacer} />
        </View>
        <FlashcardReview
          cards={dueCards}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onRefresh={onRefresh}
          onRateCard={onRateCard}
          onReplayContext={onReplayContext}
        />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Saved items</Text>
          <Text style={styles.subtitle}>Từ và câu bạn đã lưu từ video</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Làm mới mục đã lưu"
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: true }} style={styles.tabActive}>
          <Text style={styles.tabTextActive}>Saved words <Text style={styles.tabCount}>{displayedTotalItems}</Text></Text>
        </TouchableOpacity>
        <View style={styles.tabInactive}>
          <Text style={styles.tabTextInactive}>Phrases</Text>
        </View>
        {displayedTotalDue > 0 ? (
          <TouchableOpacity accessibilityRole="button" style={styles.reviewCompactButton} onPress={() => setIsReviewing(true)}>
            <Text style={styles.reviewCompactText}>Ôn {displayedTotalDue}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.toolbar}>
        <View style={styles.filterRow}>
          {([
            ['all', 'Tất cả'],
            ['due', 'Cần ôn'],
            ['learning', 'Đang học'],
          ] as [SavedFilter, string][]).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === key }}
              onPress={() => setFilter(key)}
              style={[styles.filterButton, filter === key && styles.filterButtonActive]}
            >
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor="#8A8DA3"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Tìm trong mục đã lưu"
          />
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: isBulkPanelOpen }}
          style={styles.manageCardsButton}
          onPress={() => {
            setIsBulkPanelOpen((current) => !current);
            setBulkError(null);
          }}
        >
          <View>
            <Text style={styles.manageCardsTitle}>Cập nhật thẻ màu cũ</Text>
            <Text style={styles.manageCardsHint}>Chọn nhãn, chọn từ rồi đặt giai đoạn học tập</Text>
          </View>
          <Text style={styles.manageCardsChevron}>{isBulkPanelOpen ? '⌃' : '⌄'}</Text>
        </TouchableOpacity>
      </View>

      {isBulkPanelOpen ? (
        <View style={styles.bulkPanel}>
          <Text style={styles.bulkSectionLabel}>1. MÀU NHÃN CŨ</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.labelOptions}
          >
            {LABEL_FILTERS.map((option) => {
              const isActive = labelFilter === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => chooseLabelFilter(option.value)}
                  style={[styles.labelOption, isActive && styles.labelOptionActive]}
                >
                  {option.value === 'all' ? null : (
                    <View style={[styles.labelColorDot, { backgroundColor: CARD_LABEL_COLORS[option.value] }]} />
                  )}
                  <Text style={[styles.labelOptionText, isActive && styles.labelOptionTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.bulkSelectionRow}>
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allVisibleSelected }}
              disabled={visibleIds.length === 0}
              onPress={toggleSelectAllVisible}
              style={styles.selectAllButton}
            >
              <View style={[
                styles.checkbox,
                allVisibleSelected && styles.checkboxChecked,
                visibleIds.length === 0 && styles.checkboxDisabled,
              ]}>
                {allVisibleSelected ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.selectAllText}>Chọn tất cả đang hiển thị</Text>
            </TouchableOpacity>
            <Text style={styles.selectedCount}>{selectedIds.size} đã chọn</Text>
          </View>

          <Text style={styles.bulkSectionLabel}>2. GIAI ĐOẠN HỌC TẬP</Text>
          <View style={styles.stageOptions}>
            {LEARNING_STAGES.map((option) => {
              const isActive = selectedStage === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setSelectedStage(option.value)}
                  style={[styles.stageOption, isActive && styles.stageOptionActive]}
                >
                  <View style={[
                    styles.stageSwatch,
                    { backgroundColor: option.accent },
                    option.value === 'known' && styles.knownStageSwatch,
                  ]} />
                  <Text style={[styles.stageOptionTitle, isActive && styles.stageOptionTitleActive]}>
                    {LEARNING_STAGE_LABELS[option.value]}
                  </Text>
                  <Text style={styles.stageOptionDescription}>{option.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {bulkError ? <Text style={styles.bulkError}>{bulkError}</Text> : null}
          <TouchableOpacity
            accessibilityRole="button"
            disabled={selectedIds.size === 0 || !onBulkUpdateLearningStage || isBulkUpdating}
            onPress={applyLearningStage}
            style={[
              styles.applyStageButton,
              (selectedIds.size === 0 || !onBulkUpdateLearningStage || isBulkUpdating)
                && styles.applyStageButtonDisabled,
            ]}
          >
            {isBulkUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
              <Text style={styles.applyStageButtonText}>
                Áp dụng cho {selectedIds.size} từ
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {learningInsight ? (
        <View style={styles.insightLine} accessibilityLabel={`Gợi ý học tập: ${learningInsight.recommendation.message}`}>
          <Text style={styles.insightLabel}>GỢI Ý</Text>
          <Text numberOfLines={1} style={styles.insightText}>{learningInsight.recommendation.message}</Text>
        </View>
      ) : null}

      <View style={styles.tableHeader}>
        {isBulkPanelOpen ? (
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityLabel="Chọn tất cả từ đang hiển thị"
            accessibilityState={{ checked: allVisibleSelected }}
            disabled={visibleIds.length === 0}
            onPress={toggleSelectAllVisible}
            style={styles.headerCheckboxButton}
          >
            <View style={[styles.checkbox, styles.checkboxSmall, allVisibleSelected && styles.checkboxChecked]}>
              {allVisibleSelected ? <Text style={styles.checkboxMarkSmall}>✓</Text> : null}
            </View>
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.columnLabel, styles.columnItem]}>ITEM</Text>
        <Text style={[styles.columnLabel, styles.columnStage]}>STAGE</Text>
        <Text style={[styles.columnLabel, styles.columnSource]}>SOURCE</Text>
      </View>

      {isLoading ? (
        <LoadingState message="Đang tải mục đã lưu..." />
      ) : errorMessage ? (
        <ErrorState
          title="Không thể tải danh sách"
          message={errorMessage}
          onRetry={onRefresh}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {visibleItems.length === 0 ? (
            <EmptyState
              title={items.length === 0 ? 'Chưa có mục đã lưu' : 'Không tìm thấy mục phù hợp'}
              message={items.length === 0
                ? 'Chạm vào một từ trong phụ đề rồi chọn Lưu để tạo mục đầu tiên.'
                : 'Thử đổi từ khóa hoặc bộ lọc để xem thêm mục.'}
            />
          ) : visibleItems.map((item) => {
            const canReplay = Boolean(item.platform_video_id);
            return (
              <View key={item.id} style={[styles.itemRow, selectedIds.has(item.id) && styles.itemRowSelected]}>
                {isBulkPanelOpen ? (
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Chọn ${item.word}`}
                    accessibilityState={{ checked: selectedIds.has(item.id) }}
                    onPress={() => toggleItemSelection(item.id)}
                    style={styles.itemCheckboxButton}
                  >
                    <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                      {selectedIds.has(item.id) ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                  </TouchableOpacity>
                ) : null}
                <View style={styles.itemMain}>
                  <View style={styles.wordLine}>
                    <View style={styles.wordMarker}>
                      <Text style={styles.wordMarkerText}>w</Text>
                    </View>
                    <Text style={styles.wordText}>{item.word}</Text>
                    {item.phonetic ? <Text style={styles.phonetic}>{item.phonetic}</Text> : null}
                  </View>
                  <Text style={styles.meaning}>{item.meaning}</Text>
                  <View style={styles.contextBox}><ContextLine item={item} /></View>
                </View>
                <View style={styles.itemMeta}>
                  <Text style={[styles.stagePill, isDue(item) && styles.stagePillDue]}>{stageLabel(item)}</Text>
                  <View style={styles.sourceRow}>
                    <Text numberOfLines={1} style={styles.sourceText}>
                      {canReplay
                        ? `${item.platform === 'tiktok' ? 'TikTok' : 'YouTube'} · ${formatTimestamp(item.timestamp_mark)}`
                        : '—'}
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={canReplay ? `Mở ngữ cảnh video cho ${item.word}` : 'Không có nguồn video'}
                      disabled={!canReplay}
                      onPress={() => canReplay && onReplayContext(
                        item.platform_video_id!,
                        item.timestamp_mark || 0,
                        item.platform,
                      )}
                      style={[styles.playButton, !canReplay && styles.playButtonDisabled]}
                    >
                      <Text style={styles.playIcon}>▶</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F5F5F8',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 15 },
  title: { color: '#35364A', fontSize: 25, fontWeight: '600', letterSpacing: -0.35 },
  subtitle: { color: '#818398', fontSize: 13, marginTop: 3 },
  refreshButton: { width: 34, height: 34, borderRadius: 5, borderWidth: 1, borderColor: '#D7D7E0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: '#6950B5', fontSize: 21, lineHeight: 24 },
  tabsRow: { minHeight: 45, flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#DCDDE5', backgroundColor: '#FFFFFF', paddingHorizontal: 18 },
  tabActive: { alignSelf: 'stretch', justifyContent: 'center', borderBottomWidth: 3, borderColor: '#6950B5', paddingHorizontal: 2, marginRight: 21 },
  tabInactive: { alignSelf: 'stretch', justifyContent: 'center', marginRight: 12 },
  tabTextActive: { color: '#4C3A8D', fontSize: 14, fontWeight: '700' },
  tabCount: { color: '#8174AD', fontWeight: '600' },
  tabTextInactive: { color: '#818398', fontSize: 14, fontWeight: '600' },
  reviewCompactButton: { marginLeft: 'auto', marginBottom: 7, backgroundColor: '#6950B5', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6 },
  reviewCompactText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  toolbar: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E0E1E8', paddingHorizontal: 18, paddingVertical: 10 },
  filterRow: { flexDirection: 'row', marginBottom: 9 },
  filterButton: { borderWidth: 1, borderColor: '#D8D9E2', backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 5, marginRight: 7, borderRadius: 3 },
  filterButtonActive: { backgroundColor: '#F0EDFA', borderColor: '#9D8DD2' },
  filterText: { color: '#707286', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#4C3A8D' },
  searchBox: { height: 36, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D2DC', borderRadius: 3, backgroundColor: '#FCFCFD', paddingHorizontal: 9 },
  searchIcon: { color: '#85879A', fontSize: 19, marginRight: 5, marginTop: -2 },
  searchInput: { flex: 1, color: '#3B3D50', fontSize: 14, paddingVertical: 5 },
  manageCardsButton: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#ECECF1' },
  manageCardsTitle: { color: '#4C3A8D', fontSize: 12, fontWeight: '800' },
  manageCardsHint: { color: '#8A8C9D', fontSize: 10, marginTop: 2 },
  manageCardsChevron: { color: '#6950B5', fontSize: 18, fontWeight: '700', marginLeft: 12 },
  bulkPanel: { backgroundColor: '#FBFAFE', borderBottomWidth: 1, borderBottomColor: '#D9D6E6', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 13 },
  bulkSectionLabel: { color: '#77718D', fontSize: 9, fontWeight: '800', letterSpacing: 0.7, marginBottom: 7 },
  labelOptions: { paddingBottom: 11 },
  labelOption: { height: 30, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D8D9E2', borderRadius: 4, backgroundColor: '#FFFFFF', paddingHorizontal: 9, marginRight: 7 },
  labelOptionActive: { borderColor: '#8064C4', backgroundColor: '#F0EDFA' },
  labelColorDot: { width: 9, height: 9, borderRadius: 5, marginRight: 6 },
  labelOptionText: { color: '#6F7184', fontSize: 11, fontWeight: '600' },
  labelOptionTextActive: { color: '#4C3A8D', fontWeight: '800' },
  bulkSelectionRow: { minHeight: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E3EC', marginBottom: 11 },
  selectAllButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 8 },
  selectAllText: { color: '#55576A', fontSize: 11, fontWeight: '700', marginLeft: 7 },
  selectedCount: { color: '#806FAD', fontSize: 10, fontWeight: '700' },
  checkbox: { width: 19, height: 19, borderWidth: 1, borderColor: '#B9BBC8', borderRadius: 3, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { borderColor: '#6950B5', backgroundColor: '#6950B5' },
  checkboxDisabled: { backgroundColor: '#ECECF1', borderColor: '#D8D9E2' },
  checkboxMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  checkboxSmall: { width: 15, height: 15 },
  checkboxMarkSmall: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', lineHeight: 12 },
  stageOptions: { flexDirection: 'row', marginHorizontal: -3 },
  stageOption: { flex: 1, minHeight: 65, borderWidth: 1, borderColor: '#D8D9E2', borderRadius: 4, backgroundColor: '#FFFFFF', marginHorizontal: 3, paddingHorizontal: 7, paddingVertical: 8 },
  stageOptionActive: { borderColor: '#8064C4', backgroundColor: '#F5F2FD' },
  stageSwatch: { width: 22, height: 3, borderRadius: 2, marginBottom: 6 },
  knownStageSwatch: { borderWidth: 1, borderColor: '#A8AAB7' },
  stageOptionTitle: { color: '#57596C', fontSize: 11, fontWeight: '700' },
  stageOptionTitleActive: { color: '#4C3A8D' },
  stageOptionDescription: { color: '#9495A5', fontSize: 9, lineHeight: 12, marginTop: 2 },
  bulkError: { color: '#B64747', fontSize: 11, lineHeight: 16, marginTop: 9 },
  applyStageButton: { minHeight: 37, borderRadius: 4, backgroundColor: '#6950B5', alignItems: 'center', justifyContent: 'center', marginTop: 11, paddingHorizontal: 14 },
  applyStageButtonDisabled: { backgroundColor: '#C8C4D4' },
  applyStageButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  insightLine: { minHeight: 31, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#E2E2E9', backgroundColor: '#FBFAFE', paddingHorizontal: 18 },
  insightLabel: { color: '#6950B5', fontSize: 10, fontWeight: '800', letterSpacing: 0.7, marginRight: 9 },
  insightText: { flex: 1, color: '#646579', fontSize: 12 },
  tableHeader: { height: 31, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECECF1', borderBottomWidth: 1, borderColor: '#D8D9E2', paddingHorizontal: 18 },
  headerCheckboxButton: { width: 29, height: 31, justifyContent: 'center' },
  columnLabel: { color: '#77798C', fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  columnItem: { flex: 1 },
  columnStage: { width: 68, textAlign: 'center' },
  columnSource: { width: 86, textAlign: 'right' },
  listContent: { backgroundColor: '#FFFFFF', paddingBottom: 24 },
  itemRow: { flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderColor: '#E5E5EB' },
  itemRowSelected: { backgroundColor: '#F8F6FD' },
  itemCheckboxButton: { width: 29, paddingTop: 1 },
  itemMain: { flex: 1, paddingRight: 9 },
  wordLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  wordMarker: { width: 19, height: 19, borderRadius: 3, backgroundColor: '#3E93D1', alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  wordMarkerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 16 },
  wordText: { color: '#3C3D51', fontSize: 16, fontWeight: '700' },
  phonetic: { color: '#87899B', fontSize: 11, fontStyle: 'italic', marginLeft: 7 },
  meaning: { color: '#5E6074', fontSize: 13, lineHeight: 18, marginTop: 3, marginLeft: 26 },
  contextBox: { marginLeft: 26, marginTop: 7 },
  contextText: { color: '#7A7B8D', fontSize: 12, lineHeight: 17 },
  contextHighlight: { color: '#4E86BE', fontWeight: '700' },
  itemMeta: { width: 86, alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 1 },
  stagePill: { color: '#537C58', backgroundColor: '#EAF4EA', borderRadius: 3, overflow: 'hidden', fontSize: 10, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 3 },
  stagePillDue: { color: '#9D5A24', backgroundColor: '#FFF0E3' },
  sourceRow: { width: '100%', alignItems: 'flex-end' },
  sourceText: { color: '#898A9A', fontSize: 10, maxWidth: '100%', marginBottom: 5 },
  playButton: { width: 27, height: 24, borderRadius: 3, backgroundColor: '#8064C4', alignItems: 'center', justifyContent: 'center' },
  playButtonDisabled: { backgroundColor: '#D6D6DE' },
  playIcon: { color: '#FFFFFF', fontSize: 11, marginLeft: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: '#FFFFFF' },
  stateTitle: { color: '#3D3E50', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 7 },
  stateText: { color: '#77798C', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 9 },
  retryButton: { marginTop: 16, borderColor: '#9D8DD2', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 3 },
  retryButtonText: { color: '#4C3A8D', fontSize: 13, fontWeight: '700' },
  emptyState: { alignItems: 'center', padding: 32, borderTopWidth: 1, borderColor: '#E5E5EB' },
  emptyTitle: { color: '#46475A', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#7B7D90', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  reviewWorkspace: { flex: 1, backgroundColor: '#F5F5F8' },
  reviewTopBar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#DCDDE5', paddingHorizontal: 18 },
  backToSaved: { color: '#6950B5', fontSize: 14, fontWeight: '700' },
  reviewTopTitle: { color: '#3C3D51', fontSize: 15, fontWeight: '700' },
  reviewTopSpacer: { width: 85 },
});
