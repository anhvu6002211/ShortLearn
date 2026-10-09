import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GoogleSignin, isCancelledResponse } from '@react-native-google-signin/google-signin';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiRequest, getApiError } from '../services/api';
import { AuthResponse, useAuth } from '../providers/AuthProvider';
import { AuthStackParamList } from '../navigation/types';

type AuthNav = NativeStackNavigationProp<AuthStackParamList>;

// Màn hình đăng nhập tối giản: dùng email/mật khẩu thật qua POST /auth/login.
// Nút Khách cho phép xem Shorts/tra từ mà không cần tài khoản — không nạp session.
export const SignInScreen: React.FC = () => {
  const navigation = useNavigation<AuthNav>();
  const { establishSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const goToMain = () => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }),
    );
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Vui lòng nhập email và mật khẩu.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await apiRequest(
        '/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: trimmedEmail,
            password,
            device: { platform: Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web' },
          }),
        },
        8000,
      );
      if (!response.ok) {
        const error = await getApiError(response);
        setErrorMessage(response.status === 403 ? 'Email chưa xác minh. Hãy gửi lại mã OTP.' : error);
        return;
      }
      const payload = (await response.json()) as AuthResponse;
      establishSession(payload);
      goToMain();
    } catch {
      setErrorMessage('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Nhập email để gửi lại mã OTP.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await apiRequest('/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, purpose: 'verify_email' }),
      }, 8000);
      if (!response.ok) {
        setErrorMessage(await getApiError(response));
        return;
      }
      const payload = await response.json() as { challenge_id?: string };
      if (!payload.challenge_id) throw new Error('Missing OTP challenge.');
      navigation.navigate('Otp', { email: trimmedEmail, purpose: 'signup', challengeId: payload.challenge_id });
    } catch {
      setErrorMessage('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      setErrorMessage('Đăng nhập Google chưa được cấu hình cho ứng dụng này.');
      return;
    }
    setIsGoogleSubmitting(true);
    setErrorMessage(null);
    try {
      GoogleSignin.configure({ webClientId });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (isCancelledResponse(result)) return;
      const idToken = result.data?.idToken;
      if (!idToken) throw new Error('Google did not return an ID token.');
      const response = await apiRequest('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, device: { platform: Platform.OS } }),
      }, 8000);
      if (!response.ok) return setErrorMessage(await getApiError(response));
      establishSession((await response.json()) as AuthResponse);
      goToMain();
    } catch (error) {
      console.warn('Google sign-in failed', error);
      setErrorMessage('Không thể đăng nhập Google. Hãy thử lại sau.');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>ShortLearn</Text>
        <Text style={styles.subtitle}>Đăng nhập để lưu từ và ôn tập.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748B"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          placeholderTextColor="#64748B"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
          onPress={handleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          )}
        </TouchableOpacity>

        {errorMessage === 'Email chưa xác minh. Hãy gửi lại mã OTP.' ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.authLink}
            onPress={handleResendVerification}
            disabled={isSubmitting}
          >
            <Text style={styles.authLinkText}>Gửi lại mã xác minh</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.googleButton, isGoogleSubmitting && styles.disabledButton]}
          onPress={handleGoogleLogin}
          disabled={isGoogleSubmitting || isSubmitting}
        >
          {isGoogleSubmitting ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.googleButtonText}>G  Tiếp tục với Google</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.guestButton} onPress={goToMain}>
          <Text style={styles.guestButtonText}>Tiếp tục với tư cách Khách</Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" style={styles.authLink} onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.authLinkText}>Tạo tài khoản mới</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.authLink} onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.authLinkText}>Quên mật khẩu?</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Chế độ Khách: xem Shorts và tra từ bình thường, không lưu được từ vựng.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    padding: 24,
    justifyContent: 'center',
  },
  title: { color: '#F8FAFC', fontSize: 30, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: '#94A3B8', fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 28 },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
    marginBottom: 12,
  },
  error: { color: '#FCA5A5', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  primaryButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: '#082F49', fontSize: 16, fontWeight: '800' },
  googleButton: { backgroundColor: '#FFFFFF', borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  googleButtonText: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.6 },
  guestButton: {
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  guestButtonText: { color: '#94A3B8', fontSize: 15, fontWeight: '700' },
  authLink: { alignItems: 'center', paddingVertical: 5 },
  authLinkText: { color: '#A78BFA', fontSize: 14, fontWeight: '700' },
  hint: { color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 18, lineHeight: 18 },
});
