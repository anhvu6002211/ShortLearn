import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SubtitleCue } from './LanguageReactorOverlay';

interface TranscriptCueRowProps {
  cue: SubtitleCue;
  isActive: boolean;
  isLast: boolean;
  onPress: (cue: SubtitleCue) => void;
}

const formatTranscriptTime = (seconds: number): string => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

export const TranscriptCueRow = React.memo<TranscriptCueRowProps>(({
  cue,
  isActive,
  isLast,
  onPress,
}) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={`Tua đến ${formatTranscriptTime(cue.start_time)}: ${cue.en_text}`}
    activeOpacity={0.72}
    onPress={() => onPress(cue)}
    style={[
      styles.row,
      isActive && styles.rowActive,
      isLast && styles.rowLast,
    ]}
  >
    <Text style={[styles.time, isActive && styles.timeActive]}>
      {formatTranscriptTime(cue.start_time)}
    </Text>
    <View style={styles.copy}>
      <Text style={[styles.english, isActive && styles.englishActive]}>
        {cue.en_text}
      </Text>
      <Text style={[styles.vietnamese, isActive && styles.vietnameseActive]}>
        {cue.vi_text || 'Đang dịch...'}
      </Text>
    </View>
    {isActive && <Text style={styles.play}>▶</Text>}
  </TouchableOpacity>
));

TranscriptCueRow.displayName = 'TranscriptCueRow';

const styles = StyleSheet.create({
  row: {
    minHeight: 62,
    marginHorizontal: 8,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#050B13',
    borderLeftWidth: 2,
    borderLeftColor: '#334155',
    borderRightWidth: 1,
    borderRightColor: '#334155',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.10)',
  },
  rowActive: { backgroundColor: '#0A1826', borderLeftColor: '#38BDF8' },
  rowLast: {
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
  },
  time: {
    width: 42,
    paddingTop: 2,
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timeActive: { color: '#38BDF8' },
  copy: { flex: 1, paddingRight: 7 },
  english: { color: '#E2E8F0', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  englishActive: { color: '#FFFFFF' },
  vietnamese: { color: '#94A3B8', fontSize: 11, lineHeight: 16, marginTop: 5 },
  vietnameseActive: { color: '#CBD5E1' },
  play: { width: 16, color: '#38BDF8', fontSize: 11, lineHeight: 17, textAlign: 'right' },
});
