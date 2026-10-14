import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { VideoPlatform, parseVideoTarget } from '../services/videoPlatform';
import { colors, radii, spacing, touchTarget, typography } from '../styles/theme';

interface ExploreScreenProps {
  onOpenTarget: (url: string, platform: VideoPlatform) => void;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({ onOpenTarget }) => {
  const [url, setUrl] = useState('');
  const platform: VideoPlatform = 'youtube';
  const [error, setError] = useState<string | null>(null);
  const open = () => {
    if (!parseVideoTarget(url, platform)) {
      setError('Dán liên kết YouTube Shorts hợp lệ.');
      return;
    }
    setError(null);
    onOpenTarget(url, platform);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.heroGlow} />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>KHÁM PHÁ VIDEO</Text>
        <Text style={styles.title}>Biến video ngắn{`\n`}thành bài học.</Text>
        <Text style={styles.copy}>Dán một liên kết để mở video, theo dõi phụ đề song ngữ và lưu từ mới.</Text>
      </View>

      <View style={styles.linkCard}>
        <Text style={styles.cardLabel}>NGUỒN VIDEO</Text>
        <Text style={styles.hint}>YouTube Shorts</Text>

        <Text style={styles.inputLabel}>LIÊN KẾT VIDEO</Text>
        <TextInput
          accessibilityLabel="Liên kết video"
          accessibilityHint="Dán liên kết YouTube Shorts công khai"
          value={url}
          onChangeText={(value) => { setUrl(value); if (error) setError(null); }}
          onSubmitEditing={open}
          returnKeyType="go"
          placeholder="https://youtube.com/shorts/..."
          placeholderTextColor={colors.textSubdued}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[styles.input, error && styles.inputError]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.hint}>Chỉ dùng liên kết công khai của video.</Text>}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mở video để học" onPress={open} style={styles.openButton}>
          <Text style={styles.openText}>Mở video để học</Text>
          <Text style={styles.openArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipIcon}>✦</Text>
        <View style={styles.tipCopy}>
          <Text style={styles.tipTitle}>Học theo nhịp của bạn</Text>
          <Text style={styles.tipText}>Chạm vào từ bất kỳ trong phụ đề để xem nghĩa và lưu thành thẻ ôn tập.</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, padding: spacing.xl, justifyContent: 'center', overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(56,189,248,0.08)', top: -120, right: -140 },
  hero: { marginBottom: 30 },
  eyebrow: { color: colors.primary, fontWeight: '900', fontSize: typography.label, letterSpacing: 1.8 },
  title: { color: colors.text, fontSize: 31, fontWeight: '900', lineHeight: 38, marginTop: 10, letterSpacing: -0.6 },
  copy: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: spacing.md, maxWidth: 330 },
  linkCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 22, padding: 18, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, elevation: 6 },
  cardLabel: { color: colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 1.4, marginBottom: 10 },
  switcher: { flexDirection: 'row', gap: 9, marginBottom: 20 },
  platform: { flex: 1, minHeight: touchTarget, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderStrong, flexDirection: 'row', gap: 7, backgroundColor: colors.surfaceElevated },
  youtubeActive: { backgroundColor: 'rgba(239,68,68,0.11)', borderColor: 'rgba(239,68,68,0.75)' },
  tiktokActive: { backgroundColor: 'rgba(37,244,238,0.08)', borderColor: 'rgba(37,244,238,0.70)' },
  platformGlyph: { fontSize: 15, fontWeight: '900' },
  youtubeGlyph: { color: colors.error },
  tiktokGlyph: { color: '#25F4EE', fontSize: 20 },
  platformText: { color: colors.textMuted, fontWeight: '800', fontSize: 12 },
  platformTextActive: { color: colors.text },
  inputLabel: { color: colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 1.4, marginBottom: spacing.sm },
  input: { minHeight: 54, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.canvas, color: colors.text, paddingHorizontal: 14, fontSize: typography.bodyMedium },
  inputError: { borderColor: colors.error },
  hint: { color: colors.textSubdued, marginTop: 9, fontSize: 12 },
  error: { color: '#FCA5A5', marginTop: 9, fontSize: 12, fontWeight: '700' },
  openButton: { minHeight: 54, backgroundColor: colors.primary, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', marginTop: 18, flexDirection: 'row', gap: 10 },
  openText: { color: '#082F49', fontSize: 15, fontWeight: '900' },
  openArrow: { color: '#082F49', fontSize: 20, fontWeight: '900', marginTop: -2 },
  tipCard: { flexDirection: 'row', marginTop: 20, padding: 15, borderRadius: radii.xl, backgroundColor: 'rgba(168,85,247,0.08)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.18)' },
  tipIcon: { color: '#C084FC', fontSize: 18, marginRight: 11, marginTop: 1 },
  tipCopy: { flex: 1 },
  tipTitle: { color: '#E9D5FF', fontSize: typography.bodySmall, fontWeight: '900' },
  tipText: { color: '#A78BBA', fontSize: 12, lineHeight: 18, marginTop: 3 },
});
