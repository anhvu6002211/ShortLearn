import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { VideoPlatform, parseVideoTarget } from '../services/videoPlatform';

interface ExploreScreenProps {
  onOpenTarget: (url: string, platform: VideoPlatform) => void;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({ onOpenTarget }) => {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<VideoPlatform>('youtube');
  const [error, setError] = useState<string | null>(null);
  const open = () => {
    if (!parseVideoTarget(url, platform)) {
      setError('Dán liên kết Shorts hoặc TikTok hợp lệ.');
      return;
    }
    setError(null);
    onOpenTarget(url, platform);
  };
  return <View style={styles.screen}>
    <Text style={styles.eyebrow}>KHÁM PHÁ</Text>
    <Text style={styles.title}>Học từ video bạn chọn</Text>
    <Text style={styles.copy}>Dán liên kết YouTube Shorts hoặc TikTok để mở ngay trong ShortLearn.</Text>
    <View style={styles.switcher}>
      {(['youtube', 'tiktok'] as VideoPlatform[]).map((item) => <TouchableOpacity key={item} accessibilityRole="button" onPress={() => setPlatform(item)} style={[styles.platform, platform === item && styles.platformActive]}><Text style={[styles.platformText, platform === item && styles.platformTextActive]}>{item === 'youtube' ? 'YouTube' : 'TikTok'}</Text></TouchableOpacity>)}
    </View>
    <TextInput value={url} onChangeText={setUrl} placeholder="Dán liên kết video" placeholderTextColor="#64748B" autoCapitalize="none" autoCorrect={false} style={styles.input} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <TouchableOpacity accessibilityRole="button" onPress={open} style={styles.openButton}><Text style={styles.openText}>Mở video để học</Text></TouchableOpacity>
  </View>;
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090D16', padding: 24, justifyContent: 'center' },
  eyebrow: { color: '#38BDF8', fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },
  title: { color: '#F8FAFC', fontSize: 28, fontWeight: '900', marginTop: 10 },
  copy: { color: '#94A3B8', fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 24 },
  switcher: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  platform: { flex: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  platformActive: { backgroundColor: '#0C4A6E', borderColor: '#38BDF8' },
  platformText: { color: '#94A3B8', fontWeight: '800' },
  platformTextActive: { color: '#E0F2FE' },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#F8FAFC', paddingHorizontal: 14, fontSize: 15 },
  error: { color: '#FCA5A5', marginTop: 10, fontSize: 13 },
  openButton: { minHeight: 52, backgroundColor: '#38BDF8', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  openText: { color: '#082F49', fontSize: 16, fontWeight: '900' },
});
