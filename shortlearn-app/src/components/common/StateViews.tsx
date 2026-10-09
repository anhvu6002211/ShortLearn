import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface StateViewProps { title: string; message?: string; }
interface ErrorStateProps extends StateViewProps { onRetry?: () => void; }

export const LoadingState: React.FC<Pick<StateViewProps, 'message'>> = ({ message = 'Đang tải...' }) => (
  <View accessibilityRole="progressbar" style={styles.state}>
    <ActivityIndicator color="#8B5CF6" />
    <Text style={styles.message}>{message}</Text>
  </View>
);

export const EmptyState: React.FC<StateViewProps> = ({ title, message }) => (
  <View style={styles.state}>
    <Text style={styles.title}>{title}</Text>
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>
);

export const ErrorState: React.FC<ErrorStateProps> = ({ title, message, onRetry }) => (
  <View accessibilityRole="alert" style={styles.state}>
    <Text style={styles.title}>{title}</Text>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    {onRetry ? <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Thử lại</Text></TouchableOpacity> : null}
  </View>
);

export const OfflineBanner: React.FC<{ message?: string }> = ({ message = 'Bạn đang ngoại tuyến. Dữ liệu gần nhất vẫn có thể xem được.' }) => (
  <View accessibilityRole="alert" style={styles.offlineBanner}><Text style={styles.offlineText}>{message}</Text></View>
);

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { color: '#E2E8F0', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  message: { color: '#94A3B8', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { marginTop: 6, minHeight: 40, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#6D5BD0', justifyContent: 'center' },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
  offlineBanner: { backgroundColor: 'rgba(245, 158, 11, 0.14)', borderColor: 'rgba(245, 158, 11, 0.5)', borderWidth: 1, borderRadius: 10, margin: 12, padding: 10 },
  offlineText: { color: '#FDE68A', fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
