import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { VideoPlatform } from '../services/videoPlatform';

interface ShortUrlPickerProps {
  visible: boolean;
  platform: VideoPlatform;
  urlInput: string;
  error: string | null;
  onClose: () => void;
  onOpen: () => void;
  onUrlChange: (value: string) => void;
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: '#0B0F19',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#475569', alignSelf: 'center', marginBottom: 14 },
  title: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  description: { color: '#94A3B8', fontSize: 13, marginTop: 6, marginBottom: 14, lineHeight: 20 },
  platformRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  platformButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148,163,184,0.25)', backgroundColor: '#111827' },
  platformButtonActive: { borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.10)' },
  platformIconYoutube: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FF0033', alignItems: 'center', justifyContent: 'center' },
  platformIconTiktok: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#050505', borderWidth: 1, borderColor: '#25F4EE', alignItems: 'center', justifyContent: 'center' },
  platformPlay: { color: '#FFF', fontSize: 12, marginLeft: 2 },
  platformNote: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  platformLabel: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F1F5F9',
    fontSize: 14,
  },
  inputError: { borderColor: '#FB7185' },
  errorText: { color: '#FB7185', fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelButton: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  cancelText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  openButton: { flex: 1.4, paddingVertical: 13, borderRadius: 12, backgroundColor: '#38BDF8', alignItems: 'center' },
  openText: { color: '#082F49', fontSize: 14, fontWeight: '800' },
});

export const ShortUrlPickerModal: React.FC<ShortUrlPickerProps> = ({
  visible,
  platform,
  urlInput,
  error,
  onClose,
  onOpen,
  onUrlChange,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.title}>Mở YouTube Short</Text>
          <Text style={styles.description}>Dán liên kết YouTube Shorts, video YouTube hoặc mã video.</Text>
          <TextInput
            value={urlInput}
            onChangeText={onUrlChange}
            placeholder="https://youtube.com/shorts/..."
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={onOpen}
            style={[styles.input, error && styles.inputError]}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.openButton} onPress={onOpen}>
              <Text style={styles.openText}>Mở YouTube</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);
