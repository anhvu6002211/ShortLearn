import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radii, touchTarget, typography } from '../styles/theme';
import { CARD_LABEL_COLORS, WordLearningState } from '../types/learning';

export interface SubtitleCue {
  cue_index?: number;
  start_time: number;
  end_time: number;
  en_text: string;
  vi_text: string;
}

interface LanguageReactorOverlayProps {
  currentCue: SubtitleCue | null;
  onWordPress: (word: string, contextSentence: string) => void;
  onReplayCue: () => void;
  onNextCue: () => void;
  onNextShort?: () => void;
  onPrevShort?: () => void;
  autoPauseEnabled: boolean;
  onToggleAutoPause: () => void;
  selectedWord?: string;
  wordMeaning?: string;
  wordLookupVisible?: boolean;
  wordLookupLoading?: boolean;
  wordSaving?: boolean;
  onCloseWordLookup?: () => void;
  onSaveWord?: () => void;
  wordLearningStates?: Record<string, WordLearningState>;
  colorizeByLearningStage?: boolean;
  showCardLabelUnderlines?: boolean;
  onWordLongPress?: (word: string, contextSentence: string) => void;
}

export const LanguageReactorOverlay: React.FC<LanguageReactorOverlayProps> = ({
  currentCue,
  onWordPress,
  onReplayCue,
  onNextCue,
  onNextShort,
  onPrevShort,
  autoPauseEnabled,
  onToggleAutoPause,
  selectedWord = '',
  wordMeaning = '',
  wordLookupVisible = false,
  wordLookupLoading = false,
  wordSaving = false,
  onCloseWordLookup,
  onSaveWord,
  wordLearningStates = {},
  colorizeByLearningStage = true,
  showCardLabelUnderlines = true,
  onWordLongPress,
}) => {
  if (!currentCue) {
    return (
      <View style={styles.emptyStrip}>
        <View style={styles.emptyHeader}>
          <Text style={styles.emptyIcon}>🎧</Text>
          <Text style={styles.emptyText}>Đang lắng nghe lời thoại video...</Text>
        </View>
        <View style={styles.controlBar}>
          {onPrevShort && (
            <TouchableOpacity style={styles.ctrlBtn} onPress={onPrevShort}>
              <Text style={styles.ctrlBtnText}>⏮ Short trước</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.ctrlBtn, autoPauseEnabled && styles.ctrlBtnActive]}
            onPress={onToggleAutoPause}
          >
            <Text style={[styles.ctrlBtnText, autoPauseEnabled && styles.ctrlBtnActiveText]}>
              ⏸ Auto-Pause: {autoPauseEnabled ? 'BẬT' : 'TẮT'}
            </Text>
          </TouchableOpacity>
          {onNextShort && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Short tiếp" style={[styles.ctrlBtn, styles.ctrlBtnHighlight]} onPress={onNextShort}>
              <Text style={styles.ctrlBtnHighlightText}>Short tiếp ⏭</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const words = currentCue.en_text.trim().split(/\s+/).filter(Boolean);

  return (
    <View style={styles.mainStrip}>
      <ScrollView
        style={styles.sentenceScroll}
        contentContainerStyle={styles.wordsRow}
        showsVerticalScrollIndicator={false}
      >
        {words.map((chunk, index) => {
          const cleanWord = chunk.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
          if (!cleanWord) {
            return <Text key={`punct-${index}`} style={styles.punctText}>{chunk}</Text>;
          }

          const normalizedWord = cleanWord.toLocaleLowerCase();
          const learningState = wordLearningStates[normalizedWord];
          const isSelected = selectedWord.toLocaleLowerCase() === normalizedWord && wordLookupVisible;
          const underlineColor = learningState?.cardLabel
            ? CARD_LABEL_COLORS[learningState.cardLabel]
            : 'transparent';
          return (
            <TouchableOpacity
              key={`word-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Tra từ ${cleanWord}`}
              activeOpacity={0.55}
              onPress={() => onWordPress(cleanWord, currentCue.en_text)}
              onLongPress={() => onWordLongPress?.(cleanWord, currentCue.en_text)}
              delayLongPress={350}
              style={[
                styles.wordToken,
                isSelected && styles.wordTokenSelected,
                showCardLabelUnderlines && learningState?.cardLabel && {
                  borderBottomColor: underlineColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.wordText,
                  colorizeByLearningStage && learningState?.learningStage === 'learning' && styles.wordLearning,
                  colorizeByLearningStage && learningState?.learningStage === 'later' && styles.wordLater,
                ]}
              >
                {chunk}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.translationText} numberOfLines={2}>
        {currentCue.vi_text}
      </Text>

      <View style={styles.controlBar}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Phát lại câu" style={styles.ctrlBtn} onPress={onReplayCue}>
          <Text style={styles.ctrlBtnText}>↻ Lại câu</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="switch"
          accessibilityLabel="Tự động dừng sau mỗi câu"
          accessibilityState={{ checked: autoPauseEnabled }}
          style={[styles.ctrlBtn, autoPauseEnabled && styles.ctrlBtnActive]}
          onPress={onToggleAutoPause}
        >
          <Text style={[styles.ctrlBtnText, autoPauseEnabled && styles.ctrlBtnActiveText]}>
            ⏸ Pause: {autoPauseEnabled ? 'BẬT' : 'TẮT'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Câu tiếp" style={styles.ctrlBtn} onPress={onNextCue}>
          <Text style={styles.ctrlBtnText}>Câu tiếp ❯</Text>
        </TouchableOpacity>

        {onNextShort && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Short tiếp" style={[styles.ctrlBtn, styles.ctrlBtnHighlight]} onPress={onNextShort}>
            <Text style={styles.ctrlBtnHighlightText}>Short ❯❯</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={wordLookupVisible}
        onRequestClose={onCloseWordLookup}
      >
        <View style={styles.sheetRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng cửa sổ tra từ" style={styles.sheetBackdrop} onPress={onCloseWordLookup} />
          <View style={styles.wordSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>TRA TỪ TRONG NGỮ CẢNH</Text>
                <Text style={styles.sheetWord} numberOfLines={1}>{selectedWord}</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đóng cửa sổ tra từ" style={styles.sheetCloseButton} onPress={onCloseWordLookup}>
                <Text style={styles.sheetCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sheetMeaningCard}>
              <Text style={styles.sheetMeaningLabel}>NGHĨA TIẾNG VIỆT</Text>
              {wordLookupLoading ? (
                <ActivityIndicator size="small" color="#38BDF8" style={styles.sheetLoader} />
              ) : (
                <Text style={styles.sheetMeaning}>{wordMeaning || 'Đang tra nghĩa...'}</Text>
              )}
            </View>
            <View style={styles.sheetContextCard}>
              <Text style={styles.sheetContextLabel}>CÂU GỐC</Text>
              <Text style={styles.sheetContext} numberOfLines={2}>{currentCue?.en_text}</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Lưu từ vào flashcard"
              style={[styles.sheetSaveButton, (wordSaving || wordLookupLoading) && styles.sheetSaveDisabled]}
              onPress={onSaveWord}
              disabled={wordSaving || wordLookupLoading}
            >
              {wordSaving ? <ActivityIndicator size="small" color="#052E24" /> : <Text style={styles.sheetSaveText}>Lưu Flashcard</Text>}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Để sau" style={styles.sheetCancelButton} onPress={onCloseWordLookup}>
              <Text style={styles.sheetCancelText}>Để sau</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  mainStrip: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 9, justifyContent: 'space-between' },
  emptyStrip: { flex: 1, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  emptyHeader: { alignItems: 'center', marginBottom: 12 },
  emptyIcon: { fontSize: 22, marginBottom: 4 },
  emptyText: { color: colors.textMuted, fontSize: typography.bodySmall, fontWeight: '500', textAlign: 'center' },
  sentenceScroll: { maxHeight: 76, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  wordsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center', paddingBottom: 7 },
  wordToken: { marginRight: 3, marginBottom: 4, paddingHorizontal: 2, paddingVertical: 1, borderRadius: radii.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  wordTokenSelected: { backgroundColor: 'rgba(168,85,247,0.25)' },
  wordText: { color: colors.text, fontSize: typography.bodyLarge, lineHeight: 21, fontWeight: '700' },
  wordLearning: { color: colors.vietnamese },
  wordLater: { color: colors.textSubdued },
  punctText: { color: colors.textMuted, fontSize: typography.bodyLarge, lineHeight: 21, marginRight: 3, marginBottom: 4 },
  translationText: { color: colors.vietnamese, fontSize: typography.bodyMedium, lineHeight: 19, fontWeight: '600', textAlign: 'left', marginVertical: 4 },
  controlBar: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong, paddingTop: 6, alignItems: 'center' },
  ctrlBtn: { minHeight: touchTarget, paddingVertical: 6, paddingHorizontal: 9, borderRadius: radii.lg, backgroundColor: colors.surfaceOverlay, borderWidth: 1, borderColor: colors.border },
  ctrlBtnActive: { backgroundColor: 'rgba(56,189,248,0.14)', borderColor: colors.primary, borderWidth: 1 },
  ctrlBtnText: { color: colors.textMuted, fontSize: typography.label, fontWeight: '700' },
  ctrlBtnActiveText: { color: colors.primaryLight, fontWeight: '800' },
  ctrlBtnHighlight: { backgroundColor: 'rgba(168,85,247,0.15)', borderColor: 'rgba(168,85,247,0.65)', borderWidth: 1 },
  ctrlBtnHighlightText: { color: '#D8B4FE', fontSize: typography.label, fontWeight: '800' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,23,0.72)' },
  wordSheet: { backgroundColor: colors.surfaceOverlay, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.borderStrong, paddingHorizontal: 20, paddingBottom: 28 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.textSubdued, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetEyebrow: { color: colors.primary, fontSize: 10, letterSpacing: 1.35, fontWeight: '900' },
  sheetWord: { color: colors.text, fontSize: 29, fontWeight: '900', marginTop: 4, maxWidth: 250 },
  sheetCloseButton: { minWidth: touchTarget, minHeight: touchTarget, borderRadius: radii.pill, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { color: colors.textMuted, fontSize: 25, lineHeight: 28 },
  sheetMeaningCard: { marginTop: 20, padding: 16, borderRadius: radii.xl, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)' },
  sheetMeaningLabel: { color: '#C084FC', fontSize: 10, fontWeight: '900', letterSpacing: 1.15 },
  sheetLoader: { marginVertical: 16 },
  sheetMeaning: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 26, marginTop: 6 },
  sheetContextCard: { marginTop: 10, paddingHorizontal: 4 },
  sheetContextLabel: { color: colors.textSubdued, fontSize: 10, fontWeight: '900', letterSpacing: 1.15 },
  sheetContext: { color: colors.textMuted, fontSize: typography.bodyMedium, lineHeight: 21, marginTop: 5, fontStyle: 'italic' },
  sheetSaveButton: { minHeight: 52, borderRadius: radii.lg, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  sheetSaveDisabled: { opacity: 0.55 },
  sheetSaveText: { color: '#052E24', fontSize: 15, fontWeight: '900' },
  sheetCancelButton: { minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  sheetCancelText: { color: colors.textMuted, fontSize: typography.bodyMedium, fontWeight: '800' },
});
