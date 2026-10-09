import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { LearningDisplayPreferences } from '../services/learningPreferences';
import { LearningDisplaySettings } from '../components/LearningDisplaySettings';

interface SettingsScreenProps {
  preferences: LearningDisplayPreferences;
  onChange: (patch: Partial<LearningDisplayPreferences>) => void;
  autoPauseEnabled: boolean;
  onToggleAutoPause: () => void;
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ preferences, onChange, autoPauseEnabled, onToggleAutoPause, onBack }) => <ScrollView contentContainerStyle={styles.screen}>
  <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.back}><Text style={styles.backText}>‹  Cá nhân</Text></TouchableOpacity>
  <Text style={styles.eyebrow}>CÀI ĐẶT</Text>
  <Text style={styles.title}>Trải nghiệm học</Text>
  <Text style={styles.copy}>Điều chỉnh phụ đề và hành vi học. Các thay đổi được lưu trên thiết bị này.</Text>
  <View style={styles.card}><LearningDisplaySettings preferences={preferences} onChange={onChange} /></View>
  <View style={[styles.card, styles.row]}><View style={styles.rowCopy}><Text style={styles.cardTitle}>Tự tạm dừng</Text><Text style={styles.cardCopy}>Dừng video khi câu phụ đề kết thúc.</Text></View><Switch value={autoPauseEnabled} onValueChange={onToggleAutoPause} trackColor={{ false: '#334155', true: '#0EA5E9' }} thumbColor="#F8FAFC" /></View>
  <View style={styles.card}><Text style={styles.cardTitle}>Quyền riêng tư</Text><Text style={styles.cardCopy}>Tài khoản ShortLearn, dữ liệu học và phiên YouTube/TikTok được quản lý tách biệt.</Text></View>
</ScrollView>;

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: '#090D16', padding: 20 }, back: { alignSelf: 'flex-start', paddingVertical: 10 }, backText: { color: '#A78BFA', fontSize: 14, fontWeight: '800' }, eyebrow: { color: '#38BDF8', fontWeight: '900', fontSize: 12, letterSpacing: 1.4, marginTop: 12 }, title: { color: '#F8FAFC', fontSize: 28, fontWeight: '900', marginTop: 8 }, copy: { color: '#94A3B8', lineHeight: 21, marginTop: 8, marginBottom: 18 }, card: { backgroundColor: '#111827', borderColor: 'rgba(148,163,184,0.18)', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 }, row: { flexDirection: 'row', alignItems: 'center' }, rowCopy: { flex: 1, paddingRight: 12 }, cardTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' }, cardCopy: { color: '#94A3B8', lineHeight: 20, marginTop: 7 },
});
