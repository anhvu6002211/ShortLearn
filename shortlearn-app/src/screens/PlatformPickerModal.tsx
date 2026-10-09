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
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.72)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: '#0B0F19',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  description: { color: '#94A3B8', fontSize: 13, marginTop: 4 },
  closeButton: { padding: 8 },
  closeText: { color: '#94A3B8', fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  option: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 16,
    alignItems: 'center',
  },
  optionYouTubeActive: { borderColor: '#FF335F', backgroundColor: 'rgba(255, 0, 51, 0.10)' },
  optionTikTokActive: { borderColor: '#25F4EE', backgroundColor: 'rgba(37, 244, 238, 0.08)' },
  logo: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  youtubeLogo: { backgroundColor: '#FF0033' },
  tiktokLogo: { backgroundColor: '#050505', borderWidth: 2, borderColor: '#25F4EE' },
  youtubePlayIcon: { color: '#FFFFFF', fontSize: 22 },
  tiktokNoteIcon: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  optionTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  optionCaption: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
});

export const PlatformPickerModal: React.FC<PlatformPickerProps> = ({
  visible,
  currentPlatform,
  onClose,
  onSelectPlatform,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Đóng bộ chọn nền tảng"
        activeOpacity={1}
        style={StyleSheet.absoluteFill}
        onPress={onClose}
      />
      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Chọn nền tảng Shorts</Text>
            <Text style={styles.description}>Bạn muốn học với video từ đâu?</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đóng" style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Mở YouTube Shorts"
            style={[styles.option, currentPlatform === 'youtube' && styles.optionYouTubeActive]}
            onPress={() => onSelectPlatform('youtube')}
          >
            <View style={[styles.logo, styles.youtubeLogo]}><Text style={styles.youtubePlayIcon}>▶</Text></View>
            <Text style={styles.optionTitle}>YouTube</Text>
            <Text style={styles.optionCaption}>Shorts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Mở TikTok"
            style={[styles.option, currentPlatform === 'tiktok' && styles.optionTikTokActive]}
            onPress={() => onSelectPlatform('tiktok')}
          >
            <View style={[styles.logo, styles.tiktokLogo]}><Text style={styles.tiktokNoteIcon}>♪</Text></View>
            <Text style={styles.optionTitle}>TikTok</Text>
            <Text style={styles.optionCaption}>For You</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
