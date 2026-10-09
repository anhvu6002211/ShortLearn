import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LearningDisplaySettings } from '../components/LearningDisplaySettings';
import { LearningDisplayPreferences } from '../services/learningPreferences';
import { VideoPlatform } from '../services/videoPlatform';
import { YouTubeSession } from '../services/youtubeAuth';
import { useAuth } from '../providers/AuthProvider';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';

interface AccountScreenProps {
  accountPlatform: VideoPlatform;
  isDisconnectingYouTube: boolean;
  isExpoGo: boolean;
  isGoogleOAuthConfigured: boolean;
  isLoadingYouTubeSession: boolean;
  isSigningInYouTube: boolean;
  learningDisplayPreferences: LearningDisplayPreferences;
  youTubeNotice: string | null;
  youTubeSession: YouTubeSession | null;
  onAccountPlatformChange: (platform: VideoPlatform) => void;
  onDisconnectYouTube: () => void | Promise<void>;
  onLearningDisplayChange: (patch: Partial<LearningDisplayPreferences>) => void;
  onOpenSettings: () => void;
  onOpenTikTok: () => void;
  onOpenOnboarding: () => void;
  onOpenYouTube: () => void;
  onSignInYouTube: () => void | Promise<void>;
  savedCount: number;
  dueCount: number;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  accountPlatform,
  isDisconnectingYouTube,
  isExpoGo,
  isGoogleOAuthConfigured,
  isLoadingYouTubeSession,
  isSigningInYouTube,
  learningDisplayPreferences,
  youTubeNotice,
  youTubeSession,
  onAccountPlatformChange,
  onDisconnectYouTube,
  onLearningDisplayChange,
  onOpenSettings,
  onOpenTikTok,
  onOpenOnboarding,
  onOpenYouTube,
  onSignInYouTube,
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
  return (
  <ScrollView contentContainerStyle={styles.accountView}>
    <View style={styles.accountHero}>
      <View style={styles.accountHeroPlatforms}>
        <View style={[styles.accountHeroPlatformIcon, styles.accountHeroYouTubeIcon]}>
          <Text style={styles.accountHeroYouTubeGlyph}>▶</Text>
        </View>
        <View style={[styles.accountHeroPlatformIcon, styles.accountHeroTikTokIcon]}>
          <Text style={styles.accountHeroTikTokGlyph}>♪</Text>
        </View>
      </View>
      <Text style={styles.accountTitle}>Cá nhân</Text>
      <Text style={styles.accountDescription}>
        Hồ sơ ShortLearn, cài đặt học và các phiên nền tảng của bạn.
      </Text>
      <View style={styles.shortLearnProfileCard}>
        <View style={styles.shortLearnAvatar}><Text style={styles.shortLearnAvatarText}>{isAuthenticated ? (session?.user.displayName || session?.user.email || 'S').slice(0, 1).toUpperCase() : 'K'}</Text></View>
        <View style={styles.shortLearnProfileCopy}>
          <Text style={styles.shortLearnProfileName}>{isAuthenticated ? (session?.user.displayName || 'Người học ShortLearn') : 'Chế độ Khách'}</Text>
          <Text style={styles.shortLearnProfileEmail}>{isAuthenticated ? session?.user.email : 'Đăng nhập để đồng bộ từ vựng và lịch ôn.'}</Text>
        </View>
      </View>
      <View style={styles.learningStats}>
        <View style={styles.stat}><Text style={styles.statValue}>{savedCount}</Text><Text style={styles.statLabel}>Từ đã lưu</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{dueCount}</Text><Text style={styles.statLabel}>Thẻ đến hạn</Text></View>
      </View>
      {isAuthenticated ? <Text style={styles.statsHint}>Streak và lịch sử học sẽ hiển thị khi API tiến độ sẵn sàng.</Text> : null}
      {isAuthenticated ? (
        <>
          <Text style={styles.shortLearnAccountText}>{session?.user.email}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={signOut} style={styles.shortLearnSignOutButton}>
            <Text style={styles.shortLearnSignOutText}>Đăng xuất ShortLearn</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.navigate('SignIn')}
          style={styles.shortLearnSignInButton}
        >
          <Text style={styles.shortLearnSignInText}>Đăng nhập hoặc đổi tài khoản ShortLearn</Text>
        </TouchableOpacity>
      )}
    </View>

    <View style={styles.accountPlatformSwitcher}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: accountPlatform === 'youtube' }}
        onPress={() => onAccountPlatformChange('youtube')}
        style={[
          styles.accountPlatformButton,
          accountPlatform === 'youtube' && styles.accountPlatformYouTubeActive,
        ]}
      >
        <View style={[styles.accountPlatformLogo, styles.accountPlatformLogoYouTube]}>
          <Text style={styles.accountPlatformYouTubeGlyph}>▶</Text>
        </View>
        <View style={styles.accountPlatformCopy}>
          <Text style={styles.accountPlatformName}>YouTube</Text>
          <Text style={styles.accountPlatformStatus}>
            {youTubeSession ? 'Đã liên kết' : 'Tài khoản Google'}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: accountPlatform === 'tiktok' }}
        onPress={() => onAccountPlatformChange('tiktok')}
        style={[
          styles.accountPlatformButton,
          accountPlatform === 'tiktok' && styles.accountPlatformTikTokActive,
        ]}
      >
        <View style={[styles.accountPlatformLogo, styles.accountPlatformLogoTikTok]}>
          <Text style={styles.accountPlatformTikTokGlyph}>♪</Text>
        </View>
        <View style={styles.accountPlatformCopy}>
          <Text style={styles.accountPlatformName}>TikTok</Text>
          <Text style={styles.accountPlatformStatus}>Phiên WebView</Text>
        </View>
      </TouchableOpacity>
    </View>

    {accountPlatform === 'youtube' ? (
      <>
        {isLoadingYouTubeSession ? (
          <View style={styles.accountCard}>
            <ActivityIndicator color="#38BDF8" />
            <Text style={styles.accountLoadingText}>Đang kiểm tra phiên đăng nhập...</Text>
          </View>
        ) : youTubeSession ? (
          <View style={styles.accountCard}>
            <View style={styles.accountIdentityRow}>
              <View style={styles.accountAvatar}>
                <Text style={styles.accountAvatarText}>
                  {youTubeSession.account.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.accountIdentityText}>
                <Text style={styles.accountConnected}>Đã liên kết YouTube</Text>
                <Text style={styles.accountName}>
                  {youTubeSession.account.channelTitle || youTubeSession.account.displayName}
                </Text>
                {youTubeSession.account.email && (
                  <Text style={styles.accountEmail}>{youTubeSession.account.email}</Text>
                )}
              </View>
            </View>

            <TouchableOpacity style={styles.youTubeOpenButton} onPress={onOpenYouTube}>
              <Text style={styles.youTubeOpenButtonText}>▶  Mở YouTube</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.accountSecondaryButton}
              onPress={onSignInYouTube}
              disabled={isSigningInYouTube || isDisconnectingYouTube}
            >
              <Text style={styles.accountSecondaryButtonText}>Đổi tài khoản</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.accountDisconnectButton}
              onPress={onDisconnectYouTube}
              disabled={isSigningInYouTube || isDisconnectingYouTube}
            >
              {isDisconnectingYouTube ? (
                <ActivityIndicator color="#FCA5A5" />
              ) : (
                <Text style={styles.accountDisconnectButtonText}>Ngắt liên kết</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.accountCard}>
            <Text style={styles.accountCardEyebrow}>YOUTUBE</Text>
            <Text style={styles.accountCardTitle}>Chưa liên kết tài khoản</Text>
            <Text style={styles.accountCardDescription}>
              Đăng nhập Google để cho phép ShortLearn đọc thông tin kênh YouTube cơ bản của bạn.
            </Text>
            <TouchableOpacity
              style={[
                styles.googleLoginButton,
                (isSigningInYouTube || isDisconnectingYouTube) && styles.disabledButton,
              ]}
              onPress={onSignInYouTube}
              disabled={isSigningInYouTube || isDisconnectingYouTube}
            >
              {isSigningInYouTube ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.googleLoginButtonText}>G  Đăng nhập với Google</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.youTubeOpenButton} onPress={onOpenYouTube}>
              <Text style={styles.youTubeOpenButtonText}>▶  Mở YouTube để đăng nhập</Text>
            </TouchableOpacity>
            <Text style={styles.accountYouTubeHint}>
              Đăng nhập trong YouTube dùng cho phiên xem. Để liên kết dữ liệu kênh với ShortLearn, hãy dùng nút Google phía trên.
            </Text>
          </View>
        )}

        {(isExpoGo || !isGoogleOAuthConfigured) && (
          <View style={styles.accountNotice}>
            <Text style={styles.accountNoticeTitle}>Thiết lập YouTube còn thiếu</Text>
            <Text style={styles.accountNoticeText}>
              {isExpoGo
                ? 'Đăng nhập Google cần development build; Expo Go chỉ dùng để xem giao diện này.'
                : 'Cần thêm Web OAuth Client ID vào .env, sau đó khởi động lại Metro và tải lại ứng dụng.'}
            </Text>
          </View>
        )}

        {youTubeNotice && <Text style={styles.accountStatusText}>{youTubeNotice}</Text>}
      </>
    ) : (
      <View style={styles.accountCard}>
        <View style={styles.accountIdentityRow}>
          <View style={[styles.accountAvatar, styles.accountAvatarTikTok]}>
            <Text style={styles.accountAvatarTikTokText}>♪</Text>
          </View>
          <View style={styles.accountIdentityText}>
            <Text style={styles.accountTikTokMode}>ĐĂNG NHẬP TRONG WEBVIEW</Text>
            <Text style={styles.accountName}>Tài khoản TikTok</Text>
            <Text style={styles.accountEmail}>Phiên được lưu trong trình duyệt ứng dụng</Text>
          </View>
        </View>
        <Text style={styles.accountCardDescription}>
          Mở TikTok rồi đăng nhập trực tiếp trên trang chính thức. ShortLearn không nhận hoặc lưu mật khẩu TikTok của bạn.
        </Text>
        <TouchableOpacity style={styles.tikTokLoginButton} onPress={onOpenTikTok}>
          <Text style={styles.tikTokLoginButtonText}>♪  Mở TikTok để đăng nhập</Text>
        </TouchableOpacity>
        <Text style={styles.accountTikTokHint}>
          Sau khi đăng nhập, bạn có thể xem Shorts TikTok và phụ đề trong cùng phiên này.
        </Text>
      </View>
    )}

    <LearningDisplaySettings
      preferences={learningDisplayPreferences}
      onChange={onLearningDisplayChange}
    />

    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Mở cài đặt ShortLearn"
      onPress={onOpenSettings}
      style={styles.settingsButton}
    >
      <Text style={styles.settingsButtonText}>Cài đặt ShortLearn</Text>
    </TouchableOpacity>

    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Xem lại hướng dẫn ShortLearn"
      onPress={onOpenOnboarding}
      style={styles.onboardingButton}
    >
      <Text style={styles.onboardingButtonText}>Xem lại hướng dẫn ShortLearn</Text>
    </TouchableOpacity>

    <Text style={styles.accountPrivacyText}>
      {accountPlatform === 'youtube'
        ? 'YouTube dùng bộ chọn tài khoản Google của hệ thống và chỉ yêu cầu quyền đọc. Phiên truy cập được mã hóa trong bộ nhớ an toàn của thiết bị.'
        : 'TikTok đăng nhập trên trang chính thức trong WebView. Cookie phiên được giữ trong trình duyệt ứng dụng; ShortLearn không đọc mật khẩu của bạn.'}
    </Text>
  </ScrollView>
  );
};

const styles = StyleSheet.create({
  accountView: { flexGrow: 1, backgroundColor: '#090D16', padding: 20 },
  accountHero: { alignItems: 'center', marginTop: 28, marginBottom: 22 },
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
  accountTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '800' },
  accountDescription: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  shortLearnSignInButton: { marginTop: 16, minHeight: 42, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#6D5BD0', alignItems: 'center', justifyContent: 'center' },
  shortLearnSignInText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  shortLearnProfileCard: { width: '100%', flexDirection: 'row', alignItems: 'center', marginTop: 18, padding: 13, borderRadius: 16, backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)' },
  shortLearnAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6D5BD0', marginRight: 11 },
  shortLearnAvatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  shortLearnProfileCopy: { flex: 1 },
  shortLearnProfileName: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  shortLearnProfileEmail: { color: '#94A3B8', fontSize: 12, marginTop: 3 },
  learningStats: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 10 },
  stat: { flex: 1, borderRadius: 12, paddingVertical: 10, backgroundColor: 'rgba(56,189,248,0.08)', alignItems: 'center' },
  statValue: { color: '#E0F2FE', fontSize: 19, fontWeight: '900' },
  statLabel: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  statsHint: { color: '#64748B', fontSize: 11, textAlign: 'center', marginTop: 9 },
  shortLearnAccountText: { color: '#94A3B8', fontSize: 13, marginTop: 14 },
  shortLearnSignOutButton: { marginTop: 8, minHeight: 40, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(248, 113, 113, 0.7)', alignItems: 'center', justifyContent: 'center' },
  shortLearnSignOutText: { color: '#FCA5A5', fontSize: 14, fontWeight: '800' },
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
  accountPlatformStatus: { color: '#94A3B8', fontSize: 10, lineHeight: 14, marginTop: 2 },
  accountCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
  },
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
  tikTokLoginButton: {
    minHeight: 49,
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
  disabledButton: { opacity: 0.55 },
});
