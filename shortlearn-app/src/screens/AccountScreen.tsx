import React from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';
import { colors, radii, spacing, touchTarget, typography } from '../styles/theme';

interface AccountScreenProps {
  onOpenSettings: () => void;
  onOpenOnboarding: () => void;
  onLoginTikTok: () => void;
  savedCount: number;
  dueCount: number;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  onOpenSettings,
  onOpenOnboarding,
  onLoginTikTok,
  savedCount,
  dueCount,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { isAuthenticated, session, clearSession } = useAuth();
  const signOut = () => Alert.alert(
    'Đăng xuất ShortLearn?',
    'Phiên đăng nhập sẽ bị xóa khỏi thiết bị này.',
    [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => { clearSession(); navigation.navigate('SignIn'); } },
    ],
  );

  const profileName = isAuthenticated
    ? session?.user.displayName || 'Người học ShortLearn'
    : 'Chế độ Khách';
  const profileEmail = isAuthenticated
    ? session?.user.email
    : 'Đăng nhập để đồng bộ từ vựng và lịch ôn.';
  const avatarLetter = (isAuthenticated ? session?.user.displayName || session?.user.email : 'K')?.slice(0, 1).toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.accountView}>
      <View style={styles.accountHero}>
        <Image accessibilityLabel="Logo ShortLearn" source={require('../../assets/branding/shortlearn-mark.png')} style={styles.heroMark} />
        <Text style={styles.accountTitle}>Cá nhân</Text>
        <Text style={styles.accountDescription}>Không gian học tập được cá nhân hóa cho bạn.</Text>
      </View>

      <View style={styles.shortLearnProfileCard}>
        <View style={styles.shortLearnAvatar}><Text style={styles.shortLearnAvatarText}>{avatarLetter}</Text></View>
        <View style={styles.shortLearnProfileCopy}>
          <View style={styles.profileStatusRow}>
            <Text style={styles.shortLearnProfileName}>{profileName}</Text>
            <View style={styles.profileStatusDot} />
          </View>
          <Text numberOfLines={1} style={styles.shortLearnProfileEmail}>{profileEmail}</Text>
        </View>
      </View>

      <View style={styles.learningStats}>
        <View style={styles.stat}><Text style={styles.statValue}>{savedCount}</Text><Text style={styles.statLabel}>Từ đã lưu</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.stat}><Text style={styles.statValue}>{dueCount}</Text><Text style={styles.statLabel}>Đến hạn hôm nay</Text></View>
      </View>

      {isAuthenticated ? (
        <TouchableOpacity accessibilityRole="button" onPress={signOut} style={styles.shortLearnSignOutButton}>
          <Text style={styles.shortLearnSignOutText}>Đăng xuất ShortLearn</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('SignIn')} style={styles.shortLearnSignInButton}>
          <Text style={styles.shortLearnSignInText}>Đăng nhập ShortLearn</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>TÀI KHOẢN NỀN TẢNG</Text>
      <View style={styles.tikTokAccountCard}>
        <View style={styles.comingSoonIcon}><Text style={styles.comingSoonGlyph}>♪</Text></View>
        <View style={styles.comingSoonCopy}>
          <Text style={styles.comingSoonEyebrow}>TIKTOK WEB</Text>
          <Text style={styles.comingSoonTitle}>Đăng nhập TikTok</Text>
          <Text style={styles.comingSoonText}>Mở trang đăng nhập chính thức trong trình phát. ShortLearn không đọc mật khẩu.</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đăng nhập TikTok" onPress={onLoginTikTok} style={styles.tikTokLoginButton}>
          <Text style={styles.tikTokLoginButtonText}>Đăng nhập</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>TÙY CHỈNH</Text>
      <View style={styles.menuCard}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mở cài đặt học" onPress={onOpenSettings} style={styles.menuRow}>
          <View style={[styles.menuIcon, styles.menuIconSky]}><Text style={styles.menuGlyph}>⚙</Text></View>
          <View style={styles.menuCopy}><Text style={styles.menuTitle}>Cài đặt học</Text><Text style={styles.menuDescription}>Phụ đề, tự dừng và hiển thị</Text></View>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Xem lại hướng dẫn ShortLearn" onPress={onOpenOnboarding} style={styles.menuRow}>
          <View style={[styles.menuIcon, styles.menuIconPurple]}><Text style={styles.menuGlyph}>?</Text></View>
          <View style={styles.menuCopy}><Text style={styles.menuTitle}>Xem lại hướng dẫn</Text><Text style={styles.menuDescription}>Bắt đầu học cùng ShortLearn</Text></View>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.accountPrivacyText}>Dữ liệu học được bảo vệ theo phiên đăng nhập trên thiết bị này.</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  accountView: { flexGrow: 1, backgroundColor: colors.canvas, padding: 20, paddingBottom: 32 },
  accountHero: { alignItems: 'center', marginTop: 20, marginBottom: spacing.xl },
  accountHeroPlatforms: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  accountHeroPlatformIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#090D16',
  },
  accountHeroYouTubeIcon: { backgroundColor: '#FF0033', zIndex: 2 },
  accountHeroTikTokIcon: { backgroundColor: '#050505', marginLeft: -8, borderColor: '#25F4EE' },
  accountHeroYouTubeGlyph: { color: '#FFFFFF', fontSize: 21, marginLeft: 3 },
  accountHeroTikTokGlyph: { color: '#FFFFFF', fontSize: 27, fontWeight: '900' },
  accountTitle: { color: colors.text, fontSize: 26, fontWeight: '800' },
  accountDescription: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  shortLearnSignInButton: { marginTop: spacing.lg, minHeight: touchTarget, paddingHorizontal: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  shortLearnSignInText: { color: '#082F49', fontSize: typography.bodyMedium, fontWeight: '800' },
  shortLearnProfileCard: { width: '100%', flexDirection: 'row', alignItems: 'center', marginTop: 18, padding: 15, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  shortLearnAvatar: { width: 46, height: 46, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, marginRight: spacing.md },
  shortLearnAvatarText: { color: '#082F49', fontSize: 18, fontWeight: '900' },
  shortLearnProfileCopy: { flex: 1 },
  shortLearnProfileName: { color: colors.text, fontSize: typography.bodyMedium, fontWeight: '800' },
  shortLearnProfileEmail: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  learningStats: { width: '100%', flexDirection: 'row', gap: 10, marginTop: spacing.md },
  stat: { flex: 1, borderRadius: radii.xl, paddingVertical: spacing.md, backgroundColor: 'rgba(56,189,248,0.08)', borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center' },
  statValue: { color: colors.primaryLight, fontSize: typography.titleMedium, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: typography.label, marginTop: 2 },
  statsHint: { color: colors.textSubdued, fontSize: typography.label, textAlign: 'center', marginTop: 9 },
  shortLearnAccountText: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: 14 },
  shortLearnSignOutButton: { marginTop: spacing.sm, minHeight: touchTarget, paddingHorizontal: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: 'rgba(248,113,113,0.7)', alignItems: 'center', justifyContent: 'center' },
  shortLearnSignOutText: { color: '#FCA5A5', fontSize: typography.bodyMedium, fontWeight: '800' },
  accountPlatformSwitcher: { flexDirection: 'row', marginBottom: 14, gap: 10 },
  accountPlatformButton: {
    flex: 1,
    minHeight: 74,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountPlatformYouTubeActive: { borderColor: '#FF335F', backgroundColor: 'rgba(255, 0, 51, 0.10)' },
  accountPlatformTikTokActive: { borderColor: '#25F4EE', backgroundColor: 'rgba(37, 244, 238, 0.08)' },
  accountPlatformLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  accountPlatformLogoYouTube: { backgroundColor: '#FF0033' },
  accountPlatformLogoTikTok: { backgroundColor: '#030303', borderWidth: 1, borderColor: 'rgba(37, 244, 238, 0.65)' },
  accountPlatformYouTubeGlyph: { color: '#FFFFFF', fontSize: 15, marginLeft: 2 },
  accountPlatformTikTokGlyph: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  accountPlatformCopy: { flex: 1 },
  accountPlatformName: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  comingSoonCard: { flexDirection: 'row', padding: 16, borderRadius: 18, backgroundColor: 'rgba(37,244,238,0.06)', borderWidth: 1, borderColor: 'rgba(37,244,238,0.24)', marginTop: 2 },
  comingSoonIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(37,244,238,0.55)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  comingSoonGlyph: { color: '#25F4EE', fontSize: 25, fontWeight: '900' },
  comingSoonCopy: { flex: 1 },
  comingSoonEyebrow: { color: '#67E8F9', fontSize: 10, fontWeight: '900', letterSpacing: 1.15 },
  comingSoonTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '900', marginTop: 3 },
  comingSoonText: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 4 },
  accountCardEyebrow: { color: '#FF6B86', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 7 },
  accountLoadingText: { color: '#94A3B8', textAlign: 'center', marginTop: 12, fontSize: 14 },
  accountIdentityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  accountAvatarText: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  accountAvatarTikTok: { backgroundColor: '#050505', borderWidth: 2, borderColor: '#25F4EE' },
  accountAvatarTikTokText: { color: '#FFFFFF', fontSize: 29, fontWeight: '900' },
  accountIdentityText: { flex: 1 },
  accountConnected: { color: '#4ADE80', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  accountName: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  accountEmail: { color: '#94A3B8', fontSize: 13, marginTop: 3 },
  accountTikTokMode: { color: '#25F4EE', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  accountCardTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  accountCardDescription: { color: '#94A3B8', fontSize: 14, lineHeight: 21, marginBottom: 20 },
  googleLoginButton: {
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLoginButtonText: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  youTubeOpenButton: {
    minHeight: 47,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 0, 51, 0.10)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF335F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youTubeOpenButtonText: { color: '#FF8BA3', fontSize: 14, fontWeight: '800' },
  accountYouTubeHint: { color: '#64748B', fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: 4 },
  tikTokAccountCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: 'rgba(37,244,238,0.06)', borderWidth: 1, borderColor: 'rgba(37,244,238,0.24)' },
  tikTokLoginButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    marginLeft: 10,
    backgroundColor: '#050505',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#25F4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tikTokLoginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: '#FE2C55',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  accountTikTokHint: { color: '#64748B', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 13 },
  accountSecondaryButton: {
    minHeight: 45,
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  accountSecondaryButtonText: { color: '#38BDF8', fontSize: 14, fontWeight: '700' },
  accountDisconnectButton: {
    minHeight: 45,
    borderColor: 'rgba(248, 113, 113, 0.7)',
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountDisconnectButtonText: { color: '#FCA5A5', fontSize: 14, fontWeight: '700' },
  accountNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  accountNoticeTitle: { color: '#FBBF24', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  accountNoticeText: { color: '#FDE68A', fontSize: 13, lineHeight: 19 },
  accountStatusText: { color: '#93C5FD', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 16 },
  accountPrivacyText: { color: '#64748B', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 22, paddingHorizontal: 8 },
  onboardingButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.55)', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  onboardingButtonText: { color: '#C4B5FD', fontSize: 14, fontWeight: '800' },
  settingsButton: { minHeight: 46, borderRadius: 12, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  settingsButtonText: { color: '#DBEAFE', fontSize: 14, fontWeight: '800' },
  heroMark: { width: 64, height: 64, resizeMode: 'contain', marginBottom: 14 },
  profileStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  profileStatusDot: { width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.success },
  statDivider: { width: 1, height: 34, alignSelf: 'center', backgroundColor: colors.borderStrong },
  sectionTitle: { color: colors.textSubdued, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.25, marginTop: 26, marginBottom: 10, marginLeft: 4 },
  menuCard: { borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  menuRow: { minHeight: 72, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIcon: { width: 40, height: 40, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  menuIconSky: { backgroundColor: 'rgba(56,189,248,0.14)' },
  menuIconPurple: { backgroundColor: 'rgba(168,85,247,0.14)' },
  menuGlyph: { color: colors.text, fontSize: typography.titleMedium, fontWeight: '800' },
  menuCopy: { flex: 1 },
  menuTitle: { color: colors.text, fontSize: typography.bodyMedium, fontWeight: '800' },
  menuDescription: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  menuChevron: { color: colors.textSubdued, fontSize: 28, lineHeight: 30, marginLeft: 10 },
  disabledButton: { opacity: 0.55 },
});
