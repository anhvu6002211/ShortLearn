import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { LearningDisplayPreferences } from '../services/learningPreferences';
import { LearningDisplaySettings } from '../components/LearningDisplaySettings';
import { colors, radii, spacing, touchTarget, typography } from '../styles/theme';

interface SettingsScreenProps {
  preferences: LearningDisplayPreferences;
  onChange: (patch: Partial<LearningDisplayPreferences>) => void;
  autoPauseEnabled: boolean;
  onToggleAutoPause: () => void;
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  preferences,
  onChange,
  autoPauseEnabled,
  onToggleAutoPause,
  onBack,
}) => (
  <ScrollView contentContainerStyle={styles.screen}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Quay lại Cá nhân" onPress={onBack} style={styles.back}>
      <Text style={styles.backText}>‹</Text><Text style={styles.backLabel}>Cá nhân</Text>
    </TouchableOpacity>

    <View style={styles.hero}>
      <View style={styles.heroIcon}><Text style={styles.heroGlyph}>⚙</Text></View>
      <View style={styles.heroCopy}>
        <Text style={styles.eyebrow}>LANGUAGE REACTOR</Text>
        <Text style={styles.title}>Trải nghiệm học</Text>
        <Text style={styles.copy}>Điều chỉnh phụ đề và trình phát. Các thay đổi được lưu trên thiết bị này.</Text>
      </View>
    </View>

    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>TRÌNH PHÁT</Text><Text style={styles.sectionMeta}>Video Shorts</Text></View>
    <View style={styles.group}>
      <View style={styles.settingRow}>
        <View style={[styles.settingIcon, styles.settingIconSky]}><Text style={styles.settingGlyph}>Ⅱ</Text></View>
        <View style={styles.rowCopy}><Text style={styles.cardTitle}>Tự động dừng khi hết câu</Text><Text style={styles.cardCopy}>Dừng video để kịp đọc và phân tích từ mới.</Text></View>
        <Switch
          accessibilityLabel="Tự động dừng khi hết câu"
          accessibilityRole="switch"
          value={autoPauseEnabled}
          onValueChange={onToggleAutoPause}
          trackColor={{ false: colors.surfaceOverlay, true: colors.primary }}
          thumbColor={colors.text}
        />
      </View>
    </View>

    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>PHỤ ĐỀ & TỪ VỰNG</Text><Text style={styles.sectionMeta}>Cá nhân hóa</Text></View>
    <LearningDisplaySettings preferences={preferences} onChange={onChange} />

    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>RIÊNG TƯ</Text></View>
    <View style={styles.group}>
      <View style={styles.settingRow}>
        <View style={[styles.settingIcon, styles.settingIconPurple]}><Text style={styles.settingGlyph}>⌁</Text></View>
        <View style={styles.rowCopy}><Text style={styles.cardTitle}>Dữ liệu học tập</Text><Text style={styles.cardCopy}>Dữ liệu được quản lý theo phiên đăng nhập trên thiết bị này.</Text></View>
      </View>
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: colors.canvas, padding: spacing.lg, paddingBottom: 34 },
  back: { minHeight: touchTarget, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingRight: 14 },
  backText: { color: colors.primaryLight, fontSize: 32, lineHeight: 32, marginRight: 6 },
  backLabel: { color: colors.text, fontSize: typography.bodyMedium, fontWeight: '800' },
  hero: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 14, marginBottom: 26 },
  heroIcon: { width: 52, height: 52, borderRadius: radii.xl, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  heroGlyph: { color: colors.primaryLight, fontSize: 23, fontWeight: '900' },
  heroCopy: { flex: 1 },
  eyebrow: { color: colors.primaryLight, fontSize: 10, letterSpacing: 1.2, fontWeight: '900' },
  title: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: '900', marginTop: 3 },
  copy: { color: colors.textMuted, fontSize: typography.bodySmall, lineHeight: 19, marginTop: 5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, marginTop: 20, paddingHorizontal: 3 },
  sectionTitle: { color: colors.textMuted, fontSize: typography.label, letterSpacing: 1.05, fontWeight: '900' },
  sectionMeta: { color: colors.textSubdued, fontSize: typography.label, fontWeight: '600' },
  group: { borderRadius: 18, backgroundColor: colors.surface, padding: 7, borderWidth: 1, borderColor: colors.border },
  settingRow: { minHeight: 80, padding: 10, flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, backgroundColor: colors.surfaceElevated },
  settingIcon: { width: 36, height: 36, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  settingIconSky: { backgroundColor: 'rgba(56,189,248,0.15)' },
  settingIconPurple: { backgroundColor: 'rgba(168,85,247,0.14)' },
  settingGlyph: { color: colors.primaryLight, fontSize: 18, fontWeight: '900' },
  rowCopy: { flex: 1, paddingRight: 10 },
  cardTitle: { color: colors.text, fontSize: typography.bodyMedium, fontWeight: '800' },
  cardCopy: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
});
