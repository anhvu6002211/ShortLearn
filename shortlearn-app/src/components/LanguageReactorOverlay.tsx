import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
          <Text style={styles.emptyText}>Language Reactor • Đang lắng nghe lời thoại video...</Text>
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
            <TouchableOpacity style={[styles.ctrlBtn, styles.ctrlBtnHighlight]} onPress={onNextShort}>
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
        <TouchableOpacity style={styles.ctrlBtn} onPress={onReplayCue}>
          <Text style={styles.ctrlBtnText}>↻ Lại câu</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctrlBtn, autoPauseEnabled && styles.ctrlBtnActive]}
          onPress={onToggleAutoPause}
        >
          <Text style={[styles.ctrlBtnText, autoPauseEnabled && styles.ctrlBtnActiveText]}>
            ⏸ Pause: {autoPauseEnabled ? 'BẬT' : 'TẮT'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={onNextCue}>
          <Text style={styles.ctrlBtnText}>Câu tiếp ❯</Text>
        </TouchableOpacity>

        {onNextShort && (
          <TouchableOpacity style={[styles.ctrlBtn, styles.ctrlBtnHighlight]} onPress={onNextShort}>
            <Text style={styles.ctrlBtnHighlightText}>Short ❯❯</Text>
          </TouchableOpacity>
        )}
      </View>

      {wordLookupVisible && (
        <View style={styles.wordPopover}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Đóng cửa sổ tra từ"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            style={styles.popoverCloseButton}
            onPress={onCloseWordLookup}
          >
            <Text style={styles.popoverCloseText}>×</Text>
          </TouchableOpacity>
          <Text style={styles.popoverWord} numberOfLines={2}>{selectedWord}</Text>
          <View style={styles.popoverDivider} />
          {wordLookupLoading ? (
            <ActivityIndicator size="small" color="#72F5C5" style={styles.popoverLoader} />
          ) : (
            <Text style={styles.popoverMeaning} numberOfLines={4}>
              {wordMeaning || 'Đang tra nghĩa...'}
            </Text>
          )}
          <View style={styles.popoverActions}>
            <TouchableOpacity
              accessibilityLabel="Đóng nghĩa từ"
              style={[styles.popoverAction, styles.popoverConfirm]}
              onPress={onCloseWordLookup}
            >
              <Text style={styles.popoverConfirmText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Lưu từ vào flashcard"
              style={[styles.popoverAction, styles.popoverSave]}
              onPress={onSaveWord}
              disabled={wordSaving || wordLookupLoading}
            >
              {wordSaving ? (
                <ActivityIndicator size="small" color="#F5C451" />
              ) : (
                <Text style={styles.popoverSaveText}>▣</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainStrip: {
    flex: 1,
    backgroundColor: '#191B1E',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 7,
    justifyContent: 'space-between',
  },
  emptyStrip: {
    flex: 1,
    backgroundColor: '#191B1E',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  emptyText: {
    color: '#8C929B',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  sentenceScroll: {
    maxHeight: 76,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#393D42',
  },
  wordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingBottom: 7,
  },
  wordToken: {
    marginRight: 3,
    marginBottom: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  wordTokenSelected: {
    backgroundColor: '#4B4E53',
  },
  wordText: {
    color: '#F4F5F7',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '500',
  },
  wordLearning: {
    color: '#FF9D42',
  },
  wordLater: {
    color: '#777C84',
  },
  punctText: {
    color: '#C9CED5',
    fontSize: 16,
    lineHeight: 21,
    marginRight: 3,
    marginBottom: 4,
  },
  translationText: {
    color: '#E7E9ED',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'left',
    marginVertical: 4,
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#393D42',
    paddingTop: 6,
    alignItems: 'center',
  },
  ctrlBtn: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: '#292C31',
  },
  ctrlBtnActive: {
    backgroundColor: 'rgba(88, 243, 192, 0.12)',
    borderColor: '#58F3C0',
    borderWidth: 1,
  },
  ctrlBtnText: {
    color: '#C7CBD1',
    fontSize: 11,
    fontWeight: '600',
  },
  ctrlBtnActiveText: {
    color: '#72F5C5',
    fontWeight: '700',
  },
  ctrlBtnHighlight: {
    backgroundColor: 'rgba(255, 157, 66, 0.12)',
    borderColor: '#FF9D42',
    borderWidth: 1,
  },
  ctrlBtnHighlightText: {
    color: '#FFB46F',
    fontSize: 11,
    fontWeight: '700',
  },
  wordPopover: {
    position: 'absolute',
    top: 4,
    right: 12,
    width: 154,
    minHeight: 132,
    zIndex: 100,
    elevation: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#50545A',
    backgroundColor: '#34373C',
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  popoverWord: {
    alignSelf: 'center',
    maxWidth: '72%',
    color: '#E4DB72',
    backgroundColor: '#484B50',
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  popoverCloseButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#25282D',
    borderWidth: 1,
    borderColor: '#5D6269',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popoverCloseText: {
    color: '#F0F1F3',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
  },
  popoverDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#50545A',
    marginVertical: 7,
  },
  popoverLoader: {
    marginVertical: 12,
  },
  popoverMeaning: {
    color: '#F0F1F3',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    textAlign: 'center',
    minHeight: 42,
  },
  popoverActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  popoverAction: {
    width: 36,
    height: 27,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popoverConfirm: {
    borderWidth: 2,
    borderColor: '#72F5C5',
    backgroundColor: 'rgba(88, 243, 192, 0.12)',
  },
  popoverConfirmText: {
    color: '#E8FFF6',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
  },
  popoverSave: {
    backgroundColor: '#4A4D52',
  },
  popoverSaveText: {
    color: '#F5C451',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
  },
});
