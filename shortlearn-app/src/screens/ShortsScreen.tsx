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
import { EmptyState, LoadingState } from '../components/common/StateViews';
import { TranscriptCueRow } from '../components/TranscriptCueRow';
import { LearningDisplayPreferences } from '../services/learningPreferences';
import { VideoPlatform } from '../services/videoPlatform';
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
  onOpenShortPicker: () => void;
  onPrevShort: () => void;
  onReplayCue: () => void;
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
  onOpenShortPicker,
  onPrevShort,
  onReplayCue,
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

              <View style={styles.videoTopBar}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Mở video ${currentPlatform === 'youtube' ? 'YouTube' : 'TikTok'} từ liên kết`}
                  style={styles.openShortButton}
                  onPress={onOpenShortPicker}
                >
                  <Text style={styles.openShortButtonText}>＋</Text>
                </TouchableOpacity>
              </View>

              {loading && (
                <View style={styles.statusBadge} pointerEvents="none">
                  <ActivityIndicator size="small" color="#38BDF8" />
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
            <LoadingState message="Đang tạo bản chép lời..." />
          ) : (
            <EmptyState
              title={hasNoCaptions ? 'Video chưa có bản chép lời' : 'Đang chờ video bắt đầu'}
              message={hasNoCaptions
                ? 'Vuốt sang video khác để tiếp tục học.'
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
  learningScrollContent: { backgroundColor: '#000000', paddingBottom: 12 },
  shortsViewport: { minHeight: 520 },
  videoContainer: { flex: 1, position: 'relative', backgroundColor: '#000000' },
  videoTopBar: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    zIndex: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  openShortButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 7,
  },
  openShortButtonText: { color: '#082F49', fontSize: 27, fontWeight: '500', lineHeight: 29 },
  subtitleDock: {
    height: 190,
    backgroundColor: '#0F172A',
    borderTopWidth: 2,
    borderTopColor: 'rgba(56, 189, 248, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 12,
  },
  transcriptPanel: {
    minHeight: 41,
    marginHorizontal: 8,
    marginTop: 6,
    marginBottom: 0,
    backgroundColor: '#050B13',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#334155',
    borderRadius: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  transcriptHeader: {
    height: 41,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  transcriptTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '800' },
  transcriptSource: { color: '#94A3B8', fontSize: 8, fontWeight: '800', letterSpacing: 2 },
  transcriptEmptyVirtual: {
    minHeight: 176,
    marginHorizontal: 8,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#050B13',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#334155',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  transcriptEmptyText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
  transcriptFooter: { height: 8 },
  statusBadge: {
    position: 'absolute',
    top: 72,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10000,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  statusText: { color: '#38BDF8', fontSize: 12, marginLeft: 6, fontWeight: '600' },
  noCaptionBadge: {
    position: 'absolute',
    top: 72,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10000,
  },
  noCaptionText: { color: '#94A3B8', fontSize: 12, fontWeight: '500' },
});
