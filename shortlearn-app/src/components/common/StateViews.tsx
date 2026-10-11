import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, touchTarget, typography } from '../../styles/theme';

interface StateViewProps { title: string; message?: string; }
interface ErrorStateProps extends StateViewProps { onRetry?: () => void; }

export const LoadingState: React.FC<Pick<StateViewProps, 'message'>> = ({ message = 'Đang tải...' }) => (
  <View accessibilityRole="progressbar" style={styles.state}>
    <View style={styles.loadingHalo}><ActivityIndicator color={colors.primary} /></View>
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
  state: { alignItems: 'center', justifyContent: 'center', padding: 28, margin: 16, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 9 },
  loadingHalo: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(56,189,248,0.10)' },
  title: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: '900', textAlign: 'center' },
  message: { color: colors.textMuted, fontSize: typography.bodyMedium, lineHeight: 20, textAlign: 'center' },
  retryButton: { marginTop: 8, minHeight: touchTarget, paddingHorizontal: 18, borderRadius: radii.lg, backgroundColor: colors.primary, justifyContent: 'center' },
  retryText: { color: '#082F49', fontWeight: '900' },
  offlineBanner: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.42)', borderWidth: 1, borderRadius: radii.lg, margin: 12, padding: 11 },
  offlineText: { color: '#FDE68A', fontSize: typography.bodySmall, lineHeight: 18, textAlign: 'center' },
});
