import React from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { WebView } from 'react-native-webview';
import { LanguageReactorOverlay, SubtitleCue } from '../components/LanguageReactorOverlay';
import { ShortVideoWebView } from '../components/ShortVideoWebView';
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateViews';
import { TranscriptCueRow } from '../components/TranscriptCueRow';
import { LearningDisplayPreferences } from '../services/learningPreferences';
import { VideoPlatform } from '../services/videoPlatform';
import { colors, radii, spacing, typography } from '../styles/theme';
import { WordLearningState } from '../types/learning';

interface ShortsScreenProps {
  activeCue: SubtitleCue | null;
  autoPauseEnabled: boolean;
  currentPlatform: VideoPlatform;
  handleWebViewLoadEnd: () => void;
  handleWebViewMessage: (event: any) => void;
  hasNoCaptions: boolean;
  injectedScript: string;
  isSavingWord: boolean;
  isTranslatingWord: boolean;
  isVisible: boolean;
  learningDisplayPreferences: LearningDisplayPreferences;
  loading: boolean;
  subtitleError: string | null;
  selectedWord: string;
  shortsViewportHeight: number;
  subtitles: SubtitleCue[];
  transcriptListRef: React.RefObject<FlashListRef<SubtitleCue> | null>;
  uri: string;
  webViewRef: React.RefObject<WebView | null>;
  wordLearningStates: Record<string, WordLearningState>;
  wordLookupVisible: boolean;
  wordMeaning: string;
  onCloseWordLookup: () => void;
  onNextCue: () => void;
  onNextShort: () => void;
  onPrevShort: () => void;
  onReplayCue: () => void;
  onRetrySubtitles: () => void;
  onSaveWord: () => void | Promise<void>;
  onTranscriptCuePress: (cue: SubtitleCue) => void;
  onTranscriptScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onTranscriptScrollBegin: () => void;
  onToggleAutoPause: () => void;
  onViewportHeightChange: (height: number) => void;
  onWordLongPress?: (word: string, contextSentence: string) => void;
  onWordPress: (word: string, contextSentence: string) => void;
}

export const ShortsScreen: React.FC<ShortsScreenProps> = ({
  activeCue,
  autoPauseEnabled,
  currentPlatform,
  handleWebViewLoadEnd,
  handleWebViewMessage,
  hasNoCaptions,
  injectedScript,
  isSavingWord,
  isTranslatingWord,
  isVisible,
  learningDisplayPreferences,
  loading,
  subtitleError,
  selectedWord,
  shortsViewportHeight,
  subtitles,
  transcriptListRef,
  uri,
  webViewRef,
  wordLearningStates,
  wordLookupVisible,
  wordMeaning,
  onCloseWordLookup,
  onNextCue,
  onNextShort,
  onPrevShort,
  onReplayCue,
  onRetrySubtitles,
  onSaveWord,
  onTranscriptCuePress,
  onTranscriptScroll,
  onTranscriptScrollBegin,
  onToggleAutoPause,
  onViewportHeightChange,
  onWordLongPress,
  onWordPress,
}) => (
  <View
    style={[styles.learningView, !isVisible && styles.hiddenView]}
    onLayout={(event) => {
      const nextHeight = Math.round(event.nativeEvent.layout.height);
      if (nextHeight > 0 && nextHeight !== shortsViewportHeight) {
        onViewportHeightChange(nextHeight);
      }
    }}
  >
    <FlashList
      ref={transcriptListRef}
      style={styles.learningScroll}
      contentContainerStyle={styles.learningScrollContent}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      data={subtitles}
      extraData={activeCue?.start_time}
      keyExtractor={(item, index) => `${item.cue_index ?? index}-${item.start_time}`}
      maintainVisibleContentPosition={{ disabled: true }}
      drawDistance={420}
      onScroll={onTranscriptScroll}
      onScrollBeginDrag={onTranscriptScrollBegin}
      scrollEventThrottle={32}
      ListHeaderComponent={(
        <>
          <View style={[
            styles.shortsViewport,
            shortsViewportHeight > 0 && { height: shortsViewportHeight },
          ]}>
            <View style={styles.videoContainer}>
              <ShortVideoWebView
                key={currentPlatform}
                platform={currentPlatform}
                uri={uri}
                injectedScript={injectedScript}
                webViewRef={webViewRef}
                onLoadEnd={handleWebViewLoadEnd}
                onMessage={handleWebViewMessage}
              />


              {loading && (
                <View style={styles.statusBadge} pointerEvents="none">
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.statusText}>Đang nạp phụ đề song ngữ...</Text>
                </View>
              )}

              {hasNoCaptions && (
                <View style={styles.noCaptionBadge} pointerEvents="none">
                  <Text style={styles.noCaptionText}>ℹ️ Video không có phụ đề • Vuốt tiếp để học</Text>
                </View>
              )}
            </View>

            <View style={styles.subtitleDock}>
              <LanguageReactorOverlay
                currentCue={activeCue}
                onWordPress={onWordPress}
                onReplayCue={onReplayCue}
                onNextCue={onNextCue}
                onNextShort={onNextShort}
                onPrevShort={onPrevShort}
                autoPauseEnabled={autoPauseEnabled}
                onToggleAutoPause={onToggleAutoPause}
                selectedWord={selectedWord}
                wordMeaning={wordMeaning}
                wordLookupVisible={wordLookupVisible}
                wordLookupLoading={isTranslatingWord}
                wordSaving={isSavingWord}
                onCloseWordLookup={onCloseWordLookup}
                onSaveWord={onSaveWord}
                wordLearningStates={wordLearningStates}
                colorizeByLearningStage={learningDisplayPreferences.colorizeByLearningStage}
                showCardLabelUnderlines={learningDisplayPreferences.showCardLabelUnderlines}
                onWordLongPress={onWordLongPress}
              />
            </View>
          </View>

          <View style={styles.transcriptPanel}>
            <View style={styles.transcriptHeader}>
              <Text style={styles.transcriptTitle}>Bản chép lời</Text>
              <Text style={styles.transcriptSource}>
                {currentPlatform === 'youtube' ? 'YOUTUBE' : 'TIKTOK'}
              </Text>
            </View>
          </View>
        </>
      )}
      renderItem={({ item, index }) => (
        <TranscriptCueRow
          cue={item}
          isActive={activeCue?.start_time === item.start_time}
          isLast={index === subtitles.length - 1}
          onPress={onTranscriptCuePress}
        />
      )}
      ListEmptyComponent={(
        <View style={styles.transcriptEmptyVirtual}>
          {loading ? (
            <LoadingState message="AI đang xử lý phụ đề..." />
          ) : subtitleError ? (
            <ErrorState
              title="Chưa tải được phụ đề"
              message={subtitleError}
              onRetry={onRetrySubtitles}
            />
          ) : (
            <EmptyState
              title={hasNoCaptions ? 'Video chưa có bản chép lời' : 'Đang chờ video bắt đầu'}
              message={hasNoCaptions
                ? 'Video không có phụ đề khả dụng. Vuốt sang video khác để tiếp tục học.'
                : 'Bản chép lời sẽ xuất hiện khi video bắt đầu.'}
            />
          )}
        </View>
      )}
      ListFooterComponent={<View style={styles.transcriptFooter} />}
    />
  </View>
);

const styles = StyleSheet.create({
  learningView: { flex: 1 },
  hiddenView: { display: 'none' },
  learningScroll: { flex: 1 },
  learningScrollContent: { backgroundColor: colors.canvas, paddingBottom: spacing.lg },
  shortsViewport: { minHeight: 520 },
  videoContainer: { flex: 1, position: 'relative', backgroundColor: '#05070C' },

  subtitleDock: {
    height: 190, backgroundColor: colors.surface, borderTopWidth: 1,
    borderTopColor: 'rgba(168,85,247,0.46)', shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.38, shadowRadius: 12, elevation: 14,
  },
  transcriptPanel: {
    minHeight: 44, marginHorizontal: spacing.md, marginTop: 10, marginBottom: 0,
    backgroundColor: colors.surface, borderWidth: 1, borderBottomWidth: 0,
    borderColor: colors.border, borderRadius: radii.lg, borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0, overflow: 'hidden',
  },
  transcriptHeader: {
    height: 41, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.borderStrong,
  },
  transcriptTitle: { color: colors.text, fontSize: typography.bodySmall, fontWeight: '800' },
  transcriptSource: { color: colors.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 2 },
  transcriptEmptyVirtual: {
    minHeight: 176, marginHorizontal: spacing.sm, marginBottom: 4, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: spacing.xl, backgroundColor: colors.canvas,
    borderWidth: 1, borderTopWidth: 0, borderColor: colors.borderStrong,
    borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg,
  },
  transcriptEmptyText: { color: colors.textSubdued, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.sm },
  transcriptFooter: { height: spacing.sm },
  statusBadge: {
    position: 'absolute', top: 72, right: spacing.lg, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.88)', paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radii.pill, zIndex: 10000, borderWidth: 1, borderColor: colors.primaryBorder,
  },
  statusText: { color: colors.primary, fontSize: 12, marginLeft: 6, fontWeight: '600' },
  noCaptionBadge: {
    position: 'absolute', top: 72, alignSelf: 'center', backgroundColor: 'rgba(9,13,22,0.88)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.pill, zIndex: 10000,
  },
  noCaptionText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
});
