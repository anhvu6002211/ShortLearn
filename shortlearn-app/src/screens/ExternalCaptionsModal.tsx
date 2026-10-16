import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { externalCaptions, ExternalCaptionsFilter, ExternalCaptionsStatus } from '../services/externalCaptions';
import { colors, radii, spacing, touchTarget, typography } from '../styles/theme';

interface ExternalCaptionsModalProps { visible: boolean; onClose: () => void; }
const initialStatus: ExternalCaptionsStatus = { supported: false, overlayGranted: false, running: false, state: 'idle', source: 'none', filterLevel: 'balanced', metrics: {} };
const filterOptions: Array<{ value: ExternalCaptionsFilter; label: string }> = [{ value: 'light', label: 'Nhẹ' }, { value: 'balanced', label: 'Cân bằng' }, { value: 'strong', label: 'Mạnh' }];

export const ExternalCaptionsModal: React.FC<ExternalCaptionsModalProps> = ({ visible, onClose }) => {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    try { setStatus(await externalCaptions.getStatus()); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : String(cause)); }
  }, []);
  useEffect(() => {
    if (!visible) return;
    void refresh();
    const subscription = AppState.addEventListener('change', state => state === 'active' && void refresh());
    const timer = setInterval(() => void refresh(), 1500);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [refresh, visible]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setMessage('');
    try { await action(); await refresh(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : String(cause)); await refresh(); }
    finally { setBusy(false); }
  };
  const sourceLabel = status.source === 'microphone' ? 'Microphone' : status.source === 'playback' ? 'Âm thanh nội bộ' : 'Chưa chọn nguồn';
  const stateLabel = status.state === 'running' ? `Đang nhận · ${sourceLabel}` : status.state === 'model_missing' ? `${sourceLabel} · chưa có model` : status.state === 'blocked' ? 'Nguồn đang chặn capture' : status.running ? `Phiên đang chạy · ${sourceLabel}` : 'Chưa chạy';
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.screen}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Quay lại ShortLearn" onPress={onClose} style={styles.back}><Text style={styles.backText}>‹  Quay lại</Text></TouchableOpacity>
        <View style={styles.hero}><Text style={styles.eyebrow}>SHORTLEARN LAB · ANDROID</Text><Text style={styles.title}>Phụ đề ngoài ứng dụng</Text><Text style={styles.status}>{stateLabel}</Text><Text style={styles.description}>ShortLearn xin quyền cho từng phiên, tạo foreground service và hiển thị overlay thật trên ứng dụng video khác.</Text></View>
        <View style={styles.notice}><Text style={styles.noticeTitle}>Kiểm tra thiết bị</Text><Text style={styles.noticeText}>Android 10+: {status.supported ? 'Hỗ trợ' : 'Không hỗ trợ'}{`\n`}Hiển thị trên ứng dụng khác: {status.overlayGranted ? 'Đã cấp' : 'Chưa cấp'}{`\n`}MediaProjection: luôn hỏi lại khi bắt đầu</Text></View>
        <Text style={styles.filterTitle}>Smart Filter</Text>
        <View accessibilityRole="radiogroup" style={styles.filters}>{filterOptions.map(option => <TouchableOpacity key={option.value} accessibilityRole="radio" accessibilityState={{ checked: status.filterLevel === option.value }} disabled={busy} onPress={() => void run(() => externalCaptions.setFilterLevel(option.value))} style={[styles.filter, status.filterLevel === option.value && styles.filterActive]}><Text style={[styles.filterText, status.filterLevel === option.value && styles.filterTextActive]}>{option.label}</Text></TouchableOpacity>)}</View>
        {!status.overlayGranted && <TouchableOpacity disabled={busy} onPress={() => void run(() => externalCaptions.requestOverlayPermission())} style={styles.primary}><Text style={styles.primaryText}>Cấp quyền hiển thị nổi</Text></TouchableOpacity>}
        {status.overlayGranted && !status.running && <TouchableOpacity disabled={busy || !status.supported} onPress={() => void run(() => externalCaptions.start())} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Đang mở xác nhận…' : 'Bắt đầu bằng âm thanh nội bộ'}</Text></TouchableOpacity>}
        {status.running && status.state === 'blocked' && status.source === 'playback' && <TouchableOpacity disabled={busy} onPress={() => void run(() => externalCaptions.startMicrophone())} style={styles.fallback}><Text style={styles.primaryText}>Dùng microphone thay thế</Text></TouchableOpacity>}
        {status.running && <TouchableOpacity disabled={busy} onPress={() => void run(() => externalCaptions.stop())} style={styles.stop}><Text style={styles.primaryText}>Dừng phiên phụ đề</Text></TouchableOpacity>}
        {!!message && <Text accessibilityLiveRegion="polite" style={styles.error}>{message}</Text>}
        <View style={styles.next}><Text style={styles.nextTitle}>M3 đang kiểm thử</Text><Text style={styles.nextText}>PCM và Whisper chạy native/offline. Microphone chỉ bật khi bạn chọn nút dự phòng; ShortLearn không tự chuyển nguồn và không upload audio.</Text></View>
      </ScrollView>
    </Modal>
  );
};

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
  filterTitle: { color: colors.text, fontSize: 13, fontWeight: '900', marginBottom: spacing.sm },
  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  filter: { flex: 1, minHeight: touchTarget, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  filterTextActive: { color: colors.primaryLight },
  primary: { minHeight: touchTarget, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  fallback: { minHeight: touchTarget, marginBottom: spacing.sm, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C3AED' },
  stop: { minHeight: touchTarget, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: '#BE123C' },
  primaryText: { color: '#ffffff', fontSize: typography.bodyMedium, fontWeight: '900' },
  error: { color: '#fb7185', fontSize: 13, lineHeight: 20, marginTop: spacing.md },
  next: { backgroundColor: colors.surfaceElevated, borderRadius: radii.xl, padding: spacing.md, marginTop: spacing.lg },
  nextTitle: { color: colors.text, fontWeight: '900', fontSize: typography.bodyMedium },
  nextText: { color: colors.textMuted, fontSize: 13, lineHeight: 21, marginTop: 8 },
});
