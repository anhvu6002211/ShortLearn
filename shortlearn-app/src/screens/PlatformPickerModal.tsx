import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { VideoPlatform } from '../services/videoPlatform';

interface PlatformPickerProps {
  visible: boolean;
  currentPlatform: VideoPlatform;
  onClose: () => void;
  onSelectPlatform: (platform: VideoPlatform) => void;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#070A12',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  glowTop: {
    position: 'absolute', top: -160, left: -100, width: 360, height: 360,
    borderRadius: 180, backgroundColor: 'rgba(168,85,247,0.20)',
  },
  glowBottom: {
    position: 'absolute', right: -120, bottom: -150, width: 380, height: 380,
    borderRadius: 190, backgroundColor: 'rgba(37,244,238,0.12)',
  },
  card: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  eyebrow: {
    color: '#25F4EE', fontSize: 12, fontWeight: '900', letterSpacing: 2.4,
    marginBottom: 10,
  },
  title: { color: '#F8FAFC', fontSize: 30, lineHeight: 36, fontWeight: '900', textAlign: 'center' },
  description: { color: '#94A3B8', fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
  row: { gap: 16 },
  option: {
    minHeight: 190,
    backgroundColor: 'rgba(30,41,59,0.82)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionYouTubeActive: { borderColor: '#FF335F', backgroundColor: 'rgba(255,0,51,0.12)' },
  optionTikTokActive: { borderColor: '#25F4EE', backgroundColor: 'rgba(37,244,238,0.10)' },
  logo: {
    width: 104, height: 104, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    marginRight: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
  youtubeLogo: { backgroundColor: '#FF0033' },
  tiktokLogo: { backgroundColor: '#050505', borderWidth: 3, borderColor: '#25F4EE' },
  youtubePlayIcon: { color: '#FFFFFF', fontSize: 46 },
  tiktokNoteIcon: { color: '#FFFFFF', fontSize: 48, fontWeight: '900' },
  optionCopy: { flex: 1 },
  optionTitle: { color: '#F8FAFC', fontSize: 25, fontWeight: '900' },
  optionCaption: { color: '#CBD5E1', fontSize: 14, marginTop: 5 },
  optionAction: { color: '#25F4EE', fontSize: 13, fontWeight: '800', marginTop: 14 },
});

export const PlatformPickerModal: React.FC<PlatformPickerProps> = ({
  visible,
  currentPlatform,
  onClose,
  onSelectPlatform,
}) => (
  <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>SHORTLEARN</Text>
          <Text style={styles.title}>Bạn muốn học ở đâu?</Text>
          <Text style={styles.description}>Chọn nền tảng để mở ngay luồng video ngắn.</Text>
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Mở YouTube Shorts"
            style={[styles.option, currentPlatform === 'youtube' && styles.optionYouTubeActive]}
            onPress={() => onSelectPlatform('youtube')}
          >
            <View style={[styles.logo, styles.youtubeLogo]}><Text style={styles.youtubePlayIcon}>▶</Text></View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>YouTube</Text>
              <Text style={styles.optionCaption}>Khám phá YouTube Shorts</Text>
              <Text style={styles.optionAction}>MỞ SHORTS  →</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Mở TikTok"
            style={[styles.option, currentPlatform === 'tiktok' && styles.optionTikTokActive]}
            onPress={() => onSelectPlatform('tiktok')}
          >
            <View style={[styles.logo, styles.tiktokLogo]}><Text style={styles.tiktokNoteIcon}>♪</Text></View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>TikTok</Text>
              <Text style={styles.optionCaption}>Khám phá TikTok For You</Text>
              <Text style={styles.optionAction}>MỞ FOR YOU  →</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
