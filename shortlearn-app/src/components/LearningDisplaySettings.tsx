import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { LearningDisplayPreferences } from '../services/learningPreferences';

interface LearningDisplaySettingsProps {
  preferences: LearningDisplayPreferences;
  onChange: (patch: Partial<LearningDisplayPreferences>) => void;
}

const VOCABULARY_SIZES = [1_000, 3_000, 5_000, 10_000];

const SettingRow: React.FC<{
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}> = ({ title, description, value, onValueChange }) => (
  <View style={styles.settingRow}>
    <View style={styles.settingCopy}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingDescription}>{description}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#334155', true: '#C76A1B' }}
      thumbColor={value ? '#FFB46F' : '#94A3B8'}
    />
  </View>
);

export const LearningDisplaySettings: React.FC<LearningDisplaySettingsProps> = ({
  preferences,
  onChange,
}) => (
  <View style={styles.card}>
    <Text style={styles.eyebrow}>TỪ VỰNG</Text>
    <Text style={styles.heading}>Hiển thị Giai đoạn học tập</Text>
    <Text style={styles.intro}>
      Màu chữ thể hiện mức độ cần học. Màu thẻ cũ được giữ lại dưới dạng gạch chân.
    </Text>

    <View style={styles.legend}>
      <View style={styles.legendItem}><View style={[styles.dot, styles.dotKnown]} /><Text style={styles.legendText}>Trắng · Đã biết / Gợi ý</Text></View>
      <View style={styles.legendItem}><View style={[styles.dot, styles.dotLearning]} /><Text style={styles.legendText}>Cam · Đang học</Text></View>
      <View style={styles.legendItem}><View style={[styles.dot, styles.dotLater]} /><Text style={styles.legendText}>Xám · Để sau</Text></View>
    </View>

    <SettingRow
      title="Tô màu theo giai đoạn"
      description="Hiển thị trắng, cam hoặc xám trong phụ đề."
      value={preferences.colorizeByLearningStage}
      onValueChange={(value) => onChange({ colorizeByLearningStage: value })}
    />
    <SettingRow
      title="Gạch chân màu thẻ"
      description="Hiển thị nhãn đỏ, xanh lá, vàng và xanh dương."
      value={preferences.showCardLabelUnderlines}
      onValueChange={(value) => onChange({ showCardLabelUnderlines: value })}
    />
    <SettingRow
      title="Nhấn giữ để đổi màu thẻ"
      description="Tương đương thao tác nhấp chuột phải trên máy tính."
      value={preferences.longPressCyclesCardLabel}
      onValueChange={(value) => onChange({ longPressCyclesCardLabel: value })}
    />

    <Text style={styles.vocabularyLabel}>KÍCH THƯỚC TỪ VỰNG ƯỚC TÍNH</Text>
    <View style={styles.sizeRow}>
      {VOCABULARY_SIZES.map((size) => {
        const selected = preferences.knownVocabularySize === size;
        return (
          <TouchableOpacity
            key={size}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange({ knownVocabularySize: size })}
            style={[styles.sizeButton, selected && styles.sizeButtonSelected]}
          >
            <Text style={[styles.sizeText, selected && styles.sizeTextSelected]}>
              {size >= 1_000 ? `${size / 1_000}k` : size}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 18,
    marginTop: 16,
  },
  eyebrow: { color: '#FFB46F', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  heading: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginTop: 5 },
  intro: { color: '#94A3B8', fontSize: 13, lineHeight: 19, marginTop: 6 },
  legend: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 11,
    gap: 7,
    marginTop: 14,
    marginBottom: 7,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 9 },
  dotKnown: { backgroundColor: '#F4F5F7' },
  dotLearning: { backgroundColor: '#FF9D42' },
  dotLater: { backgroundColor: '#777C84' },
  legendText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  settingRow: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  settingCopy: { flex: 1, paddingRight: 12 },
  settingTitle: { color: '#E2E8F0', fontSize: 14, fontWeight: '700' },
  settingDescription: { color: '#7F8CA1', fontSize: 11, lineHeight: 16, marginTop: 2 },
  vocabularyLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 0.7, marginTop: 16 },
  sizeRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  sizeButton: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeButtonSelected: { borderColor: '#FF9D42', backgroundColor: 'rgba(255, 157, 66, 0.12)' },
  sizeText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  sizeTextSelected: { color: '#FFB46F' },
});
