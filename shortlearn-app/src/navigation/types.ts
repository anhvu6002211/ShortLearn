import { NavigatorScreenParams } from '@react-navigation/native';
import { VideoPlatform } from '../services/videoPlatform';

export type MainTab = 'shorts' | 'explore' | 'review' | 'account';

export type MainTabsParamList = {
  Shorts: { platform?: VideoPlatform; openPicker?: boolean } | undefined;
  Explore: undefined;
  Review: undefined;
  Account: { platform?: VideoPlatform } | undefined;
};

export type AuthStackParamList = {
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
  Otp: { email: string; purpose: 'signup' | 'password_reset'; challengeId?: string };
  ForgotPassword: { email?: string; resetToken?: string } | undefined;
  Main: NavigatorScreenParams<MainTabsParamList> | undefined;
};
