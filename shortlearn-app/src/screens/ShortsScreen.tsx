import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LanguageReactorOverlay, SubtitleCue } from '../components/LanguageReactorOverlay';
import { ShortVideoWebView } from '../components/ShortVideoWebView';
import { LearningDisplayPreferences } from '../services/learningPreferences';
import { VideoPlatform } from '../services/videoPlatform';
import { colors, radii, spacing } from '../styles/theme';
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
  onSaveWord: () => void | Promise<void>;
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
  onSaveWord,
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
    <View style={styles.shortsViewport}>
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
  </View>
);

const styles = StyleSheet.create({
  learningView: { flex: 1 },
  hiddenView: { display: 'none' },
  shortsViewport: { flex: 1, minHeight: 520 },
  videoContainer: { flex: 1, position: 'relative', backgroundColor: '#05070C' },

  subtitleDock: {
    height: 190, backgroundColor: colors.surface, borderTopWidth: 1,
    borderTopColor: 'rgba(168,85,247,0.46)', shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.38, shadowRadius: 12, elevation: 14,
  },
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
