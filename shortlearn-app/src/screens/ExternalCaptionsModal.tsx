import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WhisperMicPoc } from '../components/WhisperMicPoc';
import { colors, radii, spacing, touchTarget, typography } from '../styles/theme';

interface ExternalCaptionsModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Bước thử nghiệm STT cục bộ cho chế độ phụ đề ngoài ứng dụng.
 * Chưa có overlay/MediaProjection/foreground service; không quảng cáo là Live Caption.
 */
export const ExternalCaptionsModal: React.FC<ExternalCaptionsModalProps> = ({ visible, onClose }) => (
  <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <ScrollView contentContainerStyle={styles.screen}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Quay lại ShortLearn"
        onPress={onClose}
        style={styles.back}
      >
        <Text style={styles.backText}>‹  Quay lại</Text>
      </TouchableOpacity>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SHORTLEARN LAB · ANDROID</Text>
        <Text style={styles.title}>Phụ đề ngoài ứng dụng</Text>
        <Text style={styles.status}>Bản thử nghiệm — chưa có phụ đề nổi</Text>
        <Text style={styles.description}>
          Mục tiêu: đọc lời nói khi xem video trong ứng dụng gốc và hiển thị phụ đề Anh–Việt,
          tra từ, lưu vào Flashcard. Không cần đăng nhập YouTube/TikTok bằng WebView.
        </Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Hiện tại chạy được gì?</Text>
        <Text style={styles.noticeText}>
          Bạn có thể thử nhận diện giọng nói bằng microphone ngay trong ShortLearn.
          Khi rời màn hình, thử nghiệm này sẽ dừng. Chưa thu âm thanh nội bộ,
          chưa hiển thị chữ trên các ứng dụng khác và chưa dịch song ngữ.
        </Text>
      </View>

      <WhisperMicPoc />

      <View style={styles.next}>
        <Text style={styles.nextTitle}>Để hoạt động giống Hearth cần bổ sung</Text>
        <Text style={styles.nextText}>
          Android foreground service và quyền hiển thị trên ứng dụng khác; AudioPlaybackCapture
          qua MediaProjection khi ứng dụng phát video cho phép; đồng bộ STT, dịch và Flashcard.
          Cần kiểm thử cả khi đeo tai nghe Bluetooth và lúc app chạy nền.
        </Text>
      </View>
    </ScrollView>
  </Modal>
);

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: colors.canvas, padding: spacing.lg, paddingBottom: 36 },
  back: { alignSelf: 'flex-start', minHeight: touchTarget, justifyContent: 'center' },
  backText: { color: colors.primaryLight, fontSize: typography.bodyMedium, fontWeight: '800' },
  hero: { marginTop: spacing.md, marginBottom: spacing.lg },
  eyebrow: { color: colors.primary, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 9 },
  status: { color: '#FBBF24', fontSize: 13, fontWeight: '800', marginTop: 10 },
  description: { color: colors.textMuted, fontSize: typography.bodyMedium, lineHeight: 23, marginTop: 12 },
  notice: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg },
  noticeTitle: { color: colors.text, fontSize: typography.bodyMedium, fontWeight: '900' },
  noticeText: { color: colors.textMuted, fontSize: 13, lineHeight: 21, marginTop: 8 },
  next: { backgroundColor: colors.surfaceElevated, borderRadius: radii.xl, padding: spacing.md, marginTop: spacing.lg },
  nextTitle: { color: colors.text, fontWeight: '900', fontSize: typography.bodyMedium },
  nextText: { color: colors.textMuted, fontSize: 13, lineHeight: 21, marginTop: 8 },
});
